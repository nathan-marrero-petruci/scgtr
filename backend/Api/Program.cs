using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Configurar caminho do banco (Fly.io usa /data para volume persistente)
var dbPath = builder.Configuration["DB_PATH"] ?? "controle-ganhos.db";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));
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
                {
                    return false;
                }

                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return false;
                }

                if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                {
                    return false;
                }

                if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
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
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("frontend");

app.MapGet("/api/transportadoras", async (AppDbContext db, bool includeInactive = false) =>
{
    var query = db.Transportadoras.AsQueryable();
    if (!includeInactive)
    {
        query = query.Where(x => x.Ativa);
    }

    var transportadoras = await query
        .OrderBy(x => x.Nome)
        .ToListAsync();

    return Results.Ok(transportadoras);
});

app.MapPost("/api/transportadoras", async (AppDbContext db, TransportadoraCreateRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Nome))
    {
        return Results.BadRequest("Nome é obrigatório.");
    }

    var transportadora = new Transportadora
    {
        Nome = request.Nome.Trim(),
        Ativa = true,
        CreatedAt = DateTime.UtcNow
    };

    db.Transportadoras.Add(transportadora);
    await db.SaveChangesAsync();

    return Results.Created($"/api/transportadoras/{transportadora.Id}", transportadora);
});

app.MapPut("/api/transportadoras/{id:int}", async (AppDbContext db, int id, TransportadoraUpdateRequest request) =>
{
    var transportadora = await db.Transportadoras.FindAsync(id);
    if (transportadora is null)
    {
        return Results.NotFound();
    }

    if (string.IsNullOrWhiteSpace(request.Nome))
    {
        return Results.BadRequest("Nome é obrigatório.");
    }

    transportadora.Nome = request.Nome.Trim();
    transportadora.Ativa = request.Ativa;
    await db.SaveChangesAsync();

    return Results.Ok(transportadora);
});

app.MapPatch("/api/transportadoras/{id:int}/inativar", async (AppDbContext db, int id) =>
{
    var transportadora = await db.Transportadoras.FindAsync(id);
    if (transportadora is null)
    {
        return Results.NotFound();
    }

    transportadora.Ativa = false;
    await db.SaveChangesAsync();

    return Results.Ok(transportadora);
});

app.MapPatch("/api/transportadoras/{id:int}/reativar", async (AppDbContext db, int id) =>
{
    var transportadora = await db.Transportadoras.FindAsync(id);
    if (transportadora is null)
    {
        return Results.NotFound();
    }

    transportadora.Ativa = true;
    await db.SaveChangesAsync();

    return Results.Ok(transportadora);
});

// Payment schedule endpoints
app.MapGet("/api/transportadoras/{id:int}/payment-schedule", async (AppDbContext db, int id) =>
{
    var schedule = await db.PaymentSchedules.FirstOrDefaultAsync(x => x.TransportadoraId == id);
    if (schedule is null)
    {
        return Results.NotFound();
    }

    return Results.Ok(new PaymentScheduleResponse(schedule.Frequency, schedule.Weekday, schedule.DayOfMonth));
});

app.MapPut("/api/transportadoras/{id:int}/payment-schedule", async (AppDbContext db, int id, PaymentScheduleRequest request) =>
{
    var transportadora = await db.Transportadoras.FindAsync(id);
    if (transportadora is null)
    {
        return Results.NotFound();
    }

    if (request.Frequency is null || (request.Frequency != "weekly" && request.Frequency != "quinzena"))
    {
        return Results.BadRequest("Frequency inválida. Use 'weekly' ou 'quinzena'.");
    }

    if (request.Frequency == "weekly" && (!request.Weekday.HasValue || request.Weekday < 0 || request.Weekday > 6))
    {
        return Results.BadRequest("Weekday é obrigatório para frequência 'weekly' e deve estar entre 0 (domingo) e 6 (sábado).");
    }

    if (request.Frequency == "quinzena" && (!request.DayOfMonth.HasValue || request.DayOfMonth < 1 || request.DayOfMonth > 31))
    {
        return Results.BadRequest("DayOfMonth é obrigatório para frequência 'quinzena' e deve estar entre 1 e 31.");
    }

    var schedule = await db.PaymentSchedules.FirstOrDefaultAsync(x => x.TransportadoraId == id);
    if (schedule is null)
    {
        schedule = new PaymentSchedule
        {
            TransportadoraId = id,
            Frequency = request.Frequency,
            Weekday = request.Weekday,
            DayOfMonth = request.DayOfMonth,
            CreatedAt = DateTime.UtcNow
        };

        db.PaymentSchedules.Add(schedule);
    }
    else
    {
        schedule.Frequency = request.Frequency;
        schedule.Weekday = request.Weekday;
        schedule.DayOfMonth = request.DayOfMonth;
    }

    await db.SaveChangesAsync();
    return Results.Ok(new PaymentScheduleResponse(schedule.Frequency, schedule.Weekday, schedule.DayOfMonth));
});

