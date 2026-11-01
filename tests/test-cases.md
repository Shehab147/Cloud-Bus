# Test case matrix

`Pass` means the named automated check ran locally on 2026-10-31. `Not run` is intentionally honest: it needs a browser/deployed target or manual authorized evidence.

| Test Case ID | Related Task | Scenario | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|
| API-001 | Health | Local storage available | Seed store loaded | GET `/api/health` | Local JSON store | Minimal 200 JSON + request ID, no path | 200 `{status:ok}` | Pass | `backend/tests/app.test.ts` |
| SEC-001 | CSRF | Mutation without token | No token | POST register | Valid body | 403 | 403 `CSRF_INVALID` | Pass | Integration test |
| SEC-002 | Authorization | CSRF cannot bypass admin auth | CSRF session, no user | POST route | Route name | 401 | 401 `UNAUTHENTICATED` | Pass | Integration test |
| SEC-003 | Auth | Unknown email login | CSRF session | POST login | Missing email | Generic 401 | Generic message | Pass | No enumeration |
| SEC-004 | Parsing | Unsupported content type | CSRF session | POST text/plain | `hello` | Safe 400 | `INVALID_CONTENT_TYPE` | Pass | Integration test |
| SEC-005 | Parsing | Malformed JSON | CSRF session | POST malformed JSON | `{bad json` | Safe 400 | `MALFORMED_JSON` | Pass | Integration test |
| SEC-006 | Validation | SQL-like ID rejected | None | Parse ID | `1 OR 1=1` | Validation failure | Rejected | Pass | Unit test |
| VAL-001 | Pagination | Bounds and normalization | None | Parse queries | page 2/limit 20; page 0/101 | Trim/coerce valid; reject invalid | As expected | Pass | Unit test |
| VAL-002 | Schedule fields | Strict ISO date and HH:mm | None | Parse inputs | valid/invalid pairs | Only strict values accepted | As expected | Pass | Unit test |
| VAL-003 | Partial updates | PATCH does not inject create defaults | None | Parse single-field route/stop/timetable/notice updates | One changed field each | Omitted status/scope/description stay omitted | As expected | Pass | Regression test |
| SCH-001 | Weekday/weekend | Day matches schedule type | None | Validate rows | weekday Mon/Fri, Sunday; weekend Sat/Sun, Tuesday | Valid accepted, mismatches rejected | As expected | Pass | Unit test |
| SCH-002 | Seasonal | Seasonal priority | None | Evaluate eligibility | seasonal available true/false | Seasonal overrides ordinary | As expected | Pass | Unit test |
| SCH-003 | Timezone | Cairo DST offset | Luxon timezone data | Compare dates around 2026 DST start | Apr 23/24 noon | Offset changes 60 min | 60 min | Pass | Unit test |
| RTE-001 | Public routes | Inactive filter cannot leak | Seed data loaded | GET with `status=inactive` | Demo routes | Only active records and pagination | Active forced | Pass | Integration test |
| UI-001 | Buttons | Busy mutation control | Render shared button | Inspect button | `Adding…` | Named and disabled | Named/disabled | Pass | RTL test |
| UI-002 | Pagination | Boundary controls | Render page 1 and 3 | Click Next | 42 rows | Valid callback; bounds disabled | As expected | Pass | RTL test |
| UI-003 | Error state | Accessible retry | Render error | Query alert, click retry | Service unavailable | Alert semantics + callback | As expected | Pass | RTL test |
| FE-001 | API client | Mutation lifecycle | Mock fetch | POST favorite | stop 1 | credentials, JSON, CSRF | All headers present | Pass | Vitest |
| FE-002 | API client | Field errors preserved | Mock 400 | POST route | Empty name | ApiError retains field map | Preserved | Pass | Vitest |
| FE-003 | API client | Request timeout | Mock pending fetch | Advance 25 ms timeout | GET routes | Actionable 408 timeout | `TIMEOUT` returned | Pass | Vitest fake timers |
| DATA-001 | Seed | Reset local data | Writable local path | Run `npm run data:reset`, inspect JSON | Fictional records | Valid demo data without duplicates | Command verified locally | Pass | Reset intentionally removes users |
| DATA-002 | Persistence | Atomic local write | Single Express process | Mutate a record and reload | JSON file | Complete valid JSON, no partial file | Source/automated verification | Pass | Temporary-file rename |
| AUTH-001 | Full auth | Register/login/logout/expiry | Browser/API agent | Complete lifecycle | Unique student | Session persists then invalidates | Not executed end to end | Not run | Restart also clears in-memory sessions |
| RTE-002 | Route reorder | Rollback on invalid stop | Admin session | Save valid order then invalid IDs | Duplicates/inactive/missing | 400 and prior order intact | Not executed end to end | Not run | Serialized cloned mutation |
| STP-001 | Stop map | Invalid coordinates and picker | Browser + API | Try out-of-range, click picker | ±bounds | Inline rejection; map remains stable | Not manually verified | Not run | Type/build verified only |
| SCH-004 | Next departures | Midnight, Sun/Mon, end date, no schedule | Seeded local store | Query boundary instants | Cairo cases | Chronological seven-day results | Not executed end to end | Not run | Luxon/rules reviewed |
| ANN-001 | Notice scopes | Global/route/stop and expiry | Seeded local store | Publish each scope then expire | Mixed routes/stops | Only relevant active notices, no duplicates | Not executed end to end | Not run | Scope logic implemented |
| FAV-001 | Favorite ownership | Duplicate, persistence, IDOR, inactive stop | Two students + admin | Add twice, remove cross-user, deactivate | Shared stop | 409 duplicate; IDOR fails; favorite preserved | Not executed end to end | Not run | Session ownership implemented |
| FLOW-001 | Full user flow | Admin publish to student favorite | Seed data + two roles | Create route/stops/timetable; save; notice | Coursework flow | Student sees schedule and update | Not executed end to end | Not run | Demo script documents steps |
| A11Y-001 | Accessibility | Keyboard, focus, dialog restore, mobile | Browser matrix | Tab all pages, submit invalid forms | Light/dark/mobile | Visible focus and usable order | Not manually verified | Not run | Automated component semantics partial |
| PERF-001 | Load | Search/list and auth load behavior | Authorized staging | k6/Artillery bounded test | Agreed rate | Meets agreed latency/error target | No target provisioned | Not run | Do not test without authorization |
| OPS-001 | Deployment | TLS, origin bypass, logs, health | Deployed target | Smoke and security checks | Production URL | Full Strict; origin blocked; logs/health work | No target provisioned | Not run | Runbook provided |
| OPS-002 | Restore | Actual JSON restore | Backup + separate test path | Restore file and start test API | Latest backup | Records valid and RTO/RPO evidence recorded | No target provisioned | Not run | Mandatory before go-live |
