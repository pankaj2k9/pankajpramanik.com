-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('GENERIC', 'SERVICE');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "kind" "PageKind" NOT NULL DEFAULT 'GENERIC',
ADD COLUMN     "label" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Page_kind_idx" ON "Page"("kind");
