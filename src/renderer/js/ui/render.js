// Rendering helpers used by the editor, thumbnails and export.
import { renderFrame, projectDuration } from '../engine/scene.js';
import { stageTimes } from '../engine/roulette.js';
import { img, preload, customFonts } from './dom.js';

export function projectAssetIds(p) {
  const ids = []; if (p.background && p.background.assetId) ids.push(p.background.assetId);
  for (const l of p.layers) {
    if (l.assetId) ids.push(l.assetId);
    if (l.type === 'roulette') { const q = l.params; ids.push(q.centerAssetId, q.review && q.review.productAssetId, ...q.brands.map(b => b.assetId)); }
  }
  return ids.filter(Boolean);
}
export function draw(ctx, p, t, scale = 1) { ctx.setTransform(scale, 0, 0, scale, 0, 0); renderFrame(ctx, p, t, img, customFonts()); ctx.setTransform(1, 0, 0, 1, 0, 0); }
export function posterTime(p) {
  const r = p.layers.find(l => l.type === 'roulette' && !l.hidden);
  if (r) { const S = stageTimes(r.params); return r.start + S.spinDur.a + S.spinDur.d * 0.55; }
  return Math.min(projectDuration(p) * 0.4, 3);
}
export async function thumbnail(p, maxSide = 360, t) {
  await preload(projectAssetIds(p));
  const k = maxSide / Math.max(p.width, p.height); const c = document.createElement('canvas'); c.width = Math.round(p.width * k); c.height = Math.round(p.height * k);
  draw(c.getContext('2d'), p, t ?? posterTime(p), k);
  try { return c.toDataURL('image/jpeg', 0.78); } catch (e) { return null; }
}
