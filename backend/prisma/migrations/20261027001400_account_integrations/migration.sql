CREATE TABLE "AccountIdentity" (
  "userId" UUID NOT NULL PRIMARY KEY,
  "googleSubject" VARCHAR(255),
  "verifiedAt" TIMESTAMP(3),
  CONSTRAINT "AccountIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountIdentity_googleSubject_key" ON "AccountIdentity"("googleSubject");
CREATE TABLE "AccountToken" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");
CREATE INDEX "AccountToken_userId_kind_createdAt_idx" ON "AccountToken"("userId", "kind", "createdAt");
CREATE INDEX "AccountToken_expiresAt_idx" ON "AccountToken"("expiresAt");
ALTER TABLE "Notification" ADD COLUMN "emailClaimedAt" TIMESTAMP(3), ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0;
