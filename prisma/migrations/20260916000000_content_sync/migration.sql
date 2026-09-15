-- CreateTable
CREATE TABLE "ContentSync" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSync_pkey" PRIMARY KEY ("id")
);
