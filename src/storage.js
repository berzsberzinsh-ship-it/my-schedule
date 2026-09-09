const STORAGE_KEY = 'my-schedule-v1';

export function loadLessons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data.lessons) ? data.lessons : [];
  } catch {
    return [];
  }
}

export function saveLessons(lessons) {
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    lessons,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function exportJson(lessons) {
  return JSON.stringify(
    {
      version: 1,
      app: 'my-schedule',
      exportedAt: new Date().toISOString(),
      lessons,
    },
    null,
    2
  );
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.lessons)) {
    throw new Error('Nederīgs JSON: trūkst lessons masīva');
  }
  return data.lessons.map(normalizeLesson).filter(Boolean);
}

function normalizeLesson(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const weekday = Number(raw.weekday);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) return null;
  const start = String(raw.start || '').trim();
  const end = String(raw.end || '').trim();
  const subject = String(raw.subject || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end) || !subject) {
    return null;
  }
  return {
    id: raw.id || crypto.randomUUID(),
    weekday,
    start: padTime(start),
    end: padTime(end),
    subject,
    classLabel: String(raw.classLabel || '').trim(),
    room: String(raw.room || '').trim(),
    teacher: String(raw.teacher || '').trim(),
  };
}

function padTime(t) {
  const [h, m] = t.split(':');
  return `${String(Number(h)).padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export function createLesson(partial) {
  return {
    id: crypto.randomUUID(),
    weekday: partial.weekday ?? 1,
    start: partial.start || '08:00',
    end: partial.end || '08:45',
    subject: partial.subject || '',
    classLabel: partial.classLabel || '',
    room: partial.room || '',
    teacher: partial.teacher || '',
  };
}
