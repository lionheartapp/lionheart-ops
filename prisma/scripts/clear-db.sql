-- Clear all data (run in Supabase SQL Editor)
-- Keeps schema and tables; removes all rows. Order respects FKs.

TRUNCATE
  "FormSubmission",
  "InventoryStock",
  "Expense",
  "TeacherSchedule",
  "MaintenanceTip",
  "Event",
  "Room",
  "Ticket",
  "Form",
  "KnowledgeBaseEntry",
  "InventoryItem",
  "WaterLog",
  "WaterAsset",
  "WaterAssetConfig",
  "Budget",
  "Building",
  "User",
  "AuditLog",
  "Team",
  "Organization"
RESTART IDENTITY
CASCADE;
