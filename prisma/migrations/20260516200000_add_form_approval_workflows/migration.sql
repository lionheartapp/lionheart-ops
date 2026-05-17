-- AlterEnum: Add PENDING_APPROVAL to ITTicketStatus
ALTER TYPE "ITTicketStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- AlterTable: Add formDefinitionId to ApprovalRule
ALTER TABLE "ApprovalRule" ADD COLUMN "formDefinitionId" TEXT;

-- AlterTable: Add approval fields to ITTicket
ALTER TABLE "ITTicket" ADD COLUMN "approvalGates" JSONB;
ALTER TABLE "ITTicket" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "ITTicket" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "ITTicket" ADD COLUMN "rejectionReason" TEXT;

-- AddForeignKey: ApprovalRule -> FormDefinition
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_formDefinitionId_fkey"
  FOREIGN KEY ("formDefinitionId") REFERENCES "FormDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ITTicket -> User (approvedBy)
ALTER TABLE "ITTicket" ADD CONSTRAINT "ITTicket_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ApprovalRule_organizationId_formDefinitionId_idx" ON "ApprovalRule"("organizationId", "formDefinitionId");
CREATE INDEX "ApprovalRule_formDefinitionId_idx" ON "ApprovalRule"("formDefinitionId");
