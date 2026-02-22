-- CreateTable TeacherSchedule
CREATE TABLE "TeacherSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
    CONSTRAINT "TeacherSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "TeacherSchedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE
);

CREATE INDEX "TeacherSchedule_organizationId_idx" ON "TeacherSchedule"("organizationId");
CREATE INDEX "TeacherSchedule_userId_idx" ON "TeacherSchedule"("userId");
CREATE INDEX "TeacherSchedule_roomId_dayOfWeek_idx" ON "TeacherSchedule"("roomId", "dayOfWeek");

-- CreateTable HVACOverride (for tracking HVAC emergency schedules)
CREATE TABLE "HVACOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "buildingLevel" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HVACOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
    CONSTRAINT "HVACOverride_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE,
    CONSTRAINT "HVACOverride_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE
);

CREATE INDEX "HVACOverride_organizationId_idx" ON "HVACOverride"("organizationId");
CREATE INDEX "HVACOverride_eventId_idx" ON "HVACOverride"("eventId");
CREATE INDEX "HVACOverride_roomId_date_idx" ON "HVACOverride"("roomId", "date");
