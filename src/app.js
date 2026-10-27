// Application UI for the Daily Medication & Supplement Schedule.
// Local-first: everything lives in the browser's localStorage under
// `med-schedule-v1`. Nothing is uploaded anywhere.
import {
  parseDate,
  formatDate,
  addDays,
  dayOfWeek,
  scheduledDosesOnDate,
  dailyDoseCount,
  daysOfSupplyLeft,
  refillStatus,
  weeklyGrid,
  allDosesOnDate,
  validateMedication,
  newMedication,
} from './schedule.js';

const STORAGE_KEY = 'med-schedule-v1';
const STORAGE_VERSION = 1;

let state = { version: STORAGE_VERSION, medications: [], doses: {} };
let editingId = null;

const els = {
  app: document.getElementById('app'),
  views: document.querySelectorAll('[data-view]'),
  navButtons: document.querySelectorAll('[data-nav]'),
  dateToday: document.getElementById('btn-today'),
  datePrev: document.getElementById('btn-prev-day'),
  dateNext: document.getElementById('btn-next-day'),
  dateDisplay: document.getElementById('date-display'),
  dateInput: document.getElementById('date-picker'),
  dailyList: document.getElementById('daily-list'),
  weekStartInput: document.getElementById('week-picker'),
  weekPrev: document.getElementById('btn-prev-week'),
  weekNext: document.getElementById('btn-next-week'),
  weekGrid: document.getElementById('week-grid'),
  medsList: document.getElementById('meds-list'),
  medForm: document.getElementById('med-form'),
  medFormCard: document.getElementById('med-form-card'),
  medName: document.getElementById('med-name'),
  medDose: document.getElementById('med-dose'),
  medTimes: document.getElementById('med-times'),
  medStart: document.getElementById('med-start'),
  medEnd: document.getElementById('med-end'),
  medQty: document.getElementById('med-qty'),
  medThreshold: document.getElementById('med-threshold'),
  medInstructions: document.getElementById('med-instructions'),
  medErrors: document.getElementById('med-errors'),
  btnAddMed: document.getElementById('btn-add-med'),
  btnSaveMed: document.getElementById('btn-save-med'),
  btnCancelMed: document.getElementById('btn-cancel-med'),
  btnAddTime: document.getElementById('btn-add-time'),
  refillTable: document.getElementById('refill-table-body'),
  refillDate: document.getElementById('refill-date'),
  largePrintToggle: document.getElementById('toggle-large-print'),
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  importFile: document.getElementById('import-file'),
  toast: document.getElementById('toast'),
  emptyState: document.getElementById('empty-state'),
};

// --- Storage ---------------------------------------------------------------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: STORAGE_VERSION, medications: [], doses: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad shape');
    const medications = Array.isArray(parsed.medications) ? parsed.medications : [];
    const doses = parsed.doses && typeof parsed.doses === 'object' ? parsed.doses : {};
    return { version: STORAGE_VERSION, medications, doses };
  } catch (error) {
    showToast('Could not read saved data. Starting fresh.', 'warning');
    return { version: STORAGE_VERSION, medications: [], doses: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function showToast(message, kind = 'info') {
  els.toast.textContent = message;
  els.toast.className = `toast show toast-${kind}`;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
  }, 3000);
}

// --- Navigation ------------------------------------------------------------

function showView(viewId) {
  els.views.forEach((v) => v.classList.toggle('hidden', v.id !== viewId));
  els.navButtons.forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === viewId);
  });
}

function initNavigation() {
  els.navButtons.forEach((b) => {
    b.addEventListener('click', () => showView(b.dataset.nav));
  });
  els.dateToday.addEventListener('click', () => {
    const today = formatDate(new Date());
    els.dateInput.value = today;
    renderDaily();
  });
  els.datePrev.addEventListener('click', () => shiftDate(-1));
  els.dateNext.addEventListener('click', () => shiftDate(1));
  els.dateInput.addEventListener('change', renderDaily);
  els.weekPrev.addEventListener('click', () => shiftWeek(-7));
  els.weekNext.addEventListener('click', () => shiftWeek(7));
  els.weekStartInput.addEventListener('change', renderWeekly);
  els.refillDate.addEventListener('change', renderRefills);
}

function shiftDate(delta) {
  const current = els.dateInput.value || formatDate(new Date());
  const date = parseDate(current);
  if (!date) return;
  els.dateInput.value = addDays(date, delta);
  renderDaily();
}

function shiftWeek(delta) {
  const current = els.weekStartInput.value || weekStartOf(new Date());
  const date = parseDate(current);
  if (!date) return;
  els.weekStartInput.value = addDays(date, delta);
  renderWeekly();
}

