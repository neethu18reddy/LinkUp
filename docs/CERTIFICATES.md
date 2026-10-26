# Certificates

Phase 9 uses local `pdf-lib`, embedded Noto Sans fonts and `qrcode`. No external API, storage account or live AI is needed.

## Completion and validity

Issuance checks the owned roadmap inside a serializable transaction. A roadmap must have at least one topic, every topic must be DONE, and each project topic must have a submission from that owner. Roadmap status alone never qualifies it. A unique roadmap constraint and bounded conflict retries make concurrent issuance idempotent. Name, target role, total topic estimate and issue date are snapshotted at issuance. Hours are planned learning hours, not logged time or independently audited study.

Certificates reflect learner-reported completion and evidence, not accredited qualifications or independently reviewed project quality. Reopening coursework makes public verification INACTIVE and blocks new PDF downloads. Finishing it again restores VALID without changing the original certificate ID/date. Already downloaded PDFs cannot be recalled; they explicitly instruct readers to check current online validity.

## Privacy and routes

- `GET /certificates`: owned certificates and per-roadmap completion gates.
- `POST /certificates/issue`: `{ roadmapId, publishAcknowledged: true }`. The UI explains the public name disclosure before enabling issuance.
- `GET /certificates/:id/pdf`: authenticated owner only, streamed in memory as an attachment. No access tokens in URLs.
- `GET /public/verify/:code`: public lookup by 256-bit random hex code; only ID, recipient name, role, hours, date, verification link and current status. No email, user ID, submissions or notes.

Responses disable caching and indexing. Public verification does not require sign-in. Anyone holding the link can see the certificate details. LinkedIn sharing opens a user-controlled share screen; linkup never posts automatically.

Set `PUBLIC_WEB_URL` in the backend to the deployed frontend origin, for example `https://linkup.example`. The origin must use HTTP(S) and cannot contain credentials, query, fragment or a path. Development falls back to the first `CLIENT_URL`. Links and QR codes use this trusted configuration, never a request Host header. Localhost QR codes are local previews until deployment. Configure the final origin before sharing certificates publicly; PDF files are regenerated from saved metadata rather than uploaded to external storage.

PDFs embed SIL Open Font License Noto Sans subsets from the installed Fontsource package, supporting Latin, Greek, Cyrillic and Vietnamese text. Layout scales long names/roles to fit. Unsupported scripts return a clear 422 error instead of corrupting a name; the full original name remains on the verification page. Additional script fonts can be added later.

## Validation

Unit/API coverage checks nonempty completion, owner evidence, reopening, public lookup, authentication, malformed codes, embedded-font PDF output and unsupported glyph errors. PostgreSQL CI tests concurrent issuance, persistence, cross-account PDF denial, current validity, stable reissuance and PDF download. The sample PDF is rendered with Poppler for visual inspection.
