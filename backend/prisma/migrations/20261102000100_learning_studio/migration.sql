-- Forward-only Learning Studio tables; existing tables and records remain intact.
CREATE TYPE "SkillProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'SKIPPED');

CREATE TYPE "SkillProgressSource" AS ENUM ('MANUAL', 'RESOURCE', 'ASSESSMENT');

CREATE TABLE "UserSkillProgress" (
  "userId" UUID NOT NULL,
  "skillId" UUID NOT NULL,
  "status" "SkillProgressStatus" NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source" "SkillProgressSource" NOT NULL,
  "manualComplete" BOOLEAN NOT NULL DEFAULT false,
  "beforeTracking" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSkillProgress_pkey" PRIMARY KEY ("userId", "skillId")
);

CREATE TABLE "UserSettings" (
  "userId" UUID NOT NULL,
  "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
  "timezoneConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "dailyGoalType" VARCHAR(10) NOT NULL DEFAULT 'minutes',
  "dailyGoalValue" INTEGER NOT NULL DEFAULT 20,
  "autoplayNext" BOOLEAN NOT NULL DEFAULT false,
  "emojiRecap" BOOLEAN NOT NULL DEFAULT true,
  "confirmSkillCompletion" BOOLEAN NOT NULL DEFAULT false,
  "completionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "StudioResource" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "provider" VARCHAR(20) NOT NULL,
  "externalId" VARCHAR(200),
  "title" VARCHAR(200) NOT NULL,
  "channel" VARCHAR(200) NOT NULL DEFAULT '',
  "thumbnailUrl" VARCHAR(2048),
  "totalDurationSec" INTEGER NOT NULL DEFAULT 0,
  "videoCount" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "targetRoleId" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StudioResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudioSection" (
  "id" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "order" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "topicSummary" VARCHAR(500) NOT NULL,
  "topicTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "totalDurationSec" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StudioSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudioSectionSkill" (
  "sectionId" UUID NOT NULL,
  "skillId" UUID NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  CONSTRAINT "StudioSectionSkill_pkey" PRIMARY KEY ("sectionId", "skillId")
);

CREATE TABLE "ResourceItem" (
  "id" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "sectionId" UUID NOT NULL,
  "order" INTEGER NOT NULL,
  "externalVideoId" VARCHAR(20),
  "title" VARCHAR(200) NOT NULL,
  "url" VARCHAR(2048),
  "durationSec" INTEGER NOT NULL DEFAULT 0,
  "thumbnailUrl" VARCHAR(2048),
  "available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ResourceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemProgress" (
  "userId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "watchedSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contentWatchedSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastPositionSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" VARCHAR(20) NOT NULL DEFAULT 'not_started',
  "completedAt" TIMESTAMP(3),
  "firstCompletedAt" TIMESTAMP(3),
  "completedBy" VARCHAR(10),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemProgress_pkey" PRIMARY KEY ("userId", "itemId")
);

CREATE TABLE "WatchSession" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "wallSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contentSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "WatchSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchLease" (
  "userId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WatchLease_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "WatchEvent" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "secondsWatched" DOUBLE PRECISION NOT NULL,
  "contentSeconds" DOUBLE PRECISION NOT NULL,
  "localDate" VARCHAR(10) NOT NULL,
  "timezone" VARCHAR(100) NOT NULL,
  CONSTRAINT "WatchEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudioActivity" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "itemId" UUID,
  "requestId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudioNote" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "itemId" UUID,
  "timestampSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bodyMd" VARCHAR(20000) NOT NULL,
  "type" VARCHAR(20) NOT NULL DEFAULT 'Key idea',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CodeSnippet" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "itemId" UUID,
  "sectionId" UUID,
  "title" VARCHAR(200) NOT NULL,
  "language" VARCHAR(20) NOT NULL,
  "code" VARCHAR(50000) NOT NULL,
  "timestampSec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodeSnippet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SnippetVersion" (
  "id" UUID NOT NULL,
  "snippetId" UUID NOT NULL,
  "code" VARCHAR(50000) NOT NULL,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SnippetVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SnippetRun" (
  "id" UUID NOT NULL,
  "snippetId" UUID NOT NULL,
  "language" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SnippetRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyStat" (
  "userId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "localDate" VARCHAR(10) NOT NULL,
  "secondsWatched" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "contentSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "videosCompleted" INTEGER NOT NULL DEFAULT 0,
  "notesCount" INTEGER NOT NULL DEFAULT 0,
  "snippetsCount" INTEGER NOT NULL DEFAULT 0,
  "runsCount" INTEGER NOT NULL DEFAULT 0,
  "topicTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("userId", "resourceId", "localDate")
);

CREATE TABLE "DailyRecap" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "localDate" VARCHAR(10) NOT NULL,
  "payload" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyRecap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudioPlaylistCache" (
  "externalId" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioPlaylistCache_pkey" PRIMARY KEY ("externalId")
);

ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "UserSkillProgress_userId_status_idx" ON "UserSkillProgress"("userId", "status");
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioResource" ADD CONSTRAINT "StudioResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "StudioResource_userId_importedAt_idx" ON "StudioResource"("userId", "importedAt");
ALTER TABLE "StudioSection" ADD CONSTRAINT "StudioSection_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StudioSection_resourceId_order_key" ON "StudioSection"("resourceId", "order");
CREATE UNIQUE INDEX "StudioSection_id_resourceId_key" ON "StudioSection"("id", "resourceId");
ALTER TABLE "StudioSectionSkill" ADD CONSTRAINT "StudioSectionSkill_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "StudioSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioSectionSkill" ADD CONSTRAINT "StudioSectionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "StudioSectionSkill_skillId_idx" ON "StudioSectionSkill"("skillId");
ALTER TABLE "ResourceItem" ADD CONSTRAINT "ResourceItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceItem" ADD CONSTRAINT "ResourceItem_sectionId_resourceId_fkey" FOREIGN KEY ("sectionId", "resourceId") REFERENCES "StudioSection"("id", "resourceId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ResourceItem_resourceId_order_key" ON "ResourceItem"("resourceId", "order");
CREATE INDEX "ResourceItem_sectionId_idx" ON "ResourceItem"("sectionId");
ALTER TABLE "ItemProgress" ADD CONSTRAINT "ItemProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemProgress" ADD CONSTRAINT "ItemProgress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ResourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ResourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "WatchSession_userId_lastAt_idx" ON "WatchSession"("userId", "lastAt");
ALTER TABLE "WatchLease" ADD CONSTRAINT "WatchLease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchEvent" ADD CONSTRAINT "WatchEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchEvent" ADD CONSTRAINT "WatchEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchEvent" ADD CONSTRAINT "WatchEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ResourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "WatchEvent_userId_requestId_localDate_key" ON "WatchEvent"("userId", "requestId", "localDate");
CREATE INDEX "WatchEvent_userId_localDate_idx" ON "WatchEvent"("userId", "localDate");
CREATE INDEX "WatchEvent_resourceId_startedAt_idx" ON "WatchEvent"("resourceId", "startedAt");
ALTER TABLE "StudioActivity" ADD CONSTRAINT "StudioActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioActivity" ADD CONSTRAINT "StudioActivity_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StudioActivity_requestId_key" ON "StudioActivity"("requestId");
CREATE INDEX "StudioActivity_resourceId_createdAt_idx" ON "StudioActivity"("resourceId", "createdAt");
ALTER TABLE "StudioNote" ADD CONSTRAINT "StudioNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioNote" ADD CONSTRAINT "StudioNote_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioNote" ADD CONSTRAINT "StudioNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ResourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "StudioNote_userId_updatedAt_idx" ON "StudioNote"("userId", "updatedAt");
CREATE INDEX "StudioNote_resourceId_itemId_idx" ON "StudioNote"("resourceId", "itemId");
ALTER TABLE "CodeSnippet" ADD CONSTRAINT "CodeSnippet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSnippet" ADD CONSTRAINT "CodeSnippet_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSnippet" ADD CONSTRAINT "CodeSnippet_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ResourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodeSnippet" ADD CONSTRAINT "CodeSnippet_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "StudioSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CodeSnippet_userId_updatedAt_idx" ON "CodeSnippet"("userId", "updatedAt");
CREATE INDEX "CodeSnippet_resourceId_itemId_idx" ON "CodeSnippet"("resourceId", "itemId");
ALTER TABLE "SnippetVersion" ADD CONSTRAINT "SnippetVersion_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "CodeSnippet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SnippetVersion_snippetId_savedAt_idx" ON "SnippetVersion"("snippetId", "savedAt");
ALTER TABLE "SnippetRun" ADD CONSTRAINT "SnippetRun_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "CodeSnippet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SnippetRun_snippetId_createdAt_idx" ON "SnippetRun"("snippetId", "createdAt");
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "DailyStat_userId_localDate_idx" ON "DailyStat"("userId", "localDate");
ALTER TABLE "DailyRecap" ADD CONSTRAINT "DailyRecap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DailyRecap_userId_localDate_key" ON "DailyRecap"("userId", "localDate");

ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "skill_percent_range" CHECK ("percent" BETWEEN 0 AND 100);

-- Repeatable: never overwrite progress recorded after tracking began.
INSERT INTO "UserSettings" ("userId") SELECT "id" FROM "User" ON CONFLICT DO NOTHING;
INSERT INTO "UserSkillProgress" ("userId", "skillId", "status", "percent", "source", "beforeTracking", "updatedAt")
SELECT "userId", "skillId", 'SKIPPED', 100, 'ASSESSMENT', true, "updatedAt" FROM "UserSkill"
ON CONFLICT ("userId", "skillId") DO NOTHING;

INSERT INTO "UserSkillProgress" ("userId", "skillId", "status", "percent", "source", "manualComplete", "beforeTracking", "completedAt", "updatedAt")
SELECT r."userId", t."skillId", 'DONE', 100, 'MANUAL', true,
       bool_and(t."completedAt" IS NULL), min(t."completedAt"), coalesce(max(t."completedAt"), now())
FROM "Topic" t JOIN "Phase" p ON p.id = t."phaseId" JOIN "Roadmap" r ON r.id = p."roadmapId"
WHERE t.status = 'DONE' AND NOT t."isProject" AND t."skillId" IS NOT NULL
GROUP BY r."userId", t."skillId"
ON CONFLICT ("userId", "skillId") DO UPDATE
SET "status" = 'DONE', "percent" = 100, "source" = 'MANUAL', "manualComplete" = true,
    "beforeTracking" = EXCLUDED."beforeTracking", "completedAt" = EXCLUDED."completedAt", "updatedAt" = EXCLUDED."updatedAt"
WHERE "UserSkillProgress"."beforeTracking" AND "UserSkillProgress"."source" = 'ASSESSMENT';
