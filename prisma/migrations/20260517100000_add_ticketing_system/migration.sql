-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EventTicketStatus" AS ENUM ('VALID', 'USED', 'CANCELLED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('STANDARD', 'ACCESSIBLE', 'COMPANION', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SeatAvailability" AS ENUM ('AVAILABLE', 'HELD', 'SOLD', 'BLOCKED');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "FormFieldType" ADD VALUE 'TICKET_SELECTOR';

-- AlterTable: FormDefinition — add ticketing fields
ALTER TABLE "FormDefinition" ADD COLUMN "maxCapacity" INTEGER;
ALTER TABLE "FormDefinition" ADD COLUMN "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FormDefinition" ADD COLUMN "discountCodes" JSONB;
ALTER TABLE "FormDefinition" ADD COLUMN "eventProjectId" TEXT;
ALTER TABLE "FormDefinition" ADD COLUMN "status" "FormStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "FormDefinition_eventProjectId_key" ON "FormDefinition"("eventProjectId");

-- AddForeignKey
ALTER TABLE "FormDefinition" ADD CONSTRAINT "FormDefinition_eventProjectId_fkey" FOREIGN KEY ("eventProjectId") REFERENCES "EventProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: TicketType
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "maxPerOrder" INTEGER,
    "totalInventory" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "depositPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketType_formId_idx" ON "TicketType"("formId");
CREATE INDEX "TicketType_formId_isActive_idx" ON "TicketType"("formId", "isActive");

ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: FormOrder
CREATE TABLE "FormOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "submissionId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "discountCode" TEXT,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormOrder_submissionId_key" ON "FormOrder"("submissionId");
CREATE UNIQUE INDEX "FormOrder_stripePaymentIntentId_key" ON "FormOrder"("stripePaymentIntentId");
CREATE INDEX "FormOrder_organizationId_idx" ON "FormOrder"("organizationId");
CREATE INDEX "FormOrder_formId_idx" ON "FormOrder"("formId");
CREATE INDEX "FormOrder_buyerEmail_idx" ON "FormOrder"("buyerEmail");
CREATE INDEX "FormOrder_organizationId_status_idx" ON "FormOrder"("organizationId", "status");

ALTER TABLE "FormOrder" ADD CONSTRAINT "FormOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormOrder" ADD CONSTRAINT "FormOrder_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FormOrder" ADD CONSTRAINT "FormOrder_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: OrderLineItem
CREATE TABLE "OrderLineItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "OrderLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FormOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLineItem" ADD CONSTRAINT "OrderLineItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: EventTicket
CREATE TABLE "EventTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "status" "EventTicketStatus" NOT NULL DEFAULT 'VALID',
    "seatId" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTicket_ticketCode_key" ON "EventTicket"("ticketCode");
CREATE INDEX "EventTicket_orderId_idx" ON "EventTicket"("orderId");
CREATE INDEX "EventTicket_ticketCode_idx" ON "EventTicket"("ticketCode");
CREATE INDEX "EventTicket_organizationId_idx" ON "EventTicket"("organizationId");

ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FormOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- EventTicket_seatId_fkey deferred to end of file (Seat table created below)

-- CreateTable: TicketDesign
CREATE TABLE "TicketDesign" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "canvasWidth" INTEGER NOT NULL DEFAULT 1050,
    "canvasHeight" INTEGER NOT NULL DEFAULT 450,
    "backgroundUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketDesign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketDesign_formId_key" ON "TicketDesign"("formId");

ALTER TABLE "TicketDesign" ADD CONSTRAINT "TicketDesign_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Venue
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalCapacity" INTEGER NOT NULL,
    "layoutConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Venue_organizationId_idx" ON "Venue"("organizationId");

ALTER TABLE "Venue" ADD CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: VenueSection
CREATE TABLE "VenueSection" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "seatsPerRow" INTEGER NOT NULL,
    "rowStartLabel" TEXT NOT NULL DEFAULT 'A',
    "color" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VenueSection_venueId_idx" ON "VenueSection"("venueId");

ALTER TABLE "VenueSection" ADD CONSTRAINT "VenueSection_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Seat
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "row" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "seatType" "SeatType" NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Seat_sectionId_idx" ON "Seat"("sectionId");

ALTER TABLE "Seat" ADD CONSTRAINT "Seat_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VenueSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: EventSeatingMap
CREATE TABLE "EventSeatingMap" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSeatingMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventSeatingMap_formId_key" ON "EventSeatingMap"("formId");
CREATE INDEX "EventSeatingMap_venueId_idx" ON "EventSeatingMap"("venueId");

ALTER TABLE "EventSeatingMap" ADD CONSTRAINT "EventSeatingMap_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSeatingMap" ADD CONSTRAINT "EventSeatingMap_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: EventSeatStatus
CREATE TABLE "EventSeatStatus" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "status" "SeatAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "heldBy" TEXT,
    "heldUntil" TIMESTAMP(3),
    "orderId" TEXT,
    "ticketId" TEXT,

    CONSTRAINT "EventSeatStatus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventSeatStatus_mapId_status_idx" ON "EventSeatStatus"("mapId", "status");
CREATE INDEX "EventSeatStatus_heldUntil_idx" ON "EventSeatStatus"("heldUntil");
CREATE UNIQUE INDEX "EventSeatStatus_mapId_seatId_key" ON "EventSeatStatus"("mapId", "seatId");

ALTER TABLE "EventSeatStatus" ADD CONSTRAINT "EventSeatStatus_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "EventSeatingMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSeatStatus" ADD CONSTRAINT "EventSeatStatus_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deferred FK: EventTicket -> Seat (Seat table now exists)
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
