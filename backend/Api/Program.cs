using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin))
                    return false;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                    return false;
                if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                    return false;
                if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
                    return true;
                if (System.Net.IPAddress.TryParse(uri.Host, out var ip))
                {
                    var bytes = ip.GetAddressBytes();
                    if (bytes[0] == 192 && bytes[1] == 168) return true;
                    if (bytes[0] == 10) return true;
                    if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
                }
                return uri.Host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.EndsWith(".pages.dev", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.EndsWith(".up.railway.app", StringComparison.OrdinalIgnoreCase);
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors("frontend");

// ── Carriers ──────────────────────────────────────────────────────────────────

app.MapGet("/api/carriers", async (AppDbContext db, bool includeInactive = false) =>
{
    var query = db.Carriers.AsQueryable();
    if (!includeInactive)
        query = query.Where(x => x.IsActive);

    var carriers = await query
        .Include(x => x.PaymentSchedule)
        .OrderBy(x => x.Name)
        .ToListAsync();

    var result = carriers.Select(c => new CarrierResponse(
        c.Id,
        c.Name,
        c.IsActive,
        c.PaymentSchedule != null
            ? new PaymentScheduleResponse(c.PaymentSchedule.Frequency, c.PaymentSchedule.Weekday, c.PaymentSchedule.DayOfMonth, c.PaymentSchedule.WeekStartDay)
            : null,
        c.CreatedAt
    )).ToList();

    return Results.Ok(result);
});

app.MapPost("/api/carriers", async (AppDbContext db, CarrierCreateRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest("Name is required.");

    var nameTrimmed = request.Name.Trim();
    var duplicate = await db.Carriers.AnyAsync(c => c.Name.ToLower() == nameTrimmed.ToLower());
    if (duplicate)
        return Results.Conflict("A carrier with this name already exists.");

    var carrier = new Carrier
    {
        Name = nameTrimmed,
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    db.Carriers.Add(carrier);
    await db.SaveChangesAsync();

    return Results.Created($"/api/carriers/{carrier.Id}", carrier);
});

app.MapPut("/api/carriers/{id:int}", async (AppDbContext db, int id, CarrierUpdateRequest request) =>
{
    var carrier = await db.Carriers.FindAsync(id);
    if (carrier is null)
        return Results.NotFound();

    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest("Name is required.");

    var nameTrimmed = request.Name.Trim();
    var duplicate = await db.Carriers.AnyAsync(c => c.Id != id && c.Name.ToLower() == nameTrimmed.ToLower());
    if (duplicate)
        return Results.Conflict("A carrier with this name already exists.");

    carrier.Name = nameTrimmed;
    carrier.IsActive = request.IsActive;
    await db.SaveChangesAsync();

    return Results.Ok(carrier);
});

app.MapDelete("/api/carriers/{id:int}", async (AppDbContext db, int id) =>
{
    var carrier = await db.Carriers
        .Include(c => c.Routes)
        .FirstOrDefaultAsync(c => c.Id == id);

    if (carrier is null) return Results.Problem("Carrier not found.", statusCode: 404);

    if (carrier.Routes.Count > 0)
        return Results.Problem("Cannot delete a carrier with registered routes. Deactivate it first.", statusCode: 400);

    var schedule = await db.PaymentSchedules.FirstOrDefaultAsync(x => x.CarrierId == id);
    if (schedule is not null) db.PaymentSchedules.Remove(schedule);

    var payments = await db.Payments.Where(x => x.CarrierId == id).ToListAsync();
    db.Payments.RemoveRange(payments);

    db.Carriers.Remove(carrier);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapPatch("/api/carriers/{id:int}/deactivate", async (AppDbContext db, int id) =>
{
    var carrier = await db.Carriers.FindAsync(id);
    if (carrier is null)
        return Results.NotFound();

    carrier.IsActive = false;
    await db.SaveChangesAsync();
    return Results.Ok(carrier);
});

app.MapPatch("/api/carriers/{id:int}/reactivate", async (AppDbContext db, int id) =>
{
    var carrier = await db.Carriers.FindAsync(id);
    if (carrier is null)
        return Results.NotFound();

    carrier.IsActive = true;
    await db.SaveChangesAsync();
    return Results.Ok(carrier);
});

// ── Payment Schedules ─────────────────────────────────────────────────────────

app.MapGet("/api/carriers/{id:int}/payment-schedule", async (AppDbContext db, int id) =>
{
    var schedule = await db.PaymentSchedules.FirstOrDefaultAsync(x => x.CarrierId == id);
    if (schedule is null)
        return Results.NotFound();

    return Results.Ok(new PaymentScheduleResponse(schedule.Frequency, schedule.Weekday, schedule.DayOfMonth, schedule.WeekStartDay));
});

app.MapPut("/api/carriers/{id:int}/payment-schedule", async (AppDbContext db, int id, PaymentScheduleRequest request) =>
{
    var carrier = await db.Carriers.FindAsync(id);
    if (carrier is null)
        return Results.NotFound();

    if (request.Frequency is null || (request.Frequency != "weekly" && request.Frequency != "quinzena"))
        return Results.BadRequest("Invalid frequency. Use 'weekly' or 'quinzena'.");

    if (request.Frequency == "weekly" && (!request.Weekday.HasValue || request.Weekday < 0 || request.Weekday > 6))
        return Results.BadRequest("Weekday is required for 'weekly' and must be between 0 (Sunday) and 6 (Saturday).");

    if (request.Frequency == "quinzena" && (!request.DayOfMonth.HasValue || request.DayOfMonth < 1 || request.DayOfMonth > 31))
        return Results.BadRequest("DayOfMonth is required for 'quinzena' and must be between 1 and 31.");

    var schedule = await db.PaymentSchedules.FirstOrDefaultAsync(x => x.CarrierId == id);
    if (schedule is null)
    {
        schedule = new PaymentSchedule
        {
            CarrierId = id,
            Frequency = request.Frequency,
            Weekday = request.Weekday,
            DayOfMonth = request.DayOfMonth,
            WeekStartDay = request.WeekStartDay,
            CreatedAt = DateTime.UtcNow
        };
        db.PaymentSchedules.Add(schedule);
    }
    else
    {
        schedule.Frequency = request.Frequency;
        schedule.Weekday = request.Weekday;
        schedule.DayOfMonth = request.DayOfMonth;
        schedule.WeekStartDay = request.WeekStartDay;
    }

    await db.SaveChangesAsync();
    return Results.Ok(new PaymentScheduleResponse(schedule.Frequency, schedule.Weekday, schedule.DayOfMonth, schedule.WeekStartDay));
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.MapGet("/api/routes", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? carrierId = null) =>
{
    var query = db.Routes
        .Include(x => x.Carrier)
        .Include(x => x.Discounts)
        .AsQueryable();

    if (startDate.HasValue)
        query = query.Where(x => x.RouteDate >= startDate.Value);
    if (endDate.HasValue)
        query = query.Where(x => x.RouteDate <= endDate.Value);
    if (carrierId.HasValue)
        query = query.Where(x => x.CarrierId == carrierId.Value);

    var routes = await query
        .OrderByDescending(x => x.RouteDate)
        .ThenByDescending(x => x.CreatedAt)
        .Select(x => new RouteResponse(
            x.Id,
            x.CarrierId,
            x.Carrier.Name,
            x.RouteDate,
            x.FixedAmount,
            x.AmountPerPackage,
            x.PackageCount,
            x.TotalAmount,
            x.Discounts.Sum(d => d.DiscountAmount),
            x.TotalAmount - x.Discounts.Sum(d => d.DiscountAmount),
            x.CreatedAt
        ))
        .ToListAsync();

    return Results.Ok(routes);
});

app.MapPost("/api/routes", async (AppDbContext db, RouteCreateRequest request) =>
{
    var carrier = await db.Carriers.FindAsync(request.CarrierId);
    if (carrier is null || !carrier.IsActive)
        return Results.BadRequest("Invalid or inactive carrier.");

    var validation = ValidateRouteFinancials(request.FixedAmount, request.AmountPerPackage, request.PackageCount);
    if (!validation.IsValid)
        return Results.BadRequest(validation.ErrorMessage);

    var route = new DeliveryRoute
    {
        CarrierId = request.CarrierId,
        RouteDate = request.RouteDate,
        FixedAmount = request.FixedAmount,
        AmountPerPackage = request.AmountPerPackage,
        PackageCount = request.PackageCount,
        TotalAmount = CalculateTotalAmount(request.FixedAmount, request.AmountPerPackage, request.PackageCount),
        CreatedAt = DateTime.UtcNow
    };

    db.Routes.Add(route);
    await db.SaveChangesAsync();

    return Results.Created($"/api/routes/{route.Id}", route);
});

app.MapPut("/api/routes/{id:int}", async (AppDbContext db, int id, RouteCreateRequest request) =>
{
    var route = await db.Routes.FindAsync(id);
    if (route is null)
        return Results.NotFound();

    var carrier = await db.Carriers.FindAsync(request.CarrierId);
    if (carrier is null || !carrier.IsActive)
        return Results.BadRequest("Invalid or inactive carrier.");

    var validation = ValidateRouteFinancials(request.FixedAmount, request.AmountPerPackage, request.PackageCount);
    if (!validation.IsValid)
        return Results.BadRequest(validation.ErrorMessage);

    route.CarrierId = request.CarrierId;
    route.RouteDate = request.RouteDate;
    route.FixedAmount = request.FixedAmount;
    route.AmountPerPackage = request.AmountPerPackage;
    route.PackageCount = request.PackageCount;
    route.TotalAmount = CalculateTotalAmount(request.FixedAmount, request.AmountPerPackage, request.PackageCount);
    await db.SaveChangesAsync();

    return Results.Ok(route);
});

// ── Discounts ─────────────────────────────────────────────────────────────────

app.MapGet("/api/discounts", async (AppDbContext db, int? routeId = null, DateOnly? startDate = null, DateOnly? endDate = null) =>
{
    var query = db.Discounts
        .Include(x => x.Route)
        .ThenInclude(r => r.Carrier)
        .AsQueryable();

    if (routeId.HasValue)
        query = query.Where(x => x.RouteId == routeId.Value);
    if (startDate.HasValue)
        query = query.Where(x => x.DiscountDate >= startDate.Value);
    if (endDate.HasValue)
        query = query.Where(x => x.DiscountDate <= endDate.Value);

    var discounts = await query
        .OrderByDescending(x => x.DiscountDate)
        .ThenByDescending(x => x.CreatedAt)
        .Select(x => new DiscountResponse(
            x.Id,
            x.RouteId,
            x.Route.Carrier.Name,
            x.Route.RouteDate,
            x.DiscountDate,
            x.DiscountAmount,
            x.Notes,
            x.CreatedAt
        ))
        .ToListAsync();

    return Results.Ok(discounts);
});

app.MapPost("/api/discounts", async (AppDbContext db, DiscountCreateRequest request) =>
{
    var route = await db.Routes.FindAsync(request.RouteId);
    if (route is null)
        return Results.BadRequest("Route not found.");

    if (request.DiscountAmount <= 0)
        return Results.BadRequest("Discount amount must be greater than zero.");

    var discount = new Discount
    {
        RouteId = request.RouteId,
        DiscountDate = request.DiscountDate,
        DiscountAmount = request.DiscountAmount,
        Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
        CreatedAt = DateTime.UtcNow
    };

    db.Discounts.Add(discount);
    await db.SaveChangesAsync();

    return Results.Created($"/api/discounts/{discount.Id}", discount);
});

app.MapDelete("/api/discounts/{id:int}", async (AppDbContext db, int id) =>
{
    var discount = await db.Discounts.FindAsync(id);
    if (discount is null)
        return Results.NotFound();

    db.Discounts.Remove(discount);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// ── Payments ──────────────────────────────────────────────────────────────────

app.MapGet("/api/payments", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? carrierId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today);
    var fim = endDate ?? inicio;

    if (inicio > fim)
        return Results.BadRequest("Invalid period.");

    var carriersQuery = db.Carriers.AsQueryable();
    if (carrierId.HasValue)
        carriersQuery = carriersQuery.Where(c => c.Id == carrierId.Value);
    if (onlyActive)
        carriersQuery = carriersQuery.Where(c => c.IsActive);

    var carriers = await carriersQuery
        .Include(c => c.PaymentSchedule)
        .ToListAsync();

    var results = new List<PaymentListItemResponse>();

    foreach (var c in carriers)
    {
        var schedule = c.PaymentSchedule;
        if (schedule is null) continue;

        if (schedule.Frequency == "weekly")
        {
            var targetWeekday = (DayOfWeek)(schedule.Weekday ?? 0);
            var current = inicio;
            var daysToAdd = ((int)targetWeekday - (int)current.DayOfWeek + 7) % 7;
            var scheduledDate = current.AddDays(daysToAdd);

            while (scheduledDate <= fim)
            {
                DateOnly periodStart, periodEnd;
                if (schedule.WeekStartDay.HasValue)
                {
                    var weekEndDay = (schedule.WeekStartDay.Value - 1 + 7) % 7;
                    var daysBack = ((int)scheduledDate.DayOfWeek - weekEndDay + 7) % 7;
                    periodEnd = scheduledDate.AddDays(-daysBack);
                    periodStart = periodEnd.AddDays(-6);
                }
                else
                {
                    periodEnd = scheduledDate;
                    periodStart = scheduledDate.AddDays(-6);
                }

                var routesInPeriod = await db.Routes
                    .Include(r => r.Discounts)
                    .Where(r => r.CarrierId == c.Id && r.RouteDate >= periodStart && r.RouteDate <= periodEnd)
                    .ToListAsync();

                var grossEarnings = routesInPeriod.Sum(r => r.TotalAmount);
                var totalDiscounts = routesInPeriod.SelectMany(r => r.Discounts).Sum(d => d.DiscountAmount);
                var amountDue = grossEarnings - totalDiscounts;

                var payment = await db.Payments.FirstOrDefaultAsync(p => p.CarrierId == c.Id && p.PeriodStart == periodStart && p.PeriodEnd == periodEnd);

                results.Add(new PaymentListItemResponse(
                    c.Id, c.Name, periodStart, periodEnd, scheduledDate,
                    grossEarnings, totalDiscounts, amountDue,
                    payment?.AmountReceived, payment?.ReceivedAt, payment is not null
                ));

                scheduledDate = scheduledDate.AddDays(7);
            }
        }
        else if (schedule.Frequency == "quinzena")
        {
            var iterateMonth = new DateOnly(inicio.Year, inicio.Month, 1);
            while (iterateMonth <= fim)
            {
                var year = iterateMonth.Year;
                var month = iterateMonth.Month;
                var lastDay = DateTime.DaysInMonth(year, month);
                var splitDay = Math.Min(schedule.DayOfMonth ?? 15, lastDay);

                var firstHalfStart = new DateOnly(year, month, 1);
                var firstHalfEnd = new DateOnly(year, month, splitDay);
                var firstHalfScheduled = new DateOnly(year, month, lastDay);

                if (firstHalfScheduled >= inicio && firstHalfScheduled <= fim)
                {
                    var routesInPeriod = await db.Routes.Include(r => r.Discounts).Where(r => r.CarrierId == c.Id && r.RouteDate >= firstHalfStart && r.RouteDate <= firstHalfEnd).ToListAsync();
                    var grossEarnings = routesInPeriod.Sum(r => r.TotalAmount);
                    var totalDiscounts = routesInPeriod.SelectMany(r => r.Discounts).Sum(d => d.DiscountAmount);
                    var amountDue = grossEarnings - totalDiscounts;
                    var payment = await db.Payments.FirstOrDefaultAsync(p => p.CarrierId == c.Id && p.PeriodStart == firstHalfStart && p.PeriodEnd == firstHalfEnd);
                    results.Add(new PaymentListItemResponse(c.Id, c.Name, firstHalfStart, firstHalfEnd, firstHalfScheduled, grossEarnings, totalDiscounts, amountDue, payment?.AmountReceived, payment?.ReceivedAt, payment is not null));
                }

                if (splitDay < lastDay)
                {
                    var nextMonth = iterateMonth.AddMonths(1);
                    var nextMonthLastDay = DateTime.DaysInMonth(nextMonth.Year, nextMonth.Month);
                    var secondHalfPayDay = Math.Min(splitDay, nextMonthLastDay);
                    var secondHalfScheduled = new DateOnly(nextMonth.Year, nextMonth.Month, secondHalfPayDay);
                    var secondHalfStart = new DateOnly(year, month, splitDay + 1);
                    var secondHalfEnd = new DateOnly(year, month, lastDay);

                    if (secondHalfScheduled >= inicio && secondHalfScheduled <= fim)
                    {
                        var routesInPeriod = await db.Routes.Include(r => r.Discounts).Where(r => r.CarrierId == c.Id && r.RouteDate >= secondHalfStart && r.RouteDate <= secondHalfEnd).ToListAsync();
                        var grossEarnings = routesInPeriod.Sum(r => r.TotalAmount);
                        var totalDiscounts = routesInPeriod.SelectMany(r => r.Discounts).Sum(d => d.DiscountAmount);
                        var amountDue = grossEarnings - totalDiscounts;
                        var payment = await db.Payments.FirstOrDefaultAsync(p => p.CarrierId == c.Id && p.PeriodStart == secondHalfStart && p.PeriodEnd == secondHalfEnd);
                        results.Add(new PaymentListItemResponse(c.Id, c.Name, secondHalfStart, secondHalfEnd, secondHalfScheduled, grossEarnings, totalDiscounts, amountDue, payment?.AmountReceived, payment?.ReceivedAt, payment is not null));
                    }
                }

                iterateMonth = iterateMonth.AddMonths(1);
            }
        }
    }

    return Results.Ok(results.OrderBy(x => x.ScheduledDate).ThenBy(x => x.CarrierName).ToList());
});

app.MapPost("/api/payments", async (AppDbContext db, PaymentCreateRequest request) =>
{
    var carrier = await db.Carriers.FindAsync(request.CarrierId);
    if (carrier is null)
        return Results.BadRequest("Invalid carrier.");

    var routesInPeriod = await db.Routes.Include(r => r.Discounts)
        .Where(r => r.CarrierId == request.CarrierId && r.RouteDate >= request.PeriodStart && r.RouteDate <= request.PeriodEnd)
        .ToListAsync();

    var grossEarnings = routesInPeriod.Sum(r => r.TotalAmount);
    var totalDiscounts = routesInPeriod.SelectMany(r => r.Discounts).Sum(d => d.DiscountAmount);
    var amountDue = grossEarnings - totalDiscounts;

    if (amountDue != request.AmountReceived)
        return Results.BadRequest("Amount received must equal amount due. Partial payments are not allowed.");

    var exists = await db.Payments.AnyAsync(p => p.CarrierId == request.CarrierId && p.PeriodStart == request.PeriodStart && p.PeriodEnd == request.PeriodEnd);
    if (exists)
        return Results.Conflict("Payment already registered for this period.");

    var payment = new Payment
    {
        CarrierId = request.CarrierId,
        PeriodStart = request.PeriodStart,
        PeriodEnd = request.PeriodEnd,
        ScheduledDate = request.ScheduledDate,
        AmountReceived = request.AmountReceived,
        ReceivedAt = DateTime.UtcNow,
        Notes = request.Notes,
        CreatedAt = DateTime.UtcNow
    };

    db.Payments.Add(payment);
    await db.SaveChangesAsync();

    return Results.Created($"/api/payments/{payment.Id}", payment);
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

app.MapGet("/api/dashboard/summary", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? carrierId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today);
    var fim = endDate ?? inicio;

    if (inicio > fim)
        return Results.BadRequest("Invalid period.");

    var query = db.Routes
        .Include(x => x.Discounts)
        .Include(x => x.Carrier)
        .Where(x => x.RouteDate >= inicio && x.RouteDate <= fim);

    if (carrierId.HasValue)
        query = query.Where(x => x.CarrierId == carrierId.Value);
    if (onlyActive)
        query = query.Where(x => x.Carrier.IsActive);

    var routes = await query.ToListAsync();

    var grossEarnings = routes.Sum(x => x.TotalAmount);
    var totalDiscounts = routes.SelectMany(x => x.Discounts).Sum(x => x.DiscountAmount);
    var totalPackages = routes.Sum(x => x.PackageCount);
    var workingDays = routes.Select(x => x.RouteDate).Distinct().Count();

    return Results.Ok(new DashboardSummaryResponse(
        inicio, fim, routes.Count, totalPackages, workingDays,
        grossEarnings, totalDiscounts, grossEarnings - totalDiscounts
    ));
});

app.MapGet("/api/dashboard/forecast", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? carrierId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today);
    var fim = endDate ?? inicio;

    var query = db.Routes
        .Include(x => x.Carrier)
        .Include(x => x.Discounts)
        .Where(x => x.RouteDate >= inicio && x.RouteDate <= fim);

    if (carrierId.HasValue)
        query = query.Where(x => x.CarrierId == carrierId.Value);
    if (onlyActive)
        query = query.Where(x => x.Carrier.IsActive);

    var routes = await query.ToListAsync();

    var forecast = routes
        .GroupBy(x => new { x.RouteDate, x.CarrierId, x.Carrier.Name })
        .Select(g => new DashboardForecastItemResponse(
            g.Key.RouteDate,
            g.Key.CarrierId,
            g.Key.Name,
            g.Count(),
            g.Sum(x => x.TotalAmount),
            g.SelectMany(x => x.Discounts).Sum(x => x.DiscountAmount),
            g.Sum(x => x.TotalAmount) - g.SelectMany(x => x.Discounts).Sum(x => x.DiscountAmount)
        ))
        .OrderBy(x => x.RouteDate)
        .ThenBy(x => x.CarrierName)
        .ToList();

    return Results.Ok(forecast);
});

app.MapGet("/api/dashboard/history", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? carrierId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today.AddDays(-30));
    var fim = endDate ?? DateOnly.FromDateTime(DateTime.Today);

    var query = db.Routes
        .Include(x => x.Discounts)
        .Include(x => x.Carrier)
        .Where(x => x.RouteDate >= inicio && x.RouteDate <= fim);

    if (carrierId.HasValue)
        query = query.Where(x => x.CarrierId == carrierId.Value);
    if (onlyActive)
        query = query.Where(x => x.Carrier.IsActive);

    var routes = await query.ToListAsync();

    var history = routes
        .GroupBy(x => x.RouteDate)
        .Select(g => new DashboardHistoryItemResponse(
            g.Key,
            g.Count(),
            g.Sum(x => x.TotalAmount),
            g.SelectMany(x => x.Discounts).Sum(x => x.DiscountAmount),
            g.Sum(x => x.TotalAmount) - g.SelectMany(x => x.Discounts).Sum(x => x.DiscountAmount)
        ))
        .OrderBy(x => x.Date)
        .ToList();

    return Results.Ok(history);
});

app.MapPost("/api/clear-test-data", async (AppDbContext db) =>
{
    db.PaymentSchedules.RemoveRange(db.PaymentSchedules);
    db.Payments.RemoveRange(db.Payments);
    db.Carriers.RemoveRange(db.Carriers);
    db.Routes.RemoveRange(db.Routes);
    db.Discounts.RemoveRange(db.Discounts);
    await db.SaveChangesAsync();
    return Results.Ok("Test data cleared.");
});

app.Run();

// ── Helpers ───────────────────────────────────────────────────────────────────

static (bool IsValid, string? ErrorMessage) ValidateRouteFinancials(decimal? fixedAmount, decimal? amountPerPackage, int packageCount)
{
    if (!fixedAmount.HasValue && !amountPerPackage.HasValue)
        return (false, "Provide fixed amount, amount per package, or both.");
    if (amountPerPackage.HasValue && packageCount <= 0)
        return (false, "Package count is required when amount per package is set.");
    if (fixedAmount.HasValue && fixedAmount.Value < 0)
        return (false, "Fixed amount cannot be negative.");
    if (amountPerPackage.HasValue && amountPerPackage.Value < 0)
        return (false, "Amount per package cannot be negative.");
    return (true, null);
}

static decimal CalculateTotalAmount(decimal? fixedAmount, decimal? amountPerPackage, int packageCount)
{
    var fixedPart = fixedAmount ?? 0m;
    var variablePart = (amountPerPackage ?? 0m) * packageCount;
    return fixedPart + variablePart;
}

// ── DbContext ─────────────────────────────────────────────────────────────────

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Carrier> Carriers => Set<Carrier>();
    public DbSet<DeliveryRoute> Routes => Set<DeliveryRoute>();
    public DbSet<Discount> Discounts => Set<Discount>();
    public DbSet<PaymentSchedule> PaymentSchedules => Set<PaymentSchedule>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Carrier>().Property(x => x.Name).HasMaxLength(120).IsRequired();
        modelBuilder.Entity<DeliveryRoute>().Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<DeliveryRoute>().Property(x => x.FixedAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<DeliveryRoute>().Property(x => x.AmountPerPackage).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Discount>().Property(x => x.DiscountAmount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Discount>().Property(x => x.Notes).HasMaxLength(300);
        modelBuilder.Entity<PaymentSchedule>().Property(x => x.Frequency).HasMaxLength(20).IsRequired();
        modelBuilder.Entity<PaymentSchedule>().Property(x => x.Weekday);
        modelBuilder.Entity<PaymentSchedule>().Property(x => x.DayOfMonth);
        modelBuilder.Entity<Payment>().Property(x => x.AmountReceived).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Payment>().Property(x => x.Notes).HasMaxLength(300);
    }
}

// ── Entities ──────────────────────────────────────────────────────────────────

public class Carrier
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public List<DeliveryRoute> Routes { get; set; } = [];
    public PaymentSchedule? PaymentSchedule { get; set; }
}