app.MapGet("/api/rotas", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? transportadoraId = null) =>
{
    var query = db.Rotas
        .Include(x => x.Transportadora)
        .Include(x => x.Pnrs)
        .AsQueryable();

    if (startDate.HasValue)
    {
        query = query.Where(x => x.DataRota >= startDate.Value);
    }

    if (endDate.HasValue)
    {
        query = query.Where(x => x.DataRota <= endDate.Value);
    }

    if (transportadoraId.HasValue)
    {
        query = query.Where(x => x.TransportadoraId == transportadoraId.Value);
    }

    var rotas = await query
        .OrderByDescending(x => x.DataRota)
        .ThenByDescending(x => x.CreatedAt)
        .Select(x => new RotaResponse(
            x.Id,
            x.TransportadoraId,
            x.Transportadora.Nome,
            x.DataRota,
            x.ValorFixo,
            x.ValorPorPacote,
            x.QuantidadePacotes,
            x.ValorTotalCalculado,
            x.Pnrs.Sum(p => p.ValorDesconto),
            x.ValorTotalCalculado - x.Pnrs.Sum(p => p.ValorDesconto),
            x.CreatedAt
        ))
        .ToListAsync();

    return Results.Ok(rotas);
});

app.MapPost("/api/rotas", async (AppDbContext db, RotaCreateRequest request) =>
{
    var transportadora = await db.Transportadoras.FindAsync(request.TransportadoraId);
    if (transportadora is null || !transportadora.Ativa)
    {
        return Results.BadRequest("Transportadora inválida ou inativa.");
    }

    var validation = ValidarRotaFinanceira(request.ValorFixo, request.ValorPorPacote, request.QuantidadePacotes);
    if (!validation.IsValid)
    {
        return Results.BadRequest(validation.ErrorMessage);
    }

    var rota = new Rota
    {
        TransportadoraId = request.TransportadoraId,
        DataRota = request.DataRota,
        ValorFixo = request.ValorFixo,
        ValorPorPacote = request.ValorPorPacote,
        QuantidadePacotes = request.QuantidadePacotes,
        ValorTotalCalculado = CalcularValorTotal(request.ValorFixo, request.ValorPorPacote, request.QuantidadePacotes),
        CreatedAt = DateTime.UtcNow
    };

    db.Rotas.Add(rota);
    await db.SaveChangesAsync();

    return Results.Created($"/api/rotas/{rota.Id}", rota);
});

app.MapPut("/api/rotas/{id:int}", async (AppDbContext db, int id, RotaCreateRequest request) =>
{
    var rota = await db.Rotas.FindAsync(id);
    if (rota is null)
    {
        return Results.NotFound();
    }

    var transportadora = await db.Transportadoras.FindAsync(request.TransportadoraId);
    if (transportadora is null || !transportadora.Ativa)
    {
        return Results.BadRequest("Transportadora inválida ou inativa.");
    }

    var validation = ValidarRotaFinanceira(request.ValorFixo, request.ValorPorPacote, request.QuantidadePacotes);
    if (!validation.IsValid)
    {
        return Results.BadRequest(validation.ErrorMessage);
    }

    rota.TransportadoraId = request.TransportadoraId;
    rota.DataRota = request.DataRota;
    rota.ValorFixo = request.ValorFixo;
    rota.ValorPorPacote = request.ValorPorPacote;
    rota.QuantidadePacotes = request.QuantidadePacotes;
    rota.ValorTotalCalculado = CalcularValorTotal(request.ValorFixo, request.ValorPorPacote, request.QuantidadePacotes);
    await db.SaveChangesAsync();

    return Results.Ok(rota);
});

