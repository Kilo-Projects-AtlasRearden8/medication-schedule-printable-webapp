// Tests for the pure schedule logic in src/schedule.js.
// Runs in plain Node with the built-in `assert` module — no browser, no framework.
import assert from 'node:assert/strict';
import {
  parseDate,
  formatDate,
  addDays,
  daysBetween,
  dayOfWeek,
  scheduledDosesOnDate,
  dailyDoseCount,
  daysOfSupplyLeft,
  refillStatus,
  weeklyGrid,
  allDosesOnDate,
  validateMedication,
  newMedication,
} from '../src/schedule.js';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.message);
  }
}
function summary() {
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll tests passed.');
}

// --- Date helpers ---

test('parseDate reads YYYY-MM-DD', () => {
  const d = parseDate('2026-10-27');
  assert.ok(d instanceof Date);
  assert.strictEqual(formatDate(d), '2026-10-27');
});

test('parseDate rejects invalid dates', () => {
  assert.strictEqual(parseDate(''), null);
  assert.strictEqual(parseDate('not-a-date'), null);
  assert.strictEqual(parseDate('2026-13-01'), null);
  assert.strictEqual(parseDate('2026-02-30'), null);
  assert.strictEqual(parseDate('27-10-2026'), null);
});

test('formatDate pads month and day', () => {
  assert.strictEqual(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('addDays crosses month and year boundaries', () => {
  assert.strictEqual(addDays(new Date(2026, 11, 31), 1), '2027-01-01');
  assert.strictEqual(addDays(new Date(2026, 1, 28), 1), '2026-03-01'); // 2026 not a leap year
  assert.strictEqual(addDays(new Date(2026, 0, 1), -1), '2025-12-31');
});

test('daysBetween counts calendar days', () => {
  assert.strictEqual(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 2)), 1);
  assert.strictEqual(daysBetween(new Date(2026, 0, 2), new Date(2026, 0, 1)), -1);
  assert.strictEqual(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 1)), 0);
  assert.strictEqual(daysBetween(new Date(2026, 0, 31), new Date(2026, 1, 1)), 1);
});

test('dayOfWeek Sunday is 0', () => {
  assert.strictEqual(dayOfWeek(new Date(2026, 9, 4)), 0); // 2026-10-04 is a Sunday
  assert.strictEqual(dayOfWeek(new Date(2026, 9, 5)), 1); // Monday
});

// --- Scheduled doses ---

const dailyMeds = {
  id: 'm1',
  name: 'Vitamin D',
  dose: '2000 IU',
  times: [{ id: 't1', time: '08:00' }, { id: 't2', time: '20:00' }],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-10-01',
  endDate: '2026-10-31',
};

test('scheduledDosesOnDate returns both daily doses in range', () => {
  const doses = scheduledDosesOnDate(dailyMeds, '2026-10-15');
  assert.deepStrictEqual(doses, [
    { time: '08:00', label: 'Vitamin D 2000 IU' },
    { time: '20:00', label: 'Vitamin D 2000 IU' },
  ]);
});

test('scheduledDosesOnDate respects days of week', () => {
  const weekdays = { ...dailyMeds, daysOfWeek: [1, 2, 3, 4, 5] };
  // 2026-10-04 is a Sunday
  assert.deepStrictEqual(scheduledDosesOnDate(weekdays, '2026-10-04'), []);
  // 2026-10-05 is a Monday
  assert.strictEqual(scheduledDosesOnDate(weekdays, '2026-10-05').length, 2);
});

test('scheduledDosesOnDate respects start and end dates', () => {
  assert.deepStrictEqual(scheduledDosesOnDate(dailyMeds, '2026-09-30'), []);
  assert.deepStrictEqual(scheduledDosesOnDate(dailyMeds, '2026-11-01'), []);
  assert.strictEqual(scheduledDosesOnDate(dailyMeds, '2026-10-01').length, 2);
  assert.strictEqual(scheduledDosesOnDate(dailyMeds, '2026-10-31').length, 2);
});

test('scheduledDosesOnDate with no date range returns doses', () => {
  const noRange = { ...dailyMeds, startDate: '', endDate: '' };
  assert.strictEqual(scheduledDosesOnDate(noRange, '2026-01-01').length, 2);
});

test('dailyDoseCount sums daily times', () => {
  assert.strictEqual(dailyDoseCount(dailyMeds), 2);
  assert.strictEqual(dailyDoseCount({ ...dailyMeds, times: [] }), 0);
  assert.strictEqual(dailyDoseCount(null), 0);
});

// --- Refill tracking ---

test('daysOfSupplyLeft computes whole-day supply', () => {
  assert.strictEqual(daysOfSupplyLeft(60, 2), 30);
  assert.strictEqual(daysOfSupplyLeft(10, 3), 10 / 3);
  assert.strictEqual(daysOfSupplyLeft(30, 0), Infinity);
  assert.strictEqual(daysOfSupplyLeft(null, 2), null);
  assert.strictEqual(daysOfSupplyLeft('', 2), null);
});

