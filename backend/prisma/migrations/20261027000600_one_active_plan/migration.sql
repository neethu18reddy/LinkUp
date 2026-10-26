CREATE UNIQUE INDEX "Plan_one_active_per_roadmap" ON "Plan" ("roadmapId") WHERE "isActive" = true;
