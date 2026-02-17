-- Add passwordHash to User for credential-based login
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