app.MapGet("/api/pnrs", async (AppDbContext db, int? rotaId = null) =>
{
    var query = db.Pnrs
        .Include(x => x.Rota)
        .ThenInclude(r => r.Transportadora)
        .AsQueryable();

    if (rotaId.HasValue)
    {
        query = query.Where(x => x.RotaId == rotaId.Value);
    }

    var pnrs = await query
        .OrderByDescending(x => x.DataPnr)
        .ThenByDescending(x => x.CreatedAt)
        .Select(x => new PnrResponse(
            x.Id,
            x.RotaId,
            x.Rota.Transportadora.Nome,
            x.Rota.DataRota,
            x.DataPnr,
            x.ValorDesconto,
            x.Observacao,
            x.CreatedAt
        ))
        .ToListAsync();

    return Results.Ok(pnrs);
});

app.MapPost("/api/pnrs", async (AppDbContext db, PnrCreateRequest request) =>
{
    var rota = await db.Rotas.FindAsync(request.RotaId);
    if (rota is null)
    {
        return Results.BadRequest("Rota não encontrada.");
    }

    if (request.ValorDesconto <= 0)
    {
        return Results.BadRequest("Valor do desconto deve ser maior que zero.");
    }

    var pnr = new Pnr
    {
        RotaId = request.RotaId,
        DataPnr = request.DataPnr,
        ValorDesconto = request.ValorDesconto,
        Observacao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim(),
        CreatedAt = DateTime.UtcNow
    };

    db.Pnrs.Add(pnr);
    await db.SaveChangesAsync();

    return Results.Created($"/api/pnrs/{pnr.Id}", pnr);
});