function weekStartOf(date) {
  const day = dayOfWeek(date);
  const offset = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(date, offset);
}

// --- Medication form -------------------------------------------------------

function timeInputsHTML(times) {
  return times
    .map(
      (t, index) => `
    <div class="time-input row" data-index="${index}">
      <label>Time ${index + 1}</label>
      <input type="time" value="${t.time || ''}" required>
      <button type="button" class="danger small remove-time" data-index="${index}">&times;</button>
    </div>
  `
    )
    .join('');
}

function renderMedForm() {
  const med = editingId ? state.medications.find((m) => m.id === editingId) : null;
  els.medForm.reset();
  els.medErrors.innerHTML = '';
  els.medName.value = med ? med.name : '';
  els.medDose.value = med ? med.dose : '';
  els.medTimes.innerHTML = timeInputsHTML(med ? med.times : [{ id: String(Date.now()), time: '' }]);
  for (let d = 0; d <= 6; d++) {
    const cb = document.getElementById(`day-${d}`);
    if (cb) cb.checked = med ? med.daysOfWeek.includes(d) : true;
  }
  els.medStart.value = med ? med.startDate : '';
  els.medEnd.value = med ? med.endDate : '';
  els.medQty.value = med ? (med.quantityOnHand == null ? '' : med.quantityOnHand) : '';
  els.medThreshold.value = med ? (med.refillThresholdDays == null ? '7' : med.refillThresholdDays) : '7';
  els.medInstructions.value = med ? med.instructions : '';
  els.btnSaveMed.textContent = med ? 'Save medication' : 'Add medication';
  els.btnCancelMed.hidden = !med;
  els.medFormCard.classList.remove('hidden');
}

function collectDayBits() {
  const bits = [];
  for (let d = 0; d <= 6; d++) {
    const cb = document.getElementById(`day-${d}`);
    if (cb && cb.checked) bits.push(d);
  }
  return bits.length > 0 ? bits : [0, 1, 2, 3, 4, 5, 6];
}

function collectMedFromForm() {
  const timeInputs = Array.from(els.medTimes.querySelectorAll('.time-input input'));
  const times = timeInputs.map((input, index) => ({
    id: `t-${index}-${Date.now()}`,
    time: input.value.trim(),
  }));
  const name = String(els.medName.value).trim();
  const start = els.medStart.value;
  const end = els.medEnd.value;
  const med = {
    id: editingId ? editingId : newMedication().id,
    name,
    dose: String(els.medDose.value).trim(),
    times,
    daysOfWeek: collectDayBits(),
    startDate: start,
    endDate: end,
    quantityOnHand: els.medQty.value.trim(),
    dosesPerDay: '',
    refillThresholdDays: els.medThreshold.value.trim() || '7',
    instructions: String(els.medInstructions.value).trim(),
  };
  return med;
}

function bindMedForm() {
  els.btnAddTime.addEventListener('click', () => {
    const index = els.medTimes.querySelectorAll('.time-input').length;
    const div = document.createElement('div');
    div.className = 'time-input row';
    div.dataset.index = index;
    div.innerHTML = `
      <label>Time ${index + 1}</label>
      <input type="time" required>
      <button type="button" class="danger small remove-time">&times;</button>
    `;
    els.medTimes.appendChild(div);
    renumberTimeLabels();
  });

  els.medTimes.addEventListener('click', (event) => {
    const button = event.target.closest('.remove-time');
    if (!button) return;
    const inputs = els.medTimes.querySelectorAll('.time-input');
    if (inputs.length <= 1) {
      showToast('Keep at least one time of day.', 'warning');
      return;
    }
    button.closest('.time-input').remove();
    renumberTimeLabels();
  });

  els.btnCancelMed.addEventListener('click', () => {
    editingId = null;
    els.medFormCard.classList.add('hidden');
    renderMeds();
  });

  els.medForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const med = collectMedFromForm();
    const errors = validateMedication(med);
    els.medErrors.innerHTML = '';
    if (errors.length > 0) {
      els.medErrors.innerHTML = errors.map((e) => `<div class="error-text">• ${e}</div>`).join('');
      return;
    }
    if (editingId) {
      state.medications = state.medications.map((m) => (m.id === editingId ? med : m));
      editingId = null;
    } else {
      state.medications.push(med);
    }
    saveState();
    els.medFormCard.classList.add('hidden');
  });

  els.btnAddMed.addEventListener('click', () => {
    editingId = null;
    renderMedForm();
  });
}

function renumberTimeLabels() {
  Array.from(els.medTimes.querySelectorAll('.time-input')).forEach((div, index) => {
    div.querySelector('label').textContent = `Time ${index + 1}`;
    div.querySelector('.remove-time').dataset.index = index;
  });
}

