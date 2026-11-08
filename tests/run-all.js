// Runs every automated check: animation engine, UI in Chromium, and the full desktop app with a real MP4 export.
import { spawnSync } from 'child_process'; import fs from 'fs';
const has = cmd => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd]).status === 0;
const steps = [['Mesin animasi Brand Roulette', ['node', ['tests/render-roulette.js']]], ['Tampilan di Chromium', ['node', ['tests/ui-smoke.cjs']]]];
const needX = process.platform === 'linux' && !process.env.DISPLAY;
if (!needX) steps.push(['Aplikasi desktop + ekspor MP4', ['node', ['tests/e2e-electron.cjs']]]);
else if (has('xvfb-run')) steps.push(['Aplikasi desktop + ekspor MP4', ['xvfb-run', ['-a', 'node', 'tests/e2e-electron.cjs']]]);
process.env.OUT = process.env.OUT || 'tests/out'; fs.mkdirSync(process.env.OUT, { recursive: true });
let bad = 0;
for (const [name, [cmd, args]] of steps) { console.log(`\n=== ${name} ===`); const r = spawnSync(cmd, args, { stdio: 'inherit', env: process.env }); if (r.status !== 0) { bad++; console.log(`>>> GAGAL: ${name}`); } }
console.log(bad ? `\n${bad} kelompok uji gagal` : '\nSemua uji lulus'); process.exit(bad ? 1 : 0);
