-- Repeatable: never overwrite progress recorded after tracking began.
INSERT INTO "ScheduledJobState" ("id", "updatedAt")
VALUES ('studio-tracking-began', coalesce((SELECT started_at FROM "_prisma_migrations" WHERE migration_name='20261102000100_learning_studio' ORDER BY started_at LIMIT 1), now()))
ON CONFLICT DO NOTHING;
INSERT INTO "UserSettings" ("userId") SELECT "id" FROM "User" ON CONFLICT DO NOTHING;
INSERT INTO "UserSkillProgress" ("userId", "skillId", "status", "percent", "source", "beforeTracking", "updatedAt")
SELECT "userId", "skillId", 'SKIPPED', 100, 'ASSESSMENT', true, "updatedAt" FROM "UserSkill" WHERE "createdAt" <= (SELECT "updatedAt" FROM "ScheduledJobState" WHERE id='studio-tracking-began')
ON CONFLICT ("userId", "skillId") DO NOTHING;

INSERT INTO "UserSkillProgress" ("userId", "skillId", "status", "percent", "source", "manualComplete", "beforeTracking", "completedAt", "updatedAt")
SELECT r."userId", t."skillId", 'DONE', 100, 'MANUAL', true,
       bool_and(t."completedAt" IS NULL), min(t."completedAt"), coalesce(max(t."completedAt"), now())
FROM "Topic" t JOIN "Phase" p ON p.id = t."phaseId" JOIN "Roadmap" r ON r.id = p."roadmapId"
WHERE t.status = 'DONE' AND NOT t."isProject" AND t."skillId" IS NOT NULL AND (t."completedAt" IS NULL OR t."completedAt" <= (SELECT "updatedAt" FROM "ScheduledJobState" WHERE id='studio-tracking-began'))
GROUP BY r."userId", t."skillId"
ON CONFLICT ("userId", "skillId") DO UPDATE
SET "status" = 'DONE', "percent" = 100, "source" = 'MANUAL', "manualComplete" = true,
    "beforeTracking" = EXCLUDED."beforeTracking", "completedAt" = EXCLUDED."completedAt", "updatedAt" = EXCLUDED."updatedAt"
WHERE "UserSkillProgress"."beforeTracking" AND "UserSkillProgress"."source" = 'ASSESSMENT';

INSERT INTO "SkillProgressEvent" ("id", "userId", "skillId", "status", "source", "percent", "occurredAt", "legacy")
SELECT t.id, r."userId", t."skillId", 'DONE', 'MANUAL', 100, t."completedAt", true
FROM "Topic" t JOIN "Phase" p ON p.id=t."phaseId" JOIN "Roadmap" r ON r.id=p."roadmapId"
WHERE t.status='DONE' AND NOT t."isProject" AND t."skillId" IS NOT NULL AND (t."completedAt" IS NULL OR t."completedAt" <= (SELECT "updatedAt" FROM "ScheduledJobState" WHERE id='studio-tracking-began'))
ON CONFLICT DO NOTHING;
INSERT INTO "SkillProgressEvent" ("id", "userId", "skillId", "status", "source", "percent", "legacy")
SELECT md5("userId"::text || ':' || "skillId"::text || ':starting-skill')::uuid, "userId", "skillId", 'SKIPPED', 'ASSESSMENT', 100, true
FROM "UserSkill" WHERE "createdAt" <= (SELECT "updatedAt" FROM "ScheduledJobState" WHERE id='studio-tracking-began') ON CONFLICT DO NOTHING;
