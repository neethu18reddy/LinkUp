ALTER TABLE "LearningLog" ADD COLUMN "requestId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "LearningLog" ALTER COLUMN "requestId" DROP DEFAULT;
CREATE UNIQUE INDEX "LearningLog_userId_requestId_key" ON "LearningLog" ("userId", "requestId");
