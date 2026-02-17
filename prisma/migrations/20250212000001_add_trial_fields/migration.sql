-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "subscriptionStatus" TEXT;