app.MapDelete("/api/pnrs/{id:int}", async (AppDbContext db, int id) =>
{
    var pnr = await db.Pnrs.FindAsync(id);
    if (pnr is null)
    {
        return Results.NotFound();
    }

    db.Pnrs.Remove(pnr);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.MapGet("/api/payments", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? transportadoraId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today);
    var fim = endDate ?? inicio;

    if (inicio > fim)
    {
        return Results.BadRequest("Período inválido.");
    }

    var transportadorasQuery = db.Transportadoras.AsQueryable();
    if (transportadoraId.HasValue)
    {
        transportadorasQuery = transportadorasQuery.Where(t => t.Id == transportadoraId.Value);
    }
    if (onlyActive)
    {
        transportadorasQuery = transportadorasQuery.Where(t => t.Ativa);
    }

    var transportadorasList = await transportadorasQuery
        .Include(t => t.PaymentSchedule)
        .ToListAsync();

    var results = new List<PaymentListItemResponse>();

    foreach (var t in transportadorasList)
    {
        var schedule = t.PaymentSchedule;
        if (schedule is null) continue;

        if (schedule.Frequency == "weekly")
        {
            var targetWeekday = (DayOfWeek)(schedule.Weekday ?? 0);
            var current = inicio;
            var daysToAdd = ((int)targetWeekday - (int)current.DayOfWeek + 7) % 7;
            var scheduledDate = current.AddDays(daysToAdd);

            while (scheduledDate <= fim)
            {
                var periodEnd = scheduledDate;
                var periodStart = scheduledDate.AddDays(-6);

                var rotasInPeriod = await db.Rotas
                    .Include(r => r.Pnrs)
                    .Where(r => r.TransportadoraId == t.Id && r.DataRota >= periodStart && r.DataRota <= periodEnd)
                    .ToListAsync();

                var ganhosBrutos = rotasInPeriod.Sum(r => r.ValorTotalCalculado);
                var descontosPnr = rotasInPeriod.SelectMany(r => r.Pnrs).Sum(p => p.ValorDesconto);
                var amountDue = ganhosBrutos - descontosPnr;

                var payment = await db.Payments.FirstOrDefaultAsync(p => p.TransportadoraId == t.Id && p.PeriodStart == periodStart && p.PeriodEnd == periodEnd);

                results.Add(new PaymentListItemResponse(
                    t.Id,
                    t.Nome,
                    periodStart,
                    periodEnd,
                    scheduledDate,
                    ganhosBrutos,
                    descontosPnr,
                    amountDue,
                    payment?.AmountReceived,
                    payment?.ReceivedAt,
                    payment is not null
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
                var preferredDay = schedule.DayOfMonth ?? 15;
                var firstDay = Math.Min(preferredDay, lastDay);
                var firstHalfScheduled = new DateOnly(year, month, firstDay);

                if (firstHalfScheduled >= inicio && firstHalfScheduled <= fim)
                {
                    var periodStart = new DateOnly(year, month, 1);
                    var periodEnd = firstHalfScheduled;
                    var rotasInPeriod = await db.Rotas.Include(r => r.Pnrs).Where(r => r.TransportadoraId == t.Id && r.DataRota >= periodStart && r.DataRota <= periodEnd).ToListAsync();
                    var ganhosBrutos = rotasInPeriod.Sum(r => r.ValorTotalCalculado);
                    var descontosPnr = rotasInPeriod.SelectMany(r => r.Pnrs).Sum(p => p.ValorDesconto);
                    var amountDue = ganhosBrutos - descontosPnr;
                    var payment = await db.Payments.FirstOrDefaultAsync(p => p.TransportadoraId == t.Id && p.PeriodStart == periodStart && p.PeriodEnd == periodEnd);
                    results.Add(new PaymentListItemResponse(t.Id, t.Nome, periodStart, periodEnd, firstHalfScheduled, ganhosBrutos, descontosPnr, amountDue, payment?.AmountReceived, payment?.ReceivedAt, payment is not null));
                }

                if (firstDay < lastDay)
                {
                    var secondHalfScheduled = new DateOnly(year, month, lastDay);
                    var periodStart = new DateOnly(year, month, firstDay + 1);
                    var periodEnd = secondHalfScheduled;

                    if (secondHalfScheduled >= inicio && secondHalfScheduled <= fim)
                    {
                        var rotasInPeriod = await db.Rotas.Include(r => r.Pnrs).Where(r => r.TransportadoraId == t.Id && r.DataRota >= periodStart && r.DataRota <= periodEnd).ToListAsync();
                        var ganhosBrutos = rotasInPeriod.Sum(r => r.ValorTotalCalculado);
                        var descontosPnr = rotasInPeriod.SelectMany(r => r.Pnrs).Sum(p => p.ValorDesconto);
                        var amountDue = ganhosBrutos - descontosPnr;
                        var payment = await db.Payments.FirstOrDefaultAsync(p => p.TransportadoraId == t.Id && p.PeriodStart == periodStart && p.PeriodEnd == periodEnd);
                        results.Add(new PaymentListItemResponse(t.Id, t.Nome, periodStart, periodEnd, secondHalfScheduled, ganhosBrutos, descontosPnr, amountDue, payment?.AmountReceived, payment?.ReceivedAt, payment is not null));
                    }
                }

                iterateMonth = iterateMonth.AddMonths(1);
            }
        }
    }

    var ordered = results.OrderBy(x => x.ScheduledDate).ThenBy(x => x.TransportadoraNome).ToList();
    return Results.Ok(ordered);
});

app.MapPost("/api/payments", async (AppDbContext db, PaymentCreateRequest request) =>
{
    var transportadora = await db.Transportadoras.FindAsync(request.TransportadoraId);
    if (transportadora is null)
    {
        return Results.BadRequest("Transportadora inválida.");
    }

    var rotasInPeriod = await db.Rotas.Include(r => r.Pnrs)
        .Where(r => r.TransportadoraId == request.TransportadoraId && r.DataRota >= request.PeriodStart && r.DataRota <= request.PeriodEnd)
        .ToListAsync();

    var ganhosBrutos = rotasInPeriod.Sum(r => r.ValorTotalCalculado);
    var descontosPnr = rotasInPeriod.SelectMany(r => r.Pnrs).Sum(p => p.ValorDesconto);
    var amountDue = ganhosBrutos - descontosPnr;

    if (amountDue != request.AmountReceived)
    {
        return Results.BadRequest("Valor recebido deve ser igual ao valor devido. Pagamentos parciais não são permitidos.");
    }

    var exists = await db.Payments.AnyAsync(p => p.TransportadoraId == request.TransportadoraId && p.PeriodStart == request.PeriodStart && p.PeriodEnd == request.PeriodEnd);
    if (exists)
    {
        return Results.Conflict("Pagamento já registrado para este período.");
    }

    var payment = new Payment
    {
        TransportadoraId = request.TransportadoraId,
        PeriodStart = request.PeriodStart,
        PeriodEnd = request.PeriodEnd,
        ScheduledDate = request.PeriodEnd,
        AmountReceived = request.AmountReceived,
        ReceivedAt = DateTime.UtcNow,
        Notes = request.Notes,
        CreatedAt = DateTime.UtcNow
    };

    db.Payments.Add(payment);
    await db.SaveChangesAsync();

    return Results.Created($"/api/payments/{payment.Id}", payment);
});

app.MapGet("/api/dashboard/summary", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? transportadoraId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today);
    var fim = endDate ?? inicio;

    if (inicio > fim)
    {
        return Results.BadRequest("Período inválido.");
    }

    var query = db.Rotas
        .Include(x => x.Pnrs)
        .Include(x => x.Transportadora)
        .Where(x => x.DataRota >= inicio && x.DataRota <= fim);

    if (transportadoraId.HasValue)
    {
        query = query.Where(x => x.TransportadoraId == transportadoraId.Value);
    }

    if (onlyActive)
    {
        query = query.Where(x => x.Transportadora.Ativa);
    }

    var rotas = await query.ToListAsync();

    var ganhosBrutos = rotas.Sum(x => x.ValorTotalCalculado);
    var descontosPnr = rotas.SelectMany(x => x.Pnrs).Sum(x => x.ValorDesconto);
    var totalPacotes = rotas.Sum(x => x.QuantidadePacotes);

    return Results.Ok(new DashboardSummaryResponse(
        inicio,
        fim,
        rotas.Count,
        totalPacotes,
        ganhosBrutos,
        descontosPnr,
        ganhosBrutos - descontosPnr
    ));
});

