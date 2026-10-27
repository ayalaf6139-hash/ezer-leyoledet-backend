-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('MAIN', 'SALAD', 'DESSERT', 'OTHER');

-- CreateEnum
CREATE TYPE "ShabbatStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'TAKEN', 'DELIVERED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "lastName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "address" VARCHAR(200),
    "neighborhood" VARCHAR(100),
    "role" "Role" NOT NULL DEFAULT 'VOLUNTEER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "receiveWeeklyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(1000),
    "resetTokenHash" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" SERIAL NOT NULL,
    "familyName" VARCHAR(100) NOT NULL,
    "contactPhone" VARCHAR(20),
    "address" VARCHAR(200),
    "neighborhood" VARCHAR(100),
    "peopleCount" INTEGER NOT NULL,
    "simchaType" VARCHAR(50) NOT NULL,
    "firstShabbat" DATE NOT NULL,
    "lastShabbat" DATE NOT NULL,
    "dietaryNotes" VARCHAR(500),
    "deliveryNotes" VARCHAR(500),
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "Category" NOT NULL,
    "description" VARCHAR(300),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shabbatot" (
    "id" SERIAL NOT NULL,
    "shabbatDate" DATE NOT NULL,
    "parasha" VARCHAR(50) NOT NULL,
    "deliveryDeadline" TIMESTAMP(3) NOT NULL,
    "collectionPoint" VARCHAR(200) NOT NULL,
    "message" VARCHAR(2000),
    "status" "ShabbatStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "openSlotsReportSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shabbatot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_slots" (
    "id" SERIAL NOT NULL,
    "shabbatId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "category" "Category" NOT NULL,
    "portions" INTEGER NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetTokenHash_key" ON "users"("resetTokenHash");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "families_status_idx" ON "families"("status");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_category_key" ON "products"("name", "category");

-- CreateIndex
CREATE UNIQUE INDEX "shabbatot_shabbatDate_key" ON "shabbatot"("shabbatDate");

-- CreateIndex
CREATE INDEX "shabbatot_status_idx" ON "shabbatot"("status");

-- CreateIndex
CREATE INDEX "meal_slots_shabbatId_status_idx" ON "meal_slots"("shabbatId", "status");

-- CreateIndex
CREATE INDEX "meal_slots_familyId_idx" ON "meal_slots"("familyId");

-- CreateIndex
CREATE INDEX "assignments_slotId_idx" ON "assignments"("slotId");

-- CreateIndex
CREATE INDEX "assignments_userId_status_idx" ON "assignments"("userId", "status");

-- AddForeignKey
ALTER TABLE "meal_slots" ADD CONSTRAINT "meal_slots_shabbatId_fkey" FOREIGN KEY ("shabbatId") REFERENCES "shabbatot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_slots" ADD CONSTRAINT "meal_slots_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "meal_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== אילוצים נוספים שנכתבו ידנית (Prisma לא יודע לתאר אותם בסכמה) =====

-- מניעת כפילויות: לכל משבצת לכל היותר שיבוץ אחד שאינו מבוטל
CREATE UNIQUE INDEX "assignments_one_live_per_slot" ON "assignments"("slotId") WHERE "status" <> 'CANCELLED';

-- אילוצי תקינות
ALTER TABLE "families" ADD CONSTRAINT "families_people_count_check" CHECK ("peopleCount" BETWEEN 1 AND 30);
ALTER TABLE "families" ADD CONSTRAINT "families_shabbat_range_check" CHECK ("lastShabbat" >= "firstShabbat");
ALTER TABLE "meal_slots" ADD CONSTRAINT "meal_slots_portions_check" CHECK ("portions" BETWEEN 1 AND 100);
ALTER TABLE "shabbatot" ADD CONSTRAINT "shabbatot_is_saturday_check" CHECK (EXTRACT(ISODOW FROM "shabbatDate") = 6);
