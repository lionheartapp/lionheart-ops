-- AlterTable: Add updatedById to FormDefinition
ALTER TABLE "FormDefinition" ADD COLUMN "updatedById" TEXT;

-- AddForeignKey
ALTER TABLE "FormDefinition" ADD CONSTRAINT "FormDefinition_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
