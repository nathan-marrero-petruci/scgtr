-- Migration: billing support
-- Run in Supabase SQL Editor before deploying the billing backend update

ALTER TABLE "Users"
  ADD COLUMN IF NOT EXISTS "StripeCustomerId"   VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "SubscriptionStatus" VARCHAR(20) NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS "SubscriptionEndsAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "TrialEndsAt"        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS "ReferralCode"       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "ReferredById"       INTEGER,
  ADD COLUMN IF NOT EXISTS "ReferralCredits"    INTEGER NOT NULL DEFAULT 0;

-- Grandfather all existing users as permanently active
UPDATE "Users"
SET
  "SubscriptionStatus" = 'active',
  "SubscriptionEndsAt" = NOW() + INTERVAL '36500 days',
  "TrialEndsAt"        = NOW() - INTERVAL '1 second'
WHERE "Id" > 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_Users_ReferralCode') THEN
    ALTER TABLE "Users" ADD CONSTRAINT "UQ_Users_ReferralCode" UNIQUE ("ReferralCode");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Users_ReferredBy') THEN
    ALTER TABLE "Users" ADD CONSTRAINT "FK_Users_ReferredBy"
      FOREIGN KEY ("ReferredById") REFERENCES "Users"("Id");
  END IF;
END $$;
