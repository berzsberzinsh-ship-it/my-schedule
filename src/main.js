import './style.css';
import {
  loadLessons,
  saveLessons,
  exportJson,
  importJson,
  createLesson,
} from './storage.js';

const WEEKDAYS = [
  { id: 1, short: 'P', full: 'Pirmdiena' },
  { id: 2, short: 'O', full: 'Otrdiena' },
  { id: 3, short: 'T', full: 'Trešdiena' },
  { id: 4, short: 'C', full: 'Ceturtdiena' },
  { id: 5, short: 'Pk', full: 'Piektdiena' },
];

const RIGA_TZ = 'Europe/Riga';
const CLOCK_MS = 45_000;

const app = document.getElementById('app');
let lessons = loadLessons();
let view = 'today'; // today | week
let editingId = null;
let formOpen = false;
let toastTimer = null;
let clockTimer = null;

/** Riga calendar/time parts via Intl (not browser local default alone). */
function getRigaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIGA_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  const wdMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return {
    weekday: wdMap[map.weekday] ?? null,
    hour: Number(map.hour),
    minute: Number(map.minute),
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

/** Mon=1 … Fri=5; Sat/Sun → null (free day). */
function todayWeekday(date = new Date()) {
  const wd = getRigaParts(date).weekday;
  return wd === 0 || wd === 6 ? null : wd;
}

function minutesSinceMidnight(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes(date = new Date()) {
  const { hour, minute } = getRigaParts(date);
  return hour * 60 + minute;
}

function formatRigaDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('lv-LV', {
    timeZone: RIGA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/**
 * @returns {{ kind: 'now'|'next'|'done'|'free'|'empty', lesson?: object, minutes?: number }}
 */
function getScheduleStatus(date = new Date()) {
  const wd = todayWeekday(date);
  if (wd === null) return { kind: 'free' };

  const todayLessons = sortLessons(lessons.filter((l) => l.weekday === wd));
  if (!todayLessons.length) return { kind: 'empty' };

  const now = nowMinutes(date);

  for (const lesson of todayLessons) {
    const start = minutesSinceMidnight(lesson.start);
    const end = minutesSinceMidnight(lesson.end);
    if (now >= start && now < end) {
      return { kind: 'now', lesson, minutes: end - now };
    }
  }

  for (const lesson of todayLessons) {
    const start = minutesSinceMidnight(lesson.start);
    if (now < start) {
      return { kind: 'next', lesson, minutes: start - now };
    }
  }

  return { kind: 'done' };
}

function statusLineText(status) {
  switch (status.kind) {
    case 'now':
      return `Tagad: ${status.lesson.subject} · vēl ${status.minutes} min`;
    case 'next':
      return `Nākamā: ${status.lesson.subject} · pēc ${status.minutes} min`;
    case 'done':
      return 'Šodien stundas beigušās';
    case 'free':
      return 'Šodien brīvdiena';
    case 'empty':
      return 'Šodien nav stundu';
    default:
      return '';
  }
}

function sortLessons(list) {
  return [...list].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return a.start.localeCompare(b.start);
  });
}

function showToast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function persist() {
  saveLessons(lessons);
}

function openForm(lesson = null) {
  editingId = lesson ? lesson.id : null;
  formOpen = true;
  render();
}

function closeForm() {
  editingId = null;
  formOpen = false;
  render();
}

function deleteLesson(id) {
  if (!confirm('Dzēst šo stundu?')) return;
  lessons = lessons.filter((l) => l.id !== id);
  persist();
  showToast('Stunda dzēsta');
  closeForm();
}

function handleSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = {
    weekday: Number(fd.get('weekday')),
    start: String(fd.get('start')),
    end: String(fd.get('end')),
    subject: String(fd.get('subject')).trim(),
    classLabel: String(fd.get('classLabel') || '').trim(),
    room: String(fd.get('room') || '').trim(),
    teacher: String(fd.get('teacher') || '').trim(),
  };
  if (!data.subject) {
    showToast('Norādi priekšmetu');
    return;
  }
  if (data.end <= data.start) {
    showToast('Beigu laiks jābūt pēc sākuma');
    return;
  }

  if (editingId) {
    lessons = lessons.map((l) =>
      l.id === editingId ? { ...l, ...data } : l
    );
    showToast('Saglabāts');
  } else {
    lessons = [...lessons, createLesson(data)];
    showToast('Stunda pievienota');
  }
  persist();
  closeForm();
}

function downloadBackup() {
  const blob = new Blob([exportJson(lessons)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saraksts-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Eksports lejupielādēts');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = importJson(String(reader.result));
      if (!confirm(`Importēt ${imported.length} stundu(as)? Esošie dati tiks aizvietoti.`)) {
        return;
      }
      lessons = imported;
      persist();
      showToast('Imports veiksmīgs');
      render();
    } catch (err) {
      showToast(err.message || 'Imports neizdevās');
    }
  };
  reader.readAsText(file);
}

function lessonCard(lesson, { showDay = false, isNow = false } = {}) {
  const day = WEEKDAYS.find((d) => d.id === lesson.weekday);
  const meta = [lesson.classLabel, lesson.room, lesson.teacher]
    .filter(Boolean)
    .join(' · ');
  const nowClass = isNow ? ' lesson-card--now' : '';
  const nowBadge = isNow ? `<span class="now-badge">Tagad</span>` : '';
  return `
    <article class="lesson-card${nowClass}" data-id="${lesson.id}" role="button" tabindex="0">
      <div class="lesson-time">
        <span class="time-start">${escapeHtml(lesson.start)}</span>
        <span class="time-sep">–</span>
        <span class="time-end">${escapeHtml(lesson.end)}</span>
      </div>
      <div class="lesson-body">
        ${showDay ? `<span class="day-badge">${escapeHtml(day?.short || '')}</span>` : ''}
        ${nowBadge}
        <h3 class="lesson-subject">${escapeHtml(lesson.subject)}</h3>
        ${meta ? `<p class="lesson-meta">${escapeHtml(meta)}</p>` : ''}
      </div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderToday() {
  const wd = todayWeekday();
  if (wd === null) {
    return `
      <section class="panel">
        <p class="empty-hint">Šodien brīvdiena. Skolas nedēļa: pirmdiena–piektdiena.</p>
        <button type="button" class="btn ghost" data-action="goto-week">Skatīt nedēļu</button>
      </section>
    `;
  }
  const day = WEEKDAYS.find((d) => d.id === wd);
  const todayLessons = sortLessons(lessons.filter((l) => l.weekday === wd));
  const status = getScheduleStatus();
  const nowId = status.kind === 'now' ? status.lesson.id : null;
  return `
    <section class="panel">
      <header class="panel-head">
        <h2>${escapeHtml(day.full)}</h2>
        <span class="muted">${todayLessons.length} st.</span>
      </header>
      ${
        todayLessons.length
          ? `<div class="lesson-list">${todayLessons
              .map((l) => lessonCard(l, { isNow: l.id === nowId }))
              .join('')}</div>`
          : `<p class="empty-hint">Šodien vēl nav stundu. Pievieno pirmo!</p>`
      }
    </section>
  `;
}

function renderWeek() {
  const status = getScheduleStatus();
  const nowId =
    status.kind === 'now' && todayWeekday() !== null ? status.lesson.id : null;
  return `
    <section class="panel week-panel">
      ${WEEKDAYS.map((day) => {
        const dayLessons = sortLessons(lessons.filter((l) => l.weekday === day.id));
        const isToday = todayWeekday() === day.id;
        return `
          <div class="week-day${isToday ? ' week-day--today' : ''}">
            <header class="week-day-head">
              <h3>${escapeHtml(day.full)}${isToday ? ' <span class="today-pill">šodien</span>' : ''}</h3>
              <span class="muted">${dayLessons.length}</span>
            </header>
            ${
              dayLessons.length
                ? dayLessons
                    .map((l) =>
                      lessonCard(l, {
                        isNow: isToday && l.id === nowId,
                      })
                    )
                    .join('')
                : `<p class="empty-mini">—</p>`
            }
          </div>
        `;
      }).join('')}
    </section>
  `;
}

function renderForm() {
  const existing = editingId
    ? lessons.find((l) => l.id === editingId)
    : null;
  const l = existing || createLesson({});
  return `
    <div class="modal-backdrop" data-action="close-form">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <header class="modal-head">
          <h2 id="form-title">${editingId ? 'Rediģēt stundu' : 'Jauna stunda'}</h2>
          <button type="button" class="icon-btn" data-action="close-form" aria-label="Aizvērt">✕</button>
        </header>
        <form id="lesson-form" class="form">
          <label>
            <span>Diena</span>
            <select name="weekday" required>
              ${WEEKDAYS.map(
                (d) =>
                  `<option value="${d.id}" ${l.weekday === d.id ? 'selected' : ''}>${escapeHtml(d.full)}</option>`
              ).join('')}
            </select>
          </label>
          <div class="row-2">
            <label>
              <span>Sākums</span>
              <input type="time" name="start" value="${escapeHtml(l.start)}" required />
            </label>
            <label>
              <span>Beigas</span>
              <input type="time" name="end" value="${escapeHtml(l.end)}" required />
            </label>
          </div>
          <label>
            <span>Priekšmets *</span>
            <input type="text" name="subject" value="${escapeHtml(l.subject)}" required maxlength="80" placeholder="piem. Matemātika" />
          </label>
          <label>
            <span>Klase</span>
            <input type="text" name="classLabel" value="${escapeHtml(l.classLabel)}" maxlength="40" placeholder="piem. 7.a" />
          </label>
          <div class="row-2">
            <label>
              <span>Kab.</span>
              <input type="text" name="room" value="${escapeHtml(l.room)}" maxlength="20" placeholder="201" />
            </label>
            <label>
              <span>Skolotājs</span>
              <input type="text" name="teacher" value="${escapeHtml(l.teacher)}" maxlength="60" placeholder="vārds" />
            </label>
          </div>
          <div class="form-actions">
            ${
              editingId
                ? `<button type="button" class="btn danger" data-action="delete-lesson" data-id="${editingId}">Dzēst</button>`
                : `<span></span>`
            }
            <button type="submit" class="btn primary">Saglabāt</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function clearClock() {
  if (clockTimer != null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

function startClock() {
  clearClock();
  clockTimer = setInterval(() => {
    // Avoid wiping an open form (would reset inputs / focus).
    if (formOpen) return;
    render();
  }, CLOCK_MS);
}

function render() {
  const dateLabel = formatRigaDateLabel();
  const status = getScheduleStatus();
  const statusText = statusLineText(status);

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Uz ierīces</p>
          <h1>Mans saraksts</h1>
          <p class="date-line">${escapeHtml(dateLabel)}</p>
          <p class="status-line" aria-live="polite">${escapeHtml(statusText)}</p>
        </div>
        <div class="top-actions">
          <button type="button" class="icon-btn" data-action="export" title="Eksportēt JSON" aria-label="Eksportēt">↓</button>
          <label class="icon-btn file-label" title="Importēt JSON" aria-label="Importēt">
            ↑
            <input type="file" accept="application/json,.json" hidden data-action="import" />
          </label>
        </div>
      </header>

      <nav class="tabs" role="tablist">
        <button type="button" class="tab ${view === 'today' ? 'active' : ''}" data-action="view-today" role="tab" aria-selected="${view === 'today'}">Šodien</button>
        <button type="button" class="tab ${view === 'week' ? 'active' : ''}" data-action="view-week" role="tab" aria-selected="${view === 'week'}">Nedēļa</button>
      </nav>

      <main class="content">
        ${view === 'today' ? renderToday() : renderWeek()}
      </main>

      <button type="button" class="fab" data-action="add" aria-label="Pievienot stundu">+</button>
      ${formOpen ? renderForm() : ''}
    </div>
  `;

  bindEvents();
  startClock();
}

function bindEvents() {
  app.querySelectorAll('[data-action="view-today"]').forEach((el) =>
    el.addEventListener('click', () => {
      view = 'today';
      render();
    })
  );
  app.querySelectorAll('[data-action="view-week"]').forEach((el) =>
    el.addEventListener('click', () => {
      view = 'week';
      render();
    })
  );
  app.querySelectorAll('[data-action="goto-week"]').forEach((el) =>
    el.addEventListener('click', () => {
      view = 'week';
      render();
    })
  );
  app.querySelectorAll('[data-action="add"]').forEach((el) =>
    el.addEventListener('click', () => openForm())
  );
  app.querySelectorAll('[data-action="close-form"]').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target === el) closeForm();
    })
  );
  app.querySelectorAll('[data-action="export"]').forEach((el) =>
    el.addEventListener('click', downloadBackup)
  );
  app.querySelectorAll('[data-action="import"]').forEach((el) =>
    el.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importBackup(file);
      e.target.value = '';
    })
  );
  app.querySelectorAll('[data-action="delete-lesson"]').forEach((el) =>
    el.addEventListener('click', () => deleteLesson(el.dataset.id))
  );

  const form = app.querySelector('#lesson-form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
    form.addEventListener('click', (e) => e.stopPropagation());
    const modal = form.closest('.modal');
    if (modal) modal.addEventListener('click', (e) => e.stopPropagation());
  }

  app.querySelectorAll('.lesson-card').forEach((card) => {
    const open = () => {
      const lesson = lessons.find((l) => l.id === card.dataset.id);
      if (lesson) openForm(lesson);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

render();
registerSW();