// --- Views -----------------------------------------------------------------

function render() {
  renderMeds();
  renderDaily();
  renderWeekly();
  renderRefills();
}

function renderMeds() {
  els.medsList.innerHTML = '';
  if (state.medications.length === 0) {
    els.medsList.innerHTML = '<div class="empty">No medications yet. Add one to get started.</div>';
    return;
  }
  const today = formatDate(new Date());
  for (const med of state.medications) {
    const status = refillStatus(med, today);
    const card = document.createElement('article');
    card.className = 'med-card';
    const daysLeft =
      status.daysLeft == null ? '—' : status.daysLeft === Infinity ? '∞' : status.daysLeft;
    card.innerHTML = `
      <header>
        <div>
          <div style="display:flex;align-items:baseline;gap:0.4rem;">
            <span class="med-name">${escapeHtml(med.name)}</span>
            ${med.dose ? `<span class="dose">${escapeHtml(med.dose)}</span>` : ''}
          </div>
          <div class="meta meta-refill status-${status.status}">
            ${statusText(status)}
          </div>
        </div>
        <div>
          <button type="button" class="small" data-action="edit" data-id="${escapeHtml(med.id)}">Edit</button>
          <button type="button" class="danger small" data-action="delete" data-id="${escapeHtml(med.id)}">Delete</button>
        </div>
      </header>
      <div class="meta">Times: ${med.times.map((t) => t.time).join(', ') || 'none set'}</div>
      <div class="meta">
        Days: ${med.daysOfWeek.map((d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
      </div>
      ${med.startDate ? `<div class="meta">Start: ${med.startDate}</div>` : ''}
      ${med.endDate ? `<div class="meta">End: ${med.endDate}</div>` : ''}
      <div class="meta">On hand: ${med.quantityOnHand || '—'} &nbsp;•&nbsp; Days left: <strong>${daysLeft}</strong> &nbsp;•&nbsp; ${statusText(status)}</div>
      ${med.instructions ? `<div class="meta small" style="color:#374151;">${escapeHtml(med.instructions)}</div>` : ''}
    `;
    els.medsList.appendChild(card);
  }
}

function statusText(status) {
  if (status.status === 'refill-soon') return 'Refill soon';
  if (status.status === 'ok') return 'Stocked';
  if (status.status === 'unlimited') return 'No refill tracking';
  return 'No quantity set';
}

function bindMedsList() {
  els.medsList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === 'edit') {
      editingId = id;
      renderMedForm();
    } else if (button.dataset.action === 'delete') {
      if (!confirm(`Delete this medication? This cannot be undone.`)) return;
      state.medications = state.medications.filter((m) => m.id !== id);
      state.doses = Object.fromEntries(
        Object.entries(state.doses).map(([date, byMed]) => {
          const next = { ...byMed };
          delete next[id];
          return [date, next];
        })
      );
      if (editingId === id) editingId = null;
      saveState();
    }
  });
}

function renderDaily() {
  const date = els.dateInput.value || formatDate(new Date());
  els.dateDisplay.textContent = formatDate(parseDate(date) || new Date()) || date;
  els.dailyList.innerHTML = '';
  const meds = state.medications;
  const occurrences = allDosesOnDate(meds, date);
  const takenForDate = state.doses[date] || {};

  if (occurrences.length === 0) {
    els.dailyList.innerHTML = '<div class="empty">No scheduled doses for this date.</div>';
    return;
  }

  for (const occ of occurrences) {
    const med = meds.find((m) => m.id === occ.medicationId);
    const timeIndex = med.times.findIndex((t) => t.time === occ.time);
    const key = `${med.id}|${occ.time}`;
    const taken = takenForDate[key] === true;
    const row = document.createElement('div');
    row.className = `dose-row ${taken ? 'taken' : ''}`;
    row.innerHTML = `
      <div>
        <div class="med-name">${escapeHtml(med.name)}</div>
        <div class="dose-info">${escapeHtml(occ.label)} &bull; ${occ.time}</div>
      </div>
      <label style="margin:0;display:flex;align-items:center;justify-content:flex-end;">
        <input type="checkbox" class="taken-checkbox" data-key="${escapeHtml(key)}" ${taken ? 'checked' : ''}>
        <span class="muted" style="margin-left:0.4rem;">Taken</span>
      </label>
    `;
    els.dailyList.appendChild(row);
  }
}