public class DeliveryRoute
{
    public int Id { get; set; }
    public int CarrierId { get; set; }
    public Carrier Carrier { get; set; } = null!;
    public DateOnly RouteDate { get; set; }
    public decimal? FixedAmount { get; set; }
    public decimal? AmountPerPackage { get; set; }
    public int PackageCount { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Discount> Discounts { get; set; } = [];
}

public class Discount
{
    public int Id { get; set; }
    public int RouteId { get; set; }
    public DeliveryRoute Route { get; set; } = null!;
    public DateOnly DiscountDate { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PaymentSchedule
{
    public int Id { get; set; }
    public int CarrierId { get; set; }
    public Carrier Carrier { get; set; } = null!;
    // "weekly" or "quinzena"
    public string Frequency { get; set; } = string.Empty;
    // 0 = Sunday .. 6 = Saturday (used when Frequency == "weekly")
    public int? Weekday { get; set; }
    // 1..31 (used when Frequency == "quinzena")
    public int? DayOfMonth { get; set; }
    // 0 = Sunday .. 6 = Saturday — first day of the work week (weekly only)
    public int? WeekStartDay { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int CarrierId { get; set; }
    public Carrier Carrier { get; set; } = null!;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateOnly ScheduledDate { get; set; }
    public decimal AmountReceived { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public record CarrierResponse(int Id, string Name, bool IsActive, PaymentScheduleResponse? PaymentSchedule, DateTime CreatedAt);
public record CarrierCreateRequest(string Name);
public record CarrierUpdateRequest(string Name, bool IsActive);

public record RouteCreateRequest(int CarrierId, DateOnly RouteDate, decimal? FixedAmount, decimal? AmountPerPackage, int PackageCount);
public record RouteResponse(
    int Id, int CarrierId, string CarrierName, DateOnly RouteDate,
    decimal? FixedAmount, decimal? AmountPerPackage, int PackageCount,
    decimal TotalAmount, decimal TotalDiscounts, decimal NetAmount, DateTime CreatedAt
);

public record DiscountCreateRequest(int RouteId, DateOnly DiscountDate, decimal DiscountAmount, string? Notes);
public record DiscountResponse(
    int Id, int RouteId, string CarrierName, DateOnly RouteDate,
    DateOnly DiscountDate, decimal DiscountAmount, string? Notes, DateTime CreatedAt
);

public record PaymentScheduleRequest(string Frequency, int? Weekday, int? DayOfMonth, int? WeekStartDay);
public record PaymentScheduleResponse(string Frequency, int? Weekday, int? DayOfMonth, int? WeekStartDay);

public record PaymentCreateRequest(int CarrierId, DateOnly PeriodStart, DateOnly PeriodEnd, DateOnly ScheduledDate, decimal AmountReceived, string? Notes);
public record PaymentListItemResponse(
    int CarrierId, string CarrierName,
    DateOnly PeriodStart, DateOnly PeriodEnd, DateOnly ScheduledDate,
    decimal GrossEarnings, decimal TotalDiscounts, decimal AmountDue,
    decimal? AmountReceived, DateTime? ReceivedAt, bool Paid
);

public record DashboardSummaryResponse(
    DateOnly StartDate, DateOnly EndDate,
    int TotalRoutes, int TotalPackages, int WorkingDays,
    decimal GrossEarnings, decimal TotalDiscounts, decimal NetEarnings
);

public record DashboardForecastItemResponse(
    DateOnly RouteDate, int CarrierId, string CarrierName,
    int TotalRoutes, decimal GrossEarnings, decimal TotalDiscounts, decimal NetEarnings
);

public record DashboardHistoryItemResponse(
    DateOnly Date, int TotalRoutes,
    decimal GrossEarnings, decimal TotalDiscounts, decimal NetEarnings
);
