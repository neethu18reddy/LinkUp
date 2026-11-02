ALTER TABLE "StudioResource" ADD CONSTRAINT "StudioResource_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "RoleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WatchLease" ADD CONSTRAINT "WatchLease_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioActivity" ADD CONSTRAINT "StudioActivity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ResourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "ScheduledJobState" ("id", "updatedAt")
VALUES ('studio-tracking-began', coalesce((SELECT started_at FROM "_prisma_migrations" WHERE migration_name='20261102000100_learning_studio' ORDER BY started_at LIMIT 1), now()))
ON CONFLICT DO NOTHING;
