// Pure schedule logic for the medication/supplement schedule app.
// No DOM, no localStorage — easy to test and easy to reason about.

// --- Date helpers -----------------------------------------------------------

// Parse an ISO date string (YYYY-MM-DD) into a local-date Date at midnight.
// Returns null when the string is not a valid calendar date.
export function parseDate(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

// Format a Date as YYYY-MM-DD in local time.
export function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Add (or subtract) days to a date, returning a YYYY-MM-DD string.
export function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return formatDate(result);
}

// Days difference between two dates (calendar days), truncated to whole days.
export function daysBetween(a, b) {
  const msPerDay = 86400000;
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / msPerDay);
}

// Day of week index: 0 = Sunday, 1 = Monday, ... 6 = Saturday.
export function dayOfWeek(date) {
  return date.getDay();
}

// --- Medication schedule logic ---------------------------------------------

// Times scheduled for one medication on one date, filtered by days of week
// and the medication's start/end date range.
// Returns an array of { time, label } entries, in the order of med.times.
export function scheduledDosesOnDate(med, dateString) {
  const date = parseDate(dateString);
  if (!med || !date) return [];

  const start = med.startDate ? parseDate(med.startDate) : null;
  const end = med.endDate ? parseDate(med.endDate) : null;

  if (start && daysBetween(start, date) < 0) return [];
  if (end && daysBetween(date, end) < 0) return [];

  const dow = dayOfWeek(date);
  if (!med.daysOfWeek || !med.daysOfWeek.includes(dow)) return [];

  const times = Array.isArray(med.times) ? med.times : [];
  return times
    .filter((t) => t && typeof t.time === 'string' && t.time.length > 0)
    .map((t) => ({
      time: t.time,
      label: `${med.name} ${med.dose ? med.dose : ''}`.trim(),
    }));
}

// Total scheduled doses per day for a medication (sum of daily times).
export function dailyDoseCount(med) {
  if (!med) return 0;
  const times = Array.isArray(med.times) ? med.times : [];
  return times.filter((t) => t && typeof t.time === 'string' && t.time.length > 0)
    .length;
}

// Days of supply left given quantity on hand and doses per day.
// Returns Infinity when doses per day is 0, null when quantity is missing.
export function daysOfSupplyLeft(quantityOnHand, dosesPerDay) {
  if (quantityOnHand == null || quantityOnHand === '') return null;
  const qty = Number(quantityOnHand);
  const perDay = Number(dosesPerDay);
  if (!Number.isFinite(qty) || !Number.isFinite(perDay)) return null;
  if (perDay <= 0) return Infinity;
  return qty / perDay;
}

// Refill status for a medication at a reference date.
// daysLeft is rounded down to whole days; refillSoon when daysLeft <= threshold.
export function refillStatus(med, referenceDateString) {
  const reference = referenceDateString ? parseDate(referenceDateString) : null;
  const start = med.startDate ? parseDate(med.startDate) : null;
  const activeToday =
    !reference || !start || daysBetween(start, reference) >= 0;

  const perDay = dailyDoseCount(med);
  const quantity = med.quantityOnHand == null ? null : Number(med.quantityOnHand);
  const daysLeft = daysOfSupplyLeft(quantity, perDay);
  const threshold = med.refillThresholdDays == null ? 7 : Number(med.refillThresholdDays);
  const refillSoon =
    activeToday &&
    daysLeft != null &&
    daysLeft !== Infinity &&
    daysLeft <= threshold;

  return {
    activeToday,
    dailyDoseCount: perDay,
    daysLeft: daysLeft == null ? null : Math.floor(daysLeft),
    refillSoon,
    status: daysLeft == null
      ? 'unknown'
      : daysLeft === Infinity
        ? 'unlimited'
        : refillSoon
          ? 'refill-soon'
          : 'ok',
  };
}

// Weekly grid: for each date in a 7-day week starting at weekStart (YYYY-MM-DD),
// the scheduled doses per medication id.
export function weeklyGrid(meds, weekStartString) {
  const weekStart = parseDate(weekStartString);
  if (!meds || !weekStart) return {};
  const grid = {};
  for (let offset = 0; offset < 7; offset++) {
    const dateString = addDays(weekStart, offset);
    grid[dateString] = {};
    for (const med of meds) {
      if (!med || !med.id) continue;
      const doses = scheduledDosesOnDate(med, dateString);
      if (doses.length > 0) {
        grid[dateString][med.id] = doses;
      }
    }
  }
  return grid;
}

// All scheduled dose occurrences across meds for one date.
export function allDosesOnDate(meds, dateString) {
  const occurrences = [];
  for (const med of meds) {
    if (!med || !med.id) continue;
    for (const dose of scheduledDosesOnDate(med, dateString)) {
      occurrences.push({ medicationId: med.id, ...dose });
    }
  }
  return occurrences;
}

// Validate a medication object, returning an array of human-readable errors.
// Empty array means valid.
export function validateMedication(med) {
  const errors = [];
  if (!med) {
    errors.push('Medication is required.');
    return errors;
  }
  if (!med.name || String(med.name).trim().length === 0) {
    errors.push('Medication name is required.');
  }
  if (med.startDate && !parseDate(med.startDate)) {
    errors.push('Start date is not a valid date.');
  }
  if (med.endDate && !parseDate(med.endDate)) {
    errors.push('End date is not a valid date.');
  }
  if (med.startDate && med.endDate) {
    const start = parseDate(med.startDate);
    const end = parseDate(med.endDate);
    if (daysBetween(start, end) < 0) {
      errors.push('End date must be on or after the start date.');
    }
  }
  const times = Array.isArray(med.times) ? med.times : [];
  if (times.length === 0) {
    errors.push('Add at least one time of day.');
  }
  const seenTimes = new Set();
  for (const t of times) {
    if (!t || typeof t.time !== 'string' || t.time.length === 0) {
      errors.push('Each dose needs a time.');
      continue;
    }
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t.time)) {
      errors.push(`Time ${t.time} is not a valid HH:MM time.`);
    }
    if (seenTimes.has(t.time)) {
      errors.push(`Duplicate time ${t.time}.`);
    }
    seenTimes.add(t.time);
  }
  if (
    med.quantityOnHand != null &&
    String(med.quantityOnHand).trim() !== '' &&
    (!Number.isFinite(Number(med.quantityOnHand)) ||
      Number(med.quantityOnHand) < 0)
  ) {
    errors.push('Quantity on hand must be a non-negative number.');
  }
  if (
    med.refillThresholdDays != null &&
    String(med.refillThresholdDays).trim() !== '' &&
    (!Number.isFinite(Number(med.refillThresholdDays)) ||
      Number(med.refillThresholdDays) < 0)
  ) {
    errors.push('Refill threshold must be a non-negative number.');
  }
  return errors;
}

// Default empty medication shape for new entries.
export function newMedication() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: '',
    dose: '',
    times: [],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: '',
    endDate: '',
    quantityOnHand: '',
    dosesPerDay: '',
    refillThresholdDays: '7',
    instructions: '',
  };
}
