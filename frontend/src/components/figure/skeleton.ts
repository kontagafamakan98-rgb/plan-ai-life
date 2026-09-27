/**
 * Skeleton: the measurements behind every resident.
 *
 * A person is not a rectangle. It is a head with a jaw, shoulders that slope
 * into arms of two tapering segments, a torso with a waist, legs that bend at a
 * knee, and shoes with a heel. This file turns a resident plus a mood into those
 * numbers once, so the drawing code never invents geometry on the fly and two
 * residents can never accidentally share a body.
 *
 * Units are the sprite's own: 96 wide, 156 tall, shoes on the line at 141.
 */

import { SILHOUETTE_SHAPE, hashString, silhouetteOf } from '../../game/art';
import type { Resident } from '../../game/types';

export const VIEW_WIDTH = 96;
export const VIEW_HEIGHT = 156;

/** The line the shoes rest on. */
export const GROUND = 141;

/** Centre of the figure, left to right. */
export const CX = 48;

export type Stance = 'relaxed' | 'pocket' | 'clasped';

export interface Build {
  seed: number;
  stance: Stance;
  /** Head */
  headTop: number;
  headHalf: number;
  headTall: number;
  chin: number;
  neckY: number;
  earRx: number;
  earRy: number;
  /** Face, all placed relative to the head so proportions stay right */
  eyeY: number;
  eyeGap: number;
  eyeHalf: number;
  eyeHalfTall: number;
  browY: number;
  noseY: number;
  mouthY: number;
  /** Body */
  shoulderY: number;
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  hipY: number;
  kneeY: number;
  ankleY: number;
  thigh: number;
  knee: number;
  ankle: number;
  upperArm: number;
  forearm: number;
  wrist: number;
  legSpread: number;
  armOut: number;
  /** Posture, from the mood and from the person */
  spineLean: number;
  shoulderDrop: number;
  headTilt: number;
  slump: number;
}

export type MouthShape = 'smile' | 'flat' | 'frown' | 'open';

export type MoodShape = {
  browTilt: number;
  browLift: number;
  mouth: MouthShape;
  cheek: number;
  eyeOpen: number;
  lid: number;
  headTilt: number;
  shoulder: number;
  lean: number;
};

const MOODS: Record<string, MoodShape> = {
  radiant: { browTilt: -3, browLift: -1, mouth: 'open', cheek: 0.95, eyeOpen: 1.02, lid: 0, headTilt: -1.2, shoulder: -1, lean: -0.7 },
  content: { browTilt: -1.5, browLift: 0, mouth: 'smile', cheek: 0.8, eyeOpen: 1, lid: 0.1, headTilt: 0.6, shoulder: 0.2, lean: 0.2 },
  focused: { browTilt: 3, browLift: 1.4, mouth: 'flat', cheek: 0.28, eyeOpen: 0.96, lid: 0.26, headTilt: -0.4, shoulder: -0.6, lean: -0.5 },
  neutral: { browTilt: 0, browLift: 0, mouth: 'flat', cheek: 0.34, eyeOpen: 1, lid: 0.2, headTilt: 0, shoulder: 0, lean: 0 },
  tired: { browTilt: 1.5, browLift: 0.8, mouth: 'flat', cheek: 0.22, eyeOpen: 0.74, lid: 0.46, headTilt: 1.6, shoulder: 1.1, lean: 0.9 },
  anxious: { browTilt: 5, browLift: -1, mouth: 'frown', cheek: 0.4, eyeOpen: 1.04, lid: 0.08, headTilt: -0.6, shoulder: -1.4, lean: -0.4 },
  upset: { browTilt: 6, browLift: -2, mouth: 'frown', cheek: 0.6, eyeOpen: 0.9, lid: 0.2, headTilt: 2.2, shoulder: 1.4, lean: 1.2 },
  lost: { browTilt: 2.5, browLift: 2, mouth: 'flat', cheek: 0.16, eyeOpen: 0.82, lid: 0.3, headTilt: -1.8, shoulder: -0.4, lean: -0.3 },
};

