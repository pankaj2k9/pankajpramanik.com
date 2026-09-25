-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('STOPPED', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('NOT_SENT', 'QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailVerification" AS ENUM ('VALID', 'RISKY', 'UNKNOWN', 'INVALID');

-- CreateEnum
CREATE TYPE "ReplyClass" AS ENUM ('POSITIVE', 'INTERVIEW_REQUEST', 'NEUTRAL', 'NOT_NOW', 'WRONG_PERSON', 'NEGATIVE', 'OUT_OF_OFFICE', 'UNSUBSCRIBE', 'OTHER');

-- CreateTable
CREATE TABLE "OutreachRun" (
    "id" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'STOPPED',
    "targetCount" INTEGER NOT NULL DEFAULT 5,
    "qualifiedCount" INTEGER NOT NULL DEFAULT 0,
    "threadId" TEXT NOT NULL,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyUrl" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobUrl" TEXT NOT NULL,
    "jobSource" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "remoteStatus" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "matchBreakdown" JSONB NOT NULL,
    "matchReason" TEXT NOT NULL,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "contactEmail" TEXT,
    "emailSource" TEXT,
    "emailVerification" "EmailVerification",
    "linkedinUrl" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "coverLetter" TEXT,
    "cvFilePath" TEXT,
    "cvVersion" TEXT,
    "attachCv" BOOLEAN NOT NULL DEFAULT true,
    "attachCoverLetter" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "sendStatus" "SendStatus" NOT NULL DEFAULT 'NOT_SENT',
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "sentSubject" TEXT,
    "sentBody" TEXT,
    "replyStatus" "ReplyClass",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoNotContact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoNotContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "opportunityId" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachRun_threadId_key" ON "OutreachRun"("threadId");

-- CreateIndex
CREATE INDEX "OutreachRun_status_createdAt_idx" ON "OutreachRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_contactEmail_idx" ON "Opportunity"("contactEmail");

-- CreateIndex
CREATE INDEX "Opportunity_approvalStatus_sendStatus_idx" ON "Opportunity"("approvalStatus", "sendStatus");

-- CreateIndex
CREATE INDEX "Opportunity_companyName_idx" ON "Opportunity"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_runId_jobUrl_key" ON "Opportunity"("runId", "jobUrl");

-- CreateIndex
CREATE UNIQUE INDEX "DoNotContact_email_key" ON "DoNotContact"("email");

-- CreateIndex
CREATE INDEX "DoNotContact_domain_idx" ON "DoNotContact"("domain");

-- CreateIndex
CREATE INDEX "OutreachEvent_runId_createdAt_idx" ON "OutreachEvent"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "OutreachEvent_opportunityId_createdAt_idx" ON "OutreachEvent"("opportunityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OutreachRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
