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
