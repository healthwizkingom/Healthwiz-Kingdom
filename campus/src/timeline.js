// The film's clock and everything that depends only on it. Both screens read this, which is what keeps them in sync.
import { keyframes, smooth, clamp } from './common.js';

export const LOOP = 108;      // seconds in one loop
export const OVERLAP = 2;    // extra seconds rendered past LOOP, dissolved into the opening so the loop seam cannot be seen
export const FPS = 60;

// hours of the day over the film: dawn -> golden morning -> noon -> storm -> afternoon -> sunset -> night -> dawn
const TOD = [[0, 6.2], [8, 7.0], [14, 7.9], [24, 8.7], [38, 10.4], [50, 12.3], [62, 13.4], [72, 15.4], [78, 17.4], [84, 18.6], [88, 19.6], [91, 22.5], [94, 26.8], [96, 30.2], [104, 31.0]];
export const todAt = (t) => keyframes(TOD, t, smooth);

// weather: cloud, rain, fog, haze, storm, wet
const K = (cloud, rain, fog, haze, storm, wet) => [cloud, rain, fog, haze, storm, wet];
const WX = [
  [0, K(0.14, 0, 0.1, 0.12, 0, 0)], [10, K(0.18, 0, 0.0, 0.4, 0, 0)], [24, K(0.25, 0, 0, 0.3, 0, 0)], [38, K(0.35, 0, 0, 0.12, 0, 0)],
  [46, K(0.7, 0, 0, 0, 0, 0)], [50, K(0.95, 0.5, 0.05, 0, 0.5, 0.4)], [53, K(1, 1, 0.1, 0, 1, 0.9)], [60, K(1, 0.9, 0.1, 0, 0.8, 1)], [64, K(0.9, 0.6, 0.15, 0, 0.3, 0.95)],
  [70, K(0.6, 0.2, 0.2, 0, 0, 0.85)], [76, K(0.45, 0, 0.5, 0.2, 0, 0.6)], [80, K(0.3, 0, 0.8, 0.25, 0, 0.45)], [87, K(0.2, 0, 0.35, 0, 0, 0.2)], [92, K(0.15, 0, 0.12, 0, 0, 0.05)], [96, K(0.14, 0, 0.1, 0.12, 0, 0)], [104, K(0.14, 0, 0.1, 0.12, 0, 0)],
];
const BOLTS = [51.6, 53.4, 53.58, 56.4, 57.9, 58.05, 59.6, 61.2];
export function weatherAt(t) {
  const [cloud, rain, fog, haze, storm, wet] = keyframes(WX, t, smooth);
  let flash = 0;
  for (const b of BOLTS) { const d = t - b; if (d >= 0 && d < 0.5) flash = Math.max(flash, Math.exp(-d * 6) * (0.75 + 0.25 * Math.sin(d * 40)) * Math.min(1, d * 25)); }
  return { cloud, rain, fog, haze, storm, wet, flash: flash * storm };
}

// the staircase stops: when each is tapped (seconds), and when its climber swaps between the two students
export const STAIR_EVENTS = {
  ST26: { tap: 27.0, swap: 31.0 },   // tangga dari rumah pengarah naik ke Blok E
  ST09: { tap: 65.5, swap: 69.0 },   // tangga ke Jab. Sains (beside ST05 behind Jab. Matematik)
  ST05: { tap: 72.8, swap: 0 },
};
export { clamp };
