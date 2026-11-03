CREATE TABLE "YouTubeStudyPlan" (
 "resourceId" UUID NOT NULL, "userId" UUID NOT NULL, "goal" VARCHAR(200) NOT NULL,
 "level" VARCHAR(20) NOT NULL, "language" VARCHAR(10) NOT NULL, "timezone" VARCHAR(100) NOT NULL,
 "preferences" JSONB NOT NULL, "schedule" JSONB NOT NULL, "resourceVersion" INTEGER NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "YouTubeStudyPlan_pkey" PRIMARY KEY ("resourceId"),
 CONSTRAINT "YouTubeStudyPlan_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "StudioResource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "YouTubeStudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "YouTubeStudyPlan_userId_updatedAt_idx" ON "YouTubeStudyPlan"("userId", "updatedAt");
CREATE TABLE "YouTubePreference" (
 "userId" UUID NOT NULL, "language" VARCHAR(10) NOT NULL,
 CONSTRAINT "YouTubePreference_pkey" PRIMARY KEY ("userId"),
 CONSTRAINT "YouTubePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "YouTubeSearchBudget" (
 "key" VARCHAR(150) NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "YouTubeSearchBudget_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "YouTubeSearchBudget_expiresAt_idx" ON "YouTubeSearchBudget"("expiresAt");