function bindDaily() {
  els.dailyList.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.taken-checkbox');
    if (!checkbox) return;
    const key = checkbox.dataset.key;
    const date = els.dateInput.value || formatDate(new Date());
    const [medId, time] = key.split('|');
    const byMed = state.doses[date] || {};
    if (checkbox.checked) {
      byMed[medId] = byMed[medId] || {};
      byMed[medId][time] = true;
    } else {
      delete byMed[medId]?.[time];
      if (Object.keys(byMed[medId] || {}).length === 0) delete byMed[medId];
      if (Object.keys(byMed).length === 0) delete state.doses[date];
    }
    state.doses[date] = byMed;
    saveState();
  });
}

function renderWeekly() {
  const weekStart = els.weekStartInput.value || weekStartOf(new Date());
  els.weekStartInput.value = weekStart;
  const grid = weeklyGrid(state.medications, weekStart);
  const dates = Object.keys(grid); // already ordered by addDays
  const timesSet = new Set();
  for (const date of dates) {
    for (const medId of Object.keys(grid[date])) {
      for (const dose of grid[date][medId]) timesSet.add(dose.time);
    }
  }
  const times = [...timesSet].sort();

  let html = `<thead><tr><th class="date-col">Time</th>`;
  for (const date of dates) {
    const d = parseDate(date);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek(d)];
    html += `<th>${escapeHtml(dayName)}<br>${escapeHtml(date)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const time of times) {
    html += `<tr><td><strong>${escapeHtml(time)}</strong></td>`;
    for (const date of dates) {
      const cell = grid[date];
      const medsAtTime = [];
      for (const medId of Object.keys(cell)) {
        for (const dose of cell[medId]) {
          if (dose.time === time) {
            const med = state.medications.find((m) => m.id === medId);
            if (med) medsAtTime.push(`${escapeHtml(med.name)}${med.dose ? ` ${escapeHtml(med.dose)}` : ''}`);
          }
        }
      }
      if (medsAtTime.length > 0) {
        html += `<td><div class="cell-dose">${medsAtTime.join('<br>')}</div></td>`;
      } else {
        html += '<td class="empty"></td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody>';
  els.weekGrid.innerHTML = html;
}

function renderRefills() {
  const reference = els.refillDate.value || formatDate(new Date());
  els.refillDate.value = reference;
  els.refillTable.innerHTML = '';
  for (const med of state.medications) {
    const status = refillStatus(med, reference);
    const perDay = status.dailyDoseCount;
    const daysLeft = status.daysLeft == null ? '—' : status.daysLeft === Infinity ? '∞' : status.daysLeft;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(med.name)}${med.dose ? `<div class="small muted">${escapeHtml(med.dose)}</div>` : ''}</td>
      <td class="numeric">${perDay}</td>
      <td class="numeric">${med.quantityOnHand || '—'}</td>
      <td class="numeric">${daysLeft}</td>
      <td><span class="badge badge-${status.status}">${status.status.replace('-', ' ')}</span></td>
    `;
    els.refillTable.appendChild(row);
  }
}

// --- Export / import -------------------------------------------------------

function bindExportImport() {
  els.btnExport.addEventListener('click', () => {
    const payload = {
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      medications: state.medications,
      doses: state.doses,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `med-schedule-export-${formatDate(new Date()) || 'unknown'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported your schedule as JSON.');
  });

  els.btnImport.addEventListener('click', () => {
    els.importFile.click();
  });

  els.importFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.medications)) {
          throw new Error('Invalid file: missing medications list.');
        }
        const bad = parsed.medications
          .map((m) => validateMedication(m))
          .some((errors) => errors.length > 0);
        if (bad) throw new Error('File contains invalid medications.');
        if (!confirm(`Import ${parsed.medications.length} medication(s)? This replaces your current list.`)) return;
        state.medications = parsed.medications;
        state.doses = parsed.doses && typeof parsed.doses === 'object' ? parsed.doses : {};
        saveState();
        showToast(`Imported ${parsed.medications.length} medication(s).`);
      } catch (error) {
        showToast(error.message || 'Import failed.', 'danger');
      }
      els.importFile.value = '';
    };
    reader.readAsText(file);
  });
}

// --- Large print -----------------------------------------------------------

function bindLargePrint() {
  els.largePrintToggle.addEventListener('change', (event) => {
    document.body.classList.toggle('large-print', event.target.checked);
  });
}

// --- Init ------------------------------------------------------------------

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  state = loadState();
  els.dateInput.value = formatDate(new Date());
  els.weekStartInput.value = weekStartOf(new Date());
  els.refillDate.value = formatDate(new Date());
  initNavigation();
  bindMedForm();
  bindMedsList();
  bindDaily();
  bindExportImport();
  bindLargePrint();
  showView('daily');
  render();
});
