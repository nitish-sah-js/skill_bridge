# Assessment proctoring: design

Date: 2026-10-10. Status: approved in chat, awaiting spec review.

## Goal

Make the assessment harder to game without pretending to do what a web page cannot. The test opens in its own popup window, runs fullscreen, and counts rule breaks. Rule breaks 1 to 3 show a warning; the 4th saves the latest answers and auto-submits. Auto-submitted results are labelled as such wherever results appear.

## What a browser can and cannot do (stated to the user, carried into the design)

- Cannot block new tabs/windows (Ctrl+T, Alt+Tab), OS screenshots, or phone photos.
- Can detect the test window being hidden or losing focus, leaving fullscreen, a reload (on the next load), and usually the Print Screen key.
- Can block F5 / Ctrl+R, copy, paste, cut, context menu and text selection inside the test window, and show the browser's leave-page prompt.
- Therefore: detect, warn, count, auto-submit. Not true lockdown.

## Rule set (agreed)

| Event | Effect |
|---|---|
| Window hidden (`visibilitychange`) or loses focus (`blur`) for more than 1 s | Strike `focus_lost` |
| Leaving fullscreen while the test is running | Strike `fullscreen_exit` |
| Page reloaded/re-opened while the test was running (detected on load) | Strike `reload` |
| Print Screen key | Strike `screenshot_key` |
| Copy, paste, cut, right-click, text selection, F5, Ctrl/Cmd+R | Blocked, no strike |

- One strike per away episode: `blur` + `visibilitychange` + `fullscreen_exit` caused by the same switch count once. A new episode starts only after the student returns (focus regained and the warning acknowledged).
- Focus loss shorter than 1 s is ignored.
- `MAX_WARNINGS = 3`. Strikes 1-3 warn; strike 4 auto-submits. Tunables live in `src/config/engine.ts` (`PROCTORING_CONFIG`).

## Architecture

### Pure module: `src/features/assessments/proctoring.ts`

No DOM, no IO. Exposes:

- `PROCTORING_CONFIG` re-export / types: `ViolationType = "focus_lost" | "fullscreen_exit" | "reload" | "screenshot_key"`.
- `createStrikeTracker(config)`: a small state machine fed with timestamped events (`away`, `back`, `fullscreen_exit`, `reload`, `screenshot_key`, `acknowledged`) that returns `{ strike: ViolationType } | null` per event. Encodes the grace period and the one-strike-per-episode rule.
- `strikeOutcome(count)`: `{ kind: "warning", number, remaining } | { kind: "auto_submit" }`.

Unit-tested exhaustively.

### Server

- Migration `supabase/migrations/20261011000000_assessment_proctoring.sql`:
  - `assessment_attempts` adds `violation_count integer not null default 0 check (>= 0)`, `violations jsonb not null default '[]'`, `auto_submitted boolean not null default false`.
  - `record_assessment_violation(p_attempt_id uuid, p_user_id uuid, p_type text) returns integer`: locks the row, rejects if not owner (`ATTEMPT_NOT_FOUND`) or not `in_progress` (`ATTEMPT_ALREADY_SUBMITTED`), validates the type, increments the count, appends `{type, at}` to `violations`, returns the new count. Executable only by `service_role`.
  - `finalize_assessment` is re-created to also set `auto_submitted = coalesce((p_result ->> 'autoSubmitted')::boolean, false)`. TS producer and SQL change together.
- `src/types/database.ts` updated by hand (columns + function).
- Service `recordViolation(userId, attemptId, { type, answers?, practicals? })` in `features/assessments/service.ts`:
  1. Saves the supplied draft (reuses `saveDraft`), so the auto-submit scores the latest answers.
  2. Calls `record_assessment_violation`.
  3. If the count exceeds `MAX_WARNINGS`, loads the stored drafts and calls `submitAssessment(..., { autoSubmitted: true })`.
  4. Returns `{ count, outcome }` where outcome is `warning` (with number/remaining) or `auto_submitted`.
- `submitAssessment` gains an optional `autoSubmitted` flag passed into the finalize payload.
- Route `POST /api/assessments/[attemptId]/violations` with Zod schema `violationSchema` (`type` enum + optional answers/practicals), wrapped in `handle()`.
- `AttemptView` / `AttemptSummary` expose `violationCount` and `autoSubmitted`.

### Client

- New route `src/app/assessment/[attemptId]/take/page.tsx` outside the `(app)` group: bare layout (no sidebar/header), same auth via `requireUser`, onboarding check as in `(app)` layout. Submitted attempt: shows a "test finished" screen and closes.
- `ProctoredRunner` (client component) wraps the existing `AssessmentRunner`:
  - Pre-start screen: rules in plain language, strikes already used, **Begin test** (requests fullscreen).
  - Wires DOM events into the strike tracker; on a strike calls the violations endpoint with the current draft; shows the warning dialog (blocks input; **Return to test** re-enters fullscreen and acknowledges); on `auto_submitted` shows the final screen.
  - Reload detection: `sessionStorage` flag set while running; on load, if set and the attempt is still open, records a `reload` strike before showing the pre-start screen.
  - Blocks copy/paste/cut/contextmenu/selection and F5/Ctrl+R; `beforeunload` prompt while running.
  - Strike counter in the top bar ("Warnings: n of 3").
  - On finish (normal or auto): `window.opener?.postMessage({ type: "assessment-finished", attemptId })`, then `window.close()` after a short delay; if the window cannot close (not a popup), navigate to the results page instead.
- `AssessmentRunner` gets an `onSubmitted` callback (instead of only `router.refresh()`) and a `disabled` prop for the warning state. Default behaviour unchanged for other callers.
- Opening: `StartAssessmentButton` and Resume links call `openTestWindow(attemptId)` (`window.open(url, "skillbridge-test", "popup,width=...,height=...")`). If it returns null, show "Allow popups for this site to start the test" with a retry.
- `/assessment/[attemptId]` for an open attempt shows "Your test is open in another window" with **Reopen test window**, listens for the `assessment-finished` message and refreshes.
- Results and history show "Auto-submitted after 4 rule breaks" when `autoSubmitted`.

## Error handling

- Violation request fails (offline): keep it in a queue, retry on `online`, still show the warning locally. Count shown is the server's once it answers.
- Server says attempt already submitted: show the finished screen.
- Auto-submit scoring error: surface the error, keep the window open with a retry; never fake a submission.

## Testing

- Unit: strike tracker (grace period, single strike per episode, acknowledgement resets, each event type), `strikeOutcome` thresholds, `violationSchema`.
- Integration (PGlite, `tests/integration/database.test.ts`): new columns and defaults; `record_assessment_violation` increments atomically and logs; rejects non-owner and submitted attempts; not executable by `authenticated`; `finalize_assessment` stores `autoSubmitted`.
- E2E (`tests/e2e/student-journey.spec.ts`): handle the popup (`context.waitForEvent("page")`), click Begin test, complete and submit in the popup, assert the opener shows results.

## Out of scope

Webcam/microphone proctoring, lockdown browser integration, teacher review dashboard of violation logs.
