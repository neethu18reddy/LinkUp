# YouTube suggestions and personal study plans

Open **Mentor** for the topic-based video finder, or **Learning Studio → YouTube videos and plans** for favorite links and saved study schedules. Learning Studio is the single workspace for the learning shelf, YouTube discovery, planning and study tools. Old `/youtube` links redirect into Studio and preserve their parameters. Set only the existing server-side `YOUTUBE_API_KEY` in Vercel Production and redeploy. No new provider key or model setting is needed. Mercury/Gemini mentor routing and career roadmap generation remain unchanged.

## Find videos

Enter a topic, choose Hindi, English or both, select your level and click **Find videos**. No discovery search runs automatically. The account remembers the chosen language. Results default to YouTube relevance; **Most viewed** and **Highest rated on YouTube** use YouTube's supported search ordering. Mixed-language searches make two upstream searches and interleave the eligible results. Language is a preference; a returned result's audio language is marked unverified when YouTube does not supply it.

Up to six cards show real public views, likes and comment counts where provided, plus duration, channel and publication date. Missing counts are not replaced with zero. Expand **Show top comments** to fetch up to three top public comments. Comments render as plain text, including any HTML-looking text. Comments disabled by the owner are labeled unavailable. No sentiment score, synthetic quality score or impression count is invented. Popularity and comments do not guarantee teaching quality; impressions belong to private creator analytics.

Use **Watch on YouTube** or **Build my study plan**. The latter opens the favorite-link workflow using the exact selected video; it does not silently alter a career roadmap.

## Bring a favorite link and plan

Choose **I have a video or playlist**, paste its URL and load a preview through the existing official API importer. Playlist order is retained. Rename, split, merge or reorder chapters and review catalog skill mappings before saving. Linking the mapped skills to the current career goal is optional.

Enter a learning goal, level, preferred language, minutes per study day, weekdays, start date and optional deadline. Minutes default to the existing daily-minute goal, clamped to the planner's 10–240 minute range; video-count goals use 20 minutes. Dates use the learner's timezone. Unknown video durations require a user estimate before scheduling; estimates do not become trusted playback durations.

Preview the schedule before saving. Videos are scheduled in chapter order and long videos are split across sessions referencing the same Studio item. Each chapter includes suggested practice (10 minutes for beginners, 15 intermediate, 20 advanced) and five minutes of review. These are LinkUp planning estimates, not claims about the video content. The plan uses available titles/durations and user preferences; it does not download videos or claim transcript analysis. Infeasible deadlines produce a warning and a realistic finish date, without dropping content. Plans requiring over 3,660 study days ask for more availability or a smaller resource.

Saved plans appear in **Learning Studio → YouTube videos and plans**. Plan details use `/studio/:id/plan`; the learning shelf remains at `/studio`. Session links open Studio at the scheduled video position. Seeking earns no watch credit. Existing video progress, notes, code and analytics remain authoritative. Suggested practice/review are planning guidance, not automatic learning logs or completions. Editing chapters flags the saved schedule for regeneration; updating a schedule preserves watch progress. Resource deletion cascades to its study plan. Conflicting edits return a reload error.

## API and quota boundaries

All endpoints use existing bearer authentication and the `/api/v1` prefix:

- `GET /youtube/recommendations`: bounded topic, language, level and YouTube order.
- `GET /youtube/videos/:id/comments`: validated video ID and on-demand comments.
- `GET/PUT /youtube/preferences`, `GET /youtube/plans`: owned language preference and recent saved plans.
- `POST /resources/import/study-plan-preview`: signed, owner-bound existing import preview plus edited chapters/preferences.
- `GET/PUT /resources/:id/study-plan`, `POST /resources/:id/study-plan/preview`: owned saved plan, optimistic version and non-saving preview.

Search and comment metadata cache for six hours in a namespace separate from the existing import cache. Discovery permits three requests per fixed UTC minute and ten per UTC day per account, including cache hits. Durable shared counters cap upstream search requests at 80 per Pacific calendar day, matching YouTube's quota-day timezone; mixed languages reserve two calls. Cache hits consume no upstream allowance. Failed upstream attempts still consume reserved allowance; quota failures return a friendly error without fake recommendations. These app limits do not override the Google project's actual quota or usage by other applications.

The additive migration creates only study-plan, preference and operational quota tables. Existing tables are not rewritten. Quota buckets expire after three days and are pruned during later reservations. No API key is stored in the browser or database cache. No LLM call is added by recommendations or scheduling.

## Verification

The migration was rehearsed on an expiring production copy: all 43 existing table counts and sorted row-content fingerprints stayed identical. API/database tests use mocked official Google responses and a disposable local database. Browser QA uses a disposable local account, mocked discovery/comments and a manual favorite link; it consumes no live Google API quota. Run `npm run test:youtube-browser` after building the app and applying local migrations.

On 4 November 2026, four planner tests, four database/API integration tests and 15 frontend tests (including the original mentor tests) passed. The production build, lint, formatting and Prisma validation passed. The browser walkthrough passed mentor discovery, safe comment display, favorite-link import, schedule preview/save/reload, saved-plan listing, Studio handoff and both mentor/plan layouts at 390 pixels, with no browser errors. Existing Vite chunk-size and third-party annotation advisories remain non-blocking.

Reviewed screenshots: [mentor desktop](screenshots/youtube-mentor-desktop.png), [mentor mobile](screenshots/youtube-mentor-mobile.png), [study plan desktop](screenshots/youtube-plan-desktop.png), [study plan mobile](screenshots/youtube-plan-mobile.png). Live search relevance and quota still depend on the configured Google project and YouTube's responses; the automated walkthrough does not consume real search quota.

References: [YouTube search](https://developers.google.com/youtube/data/reference/rest/v3/search/list), [video metadata/statistics](https://developers.google.com/youtube/data/reference/rest/v3/videos), [comments](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list).
