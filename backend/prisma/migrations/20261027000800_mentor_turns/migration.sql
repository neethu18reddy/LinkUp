ALTER TABLE "ChatSession" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "busyToken" UUID, ADD COLUMN "busyUntil" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN "requestId" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN "position" INTEGER, ADD COLUMN "mode" VARCHAR(30) NOT NULL DEFAULT 'offline';
ALTER TABLE "ChatMessage" ALTER COLUMN "requestId" DROP DEFAULT;
WITH ordered AS (
 SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt", "id") - 1)::integer AS ordinal FROM "ChatMessage"
) UPDATE "ChatMessage" AS m SET "position" = ordered.ordinal FROM ordered WHERE m."id" = ordered."id";
ALTER TABLE "ChatMessage" ALTER COLUMN "position" SET NOT NULL;
UPDATE "ChatSession" AS s SET "version" = (SELECT COUNT(*)::integer FROM "ChatMessage" m WHERE m."sessionId" = s."id");
CREATE UNIQUE INDEX "ChatMessage_sessionId_position_key" ON "ChatMessage" ("sessionId", "position");
CREATE UNIQUE INDEX "ChatMessage_sessionId_requestId_role_key" ON "ChatMessage" ("sessionId", "requestId", "role");
