-- הארגון כולו בשכונת בית השם, ולכן אין צורך בשדה שכונה
-- AlterTable
ALTER TABLE "users" DROP COLUMN "neighborhood";

-- AlterTable
ALTER TABLE "families" DROP COLUMN "neighborhood";
