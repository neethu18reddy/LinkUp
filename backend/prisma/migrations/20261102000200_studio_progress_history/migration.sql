-- Keep dated legacy wins independently of later completion toggles.
CREATE TABLE "SkillProgressEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "skillId" UUID NOT NULL,
  "status" "SkillProgressStatus" NOT NULL,
  "source" "SkillProgressSource" NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "legacy" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SkillProgressEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SkillProgressEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SkillProgressEvent_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SkillProgressEvent_userId_occurredAt_idx" ON "SkillProgressEvent"("userId", "occurredAt");
INSERT INTO "SkillProgressEvent" ("id", "userId", "skillId", "status", "source", "percent", "occurredAt", "legacy")
SELECT t.id, r."userId", t."skillId", 'DONE', 'MANUAL', 100, t."completedAt", true
FROM "Topic" t JOIN "Phase" p ON p.id=t."phaseId" JOIN "Roadmap" r ON r.id=p."roadmapId"
WHERE t.status='DONE' AND NOT t."isProject" AND t."skillId" IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO "SkillProgressEvent" ("id", "userId", "skillId", "status", "source", "percent", "legacy")
SELECT md5("userId"::text || ':' || "skillId"::text || ':starting-skill')::uuid, "userId", "skillId", 'SKIPPED', 'ASSESSMENT', 100, true
FROM "UserSkill" ON CONFLICT DO NOTHING;