app.MapGet("/api/dashboard/previsao", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? transportadoraId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today);
    var fim = endDate ?? inicio;

    var query = db.Rotas
        .Include(x => x.Transportadora)
        .Include(x => x.Pnrs)
        .Where(x => x.DataRota >= inicio && x.DataRota <= fim);

    if (transportadoraId.HasValue)
    {
        query = query.Where(x => x.TransportadoraId == transportadoraId.Value);
    }

    if (onlyActive)
    {
        query = query.Where(x => x.Transportadora.Ativa);
    }

    var rotas = await query.ToListAsync();

    var previsao = rotas
        .GroupBy(x => new { x.DataRota, x.TransportadoraId, x.Transportadora.Nome })
        .Select(g => new DashboardPrevisaoItemResponse(
            g.Key.DataRota,
            g.Key.TransportadoraId,
            g.Key.Nome,
            g.Count(),
            g.Sum(x => x.ValorTotalCalculado),
            g.SelectMany(x => x.Pnrs).Sum(x => x.ValorDesconto),
            g.Sum(x => x.ValorTotalCalculado) - g.SelectMany(x => x.Pnrs).Sum(x => x.ValorDesconto)
        ))
        .OrderBy(x => x.DataRota)
        .ThenBy(x => x.TransportadoraNome)
        .ToList();

    return Results.Ok(previsao);
});

