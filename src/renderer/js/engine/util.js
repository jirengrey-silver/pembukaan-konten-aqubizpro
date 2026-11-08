// Shared math, easing and color helpers for the animation engine.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, p) => a + (b - a) * p;
export const seg = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const EASE = {
  linear: p => p,
  inQuad: p => p * p,
  outQuad: p => 1 - (1 - p) * (1 - p),
  inCubic: p => p * p * p,
  outCubic: p => 1 - Math.pow(1 - p, 3),
  inOutCubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outBack: p => { const c = 1.6; return p <= 0 ? 0 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p))
};
export function hexA(hex, a) {
  const h = String(hex || '#000000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16) || 0;
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(a, b, k) {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
  const c = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return '#' + [c(16), c(8), c(0)].map(v => v.toString(16).padStart(2, '0')).join('');
}
export const uid = () => Math.random().toString(36).slice(2, 10);
export const FONTS = {
  sora: { label: 'Sora', css: '"Sora", "Segoe UI", Arial, sans-serif' },
  plex: { label: 'IBM Plex Sans', css: '"IBM Plex Sans", "Segoe UI", Arial, sans-serif' },
  montserrat: { label: 'Montserrat', css: '"Montserrat", "Segoe UI", Arial, sans-serif' },
  orbitron: { label: 'Orbitron', css: '"Orbitron", "Arial Black", sans-serif' },
  mono: { label: 'IBM Plex Mono', css: '"IBM Plex Mono", Consolas, monospace' }
};
export function fontCss(key, customFonts) {
  if (FONTS[key]) return FONTS[key].css;
  if (customFonts && customFonts[key]) return `"${customFonts[key]}", "Segoe UI", Arial, sans-serif`;
  return FONTS.sora.css;
}
// brand colors of QBizPro
export const QB = { navy: '#0A1631', navy2: '#12285A', gold: '#F2A93B', orange: '#F57C1F', blue: '#1E9BFF', white: '#F4F7FC' };
