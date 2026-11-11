-- CreateEnum
CREATE TYPE "ThankYouStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateTable
CREATE TABLE "thank_yous" (
    "id" SERIAL NOT NULL,
    "familyName" VARCHAR(100) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "status" "ThankYouStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thank_yous_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thank_yous_status_createdAt_idx" ON "thank_yous"("status", "createdAt");
