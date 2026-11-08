import { createCanvas, sheet } from './canvas-env.js';
import { drawRoulette, defaultRoulette, stageTimes, orbitSet, orbitAngle, peakSpeed } from '../src/renderer/js/engine/roulette.js';
const OUT = process.env.OUT || '/tmp'; const p = defaultRoulette(); p.seed = 3;
const S = stageTimes(p); const set = orbitSet(p);
console.log('total', S.total.toFixed(2), 'selected', set.list[set.sel].name, 'peak rps', peakSpeed(p).toFixed(2));
// the selected brand must stop exactly at the front (angle pi/2)
const end = orbitAngle(p, S.spinDur.b, S, set) + set.sel * 2 * Math.PI / set.n; const err = Math.abs(((end - Math.PI / 2) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
console.log('landing error (rad)', err.toFixed(6));
for (const [W, H, name] of [[1080, 1920, 'port'], [1920, 1080, 'land'], [1080, 1080, 'sq']]) {
  const times = [1.4, 3.6, S.hideDur.a + S.hideDur.d * 0.45, S.hideDur.b, S.spinDur.a + 1.5, S.spinDur.b - 0.2, S.highlightDur.a + 0.6, S.zoomDur.b - 0.05, S.openDur.a + S.openDur.d * 0.15, S.openDur.a + S.openDur.d * 0.4, S.openDur.a + S.openDur.d * 0.6, S.openDur.b - 0.1, S.reviewDur.a + 2.5, S.zoomDur.a + 0.5, S.appearDur.b - 0.1];
  const cells = times.map(t => { const c = createCanvas(Math.round(W / 4), Math.round(H / 4)); const g = c.getContext('2d'); g.scale(0.25, 0.25); drawRoulette(g, W, H, t, p, () => null); return c; });
  sheet(cells, 5, `${OUT}/roulette-${name}.png`);
}
// continuity: angle must not jump between frames
let maxJump = 0, prev = null; for (let t = 0; t < S.highlightDur.b; t += 1 / 60) { const a = orbitAngle(p, t, S, set); if (prev !== null) maxJump = Math.max(maxJump, Math.abs(a - prev)); prev = a; }
console.log('max per-frame angle step', maxJump.toFixed(3));
if (err > 1e-6 || maxJump > 0.35) { console.log('GAGAL: brand tidak berhenti tepat di depan atau putaran meloncat'); process.exit(1); } else console.log('ok: pendaratan tepat dan putaran mulus');
