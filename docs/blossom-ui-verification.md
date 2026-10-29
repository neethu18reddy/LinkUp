# Linkup blossom visual refresh

Adapted the supplied Petalyx visual reference to the existing Linkup React app. Linkup copy, routes, authentication, API clients and learning data remain in place.

## Implementation

- Inter Tight typography with a local DM Sans fallback, olive primary actions, lime/sage panels and rounded controls shared across public and authenticated pages.
- Scenic homepage video, watercolor clouds, frosted decorative squares, cherry-tree illustration and moonlit closing section using the assets supplied in the prompt.
- Existing GSAP learning-path choreography retained. Decorative motion respects reduced motion; video has a Play/Pause control.
- Shared theme covers dashboard, skills, goals, roadmap, planner, learning logs, mentor, certificates, notifications and authentication screens.
- No additional runtime dependencies. Fonts and scenic assets are externally hosted and require network access. No fictional customer logos or marketing statistics added.

## Verification

- Frontend TypeScript check, repository lint and frontend production build passed.
- Landing page tests: 2 passed.
- Playwright CLI opened all nine authenticated routes with the local QA account. Representative desktop and mobile screenshots captured in `.local/blossom-*.png`.
- Mobile homepage checked at 390px without horizontal overflow. Dashboard, goals, mentor and plan visited at 768px and 390px.
- An additional repeated full-reload sweep hit the local authentication refresh rate limit (HTTP 429); the complete repeated matrix did not finish. Rate-limit protection was not changed.
- Build retains a large-chunk advisory. This visual pass does not verify live Gemini or email delivery.

Preview: http://127.0.0.1:5174. Work remains local; nothing pushed or deployed.
