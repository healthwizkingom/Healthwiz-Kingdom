import { AppState, Entry } from '../types';

export const SCHEMA_VERSION = 9;
export const STORAGE_KEY = 'healthwiz';
const BACKUP_PREFIX = 'healthwiz_backup_';
const MAX_BACKUPS = 3;

export const DEFAULT_STATE = (): AppState => ({
  sv: SCHEMA_VERSION,
  q6: { f: {}, w: {} },
  ex: { p: {} },
  xl: {},
  md: { last: {}, day: {}, seen: {}, ms: {}, log: [] },
  mg: { xp: {}, n: {}, h: [], c: {} },
  b: {},
  e: [],
  s: { kcal: 2200, water: 2000, sound: 1, set: 0 },
  p: { w: 60, h: 165, age: 16, sex: 'm', act: 1.375, days: 3, goal: 'm' },
  xp: 0,
  claimed: {},
  xd: {},
  qx: {},
  qd: {},
  ck: {},
});

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);

function stash(raw: string, why: string) {
  try {
    localStorage.setItem(`${BACKUP_PREFIX}${why}_${Date.now()}`, raw);
    const ks = Object.keys(localStorage).filter(k => k.startsWith(BACKUP_PREFIX)).sort();
    ks.slice(0, Math.max(0, ks.length - MAX_BACKUPS)).forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // ignore
  }
}

export function cleanEntry(e: any, i: number): number {
  let f = 0;
  if (!e.id || typeof e.id !== 'string' || !/^[\w.:-]{1,80}$/.test(e.id)) {
    e.id = 'm' + Date.now() + '_' + i;
    f++;
  }
  if (typeof e.c !== 'string' || !/^[a-z0-9_]{1,24}$/.test(e.c)) {
    e.c = String(e.c == null ? '' : e.c).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'unknown';
    f++;
  }
  if (typeof e.v !== 'number' || !isFinite(e.v)) {
    e.v = +e.v || 0;
    f++;
  }
  if (e.d == null || typeof e.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.d)) {
    const t = new Date();
    e.d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    f++;
  }
  if (e.t == null || typeof e.t !== 'string' || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(e.t)) {
    e.t = '12:00';
    f++;
  }
  if (!isObj(e.m)) {
    e.m = {};
    f++;
  }
  if (typeof e.n !== 'string') {
    e.n = e.n == null ? '' : String(e.n);
    f++;
  }
  return f;
}

export function sanitize(x: any): [AppState, number] {
  const D = DEFAULT_STATE();
  let fix = 0;
  const o = Object.assign(D, x);

  if (isObj(o.q6)) {
    if (!isObj(o.q6.f)) { o.q6.f = {}; fix++; }
    if (!isObj(o.q6.w)) { o.q6.w = {}; fix++; }
  } else {
    o.q6 = { f: {}, w: {} }; fix++;
  }
  if (isObj(o.ex) && !isObj(o.ex.p)) { o.ex.p = {}; fix++; }
  if (isObj(o.md) && !Array.isArray(o.md.log)) { o.md.log = []; fix++; }
  if (isObj(o.mg)) {
    ['xp', 'n', 'c'].forEach(k => {
      if (!isObj((o.mg as any)[k])) { (o.mg as any)[k] = {}; fix++; }
    });
    if (!Array.isArray(o.mg.h)) { o.mg.h = []; fix++; }
  }
  if (isObj(o.b) && typeof o.b !== 'object') { o.b = {}; fix++; }

  if (!Array.isArray(x?.e)) {
    o.e = [];
    fix++;
  } else {
    o.e = x.e.filter((e: any) => isObj(e));
    fix += x.e.length - o.e.length;
    o.e.forEach((e: Entry, i: number) => {
      fix += cleanEntry(e, i);
    });
  }

  o.s = Object.assign(DEFAULT_STATE().s, isObj(x?.s) ? x.s : (fix++, {}));
  o.p = Object.assign(DEFAULT_STATE().p, isObj(x?.p) ? x.p : (fix++, {}));

  if (!(+o.xp >= 0)) {
    o.xp = 0;
    fix++;
  } else {
    o.xp = +o.xp;
  }

  return [o, fix];
}

export function loadState(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // localStorage inaccessible
  }
  if (!raw) return DEFAULT_STATE();

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    stash(raw, 'unreadable');
    return DEFAULT_STATE();
  }

  if (!isObj(parsed)) {
    stash(raw, 'invalid_shape');
    return DEFAULT_STATE();
  }

  const [state, fixes] = sanitize(parsed);
  if (fixes > 0 || (parsed.sv || 0) < SCHEMA_VERSION) {
    state.sv = SCHEMA_VERSION;
    saveState(state);
  }

  return state;
}

export function saveState(state: AppState): boolean {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e) {
    try {
      // Clear old backup caches if storage quota is exceeded
      Object.keys(localStorage)
        .filter(k => k.startsWith(BACKUP_PREFIX + 'pre-v'))
        .forEach(k => localStorage.removeItem(k));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e2) {
      console.error('Failed to save to localStorage:', e2);
      return false;
    }
  }
}
