# Controlled security observations

Recorded 2026-10-31 from authorized local automated tests and source review. These are control observations, not claims about deployed Cloudflare/AWS infrastructure. Evidence names are reproducible repository paths; no intrusive external testing was performed.

| ID | Observation | Method and evidence | Result |
|---|---|---|---|
| SEC-01 | A mutation without the session-bound CSRF header is rejected. | Supertest `backend/tests/app.test.ts` → “requires a session-bound CSRF token”. | Pass: 403 `CSRF_INVALID`. |
| SEC-02 | A valid CSRF token does not bypass role authentication. | Supertest posts to admin `/api/routes` without a user session. | Pass: 401 `UNAUTHENTICATED`. |
| SEC-03 | Invalid login does not reveal whether the email exists. | Missing account in API integration test. | Pass: generic “Email or password is incorrect.” |
| SEC-04 | Public callers cannot request inactive routes by adding `status=inactive`. | Integration test inspects the returned records. | Pass: API forces `active`. |
| SEC-05 | Non-JSON and malformed JSON bodies fail with stable safe codes. | Two integration requests in `backend/tests/app.test.ts`. | Pass: `INVALID_CONTENT_TYPE` and `MALFORMED_JSON`; no internal details returned. |
| SEC-06 | Numeric IDs and pagination reject injection-like strings, zero pages, and excessive limits. | `backend/tests/rules.test.ts`; Zod `positiveId`/`paginationSchema`. | Pass. Strict schemas validate API inputs before storage access. |
| SEC-07 | Session cookies and lifecycle use secure server controls. | Source review: `backend/src/app.ts`, auth router. | HttpOnly, SameSite=Lax, production Secure, 8-hour max age, in-memory store, regeneration on login, destruction on logout. |
| SEC-08 | Password and session material is excluded from responses/logs/audit metadata. | Source review: pino redaction, selected auth columns, `audit()` callers. | Password request field and cookie/authorization headers are redacted; audit callers pass explicit summaries. |
| SEC-09 | Unknown mutation fields cannot mass-assign roles or ownership. | Source review of strict Zod schemas; favorites use `req.session.user.id`; registration hard-codes `student`. | Pass by construction; role/user IDs are not accepted from those bodies. |
| SEC-10 | Security headers, rate limits, body limits, and CORS are applied in the app rather than relying on Cloudflare. | Source review: `backend/src/app.ts` and auth router. | Helmet, 100 KB JSON cap, global/auth limiters, one explicit origin, credentials enabled. |
| SEC-11 | Frontend text rendering has no raw HTML injection path. | Repository search for `dangerouslySetInnerHTML`/raw HTML API usage. | No application use; React escapes route, stop, and notice text. |
| SEC-12 | Health response does not disclose the local data-file path. | Local-store API integration test. | Pass: minimal 200 response and request ID; path absent. |

## Required environment checks still open

- Verify Cloudflare Full (Strict), WAF/rate rules, origin certificate, and direct-origin firewall allowlisting.
- Run an authorized TLS/header scan, JSON backup/restore drill, filesystem-permission review, and single-process load test.
- Verify production cookie `Secure` and trusted-proxy behavior through the real proxy chain.

These remain `Not run` in the test matrix until an authorized deployed target exists.
