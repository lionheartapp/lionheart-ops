-- AlterTable: Add SAML NameID to User
ALTER TABLE "User" ADD COLUMN "samlNameId" TEXT;

-- CreateTable: SamlConnection
CREATE TABLE "SamlConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "idpEntityId" TEXT NOT NULL,
    "idpSsoUrl" TEXT NOT NULL,
    "idpCertificate" TEXT NOT NULL,
    "spEntityId" TEXT NOT NULL,
    "spAcsUrl" TEXT NOT NULL,
    "nameIdFormat" TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    "emailAttr" TEXT NOT NULL DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    "firstNameAttr" TEXT,
    "lastNameAttr" TEXT,
    "autoProvisionUsers" BOOLEAN NOT NULL DEFAULT false,
    "defaultRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamlConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SamlConnection_organizationId_key" ON "SamlConnection"("organizationId");

-- AddForeignKey
ALTER TABLE "SamlConnection" ADD CONSTRAINT "SamlConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
