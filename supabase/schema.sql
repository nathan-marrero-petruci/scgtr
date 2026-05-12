-- Schema SCGTR — rodar no SQL Editor do Supabase antes de subir o backend
-- As tabelas seguem o mesmo nome do EF Core (PascalCase) para não precisar
-- de mapeamento extra no DbContext.

CREATE TABLE IF NOT EXISTS "Carriers" (
    "Id"        SERIAL PRIMARY KEY,
    "Name"      VARCHAR(120) NOT NULL,
    "IsActive"  BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PaymentSchedules" (
    "Id"           SERIAL PRIMARY KEY,
    "CarrierId"    INTEGER NOT NULL REFERENCES "Carriers"("Id") ON DELETE CASCADE,
    "Frequency"    VARCHAR(20) NOT NULL,
    "Weekday"      INTEGER,
    "DayOfMonth"   INTEGER,
    "WeekStartDay" INTEGER,
    "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("CarrierId")
);

CREATE TABLE IF NOT EXISTS "DeliveryRoutes" (
    "Id"               SERIAL PRIMARY KEY,
    "CarrierId"        INTEGER NOT NULL REFERENCES "Carriers"("Id") ON DELETE CASCADE,
    "RouteDate"        DATE NOT NULL,
    "FixedAmount"      NUMERIC(18,2),
    "AmountPerPackage" NUMERIC(18,2),
    "PackageCount"     INTEGER NOT NULL DEFAULT 0,
    "TotalAmount"      NUMERIC(18,2) NOT NULL DEFAULT 0,
    "CreatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Discounts" (
    "Id"             SERIAL PRIMARY KEY,
    "RouteId"        INTEGER NOT NULL REFERENCES "DeliveryRoutes"("Id") ON DELETE CASCADE,
    "DiscountDate"   DATE NOT NULL,
    "DiscountAmount" NUMERIC(18,2) NOT NULL,
    "Notes"          VARCHAR(300),
    "CreatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Payments" (
    "Id"             SERIAL PRIMARY KEY,
    "CarrierId"      INTEGER NOT NULL REFERENCES "Carriers"("Id") ON DELETE CASCADE,
    "PeriodStart"    DATE NOT NULL,
    "PeriodEnd"      DATE NOT NULL,
    "ScheduledDate"  DATE NOT NULL,
    "AmountReceived" NUMERIC(18,2) NOT NULL,
    "ReceivedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "Notes"          VARCHAR(300),
    "CreatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS "IX_DeliveryRoutes_CarrierId" ON "DeliveryRoutes"("CarrierId");
CREATE INDEX IF NOT EXISTS "IX_Discounts_RouteId"        ON "Discounts"("RouteId");
CREATE INDEX IF NOT EXISTS "IX_Payments_CarrierId"       ON "Payments"("CarrierId");

-- Tabela de controle de migrations do EF Core
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId"    VARCHAR(150) NOT NULL PRIMARY KEY,
    "ProductVersion" VARCHAR(32)  NOT NULL
);
