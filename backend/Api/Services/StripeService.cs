using Stripe;
using Microsoft.EntityFrameworkCore;
using Api.Models;

namespace Api.Services;

public class StripeService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;

    public StripeService(AppDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
        StripeConfiguration.ApiKey = config["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey not configured.");
    }

    public async Task<string> CreateCheckoutSession(int userId, string priceId, string successUrl, string cancelUrl)
    {
        var user = await _context.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("Usuário não encontrado.");

        var customerId = user.StripeCustomerId ?? await EnsureStripeCustomer(user);
        if (priceId == _config["Stripe:PriceIdMonthly"])
            await ApplyPendingCredits(user, customerId);

        var options = new Stripe.Checkout.SessionCreateOptions
        {
            Customer = customerId,
            Mode = "subscription",
            Locale = "pt-BR",
            LineItems = [new Stripe.Checkout.SessionLineItemOptions { Price = priceId, Quantity = 1 }],
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
        };

        var session = await new Stripe.Checkout.SessionService().CreateAsync(options);
        return session.Url;
    }

    public async Task<string> CreatePortalSession(int userId, string returnUrl)
    {
        var user = await _context.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("Usuário não encontrado.");

        if (string.IsNullOrEmpty(user.StripeCustomerId))
            throw new InvalidOperationException("Sem assinatura registrada no Stripe.");

        var session = await new Stripe.BillingPortal.SessionService().CreateAsync(
            new Stripe.BillingPortal.SessionCreateOptions
            {
                Customer = user.StripeCustomerId,
                ReturnUrl = returnUrl,
            });

        return session.Url;
    }

    public async Task HandleWebhookEvent(string json, string stripeSignature)
    {
        var secret = _config["Stripe:WebhookSecret"]
            ?? throw new InvalidOperationException("Stripe:WebhookSecret not configured.");

        var stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, secret);

        switch (stripeEvent.Type)
        {
            case EventTypes.CheckoutSessionCompleted:
                await HandleCheckoutCompleted((Stripe.Checkout.Session)stripeEvent.Data.Object);
                break;
            case EventTypes.CustomerSubscriptionUpdated:
                await HandleSubscriptionUpdated((Subscription)stripeEvent.Data.Object);
                break;
            case EventTypes.CustomerSubscriptionDeleted:
                await HandleSubscriptionDeleted((Subscription)stripeEvent.Data.Object);
                break;
            case EventTypes.InvoicePaymentFailed:
                await HandlePaymentFailed((Invoice)stripeEvent.Data.Object);
                break;
        }
    }

    private async Task HandleCheckoutCompleted(Stripe.Checkout.Session session)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.StripeCustomerId == session.CustomerId);
        if (user == null) return;

        user.SubscriptionStatus = "active";
        await ProcessReferral(user);
        await _context.SaveChangesAsync();
    }

    // Escada mensal (centavos, mensalidade 2990): 1ª = 25%, 2ª completa 50%, 3ª completa 100%.
    private static readonly int[] ReferralLevelTotals = [0, 747, 1495, 2990];

    private async Task ProcessReferral(User user)
    {
        if (!user.ReferredById.HasValue) return;

        var referrer = await _context.Users.FindAsync(user.ReferredById.Value);
        user.ReferredById = null;
        if (referrer == null) return;

        var month = DateTime.UtcNow.ToString("yyyy-MM");
        if (referrer.ReferralMonth != month)
        {
            referrer.ReferralMonth = month;
            referrer.ReferralCountMonth = 0;
        }
        if (referrer.ReferralCountMonth >= 3) return;

        referrer.ReferralCountMonth++;
        var credit = ReferralLevelTotals[referrer.ReferralCountMonth]
                   - ReferralLevelTotals[referrer.ReferralCountMonth - 1];
        await GrantReferralCredit(referrer, credit, user.Email);
    }

    private async Task GrantReferralCredit(User referrer, int amountCents, string referredEmail)
    {
        var planPriceId = await GetActivePlanPriceId(referrer.StripeCustomerId);

        if (planPriceId == null)
        {
            referrer.ReferralCredits += amountCents;
            return;
        }
        if (planPriceId != _config["Stripe:PriceIdMonthly"]) return;

        await new CustomerBalanceTransactionService().CreateAsync(
            referrer.StripeCustomerId,
            new CustomerBalanceTransactionCreateOptions
            {
                Amount = -amountCents,
                Currency = "brl",
                Description = $"Indicação: {referredEmail}",
            });
    }

    private static async Task<string?> GetActivePlanPriceId(string? customerId)
    {
        if (customerId == null) return null;

        var subs = await new SubscriptionService().ListAsync(
            new SubscriptionListOptions { Customer = customerId, Status = "active", Limit = 1 });
        return subs.Data.FirstOrDefault()?.Items?.Data?.FirstOrDefault()?.Price?.Id;
    }

    private async Task HandleSubscriptionUpdated(Subscription sub)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.StripeCustomerId == sub.CustomerId);
        if (user == null) return;

        user.SubscriptionStatus = sub.Status;
        user.SubscriptionEndsAt = sub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        await _context.SaveChangesAsync();
    }

    private async Task HandleSubscriptionDeleted(Subscription sub)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.StripeCustomerId == sub.CustomerId);
        if (user == null) return;

        user.SubscriptionStatus = "canceled";
        user.SubscriptionEndsAt = sub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        await _context.SaveChangesAsync();
    }

    private async Task HandlePaymentFailed(Invoice invoice)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.StripeCustomerId == invoice.CustomerId);
        if (user == null) return;

        user.SubscriptionStatus = "past_due";
        await _context.SaveChangesAsync();
    }

    private async Task<string> EnsureStripeCustomer(User user)
    {
        var customer = await new CustomerService().CreateAsync(
            new CustomerCreateOptions { Email = user.Email });
        user.StripeCustomerId = customer.Id;
        await _context.SaveChangesAsync();
        return customer.Id;
    }

    private async Task ApplyPendingCredits(User user, string customerId)
    {
        if (user.ReferralCredits <= 0) return;

        await new CustomerBalanceTransactionService().CreateAsync(
            customerId,
            new CustomerBalanceTransactionCreateOptions
            {
                Amount = -user.ReferralCredits,
                Currency = "brl",
                Description = "Créditos de indicação acumulados",
            });

        user.ReferralCredits = 0;
        await _context.SaveChangesAsync();
    }
}
