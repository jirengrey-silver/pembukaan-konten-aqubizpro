// Node test environment: a real Skia canvas plus the app's bundled fonts.
import path from 'path'; import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NM = process.env.NM || path.resolve('node_modules');
const { createCanvas, GlobalFonts, Image, loadImage } = require(path.join(NM, '@napi-rs/canvas'));
const FD = path.resolve('src/renderer/fonts');
for (const f of fs.readdirSync(FD)) { if (!f.endsWith('.woff2')) continue; const fam = f.startsWith('sora') ? 'Sora' : f.startsWith('ibm-plex-sans') ? 'IBM Plex Sans' : f.startsWith('orbitron') ? 'Orbitron' : f.startsWith('ibm-plex-mono') ? 'IBM Plex Mono' : f.startsWith('montserrat') ? 'Montserrat' : null; if (fam) GlobalFonts.registerFromPath(path.join(FD, f), fam); }
export { createCanvas, Image, loadImage };
export function sheet(cells, cols, file) { const cw = cells[0].width, ch = cells[0].height; const rows = Math.ceil(cells.length / cols); const c = createCanvas(cw * cols + 6 * (cols - 1), ch * rows + 6 * (rows - 1)); const x = c.getContext('2d'); x.fillStyle = '#444'; x.fillRect(0, 0, c.width, c.height); cells.forEach((cell, i) => x.drawImage(cell, (i % cols) * (cw + 6), Math.floor(i / cols) * (ch + 6))); fs.writeFileSync(file, c.toBuffer('image/png')); }