app.MapGet("/api/dashboard/historico", async (AppDbContext db, DateOnly? startDate = null, DateOnly? endDate = null, int? transportadoraId = null, bool onlyActive = false) =>
{
    var inicio = startDate ?? DateOnly.FromDateTime(DateTime.Today.AddDays(-30));
    var fim = endDate ?? DateOnly.FromDateTime(DateTime.Today);

    var query = db.Rotas
        .Include(x => x.Pnrs)
        .Include(x => x.Transportadora)
        .Where(x => x.DataRota >= inicio && x.DataRota <= fim);

    if (transportadoraId.HasValue)
    {
        query = query.Where(x => x.TransportadoraId == transportadoraId.Value);
    }

    if (onlyActive)
    {
        query = query.Where(x => x.Transportadora.Ativa);
    }

    var rotas = await query.ToListAsync();

    var historico = rotas
        .GroupBy(x => x.DataRota)
        .Select(g => new DashboardHistoricoItemResponse(
            g.Key,
            g.Count(),
            g.Sum(x => x.ValorTotalCalculado),
            g.SelectMany(x => x.Pnrs).Sum(x => x.ValorDesconto),
            g.Sum(x => x.ValorTotalCalculado) - g.SelectMany(x => x.Pnrs).Sum(x => x.ValorDesconto)
        ))
        .OrderBy(x => x.Data)
        .ToList();

    return Results.Ok(historico);
});

app.MapPost("/api/clear-test-data", async (AppDbContext db) =>
{
    db.PaymentSchedules.RemoveRange(db.PaymentSchedules);
    db.Payments.RemoveRange(db.Payments);
    db.Transportadoras.RemoveRange(db.Transportadoras);
    db.Rotas.RemoveRange(db.Rotas);
    db.Pnrs.RemoveRange(db.Pnrs);
    await db.SaveChangesAsync();
    return Results.Ok("Dados de teste removidos com sucesso.");
});

app.Run();

static (bool IsValid, string? ErrorMessage) ValidarRotaFinanceira(decimal? valorFixo, decimal? valorPorPacote, int quantidadePacotes)
{
    if (!valorFixo.HasValue && !valorPorPacote.HasValue)
    {
        return (false, "Informe valor fixo, valor por pacote ou ambos.");
    }

    if (valorPorPacote.HasValue && quantidadePacotes <= 0)
    {
        return (false, "Quantidade de pacotes é obrigatória quando houver valor por pacote.");
    }

    if (valorFixo.HasValue && valorFixo.Value < 0)
    {
        return (false, "Valor fixo não pode ser negativo.");
    }

    if (valorPorPacote.HasValue && valorPorPacote.Value < 0)
    {
        return (false, "Valor por pacote não pode ser negativo.");
    }

    return (true, null);
}

static decimal CalcularValorTotal(decimal? valorFixo, decimal? valorPorPacote, int quantidadePacotes)
{
    var fixo = valorFixo ?? 0m;
    var variavel = (valorPorPacote ?? 0m) * quantidadePacotes;
    return fixo + variavel;
}

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Transportadora> Transportadoras => Set<Transportadora>();
    public DbSet<Rota> Rotas => Set<Rota>();
    public DbSet<Pnr> Pnrs => Set<Pnr>();
    public DbSet<PaymentSchedule> PaymentSchedules => Set<PaymentSchedule>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Transportadora>().Property(x => x.Nome).HasMaxLength(120).IsRequired();
        modelBuilder.Entity<Rota>().Property(x => x.ValorTotalCalculado).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Rota>().Property(x => x.ValorFixo).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Rota>().Property(x => x.ValorPorPacote).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Pnr>().Property(x => x.ValorDesconto).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Pnr>().Property(x => x.Observacao).HasMaxLength(300);
        modelBuilder.Entity<PaymentSchedule>().Property(x => x.Frequency).HasMaxLength(20).IsRequired();
        modelBuilder.Entity<PaymentSchedule>().Property(x => x.Weekday);
        modelBuilder.Entity<PaymentSchedule>().Property(x => x.DayOfMonth);

        modelBuilder.Entity<Payment>().Property(x => x.AmountReceived).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Payment>().Property(x => x.Notes).HasMaxLength(300);
    }
}

