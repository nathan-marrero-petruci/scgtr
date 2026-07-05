-- Migration: referral v2 — escada mensal (25% / 50% / mês grátis)
-- ReferralCredits passa a armazenar centavos (antes: reais inteiros)

ALTER TABLE "Users"
  ADD COLUMN IF NOT EXISTS "ReferralMonth"      VARCHAR(7),
  ADD COLUMN IF NOT EXISTS "ReferralCountMonth" INTEGER NOT NULL DEFAULT 0;
