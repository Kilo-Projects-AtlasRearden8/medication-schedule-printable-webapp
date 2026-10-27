# Daily Medication & Supplement Schedule

A local-first, printable daily medication/supplement schedule chart and refill tracker. Built for personal organization and education — **not medical advice**. Your data never leaves your device.

**Built by Asdale Dynamics, LLC** — beginner-friendly AI education, books, and practical tools. Dylan Asdale is a registered nurse turned AI author and founder of Asdale Dynamics, LLC (Indiana, formed Oct 2026). His book *The Massive AI Manual* and hub site https://dylanasdale.github.io explain AI "like a friend would": plain English, step by step, never condescending.

## What it does

- **Build a daily schedule** — add medications or supplements with name, dose, times of day, days of the week, and optional start/end dates
- **Print a daily chart** for any date, with checkboxes to mark each dose as taken
- **Print a weekly chart** — a time-slots × days-of-the-week grid you can print from your browser
- **Large-print mode** — bigger text and touch targets for easier reading and printing
- **Refill tracker** — quantity on hand, doses per day, days of supply left, and refill-soon flags
- **Export/import JSON** — back up your data or move it between devices; nothing is uploaded anywhere
- **All data stays in your browser's localStorage** under the key `med-schedule-v1`

## How to run

No install, no build step, and no internet required.

1. Open this folder.
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
3. Add medications, pick a date, and print (Ctrl+P / Cmd+P).

Or serve it locally:

```
npm install -g serve
npm start
```

Then open the address `serve` prints (usually http://localhost:3000).

## Using the app

**Daily chart** — pick a date with the date picker or the arrow buttons. Each scheduled dose shows with a "Taken" checkbox; checking it saves your progress for that date.

**Weekly chart** — pick a Monday start date to see a time-slots × days grid. Print this page for a paper weekly chart.

**Medications** — add, edit, or delete medications. Each one needs a name and at least one time of day. Set days of the week, start/end dates, quantity on hand, and a refill threshold.

**Refill tracker** — pick a reference date to see doses per day, quantity on hand, days of supply left, and a status badge (Stocked, Refill soon, No quantity set, No refill tracking, Unknown).

**Large-print mode** — toggle "Large-print mode" in the header for bigger text, then print.

**Export / import** — "Export JSON" downloads a backup file. "Import JSON" replaces your current list with a file you exported earlier.

## Data and privacy

- Data is stored only in your browser's `localStorage` under the key `med-schedule-v1`.
- Export downloads a JSON file you control; import reads a file you choose.
- Nothing is transmitted to a server. There is no backend, no account, and no tracking.

Clearing your browser data will clear your saved medications — export a JSON backup if you want to keep them.

## Tests

Schedule logic is covered by tests in `tests/schedule.test.js` (pure functions, no browser needed):

```
npm test
```

## Disclaimer

This tool is for education and personal organization only. It is **not medical advice**, not a substitute for professional clinical judgment, and not intended to diagnose, treat, or manage any condition. Always talk to your clinician or pharmacist before starting, stopping, or changing any medication or supplement.

## License

MIT License. Copyright (c) 2026 Asdale Dynamics, LLC. See `LICENSE`.