test('refillStatus marks refill-soon within threshold', () => {
  const med = { ...dailyMeds, quantityOnHand: '14', refillThresholdDays: '7' };
  const status = refillStatus(med, '2026-10-15');
  assert.strictEqual(status.activeToday, true);
  assert.strictEqual(status.dailyDoseCount, 2);
  assert.strictEqual(status.daysLeft, 7);
  assert.strictEqual(status.refillSoon, true);
  assert.strictEqual(status.status, 'refill-soon');
});

test('refillStatus is ok above threshold', () => {
  const med = { ...dailyMeds, quantityOnHand: '100', refillThresholdDays: '7' };
  const status = refillStatus(med, '2026-10-15');
  assert.strictEqual(status.refillSoon, false);
  assert.strictEqual(status.status, 'ok');
});

test('refillStatus is inactive before start date', () => {
  const med = { ...dailyMeds, quantityOnHand: '100' };
  const status = refillStatus(med, '2026-09-30');
  assert.strictEqual(status.activeToday, false);
  assert.strictEqual(status.refillSoon, false);
  assert.strictEqual(status.status, 'ok');
});

test('refillStatus default threshold is 7 days', () => {
  const med = { ...dailyMeds, quantityOnHand: '14' };
  assert.strictEqual(refillStatus(med, '2026-10-15').refillSoon, true);
  const med2 = { ...dailyMeds, quantityOnHand: '16' };
  assert.strictEqual(refillStatus(med2, '2026-10-15').refillSoon, false);
});

// --- Weekly grid ---

test('weeklyGrid covers 7 days from week start', () => {
  const grid = weeklyGrid([dailyMeds], '2026-10-05'); // Monday
  const dates = Object.keys(grid);
  assert.strictEqual(dates.length, 7);
  assert.strictEqual(dates[0], '2026-10-05');
  assert.strictEqual(dates[6], '2026-10-11');
  for (const date of dates) {
    const doses = grid[date]['m1'];
    assert.ok(doses, `missing doses for ${date}`);
    assert.strictEqual(doses.length, 2);
  }
});

test('weeklyGrid excludes off days', () => {
  const weekdays = { ...dailyMeds, daysOfWeek: [1, 2, 3, 4, 5] };
  const grid = weeklyGrid([weekdays], '2026-10-04'); // starts Sunday
  assert.strictEqual(grid['2026-10-04']['m1'], undefined);
  assert.strictEqual(grid['2026-10-05']['m1'].length, 2);
});

test('weeklyGrid with no medications returns an empty grid', () => {
  const grid = weeklyGrid([], '2026-10-05');
  const dates = Object.keys(grid);
  assert.strictEqual(dates.length, 7);
  for (const date of dates) {
    assert.deepStrictEqual(grid[date], {});
  }
});

test('allDosesOnDate flattens doses across medications', () => {
  const meds = [
    dailyMeds,
    { ...dailyMeds, id: 'm2', name: 'Magnesium', times: [{ id: 'x', time: '09:00' }] },
  ];
  const doses = allDosesOnDate(meds, '2026-10-15');
  assert.strictEqual(doses.length, 3);
  assert.deepStrictEqual(doses[0], { medicationId: 'm1', time: '08:00', label: 'Vitamin D 2000 IU' });
  assert.deepStrictEqual(doses[2], { medicationId: 'm2', time: '09:00', label: 'Magnesium 2000 IU' });
});

// --- Validation ---

test('validateMedication accepts a complete medication', () => {
  assert.deepStrictEqual(validateMedication(dailyMeds), []);
});

test('validateMedication rejects missing name and times', () => {
  const errors = validateMedication({ ...dailyMeds, name: '', times: [] });
  assert.ok(errors.some((e) => e.includes('name')));
  assert.ok(errors.some((e) => e.includes('time')));
});

test('validateMedication rejects bad times and duplicates', () => {
  const errors = validateMedication({
    ...dailyMeds,
    times: [{ id: 'a', time: '25:00' }, { id: 'b', time: '08:00' }, { id: 'c', time: '08:00' }],
  });
  assert.ok(errors.some((e) => e.includes('25:00')));
  assert.ok(errors.some((e) => e.includes('08:00')));
});

test('validateMedication rejects end before start', () => {
  const errors = validateMedication({
    ...dailyMeds,
    startDate: '2026-10-20',
    endDate: '2026-10-10',
  });
  assert.ok(errors.some((e) => e.includes('End date')));
});

test('validateMedication rejects negative quantity', () => {
  const errors = validateMedication({ ...dailyMeds, quantityOnHand: '-5' });
  assert.ok(errors.some((e) => e.includes('Quantity')));
});

test('newMedication returns a usable default shape', () => {
  const med = newMedication();
  assert.ok(med.id);
  assert.strictEqual(med.name, '');
  assert.deepStrictEqual(med.times, []);
  assert.strictEqual(med.refillThresholdDays, '7');
});

summary();
