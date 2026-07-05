using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Api.Services;

namespace Api.Controllers;

[ApiController]
[Route("api/subscriptions")]
[Authorize]
public class SubscriptionController : ControllerBase
{
    private readonly StripeService _stripe;
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;

    public SubscriptionController(StripeService stripe, AppDbContext context, IConfiguration config)
    {
        _stripe = stripe;
        _context = context;
        _config = config;
    }

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest request)
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        try
        {
            var url = await _stripe.CreateCheckoutSession(
                GetUserId(),
                request.PriceId,
                $"{frontendUrl}?checkout=success",
                $"{frontendUrl}?checkout=canceled");
            return Ok(new { url });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("portal")]
    public async Task<IActionResult> Portal()
    {
        var frontendUrl = _config["FrontendUrl"] ?? "http://localhost:5173";
        try
        {
            var url = await _stripe.CreatePortalSession(GetUserId(), frontendUrl);
            return Ok(new { url });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var user = await _context.Users.FindAsync(GetUserId());
        if (user == null) return NotFound();

        return Ok(new
        {
            status = user.SubscriptionStatus,
            trialEndsAt = user.TrialEndsAt,
            subscriptionEndsAt = user.SubscriptionEndsAt,
            referralCode = user.ReferralCode,
            referralCredits = user.ReferralCredits,
        });
    }

    private int GetUserId()
    {
        var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(value, out var id))
            throw new InvalidOperationException("User ID claim missing.");
        return id;
    }
}

public record CheckoutRequest(string PriceId);