public class Transportadora
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public bool Ativa { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public List<Rota> Rotas { get; set; } = [];
    public PaymentSchedule? PaymentSchedule { get; set; }
}

public class Rota
{
    public int Id { get; set; }
    public int TransportadoraId { get; set; }
    public Transportadora Transportadora { get; set; } = null!;
    public DateOnly DataRota { get; set; }
    public decimal? ValorFixo { get; set; }
    public decimal? ValorPorPacote { get; set; }
    public int QuantidadePacotes { get; set; }
    public decimal ValorTotalCalculado { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<Pnr> Pnrs { get; set; } = [];
}

public class Pnr
{
    public int Id { get; set; }
    public int RotaId { get; set; }
    public Rota Rota { get; set; } = null!;
    public DateOnly DataPnr { get; set; }
    public decimal ValorDesconto { get; set; }
    public string? Observacao { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PaymentSchedule
{
    public int Id { get; set; }
    public int TransportadoraId { get; set; }
    public Transportadora Transportadora { get; set; } = null!;
    // "weekly" or "quinzena"
    public string Frequency { get; set; } = string.Empty;
    // 0 = Sunday .. 6 = Saturday (used when Frequency == "weekly")
    public int? Weekday { get; set; }
    // 1..31 (used when Frequency == "quinzena")
    public int? DayOfMonth { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public int TransportadoraId { get; set; }
    public Transportadora Transportadora { get; set; } = null!;
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateOnly ScheduledDate { get; set; }
    public decimal AmountReceived { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public record TransportadoraCreateRequest(string Nome);
public record TransportadoraUpdateRequest(string Nome, bool Ativa);
public record RotaCreateRequest(int TransportadoraId, DateOnly DataRota, decimal? ValorFixo, decimal? ValorPorPacote, int QuantidadePacotes);
public record PnrCreateRequest(int RotaId, DateOnly DataPnr, decimal ValorDesconto, string? Observacao);

public record PaymentScheduleRequest(string Frequency, int? Weekday, int? DayOfMonth);
public record PaymentScheduleResponse(string Frequency, int? Weekday, int? DayOfMonth);

public record PaymentCreateRequest(int TransportadoraId, DateOnly PeriodStart, DateOnly PeriodEnd, decimal AmountReceived, string? Notes);

public record PaymentListItemResponse(
    int TransportadoraId,
    string TransportadoraNome,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    DateOnly ScheduledDate,
    decimal GanhosBrutos,
    decimal DescontosPnr,
    decimal AmountDue,
    decimal? AmountReceived,
    DateTime? ReceivedAt,
    bool Paid
);

public record RotaResponse(
    int Id,
    int TransportadoraId,
    string TransportadoraNome,
    DateOnly DataRota,
    decimal? ValorFixo,
    decimal? ValorPorPacote,
    int QuantidadePacotes,
    decimal ValorTotalCalculado,
    decimal TotalDescontosPnr,
    decimal ValorLiquido,
    DateTime CreatedAt
);

public record PnrResponse(
    int Id,
    int RotaId,
    string TransportadoraNome,
    DateOnly DataRota,
    DateOnly DataPnr,
    decimal ValorDesconto,
    string? Observacao,
    DateTime CreatedAt
);

public record DashboardSummaryResponse(
    DateOnly StartDate,
    DateOnly EndDate,
    int TotalRotas,
    int TotalPacotes,
    decimal GanhosBrutos,
    decimal DescontosPnr,
    decimal GanhosLiquidos
);

public record DashboardPrevisaoItemResponse(
    DateOnly DataRota,
    int TransportadoraId,
    string TransportadoraNome,
    int TotalRotas,
    decimal GanhosBrutos,
    decimal DescontosPnr,
    decimal GanhosLiquidos
);

public record DashboardHistoricoItemResponse(
    DateOnly Data,
    int TotalRotas,
    decimal GanhosBrutos,
    decimal DescontosPnr,
    decimal GanhosLiquidos
);
