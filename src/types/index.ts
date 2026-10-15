export type Category =
  | 'water'
  | 'food'
  | 'sleep'
  | 'stair'
  | 'pulse'
  | 'exercise'
  | 'stress'
  | 'bmi';

export interface EntryMetadata {
  name?: string;
  qty?: number;
  pm?: number;
  meal?: string;
  custom?: boolean;
  u?: boolean;
  p?: number; // protein
  c?: number; // carbs
  f?: number; // fat
  fb?: number; // fiber
  climbs?: number;
  steps?: number;
  dur?: number;
  pace?: string;
  hrB?: number | null;
  hrA?: number | null;
  loc?: string;
  diff?: string;
  floor?: string;
  angle?: number;
  lat?: number | null;
  lng?: number | null;
  bed?: string;
  wake?: string;
  rest?: number;
  aw?: number;
  score?: number;
  st?: string; // pulse activity
  end?: number;
  feel?: string;
  tech?: Array<{ t: string; fb: number }>;
  goal?: string;
  mus?: string;
  ex?: string;
  sets?: number;
  reps?: number[];
  kcal?: { v: number; lo: number; hi: number } | number;
  vo2?: number;
  kj?: number;
  [key: string]: any;
}

export interface Entry {
  id: string;
  c: Category | string;
  v: number;
  m: EntryMetadata;
  n: string;
  d: string; // YYYY-MM-DD
  t: string; // HH:MM
}

export interface UserProfile {
  name?: string;
  w: number; // weight in kg
  h: number; // height in cm
  age: number;
  sex: 'm' | 'f';
  act: number; // physical activity multiplier 1.2 to 1.9
  days: number;
  goal: 'm' | 'l' | 'g'; // maintain, lose, gain
  conds?: string[];
}

export interface AppSettings {
  kcal: number;
  water: number;
  sound: number;
  set: number;
  theme?: string;
  onb?: number;
  wrem?: number;
  xg?: {
    g?: string;
    c?: { reps: number; sets: number; rest: number };
    k?: { reps: number; sets: number };
  };
}

export interface AppState {
  sv: number;
  q6: { f: Record<string, any>; w: Record<string, any> };
  ex: { p: Record<string, string> };
  xl: Record<string, any>;
  md: { last: Record<string, any>; day: Record<string, any>; seen: Record<string, any>; ms: Record<string, any>; log: any[] };
  mg: { xp: Record<string, any>; n: Record<string, any>; h: any[]; c: Record<string, any> };
  b: Record<string, string>; // badges unlocked with date
  e: Entry[];
  s: AppSettings;
  p: UserProfile;
  xp: number;
  claimed: Record<string, number>;
  xd?: Record<string, number>;
  qx?: Record<string, number>;
  qd?: Record<string, number>;
  ck?: Record<string, number[]>; // sleep checklist by date
  qc?: number;
  dqn?: number;
  tutd?: number;
}

export interface FoodItem {
  name: string;
  serving: string;
  kcal: number | null;
  p?: number;
  c?: number;
  f?: number;
  fb?: number;
}

export interface StairItem {
  id: string;
  cat: 'MILD' | 'MODERATE' | 'VIGOROUS';
  name: string;
  floor: string;
  angle: number;
  lat: number | null;
  lng: number | null;
}

export interface BadgeDef {
  icon: string;
  name: string;
  desc: string;
  check: (state: AppState) => [number, number];
}

export interface DailyQuest {
  icon: string;
  name: string;
  target: string;
  progress: number;
  view: string;
  xp: number;
}
