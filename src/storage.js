const STORAGE_KEY = 'my-schedule-v1';
const BG_KEY = 'my-schedule-bg-v1';

const DEFAULT_BG = {
  image: null,
  opacity: 0.65,
};

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

export function loadBgPrefs() {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (!raw) return { ...DEFAULT_BG };
    const data = JSON.parse(raw);
    const opacity = Number(data.opacity);
    return {
      image: typeof data.image === 'string' && data.image ? data.image : null,
      opacity:
        Number.isFinite(opacity) && opacity >= 0.4 && opacity <= 0.85
          ? opacity
          : DEFAULT_BG.opacity,
    };
  } catch {
    return { ...DEFAULT_BG };
  }
}

export function saveBgPrefs(prefs) {
  const payload = {
    image: prefs.image || null,
    opacity:
      Number.isFinite(prefs.opacity) && prefs.opacity >= 0.4 && prefs.opacity <= 0.85
        ? prefs.opacity
        : DEFAULT_BG.opacity,
  };
  localStorage.setItem(BG_KEY, JSON.stringify(payload));
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
