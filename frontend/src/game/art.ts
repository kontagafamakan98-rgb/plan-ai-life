/**
 * Colour and silhouette maths for the world.
 *
 * The interface is deliberately cold (graphite and one cool accent, the
 * Watcher's instruments), while the world inside the glass is warm: plaster,
 * wood, brass, lamplight. That split is the identity of ARCADIA-9, and it lives
 * here as pure functions so the sprite, the scenery and the sky all derive their
 * shadows and highlights from the same rules.
 *
 * Warmth rule: a shadow never turns grey, it turns brown. Highlights never turn
 * white, they turn cream. Anything that must stay recognisable at small sizes is
 * derived with one of these two functions instead of a neutral shade.
 */

import type { Look, Resident } from './types';

/* ------------------------------------------------------------------ *
 * Colour maths
 * ------------------------------------------------------------------ */

const SHADOW_INK = '#2A1408';
const HIGHLIGHT_INK = '#FFE3B8';

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const numeric = parseInt(full || '808080', 16);
  return { r: (numeric >> 16) & 0xff, g: (numeric >> 8) & 0xff, b: numeric & 0xff };
}

export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`;
}

/** Blend two colours; `t` is how much of `b` ends up in the result. */
export function mix(a: string, b: string, t: number): string {
  const first = parseHex(a);
  const second = parseHex(b);
  return toHex({
    r: first.r + (second.r - first.r) * t,
    g: first.g + (second.g - first.g) * t,
    b: first.b + (second.b - first.b) * t,
  });
}

/** Neutral darkening, kept for edges and text where warmth would muddy. */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex({ r: r + amount, g: g + amount, b: b + amount });
}

/**
 * Shadow: darker, and pulled toward warm brown.
 *
 * `amount` is negative (a shade step such as -22). The colour loses the same
 * amount of luminance as `shade` but ends up earthy instead of grey, which is
 * what makes a flat shape read as a lit object.
 */
export function warmShade(hex: string, amount: number, earthiness = 0.22): string {
  const darkened = shade(hex, amount);
  return mix(darkened, SHADOW_INK, earthiness);
}

/** Highlight: lighter, and pulled toward cream rather than pure white. */
export function warmLight(hex: string, amount: number, creaminess = 0.3): string {
  const lightened = shade(hex, amount);
  return mix(lightened, HIGHLIGHT_INK, creaminess);
}

/** Add transparency to a hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Warm ambient light on a surface at a given hour, and how amber it is. */
export function ambientLight(hour: number): { intensity: number; warmth: number } {
  if (hour < 5) return { intensity: 0.34, warmth: 0.7 };
  if (hour < 8) return { intensity: 0.78, warmth: 0.62 };
  if (hour < 12) return { intensity: 1, warmth: 0.3 };
  if (hour < 16) return { intensity: 1, warmth: 0.24 };
  if (hour < 19) return { intensity: 0.86, warmth: 0.55 };
  if (hour < 22) return { intensity: 0.52, warmth: 0.72 };
  return { intensity: 0.36, warmth: 0.74 };
}

/* ------------------------------------------------------------------ *
 * Silhouette and garment
 * ------------------------------------------------------------------ */

/** Stable id hash, so a look never changes between renders or processes. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export type Garment = 'shirt' | 'jacket' | 'hoodie' | 'coat' | 'tunic' | 'wrap';
export type Silhouette = 'slim' | 'average' | 'broad' | 'tall';

const GARMENTS: Garment[] = ['shirt', 'jacket', 'hoodie', 'coat', 'tunic', 'wrap'];
const SILHOUETTES: Silhouette[] = ['slim', 'average', 'broad', 'tall'];

/** The cut of the top garment: explicit in the data, otherwise stable per id. */
export function garmentOf(resident: Resident): Garment {
  const declared = (resident.look as Look & { style?: string } | undefined)?.style;
  if (declared && (GARMENTS as string[]).includes(declared)) return declared as Garment;
  return GARMENTS[hashString(resident.id) % GARMENTS.length];
}

/** The body silhouette: explicit in the data, otherwise stable per id. */
export function silhouetteOf(resident: Resident): Silhouette {
  const declared = (resident.look as Look & { build?: string } | undefined)?.build;
  if (declared && (SILHOUETTES as string[]).includes(declared)) return declared as Silhouette;
  return SILHOUETTES[hashString(`${resident.id}:body`) % SILHOUETTES.length];
}

/** Shoulder, waist and leg measurements per silhouette, in sprite units. */
export const SILHOUETTE_SHAPE: Record<
  Silhouette,
  { torsoWidth: number; torsoHeight: number; shoulder: number; waist: number; legWidth: number; armWidth: number }
> = {
  slim: { torsoWidth: 33, torsoHeight: 37, shoulder: 15, waist: 11, legWidth: 9, armWidth: 8 },
  average: { torsoWidth: 36, torsoHeight: 36, shoulder: 16, waist: 13, legWidth: 10, armWidth: 9 },
  broad: { torsoWidth: 40, torsoHeight: 35, shoulder: 18, waist: 15, legWidth: 11, armWidth: 10 },
  tall: { torsoWidth: 35, torsoHeight: 40, shoulder: 16, waist: 12, legWidth: 10, armWidth: 9 },
};