export function moodOf(resident: Resident): MoodShape {
  return MOODS[resident.mood] ?? MOODS.neutral;
}

/** Small stable jitter, so two residents of the same silhouette still differ. */
function jitter(seed: number, shift: number, spread: number): number {
  const slice = (seed >> shift) & 255;
  return (slice / 255 - 0.5) * 2 * spread;
}

export function buildOf(resident: Resident): Build {
  const shape = SILHOUETTE_SHAPE[silhouetteOf(resident)];
  const mood = moodOf(resident);
  const seed = hashString(resident.id);

  /**
   * Height first, then the head: at a 5.2-head figure the cast reads as adults
   * and the legs carry their own length, which is what a flat foot line needs.
   */
  const chin = 44.6 - jitter(seed, 3, 1.1);
  const headHalf = 10.4 + jitter(seed, 5, 0.7) + (shape.shoulder - 16) * 0.07;
  const headTall = 11.4 + jitter(seed, 7, 0.6);
  const headTop = chin - headTall * 2;
  const neckY = chin + 3.4;
  /** A slumped mood pulls the shoulders down, a proud one lifts them. */
  const shoulderY = neckY + 3.6 + mood.shoulder * 0.7;
  const shoulder = shape.shoulder * 1.08 + jitter(seed, 9, 0.5);
  const chest = shoulder * 0.88;
  const waist = shape.waist + jitter(seed, 11, 0.4);
  const hip = waist * 1.18 + 0.8;
  const hipY = shoulderY + shape.torsoHeight * 0.98 + jitter(seed, 13, 0.8);
  const ankleY = 133;
  const kneeY = (hipY + ankleY) / 2 + 1.2;
  const thigh = shape.legWidth + 1.8;
  const knee = shape.legWidth * 0.84;
  const ankle = shape.legWidth * 0.66;
  const upperArm = shape.armWidth + 0.4;
  const forearm = shape.armWidth * 0.88;
  const wrist = shape.armWidth * 0.72;
  const legSpread = waist * 0.4 + 0.7 + jitter(seed, 17, 0.4);
  const stance: Stance = (['relaxed', 'relaxed', 'pocket', 'clasped'] as Stance[])[seed % 4];

  return {
    seed,
    stance,
    headTop,
    headHalf,
    headTall,
    chin,
    neckY,
    earRx: headHalf * 0.2,
    earRy: headHalf * 0.29,
    eyeY: chin - headTall * 0.92,
    eyeGap: headHalf * 0.445,
    eyeHalf: headHalf * 0.305,
    eyeHalfTall: headHalf * 0.265,
    browY: chin - headTall * 0.92 - headHalf * 0.44 + mood.browLift,
    noseY: chin - headTall * 0.92 + headHalf * 0.3,
    mouthY: chin - headTall * 0.92 + headHalf * 0.7,
    shoulderY,
    shoulder,
    chest,
    waist,
    hip,
    hipY,
    kneeY,
    ankleY,
    thigh,
    knee,
    ankle,
    upperArm,
    forearm,
    wrist,
    legSpread,
    armOut: 1.4 + jitter(seed, 21, 1.6) + mood.shoulder * 0.3,
    spineLean: mood.lean,
    shoulderDrop: mood.shoulder * 0.9,
    headTilt: mood.headTilt,
    slump: mood.shoulder * 0.5,
  };
}

/**
 * The eye band, in figure units, for the blinking overlay on the stage.
 *
 * Wide enough for every head in the cast, and starting below the lowest
 * hairline so the overlay can never paint a brow over a fringe.
 */
export const EYE_REGION = { x: 38.3, y: 28.9, width: 19.4, height: 12.6 };

/** Head and shoulders, for the large portrait in the roster. */
export const BUST_REGION = { x: 27.3, y: 16.2, w: 41.4, h: 46.8 };
