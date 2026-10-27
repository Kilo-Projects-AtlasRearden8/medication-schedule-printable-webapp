# STATUS

Daily Medication & Supplement Schedule — local-first static web app.

## What was built

A printable daily medication/supplement schedule chart and refill tracker (education/organization only, no medical advice):

- **schedule.js** — pure, testable schedule logic: date helpers (parse/format/add/daysBetween/dayOfWeek), `scheduledDosesOnDate`, `dailyDoseCount`, `daysOfSupplyLeft`, `refillStatus`, `weeklyGrid`, `allDosesOnDate`, `validateMedication`, `newMedication`
- **app.js** — UI: daily/weekly/medications/refill views, localStorage persistence under `med-schedule-v1`, taken-dose checkboxes, export/import JSON, large-print mode
- **index.html** — shell with four nav views, print styles, footer crediting Asdale Dynamics, LLC
- **styles.css** — responsive styling, print layout, large-print mode, refill status badges
- **tests/schedule.test.js** — 25 tests, plain Node `assert`, no browser/framework
- **LICENSE** — MIT, Copyright (c) 2026 Asdale Dynamics, LLC
- **README.md** — usage, privacy, disclaimer, test and run instructions
- **STATUS.md** — this file

## How to run

No install, no build step, no internet required:

1. Open this folder.
2. Open `index.html` in any modern browser.
3. Add medications, pick a date, print.

Optional local serve:

```
npm install -g serve
npm start
```

Tests:

```
npm test
```

## Verification results

- `npm test`: **25/25 tests pass** (schedule logic: dates, doses, refill tracking, weekly grid, validation)
- `node --check`: `src/app.js`, `src/schedule.js`, `tests/schedule.test.js` all parse cleanly
- All DOM elements referenced by `src/app.js` exist in `index.html` (previously `med-days` and `btn-add-time` were missing and crashed initialization — fixed)
- Start/end date range checks in `scheduledDosesOnDate` were inverted and let out-of-range dates through / blocked in-range ones — fixed
- Refill badge CSS class mismatch fixed (`badge-refill-soon`)

## Known gaps

- Weekly chart does not reflect "taken" checkbox state (taken doses are stored in `state.doses` but only rendered in the daily view)
- `dosesPerDay` is stored per medication but unused; doses per day are computed from the times list
- `npm start` requires a globally installed `serve`; otherwise open `index.html` directly
- Data lives in browser `localStorage` only (by design); clearing browser data wipes it — export JSON to back up
- No bundler/build step; plain HTML/CSS/JS
