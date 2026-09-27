/**
 * Figure: one resident, drawn as a vector illustration.
 *
 * The cast used to be assembled from rectangles, which is exactly what it
 * looked like. Everything here is drawn with real curves and real gradients
 * instead, in a single coordinate space of 96 by 156 units, with the shoes on
 * the line at y = 141 so the stage can anchor every figure on the same floor.
 *
 * The rules of the world still apply:
 * - one key light, from the upper right, so every form is lit on the same side
 *   and every figure casts toward the same side;
 * - a shadow turns brown (warmShade), a highlight turns cream (warmLight),
 *   never grey and never blue;
 * - a person is their cut, their hair and their stance, so two residents in
 *   similar colours still read as two different people in silhouette.
 *
 * The faces are drawn with palette, lash, lid, iris, pupil, glint, brow, nose,
 * cheek and lip shapes, so the same figure can be shown at 40 pixels on the
 * stage and at 150 pixels in the roster without turning into a blob.
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { world } from '../theme';
import {
  SILHOUETTE_SHAPE,
  garmentOf,
  hashString,
  mix,
  silhouetteOf,
  warmLight,
  warmShade,
  withAlpha,
  type Garment as GarmentCut,
} from '../game/art';
import type { Look, Resident } from '../game/types';

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

const VIEW_WIDTH = 96;
const VIEW_HEIGHT = 156;

/** The line the shoes rest on, so nothing floats above the boards. */
const GROUND = 141;

const CX = 48;
const SHOULDER_Y = 68;
const NECK_Y = 66;
const HEAD_CY = 42.4;
const HEAD_RX = 13.1;
const HEAD_RY = 14.4;
const CHIN_Y = 58.4;
const EYE_Y = 44.2;
const EYE_DX = 5.7;
const EYE_RX = 3.8;
const EYE_RY = 3.2;
const BROW_Y = 38.3;
const MOUTH_Y = 53.6;
const ANKLE_Y = 133;
const WRIST_LIFT = 2;

export {
  VIEW_WIDTH as FIGURE_WIDTH,
  VIEW_HEIGHT as FIGURE_HEIGHT,
  GROUND as FIGURE_GROUND,
};

/**
 * The eye band, in figure units, for the blinking overlay on the stage.
 *
 * The top edge sits just below every hairline in HairFront, so the overlay can
 * never paint a brow over a fringe, and the bottom edge clears the cheek blush.
 */
export const FIGURE_EYE_REGION = { x: 35.6, y: 36.8, width: 24.8, height: 11.6 };

/**
 * Head and shoulders, for the large portrait in the roster.
 *
 * The crop is a window on the same drawing, not a second drawing: the portrait
 * and the figure on the stage can never drift apart.
 */
export const FIGURE_BUST = { x: 20, y: 19, w: 56, h: 63 };

/* ------------------------------------------------------------------ *
 * Moods
 * ------------------------------------------------------------------ */

type MouthShape = 'smile' | 'flat' | 'frown' | 'open';

type MoodShape = {
  browTilt: number;
  browLift: number;
  mouth: MouthShape;
  cheek: number;
  eyeOpen: number;
  lid: number;
  headTilt: number;
  shoulder: number;
};

const MOOD_SHAPES: Record<string, MoodShape> = {
  radiant: { browTilt: -3, browLift: -1, mouth: 'open', cheek: 0.95, eyeOpen: 1.02, lid: 0, headTilt: -1.2, shoulder: -1 },
  content: { browTilt: -1.5, browLift: 0, mouth: 'smile', cheek: 0.8, eyeOpen: 1, lid: 0.1, headTilt: 0.6, shoulder: 0.2 },
  focused: { browTilt: 3, browLift: 1.4, mouth: 'flat', cheek: 0.28, eyeOpen: 0.96, lid: 0.26, headTilt: -0.4, shoulder: -0.6 },
  neutral: { browTilt: 0, browLift: 0, mouth: 'flat', cheek: 0.34, eyeOpen: 1, lid: 0.2, headTilt: 0, shoulder: 0 },
  tired: { browTilt: 1.5, browLift: 0.8, mouth: 'flat', cheek: 0.22, eyeOpen: 0.74, lid: 0.46, headTilt: 1.6, shoulder: 1.1 },
  anxious: { browTilt: 5, browLift: -1, mouth: 'frown', cheek: 0.4, eyeOpen: 1.04, lid: 0.08, headTilt: -0.6, shoulder: -1.4 },
  upset: { browTilt: 6, browLift: -2, mouth: 'frown', cheek: 0.6, eyeOpen: 0.9, lid: 0.2, headTilt: 2.2, shoulder: 1.4 },
  lost: { browTilt: 2.5, browLift: 2, mouth: 'flat', cheek: 0.16, eyeOpen: 0.82, lid: 0.3, headTilt: -1.8, shoulder: -0.4 },
};

const FALLBACK_LOOK: Look = {
  skin: '#E8C6A0',
  hair: '#4A3728',
  hairstyle: 'bob',
  eyes: '#3B2B20',
  outfit: { top: '#B4623C', bottom: '#4A3A2E', accent: '#D9A24A' },
  accessory: 'none',
};

/* ------------------------------------------------------------------ *
 * Path generators
 * ------------------------------------------------------------------ */

/** One trouser leg, tapered from the hip to the ankle. */
function legPath(xc: number, top: number, width: number): string {
  const half = width / 2;
  return [
    `M ${xc - half} ${top}`,
    `C ${xc - half - 0.9} ${top + 12} ${xc - half - 0.7} ${ANKLE_Y - 15} ${xc - half + 0.5} ${ANKLE_Y}`,
    `L ${xc + half - 0.5} ${ANKLE_Y}`,
    `C ${xc + half + 0.7} ${ANKLE_Y - 15} ${xc + half + 0.9} ${top + 12} ${xc + half} ${top}`,
    'Z',
  ].join(' ');
}

/** A shoe with a rounded toe pointing away from the other foot. */
function shoePath(xc: number, width: number, dir: 1 | -1): string {
  const inner = xc - (dir * width) / 2;
  const outer = xc + (dir * width) / 2;
  const toe = outer + dir * 2.6;
  return [
    `M ${inner} ${ANKLE_Y - 1}`,
    `L ${outer} ${ANKLE_Y - 1}`,
    `C ${toe} ${ANKLE_Y} ${toe + dir * 0.6} ${ANKLE_Y + 5.4} ${outer - dir * 0.6} ${ANKLE_Y + 6.6}`,
    `L ${inner + dir * 0.8} ${ANKLE_Y + 6.8}`,
    `C ${inner - dir * 1.2} ${ANKLE_Y + 5} ${inner - dir * 0.6} ${ANKLE_Y + 1.4} ${inner} ${ANKLE_Y - 1}`,
    'Z',
  ].join(' ');
}

/** One sleeve, from the shoulder seam to the cuff, with a slight elbow bend. */
function armPath(side: 1 | -1, shoulderHalf: number, cuffY: number, width: number, swing: number): string {
  const top = SHOULDER_Y + 1;
  const inner = side * (shoulderHalf - width * 0.9);
  const outer = side * (shoulderHalf + 1.2);
  const bend = side * 1.1;
  const bottom = cuffY + swing;
  return [
    `M ${CX + outer} ${top}`,
    `C ${CX + outer + side * 1.6} ${top + 9} ${CX + outer + bend} ${bottom - 12} ${CX + outer - side * 0.6} ${bottom}`,
    `L ${CX + inner + side * 0.4} ${bottom - 0.4}`,
    `C ${CX + inner + side * 1.2} ${bottom - 13} ${CX + inner + side * 0.6} ${top + 8} ${CX + inner} ${top}`,
    'Z',
  ].join(' ');
}

/** Torso outline of a garment, from the shoulder line to the hem. */
function torsoPath(shoulderHalf: number, waistHalf: number, hipY: number, hem: number): string {
  return [
    `M ${CX - shoulderHalf} ${SHOULDER_Y}`,
    `C ${CX - shoulderHalf - 1.6} ${SHOULDER_Y + 3} ${CX - waistHalf - 2} ${hipY - 8} ${CX - waistHalf - 2.6} ${hipY + hem}`,
    `L ${CX + waistHalf + 2.6} ${hipY + hem}`,
    `C ${CX + waistHalf + 2} ${hipY - 8} ${CX + shoulderHalf + 1.6} ${SHOULDER_Y + 3} ${CX + shoulderHalf} ${SHOULDER_Y}`,
    `C ${CX + shoulderHalf - 3} ${SHOULDER_Y - 3.6} ${CX - shoulderHalf + 3} ${SHOULDER_Y - 3.6} ${CX - shoulderHalf} ${SHOULDER_Y}`,
    'Z',
  ].join(' ');
}

/** The skull: an oval that tapers into a jaw and a small chin. */
function skullPath(scaleX: number, scaleY: number): string {
  const rx = HEAD_RX * scaleX;
  const tipX = 6.2 * scaleX;
  return [
    `M ${CX} ${HEAD_CY - HEAD_RY * scaleY}`,
    `C ${CX - rx * 0.72} ${HEAD_CY - HEAD_RY * scaleY} ${CX - rx} ${HEAD_CY - 4} ${CX - rx} ${HEAD_CY + 1.4}`,
    `C ${CX - rx} ${HEAD_CY + 7.4} ${CX - tipX - 3.2} ${HEAD_CY + 11.4} ${CX - tipX} ${HEAD_CY + 14.8}`,
    `C ${CX - tipX + 2} ${HEAD_CY + 16.8} ${CX + tipX - 2} ${HEAD_CY + 16.8} ${CX + tipX} ${HEAD_CY + 14.8}`,
    `C ${CX + tipX + 3.2} ${HEAD_CY + 11.4} ${CX + rx} ${HEAD_CY + 7.4} ${CX + rx} ${HEAD_CY + 1.4}`,
    `C ${CX + rx} ${HEAD_CY - 4} ${CX + rx * 0.72} ${HEAD_CY - HEAD_RY * scaleY} ${CX} ${HEAD_CY - HEAD_RY * scaleY}`,
    'Z',
  ].join(' ');
}

/* ------------------------------------------------------------------ *
 * Face
 * ------------------------------------------------------------------ */

function eyeAlmond(ex: number, ey: number): string {
  return [
    `M ${ex - EYE_RX} ${ey + 0.3}`,
    `C ${ex - EYE_RX + 0.5} ${ey - 2.3} ${ex - 2.1} ${ey - EYE_RY} ${ex} ${ey - EYE_RY}`,
    `C ${ex + 2.1} ${ey - EYE_RY} ${ex + EYE_RX - 0.5} ${ey - 2.3} ${ex + EYE_RX} ${ey + 0.3}`,
    `C ${ex + 2.5} ${ey + 2.6} ${ex - 2.5} ${ey + 2.6} ${ex - EYE_RX} ${ey + 0.3}`,
    'Z',
  ].join(' ');
}

/**
 * The eyes, as a group so they can live inside the figure or inside their own
 * layer for the blink animation.
 */
export function EyeLayer({
  look,
  mood,
  id,
}: {
  look: Look;
  mood: MoodShape;
  id: (part: string) => string;
}) {
  const skinShade = warmShade(look.skin, -26, 0.34);
  const lash = warmShade(look.hair, -14, 0.26);

  return (
    <>
      {[0, 1].map((side) => {
        const sign = side === 0 ? -1 : 1;
        const ex = CX + sign * EYE_DX;
        const ey = EYE_Y;
        const d = eyeAlmond(ex, ey);
        const lid = mood.lid * (EYE_RY * 2 + 0.6);
        return (
          <G key={side}>
            <ClipPath id={id(`clip${side}`)}>
              <Path d={d} />
            </ClipPath>
            <Path d={d} fill="#FFF6EA" />
            <G clipPath={`url(#${id(`clip${side}`)})`}>
              <Circle cx={ex} cy={ey + 0.5} r={2.5} fill={`url(#${id('iris')})`} />
              <Circle cx={ex} cy={ey + 0.5} r={1.6} fill="#120A07" />
              <Circle cx={ex - 0.9} cy={ey - 1.2} r={1.05} fill="#FFFBF4" opacity={0.95} />
              <Circle cx={ex + 1.3} cy={ey + 1.5} r={0.5} fill="#FFFBF4" opacity={0.5} />
              <Rect x={ex - EYE_RX} y={ey - EYE_RY - 1} width={EYE_RX * 2} height={lid} fill={`url(#${id('lid')})`} />
              <Path
                d={`M ${ex - EYE_RX} ${ey - 0.6} C ${ex - 2.4} ${ey - EYE_RY - 1.4} ${ex + 2} ${ey - EYE_RY - 1.6} ${ex + EYE_RX + 0.9} ${ey - 1.4}`}
                stroke={lash}
                strokeWidth={1.5}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={`M ${ex - EYE_RX + 0.6} ${ey + 1.2} C ${ex - 1.4} ${ey + 2.8} ${ex + 1.6} ${ey + 2.6} ${ex + EYE_RX - 0.4} ${ey + 0.9}`}
                stroke={withAlpha(skinShade, 0.7)}
                strokeWidth={0.7}
                fill="none"
              />
            </G>
          </G>
        );
      })}
      <Ellipse cx={CX - EYE_DX} cy={EYE_Y + 3.4} rx={2.2} ry={0.7} fill={withAlpha(skinShade, 0.32)} />
      <Ellipse cx={CX + EYE_DX} cy={EYE_Y + 3.4} rx={2.2} ry={0.7} fill={withAlpha(skinShade, 0.32)} />
    </>
  );
}

function browPath(ex: number, ey: number, flip: boolean): string {
  const s = flip ? -1 : 1;
  return [
    `M ${ex - s * EYE_RX - 0.2} ${ey + 0.7}`,
    `C ${ex - s * 1.6} ${ey - 1.4} ${ex + s * 1.2} ${ey - 1.6} ${ex + s * (EYE_RX + 0.5)} ${ey + 0.2}`,
    `C ${ex + s * 1.4} ${ey + 1.5} ${ex - s * 1.6} ${ey + 1.7} ${ex - s * EYE_RX - 0.2} ${ey + 0.7}`,
    'Z',
  ].join(' ');
}

function FacePaths({
  look,
  mood,
  id,
}: {
  look: Look;
  mood: MoodShape;
  id: (part: string) => string;
}) {
  const skinShade = warmShade(look.skin, -30, 0.34);
  const skinDeep = warmShade(look.skin, -52, 0.4);
  const skinLight = warmLight(look.skin, 16, 0.4);
  const lash = warmShade(look.hair, -18, 0.28);
  const lip = mix(warmShade(look.skin, -46, 0.3), world.terracotta, 0.34);
  const lipLow = warmLight(lip, 16, 0.24);

  const cornerLift = mood.mouth === 'smile' ? -0.9 : mood.mouth === 'frown' ? 1.1 : 0;
  const upperLip = [
    `M ${CX - 3.7} ${MOUTH_Y + cornerLift * 0.8}`,
    `C ${CX - 2.5} ${MOUTH_Y - 0.9} ${CX - 1.1} ${MOUTH_Y - 1.1} ${CX} ${MOUTH_Y - 0.3}`,
    `C ${CX + 1.1} ${MOUTH_Y - 1.1} ${CX + 2.5} ${MOUTH_Y - 0.9} ${CX + 3.7} ${MOUTH_Y + cornerLift * 0.8}`,
    `C ${CX + 1.8} ${MOUTH_Y + 0.9} ${CX - 1.8} ${MOUTH_Y + 0.9} ${CX - 3.7} ${MOUTH_Y + cornerLift * 0.8}`,
    'Z',
  ].join(' ');
  const lowerLip = [
    `M ${CX - 3.1} ${MOUTH_Y + 0.7}`,
    `C ${CX - 1.6} ${MOUTH_Y + 3 + cornerLift} ${CX + 1.6} ${MOUTH_Y + 3 + cornerLift} ${CX + 3.1} ${MOUTH_Y + 0.7}`,
    `C ${CX + 1.6} ${MOUTH_Y + 1.3} ${CX - 1.6} ${MOUTH_Y + 1.3} ${CX - 3.1} ${MOUTH_Y + 0.7}`,
    'Z',
  ].join(' ');

  return (
    <>
      {/* Brows */}
      {[0, 1].map((side) => {
        const sign = side === 0 ? -1 : 1;
        const ex = CX + sign * EYE_DX;
        const ey = BROW_Y + mood.browLift;
        return (
          <G
            key={side}
            transform={`rotate(${sign * mood.browTilt} ${ex} ${ey})`}
            opacity={0.94}
          >
            <Path d={browPath(ex, ey, side === 1)} fill={lash} />
          </G>
        );
      })}

      {/* Nose: a bridge highlight, a soft line and a small base. */}
      <Path
        d={`M ${CX - 1.1} ${41.4} C ${CX - 2.4} ${44.6} ${CX - 2.6} ${46.8} ${CX - 1.2} ${48.4}`}
        stroke={withAlpha(skinShade, 0.8)}
        strokeWidth={0.85}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M ${CX + 0.9} ${42.4} C ${CX + 2.1} ${44.8} ${CX + 2.4} ${46.8} ${CX + 1.2} ${48.2}`}
        stroke={withAlpha(skinLight, 0.75)}
        strokeWidth={0.85}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={`M ${CX - 2} ${48.9} C ${CX - 0.8} ${49.5} ${CX + 1} ${49.4} ${CX + 2} ${48.6}`}
        stroke={withAlpha(skinDeep, 0.5)}
        strokeWidth={0.75}
        strokeLinecap="round"
        fill="none"
      />

      {/* Cheeks */}
      <Ellipse cx={CX - 8} cy={MOUTH_Y - 2.4} rx={4.2} ry={2.8} fill={`url(#${id('blush')})`} opacity={mood.cheek} />
      <Ellipse cx={CX + 8} cy={MOUTH_Y - 2.4} rx={4.2} ry={2.8} fill={`url(#${id('blush')})`} opacity={mood.cheek} />

      {/* Mouth */}
      {mood.mouth === 'open' ? (
        <>
          <Path
            d={`M ${CX - 3.4} ${MOUTH_Y} C ${CX - 1.8} ${MOUTH_Y + 5.4} ${CX + 1.8} ${MOUTH_Y + 5.4} ${CX + 3.4} ${MOUTH_Y} C ${CX + 1.6} ${MOUTH_Y - 1.4} ${CX - 1.6} ${MOUTH_Y - 1.4} ${CX - 3.4} ${MOUTH_Y} Z`}
            fill={withAlpha(skinDeep, 0.92)}
          />
          <Path
            d={`M ${CX - 2} ${MOUTH_Y + 3.1} C ${CX - 0.6} ${MOUTH_Y + 4.6} ${CX + 0.6} ${MOUTH_Y + 4.6} ${CX + 2} ${MOUTH_Y + 3}`}
            stroke={withAlpha(lip, 0.9)}
            strokeWidth={1.4}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Path d={upperLip} fill={lip} />
          <Path d={lowerLip} fill={lipLow} />
          <Path
            d={`M ${CX - 3.3} ${MOUTH_Y + 0.6} C ${CX - 1.8} ${MOUTH_Y + 1.1} ${CX + 1.8} ${MOUTH_Y + 1.1} ${CX + 3.3} ${MOUTH_Y + 0.6}`}
            stroke={withAlpha(warmShade(lip, -34, 0.3), 0.75)}
            strokeWidth={0.6}
            fill="none"
          />
        </>
      )}

      {/* Soft shadow under the jaw, on the neck. */}
      <Ellipse cx={CX} cy={NECK_Y - 4.6} rx={7.4} ry={2.6} fill={`url(#${id('jaw')})`} />

      {/* Highlights: temple and chin, kept faint so the face stays soft. */}
      <Ellipse cx={CX + 6.4} cy={40.6} rx={3.4} ry={5} fill={withAlpha(skinLight, 0.4)} />
      <Ellipse cx={CX} cy={CHIN_Y - 2.6} rx={3} ry={1.6} fill={withAlpha(skinLight, 0.32)} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Hair
 * ------------------------------------------------------------------ */

function HairBack({ style: hairStyle, color }: { style: string; color: string }) {
  const deep = warmShade(color, -34, 0.3);
  const fill = `url(#hair-back)`;
  const mass = (d: string) => <Path d={d} fill={fill} />;
  void deep;

  switch (hairStyle) {
    case 'braids':
      return (
        <>
          {mass(`M ${CX - 15.4} ${HEAD_CY - 8} C ${CX - 20} ${HEAD_CY + 4} ${CX - 19.4} ${HEAD_CY + 16} ${CX - 15.6} ${HEAD_CY + 22} L ${CX - 11.4} ${HEAD_CY + 12} L ${CX - 11} ${HEAD_CY - 6} Z`)}
          {mass(`M ${CX + 15.4} ${HEAD_CY - 8} C ${CX + 20} ${HEAD_CY + 4} ${CX + 19.4} ${HEAD_CY + 16} ${CX + 15.6} ${HEAD_CY + 22} L ${CX + 11.4} ${HEAD_CY + 12} L ${CX + 11} ${HEAD_CY - 6} Z`)}
        </>
      );
    case 'ponytail':
      return (
        <>
          {mass(`M ${CX + 12.6} ${HEAD_CY - 6} C ${CX + 22} ${HEAD_CY - 1} ${CX + 24.6} ${HEAD_CY + 14} ${CX + 18.6} ${HEAD_CY + 26} C ${CX + 16.4} ${HEAD_CY + 18} ${CX + 15.4} ${HEAD_CY + 4} ${CX + 11.4} ${HEAD_CY - 1} Z`)}
          {mass(`M ${CX - 14.6} ${HEAD_CY - 8} C ${CX - 17.4} ${HEAD_CY - 1} ${CX - 17} ${HEAD_CY + 5} ${CX - 15} ${HEAD_CY + 8} L ${CX - 10.4} ${HEAD_CY + 2} Z`)}
        </>
      );
    case 'bun':
    case 'curls':
    case 'undercut':
    case 'swept':
    case 'bob':
    default:
      return mass(`M ${CX - 15.4} ${HEAD_CY - 9} C ${CX - 17.6} ${HEAD_CY + 2} ${CX - 16.4} ${HEAD_CY + 10} ${CX - 15} ${HEAD_CY + 12.6} L ${CX + 15} ${HEAD_CY + 12.6} C ${CX + 16.4} ${HEAD_CY + 10} ${CX + 17.6} ${HEAD_CY + 2} ${CX + 15.4} ${HEAD_CY - 9} C ${CX + 11} ${HEAD_CY - 15.6} ${CX - 11} ${HEAD_CY - 15.6} ${CX - 15.4} ${HEAD_CY - 9} Z`);
  }
}

function HairFront({ style: hairStyle, color }: { style: string; color: string }) {
  const root = warmShade(color, -16, 0.24);
  const fill = 'url(#hair-front)';
  const sheen = withAlpha(warmLight(color, 34, 0.3), 0.5);
  const cap = (d: string) => <Path d={d} fill={fill} />;
  const crown = `M ${CX - 15.2} ${HEAD_CY - 6} C ${CX - 14} ${HEAD_CY - 18} ${CX + 14} ${HEAD_CY - 18} ${CX + 15.2} ${HEAD_CY - 6} Z`;

  switch (hairStyle) {
    case 'braids':
      return (
        <>
          {cap(`M ${CX - 14.8} ${HEAD_CY - 7.4} C ${CX - 15.4} ${HEAD_CY - 17} ${CX + 15.4} ${HEAD_CY - 17} ${CX + 14.8} ${HEAD_CY - 7.4} C ${CX + 9} ${HEAD_CY - 10.6} ${CX + 5} ${HEAD_CY - 6.2} ${CX + 1.4} ${HEAD_CY - 10} C ${CX - 3} ${HEAD_CY - 6.4} ${CX - 9} ${HEAD_CY - 10.4} ${CX - 14.8} ${HEAD_CY - 7.4} Z`)}
          {[0, 1, 2, 3].map((step) => (
            <Circle
              key={step}
              cx={CX - 13.6 - step * 0.4}
              cy={HEAD_CY + 14 + step * 6.2}
              r={4.3 - step * 0.45}
              fill={step % 2 ? root : color}
            />
          ))}
          {[0, 1, 2, 3].map((step) => (
            <Circle
              key={`r${step}`}
              cx={CX + 13.6 + step * 0.4}
              cy={HEAD_CY + 14 + step * 6.2}
              r={4.3 - step * 0.45}
              fill={step % 2 ? root : color}
            />
          ))}
          <Rect x={CX - 17} y={HEAD_CY + 3} width={34} height={2} rx={1} fill={sheen} />
        </>
      );
    case 'curls':
      return (
        <>
          {cap(crown)}
          {[
            [-15, -3.4, 5.4],
            [15, -2, 5.4],
            [-12, -11.8, 5.5],
            [-4, -15.4, 5.8],
            [5, -15.4, 5.6],
            [13, -12, 5],
            [-15.4, 6, 4.8],
            [15.4, 6, 4.8],
          ].map(([dx, dy, r], index) => (
            <Circle
              key={index}
              cx={CX + dx}
              cy={HEAD_CY + dy}
              r={r}
              fill={index % 3 === 1 ? root : index % 3 === 2 ? warmLight(color, 12, 0.2) : color}
            />
          ))}
          <Path d={`M ${CX - 10} ${HEAD_CY - 12} C ${CX - 4} ${HEAD_CY - 15} ${CX + 4} ${HEAD_CY - 15} ${CX + 10} ${HEAD_CY - 12}`} stroke={sheen} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      );
    case 'bun':
      return (
        <>
          {cap(crown)}
          <Circle cx={CX + 1.5} cy={HEAD_CY - 17.4} r={7.6} fill={root} />
          <Circle cx={CX + 1} cy={HEAD_CY - 17.8} r={6.4} fill={color} />
          <Path
            d={`M ${CX - 3} ${HEAD_CY - 19.4} C ${CX + 1} ${HEAD_CY - 22.6} ${CX + 5} ${HEAD_CY - 20.6} ${CX + 5.4} ${HEAD_CY - 16.4}`}
            stroke={withAlpha(warmLight(color, 30, 0.3), 0.7)}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <Path d={`M ${CX - 14} ${HEAD_CY - 10} C ${CX - 8} ${HEAD_CY - 13.6} ${CX + 8} ${HEAD_CY - 13.6} ${CX + 14} ${HEAD_CY - 10}`} stroke={sheen} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        </>
      );
    case 'ponytail':
      return (
        <>
          {cap(`M ${CX - 15} ${HEAD_CY - 7} C ${CX - 15.6} ${HEAD_CY - 17} ${CX + 15.6} ${HEAD_CY - 17} ${CX + 15} ${HEAD_CY - 7.4} C ${CX + 8} ${HEAD_CY - 12} ${CX + 2} ${HEAD_CY - 7.4} ${CX - 3} ${HEAD_CY - 11} C ${CX - 8} ${HEAD_CY - 7.2} ${CX - 12} ${HEAD_CY - 10} ${CX - 15} ${HEAD_CY - 7} Z`)}
          <Path d={`M ${CX - 13} ${HEAD_CY - 9} C ${CX - 6} ${HEAD_CY - 13.4} ${CX + 6} ${HEAD_CY - 13.4} ${CX + 13} ${HEAD_CY - 9}`} stroke={sheen} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <Path d={`M ${CX + 13.6} ${HEAD_CY - 4} C ${CX + 15.6} ${HEAD_CY + 1} ${CX + 17} ${HEAD_CY + 6} ${CX + 16} ${HEAD_CY + 9}`} stroke={withAlpha(root, 0.8)} strokeWidth={1.4} fill="none" />
        </>
      );
    case 'undercut':
      return (
        <>
          <Path d={`M ${CX - 15.6} ${HEAD_CY + 1.4} C ${CX - 16.2} ${HEAD_CY - 6} ${CX - 14} ${HEAD_CY - 12} ${CX - 9} ${HEAD_CY - 15} C ${CX - 12} ${HEAD_CY - 8} ${CX - 13.4} ${HEAD_CY - 2} ${CX - 13} ${HEAD_CY + 3} Z`} fill={warmShade(color, -44, 0.26)} />
          <Path d={`M ${CX + 15.6} ${HEAD_CY + 1.4} C ${CX + 16.2} ${HEAD_CY - 6} ${CX + 14} ${HEAD_CY - 12} ${CX + 9} ${HEAD_CY - 15} C ${CX + 12} ${HEAD_CY - 8} ${CX + 13.4} ${HEAD_CY - 2} ${CX + 13} ${HEAD_CY + 3} Z`} fill={warmShade(color, -44, 0.26)} />
          {cap(`M ${CX - 15} ${HEAD_CY - 7} C ${CX - 15.8} ${HEAD_CY - 18} ${CX + 15.2} ${HEAD_CY - 18.6} ${CX + 15.4} ${HEAD_CY - 7.4} C ${CX + 13} ${HEAD_CY - 7} ${CX + 8} ${HEAD_CY - 6} ${CX + 5.6} ${HEAD_CY - 14.4} C ${CX + 1} ${HEAD_CY - 8} ${CX - 7} ${HEAD_CY - 10} ${CX - 15} ${HEAD_CY - 7} Z`)}
          <Path d={`M ${CX - 8} ${HEAD_CY - 12} C ${CX - 1} ${HEAD_CY - 16} ${CX + 6} ${HEAD_CY - 15} ${CX + 11} ${HEAD_CY - 10}`} stroke={sheen} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </>
      );
    case 'swept':
      return (
        <>
          {cap(`M ${CX - 15.2} ${HEAD_CY - 7} C ${CX - 16} ${HEAD_CY - 18} ${CX + 15.6} ${HEAD_CY - 18} ${CX + 15.2} ${HEAD_CY - 6.6} C ${CX + 11} ${HEAD_CY - 11} ${CX + 3} ${HEAD_CY - 12.6} ${CX - 4} ${HEAD_CY - 9} C ${CX - 9} ${HEAD_CY - 6.8} ${CX - 13} ${HEAD_CY - 8} ${CX - 15.2} ${HEAD_CY - 7} Z`)}
          <Path d={`M ${CX - 2} ${HEAD_CY - 14.6} C ${CX + 6} ${HEAD_CY - 15.4} ${CX + 12} ${HEAD_CY - 11.6} ${CX + 14.4} ${HEAD_CY - 4.6}`} stroke={sheen} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <Path d={`M ${CX + 15.4} ${HEAD_CY - 4} C ${CX + 17.4} ${HEAD_CY + 1} ${CX + 17} ${HEAD_CY + 6} ${CX + 15} ${HEAD_CY + 9}`} stroke={withAlpha(root, 0.85)} strokeWidth={1.5} fill="none" />
        </>
      );
    case 'bob':
    default:
      return (
        <>
          {cap(`M ${CX - 15} ${HEAD_CY - 6.6} C ${CX - 15.6} ${HEAD_CY - 18} ${CX + 15.6} ${HEAD_CY - 18} ${CX + 15} ${HEAD_CY - 6.6} C ${CX + 6} ${HEAD_CY - 10} ${CX + 1.6} ${HEAD_CY - 8.6} ${CX - 1.2} ${HEAD_CY - 7} C ${CX - 6} ${HEAD_CY - 5.6} ${CX - 11} ${HEAD_CY - 8} ${CX - 15} ${HEAD_CY - 6.6} Z`)}
          <Path d={`M ${CX + 0.6} ${HEAD_CY - 16.4} C ${CX + 0.2} ${HEAD_CY - 12} ${CX + 0.2} ${HEAD_CY - 8} ${CX + 0.4} ${HEAD_CY - 5}`} stroke={withAlpha(warmShade(color, -50, 0.3), 0.7)} strokeWidth={1} fill="none" />
          <Path d={`M ${CX - 12} ${HEAD_CY - 11} C ${CX - 5} ${HEAD_CY - 15.6} ${CX + 4} ${HEAD_CY - 16} ${CX + 11} ${HEAD_CY - 12}`} stroke={sheen} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        </>
      );
  }
}

/* ------------------------------------------------------------------ *
 * Accessories
 * ------------------------------------------------------------------ */

function Accessory({ kind, accent, skin }: { kind: string; accent: string; skin: string }) {
  const leather = warmShade(accent, -48, 0.4);
  const brass = world.brass;
  const brassDeep = world.brassDark;

  switch (kind) {
    case 'headphones':
      return (
        <>
          <Path
            d={`M ${CX - 15.6} ${HEAD_CY + 2} C ${CX - 16.6} ${HEAD_CY - 16} ${CX + 16.6} ${HEAD_CY - 16} ${CX + 15.6} ${HEAD_CY + 2}`}
            stroke={brassDeep}
            strokeWidth={2.6}
            fill="none"
            strokeLinecap="round"
          />
          {[-1, 1].map((side) => (
            <G key={side}>
              <Rect x={CX + side * 16.4 - 4} y={HEAD_CY - 1.6} width={8} height={10.4} rx={3.4} fill={leather} />
              <Rect x={CX + side * 16.4 - 2.4} y={HEAD_CY + 0.2} width={4.8} height={6.6} rx={2.4} fill={warmShade(accent, -18, 0.3)} />
            </G>
          ))}
        </>
      );
    case 'stethoscope':
      return (
        <>
          <Path
            d={`M ${CX - 7.6} ${NECK_Y - 1} C ${CX - 8.6} ${NECK_Y + 9} ${CX + 8.6} ${NECK_Y + 9} ${CX + 7.6} ${NECK_Y - 1}`}
            stroke={warmShade(accent, -24, 0.3)}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
          <Path d={`M ${CX + 7.4} ${NECK_Y + 4} C ${CX + 7} ${NECK_Y + 12} ${CX + 5.4} ${NECK_Y + 16} ${CX + 4} ${NECK_Y + 19}`} stroke={warmShade(accent, -30, 0.3)} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Circle cx={CX + 3.4} cy={NECK_Y + 21.4} r={3} fill={brass} stroke={brassDeep} strokeWidth={0.8} />
        </>
      );
    case 'apron':
      return (
        <>
          <Path d={`M ${CX - 9} ${NECK_Y + 2} L ${CX + 9} ${NECK_Y + 2}`} stroke={leather} strokeWidth={1.7} />
          <Path
            d={`M ${CX - 7.4} ${NECK_Y + 2.6} L ${CX + 7.4} ${NECK_Y + 2.6} L ${CX + 8.4} ${NECK_Y + 26} L ${CX - 8.4} ${NECK_Y + 26} Z`}
            fill={world.linen}
            stroke={warmShade(world.linen, -34, 0.2)}
            strokeWidth={0.8}
          />
          <Path d={`M ${CX - 6.6} ${NECK_Y + 18} L ${CX + 6.6} ${NECK_Y + 18} L ${CX + 6.6} ${NECK_Y + 24} L ${CX - 6.6} ${NECK_Y + 24} Z`} fill={warmShade(world.linen, -16, 0.18)} />
          <Path d={`M ${CX - 11} ${NECK_Y + 8} C ${CX - 9} ${NECK_Y + 6.6} ${CX - 8} ${NECK_Y + 6.6} ${CX - 7.4} ${NECK_Y + 7.6}`} stroke={leather} strokeWidth={1.4} fill="none" />
          <Path d={`M ${CX + 11} ${NECK_Y + 8} C ${CX + 9} ${NECK_Y + 6.6} ${CX + 8} ${NECK_Y + 6.6} ${CX + 7.4} ${NECK_Y + 7.6}`} stroke={leather} strokeWidth={1.4} fill="none" />
        </>
      );
    case 'visor':
      return (
        <>
          <Rect x={CX - 14.2} y={EYE_Y - 2.6} width={28.4} height={3.2} rx={1.6} fill={leather} />
          <Path
            d={`M ${CX - 14.4} ${EYE_Y - 0.4} C ${CX - 15} ${EYE_Y + 4.4} ${CX + 15} ${EYE_Y + 4.4} ${CX + 14.4} ${EYE_Y - 0.4} Z`}
            fill={withAlpha(world.glow, 0.5)}
            stroke={brassDeep}
            strokeWidth={0.8}
          />
          <Path d={`M ${CX - 11} ${EYE_Y + 1.6} C ${CX - 6} ${EYE_Y + 2.6} ${CX - 2} ${EYE_Y + 2.6} ${CX + 1} ${EYE_Y + 2.2}`} stroke={withAlpha(world.rim, 0.55)} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        </>
      );
    case 'scarf':
      return (
        <>
          <Path
            d={`M ${CX - 10} ${NECK_Y - 1} C ${CX - 11} ${NECK_Y + 6} ${CX + 11} ${NECK_Y + 6} ${CX + 10} ${NECK_Y - 1} C ${CX + 5} ${NECK_Y + 2} ${CX - 5} ${NECK_Y + 2} ${CX - 10} ${NECK_Y - 1} Z`}
            fill={accent}
          />
          <Path d={`M ${CX - 9} ${NECK_Y + 1.6} C ${CX - 4} ${NECK_Y + 4} ${CX + 4} ${NECK_Y + 4} ${CX + 9} ${NECK_Y + 1.6}`} stroke={withAlpha(warmShade(accent, -30, 0.3), 0.8)} strokeWidth={0.9} fill="none" />
          <Path d={`M ${CX + 4.4} ${NECK_Y + 3} C ${CX + 6.4} ${NECK_Y + 11} ${CX + 5.6} ${NECK_Y + 18} ${CX + 3.4} ${NECK_Y + 22}`} stroke={accent} strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d={`M ${CX + 4.4} ${NECK_Y + 3} C ${CX + 6.4} ${NECK_Y + 11} ${CX + 5.6} ${NECK_Y + 18} ${CX + 3.4} ${NECK_Y + 22}`} stroke={withAlpha(warmShade(accent, -34, 0.3), 0.55)} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        </>
      );
    case 'satchel':
      return (
        <>
          <Path d={`M ${CX - 9} ${SHOULDER_Y + 1} L ${CX + 10} ${SHOULDER_Y + 20}`} stroke={leather} strokeWidth={2.6} strokeLinecap="round" />
          <Rect x={CX + 5.6} y={SHOULDER_Y + 16} width={15.4} height={12.6} rx={2.4} fill={warmShade(accent, -28, 0.34)} stroke={leather} strokeWidth={0.9} />
          <Path d={`M ${CX + 5.6} ${SHOULDER_Y + 16} L ${CX + 21} ${SHOULDER_Y + 16} L ${CX + 21} ${SHOULDER_Y + 21.4} L ${CX + 5.6} ${SHOULDER_Y + 21.4} Z`} fill={warmShade(accent, -12, 0.3)} />
          <Rect x={CX + 12.4} y={SHOULDER_Y + 22.6} width={3} height={2.6} rx={0.6} fill={brass} />
        </>
      );
    case 'none':
    default:
      void skin;
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Garments
 * ------------------------------------------------------------------ */

function GarmentBody({
  cut,
  top,
  accent,
  shoulderHalf,
  waistHalf,
  hipY,
}: {
  cut: GarmentCut;
  top: string;
  accent: string;
  shoulderHalf: number;
  waistHalf: number;
  hipY: number;
}) {
  const fold = warmShade(top, -38, 0.32);
  const deep = warmShade(top, -56, 0.36);
  const lit = warmLight(top, 22, 0.26);
  const hem = cut === 'coat' ? 4 : 0;
  const trim = withAlpha(deep, 0.5);

  return (
    <>
      <Path d={torsoPath(shoulderHalf, waistHalf, hipY, hem)} fill="url(#cloth)" stroke={fold} strokeWidth={0.9} />

      {/* Shoulder seams and the fold under the arm, on every cut. */}
      <Path d={`M ${CX - shoulderHalf + 1.4} ${SHOULDER_Y + 1.6} C ${CX - shoulderHalf + 4} ${SHOULDER_Y + 5} ${CX - shoulderHalf + 5} ${SHOULDER_Y + 8} ${CX - shoulderHalf + 5} ${SHOULDER_Y + 10.6}`} stroke={trim} strokeWidth={0.8} fill="none" />
      <Path d={`M ${CX + shoulderHalf - 1.4} ${SHOULDER_Y + 1.6} C ${CX + shoulderHalf - 4} ${SHOULDER_Y + 5} ${CX + shoulderHalf - 5} ${SHOULDER_Y + 8} ${CX + shoulderHalf - 5} ${SHOULDER_Y + 10.6}`} stroke={withAlpha(warmLight(top, 30, 0.3), 0.45)} strokeWidth={0.8} fill="none" />

      {cut === 'shirt' ? (
        <>
          <Path d={`M ${CX - 4.6} ${SHOULDER_Y + 0.6} L ${CX - 0.6} ${SHOULDER_Y + 6.4} L ${CX - 4.2} ${SHOULDER_Y + 7.6} L ${CX - 7.6} ${SHOULDER_Y + 1.8} Z`} fill={lit} stroke={fold} strokeWidth={0.7} />
          <Path d={`M ${CX + 4.6} ${SHOULDER_Y + 0.6} L ${CX + 0.6} ${SHOULDER_Y + 6.4} L ${CX + 4.2} ${SHOULDER_Y + 7.6} L ${CX + 7.6} ${SHOULDER_Y + 1.8} Z`} fill={lit} stroke={fold} strokeWidth={0.7} />
          <Path d={`M ${CX + 0.4} ${SHOULDER_Y + 6} L ${CX + 0.4} ${hipY}`} stroke={trim} strokeWidth={0.9} />
          {[0, 1, 2].map((step) => (
            <Circle key={step} cx={CX + 0.4} cy={SHOULDER_Y + 13 + step * 8} r={0.8} fill={world.linen} opacity={0.8} />
          ))}
          <Path d={`M ${CX - shoulderHalf + 1} ${hipY - 1.4} L ${CX + shoulderHalf - 1} ${hipY - 1.4}`} stroke={trim} strokeWidth={1.2} />
        </>
      ) : null}

      {cut === 'jacket' ? (
        <>
          <Path d={`M ${CX - 0.6} ${SHOULDER_Y} L ${CX - 0.6} ${hipY - 1}`} stroke={withAlpha(lit, 0.9)} strokeWidth={3} />
          <Path d={`M ${CX - 6.4} ${SHOULDER_Y + 0.4} L ${CX - 1} ${SHOULDER_Y + 8.4} L ${CX - 6.8} ${SHOULDER_Y + 9.6} L ${CX - 9.6} ${SHOULDER_Y + 1.6} Z`} fill={warmShade(top, -6)} stroke={deep} strokeWidth={0.7} />
          <Path d={`M ${CX + 6.4} ${SHOULDER_Y + 0.4} L ${CX + 1} ${SHOULDER_Y + 8.4} L ${CX + 6.8} ${SHOULDER_Y + 9.6} L ${CX + 9.6} ${SHOULDER_Y + 1.6} Z`} fill={warmShade(top, -6)} stroke={deep} strokeWidth={0.7} />
          <Rect x={CX - shoulderHalf + 3} y={hipY - 8} width={7.4} height={5.4} rx={1} fill={withAlpha(deep, 0.35)} stroke={trim} strokeWidth={0.6} />
          <Rect x={CX + shoulderHalf - 10.4} y={hipY - 8} width={7.4} height={5.4} rx={1} fill={withAlpha(deep, 0.35)} stroke={trim} strokeWidth={0.6} />
        </>
      ) : null}

      {cut === 'hoodie' ? (
        <>
          <Path
            d={`M ${CX - 10.4} ${SHOULDER_Y + 1.4} C ${CX - 12.6} ${SHOULDER_Y - 6} ${CX + 12.6} ${SHOULDER_Y - 6} ${CX + 10.4} ${SHOULDER_Y + 1.4} C ${CX + 6} ${SHOULDER_Y - 2.6} ${CX - 6} ${SHOULDER_Y - 2.6} ${CX - 10.4} ${SHOULDER_Y + 1.4} Z`}
            fill={warmShade(top, -12, 0.26)}
            stroke={fold}
            strokeWidth={0.8}
          />
          <Path d={`M ${CX - 10} ${SHOULDER_Y + 1} C ${CX - 6} ${SHOULDER_Y - 2} ${CX + 6} ${SHOULDER_Y - 2} ${CX + 10} ${SHOULDER_Y + 1}`} stroke={withAlpha(warmLight(top, 26, 0.3), 0.4)} strokeWidth={1} fill="none" />
          <Path d={`M ${CX - 2.4} ${SHOULDER_Y + 6} L ${CX - 2.6} ${SHOULDER_Y + 13}`} stroke={lit} strokeWidth={1.3} strokeLinecap="round" />
          <Path d={`M ${CX + 2.4} ${SHOULDER_Y + 6} L ${CX + 2.6} ${SHOULDER_Y + 13}`} stroke={lit} strokeWidth={1.3} strokeLinecap="round" />
          <Path
            d={`M ${CX - 8.6} ${hipY - 6} L ${CX + 8.6} ${hipY - 6} L ${CX + 7.4} ${hipY + 0.6} L ${CX - 7.4} ${hipY + 0.6} Z`}
            fill={withAlpha(deep, 0.34)}
            stroke={trim}
            strokeWidth={0.7}
          />
        </>
      ) : null}

      {cut === 'coat' ? (
        <>
          <Path d={`M ${CX - 0.6} ${SHOULDER_Y} L ${CX - 0.6} ${hipY + 3}`} stroke={withAlpha(lit, 0.85)} strokeWidth={2.6} />
          <Path d={`M ${CX - 7.6} ${SHOULDER_Y + 0.2} L ${CX - 0.8} ${SHOULDER_Y + 14} L ${CX - 8.4} ${SHOULDER_Y + 15.6} L ${CX - 11.4} ${SHOULDER_Y + 1.4} Z`} fill={warmShade(top, -8)} stroke={deep} strokeWidth={0.7} />
          <Path d={`M ${CX + 7.6} ${SHOULDER_Y + 0.2} L ${CX + 0.8} ${SHOULDER_Y + 14} L ${CX + 8.4} ${SHOULDER_Y + 15.6} L ${CX + 11.4} ${SHOULDER_Y + 1.4} Z`} fill={warmShade(top, -8)} stroke={deep} strokeWidth={0.7} />
          <Rect x={CX - waistHalf - 2.4} y={hipY - 12} width={(waistHalf + 2.4) * 2} height={4.4} fill={fold} />
          <Rect x={CX - 2.2} y={hipY - 13.4} width={4.4} height={7} rx={1} fill={world.brass} stroke={world.brassDark} strokeWidth={0.6} />
          {[0, 1, 2].map((step) => (
            <Circle key={step} cx={CX + 5.2} cy={SHOULDER_Y + 20 + step * 7} r={1.1} fill={world.brass} stroke={world.brassDark} strokeWidth={0.4} />
          ))}
        </>
      ) : null}

      {cut === 'tunic' ? (
        <>
          <Path d={`M ${CX - 9.6} ${SHOULDER_Y + 0.8} C ${CX - 3} ${SHOULDER_Y + 8} ${CX + 3} ${SHOULDER_Y + 12} ${CX + 9.4} ${SHOULDER_Y + 17}`} stroke={withAlpha(warmShade(top, -22, 0.28), 0.9)} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d={`M ${CX + 9.6} ${SHOULDER_Y + 0.8} C ${CX + 3} ${SHOULDER_Y + 8} ${CX - 3} ${SHOULDER_Y + 12} ${CX - 9.4} ${SHOULDER_Y + 17}`} stroke={withAlpha(lit, 0.9)} strokeWidth={5} fill="none" strokeLinecap="round" />
          <Path d={`M ${CX - waistHalf - 2.4} ${hipY - 9.4} L ${CX + waistHalf + 2.4} ${hipY - 9.4} L ${CX + waistHalf + 2} ${hipY - 5.6} L ${CX - waistHalf - 2} ${hipY - 5.6} Z`} fill={accent} />
          <Path d={`M ${CX + waistHalf + 4.4} ${hipY - 8.4} L ${CX + waistHalf + 8} ${hipY - 3} L ${CX + waistHalf + 5.6} ${hipY - 1.6} Z`} fill={warmShade(accent, -18, 0.3)} />
        </>
      ) : null}

      {cut === 'wrap' ? (
        <>
          <Path d={`M ${CX - 9.8} ${SHOULDER_Y + 0.6} L ${CX + 6.4} ${hipY + 1} L ${CX + 9.8} ${hipY + 1} L ${CX - 6} ${SHOULDER_Y + 0.4} Z`} fill={warmShade(top, -16, 0.26)} stroke={deep} strokeWidth={0.6} />
          <Path d={`M ${CX + 9.8} ${SHOULDER_Y + 0.6} L ${CX - 6.4} ${hipY + 1} L ${CX - 9.8} ${hipY + 1} L ${CX + 6} ${SHOULDER_Y + 0.4} Z`} fill={lit} stroke={fold} strokeWidth={0.6} />
          <Path d={`M ${CX - waistHalf - 3} ${hipY - 10} L ${CX + waistHalf + 3} ${hipY - 10} L ${CX + waistHalf + 2} ${hipY - 4.6} L ${CX - waistHalf - 2} ${hipY - 4.6} Z`} fill={accent} />
          <Path d={`M ${CX - shoulderHalf + 0.6} ${hipY - 0.4} L ${CX + shoulderHalf - 0.6} ${hipY - 0.4}`} stroke={trim} strokeWidth={1.2} />
        </>
      ) : null}

      {/* The lit edge down the right of every torso, and the shadow on the left. */}
      <Path
        d={`M ${CX + shoulderHalf - 0.8} ${SHOULDER_Y + 1} C ${CX + shoulderHalf + 1} ${SHOULDER_Y + 6} ${CX + waistHalf + 2.6} ${hipY - 8} ${CX + waistHalf + 2.2} ${hipY + hem - 1}`}
        stroke={withAlpha(world.rim, 0.34)}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d={`M ${CX - shoulderHalf + 0.6} ${SHOULDER_Y + 1} C ${CX - shoulderHalf - 0.6} ${SHOULDER_Y + 6} ${CX - waistHalf - 1.6} ${hipY - 8} ${CX - waistHalf - 1.4} ${hipY + hem - 1}`}
        stroke={withAlpha(deep, 0.5)}
        strokeWidth={1.6}
        fill="none"
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Figure
 * ------------------------------------------------------------------ */

interface FigureProps {
  resident: Resident;
  /** Ambient light from the scene, 0 at night, 1 at noon. */
  light?: number;
  /** The stage draws the eyes in their own layer so they can blink. */
  withEyes?: boolean;
  width?: number;
  height?: number;
  /** Draw only the head and shoulders, for a portrait. */
  bust?: boolean;
}

export function Figure({
  resident,
  light = 0.85,
  withEyes = true,
  width,
  height,
  bust = false,
}: FigureProps) {
  const look: Look = resident.look ?? FALLBACK_LOOK;
  const outfit = look.outfit ?? FALLBACK_LOOK.outfit;
  const mood = MOOD_SHAPES[resident.mood] ?? MOOD_SHAPES.neutral;
  const cut = garmentOf(resident);
  const shape = SILHOUETTE_SHAPE[silhouetteOf(resident)];
  const seed = hashString(resident.id);
  const stance = (seed % 5) - 2;

  const id = useMemo(() => {
    const prefix = `fig-${resident.id.replace(/[^a-zA-Z0-9]/g, '')}-${bust ? 'b' : 'f'}`;
    return (part: string) => `${prefix}-${part}`;
  }, [resident.id, bust]);

  const skin = look.skin;
  const skinShade = warmShade(skin, -30, 0.34);
  const skinDeep = warmShade(skin, -50, 0.4);
  const skinLight = warmLight(skin, 18, 0.4);
  const hair = look.hair;
  const hairDeep = warmShade(hair, -34, 0.3);
  const hairLit = warmLight(hair, 26, 0.3);
  const clothFold = warmShade(outfit.top, -46, 0.34);
  const trouser = outfit.bottom;
  const trouserDeep = warmShade(trouser, -40, 0.34);
  const trouserLit = warmLight(trouser, 14, 0.26);
  const shoe = warmShade(trouser, -58, 0.42);

  const shoulderHalf = shape.shoulder * 1.12 + mood.shoulder * 0.6;
  const waistHalf = shape.waist + 0.6;
  const hipY = SHOULDER_Y + shape.torsoHeight;
  const legWidth = shape.legWidth - 1;
  const legGap = legWidth * 0.34;
  const cuffY = hipY - WRIST_LIFT;
  const swing = stance * 0.8;
  const lightEdge = 0.16 + Math.max(0, Math.min(1, light)) * 0.22;

  return (
    <Svg
      viewBox={
        bust
          ? `${FIGURE_BUST.x} ${FIGURE_BUST.y} ${FIGURE_BUST.w} ${FIGURE_BUST.h}`
          : `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`
      }
      width={width ?? VIEW_WIDTH}
      height={height ?? VIEW_HEIGHT}
      style={styles.overlay}
    >
      <Defs>
        <LinearGradient id={id('bust')} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={mix(world.plaster, world.walnut, 0.42)} />
          <Stop offset="0.55" stopColor={mix(world.walnut, world.shadow, 0.3)} />
          <Stop offset="1" stopColor={mix(world.walnut, world.shadow, 0.62)} />
        </LinearGradient>
        <LinearGradient id={id('skin')} x1="0.1" y1="0.1" x2="1" y2="0.8">
          <Stop offset="0" stopColor={skinShade} />
          <Stop offset="0.42" stopColor={skin} />
          <Stop offset="1" stopColor={skinLight} />
        </LinearGradient>
        <LinearGradient id={id('hair-front')} x1="0.2" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={hairLit} />
          <Stop offset="0.5" stopColor={hair} />
          <Stop offset="1" stopColor={hairDeep} />
        </LinearGradient>
        <LinearGradient id={id('hair-back')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={warmShade(hair, -10, 0.26)} />
          <Stop offset="1" stopColor={hairDeep} />
        </LinearGradient>
        <LinearGradient id={id('cloth')} x1="0.05" y1="0" x2="0.95" y2="1">
          <Stop offset="0" stopColor={clothFold} />
          <Stop offset="0.46" stopColor={outfit.top} />
          <Stop offset="1" stopColor={warmLight(outfit.top, 16, 0.24)} />
        </LinearGradient>
        <LinearGradient id={id('leg')} x1="0" y1="0" x2="1" y2="0.4">
          <Stop offset="0" stopColor={trouserDeep} />
          <Stop offset="0.55" stopColor={trouser} />
          <Stop offset="1" stopColor={trouserLit} />
        </LinearGradient>
        <LinearGradient id={id('iris')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={warmLight(look.eyes, 24, 0.24)} />
          <Stop offset="0.6" stopColor={look.eyes} />
          <Stop offset="1" stopColor={warmShade(look.eyes, -20, 0.3)} />
        </LinearGradient>
        <LinearGradient id={id('lid')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={skinShade} />
          <Stop offset="1" stopColor={withAlpha(skinShade, 0.1)} />
        </LinearGradient>
        <RadialGradient id={id('blush')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(mix(skin, world.terracotta, 0.45), 0.55)} />
          <Stop offset="1" stopColor={withAlpha(mix(skin, world.terracotta, 0.45), 0)} />
        </RadialGradient>
        <RadialGradient id={id('jaw')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(skinDeep, 0.5)} />
          <Stop offset="1" stopColor={withAlpha(skinDeep, 0)} />
        </RadialGradient>
        <RadialGradient id={id('ground')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.shadow, 0.42)} />
          <Stop offset="0.62" stopColor={withAlpha(world.shadow, 0.2)} />
          <Stop offset="1" stopColor={withAlpha(world.shadow, 0)} />
        </RadialGradient>
        <RadialGradient id={id('rim')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.rim, lightEdge)} />
          <Stop offset="1" stopColor={withAlpha(world.rim, 0)} />
        </RadialGradient>
      </Defs>

      {/* A portrait is a window on the same drawing: it gets its own light. */}
      {bust ? (
        <>
          <Rect x={FIGURE_BUST.x} y={FIGURE_BUST.y} width={FIGURE_BUST.w} height={FIGURE_BUST.h} fill={`url(#${id('bust')})`} />
          <Ellipse cx={CX + 6} cy={28} rx={30} ry={22} fill={`url(#${id('rim')})`} opacity={0.7} />
          <Ellipse cx={CX - 20} cy={FIGURE_BUST.y + FIGURE_BUST.h} rx={40} ry={16} fill={withAlpha(world.shadow, 0.3)} />
        </>
      ) : null}

      {/* Shadow on the boards: warm, soft, and cast away from the key light. */}
      <Ellipse cx={CX} cy={GROUND + 0.6} rx={21} ry={5.2} fill={`url(#${id('ground')})`} />
      <Ellipse cx={CX - 2.4} cy={GROUND + 0.4} rx={10.4} ry={2.4} fill={withAlpha(world.shadow, 0.3)} />

      {/* The whole figure leans a little, so two residents never line up. */}
      <G transform={`rotate(${stance * 0.4} ${CX} ${GROUND})`}>
        <HairBack style={look.hairstyle} color={hair} />

        {/* Legs and shoes */}
        {[-1, 1].map((side) => {
          const xc = CX + side * (legWidth / 2 + legGap);
          return (
            <G key={side}>
              <Path d={legPath(xc, hipY - 3, legWidth)} fill={`url(#${id('leg')})`} stroke={trouserDeep} strokeWidth={0.8} />
              <Path d={`M ${xc - legWidth / 2 + 0.8} ${hipY + 4} C ${xc - legWidth / 2 + 1.6} ${hipY + 16} ${xc - legWidth / 2 + 1.4} ${ANKLE_Y - 14} ${xc - legWidth / 2 + 1.8} ${ANKLE_Y - 2}`} stroke={withAlpha(warmLight(trouser, 22, 0.3), 0.3)} strokeWidth={1.4} fill="none" />
              <Path d={`M ${xc - 1.6} ${hipY + 12} C ${xc - 1.2} ${hipY + 18} ${xc - 1.2} ${ANKLE_Y - 18} ${xc - 1.6} ${ANKLE_Y - 8}`} stroke={withAlpha(trouserDeep, 0.5)} strokeWidth={0.9} fill="none" />
              <Path d={shoePath(xc, legWidth + 2.4, side === 1 ? 1 : -1)} fill={shoe} />
              <Path d={shoePath(xc, legWidth + 2.4, side === 1 ? 1 : -1)} stroke={withAlpha(world.shadow, 0.5)} strokeWidth={0.7} fill="none" />
              <Path d={`M ${xc - legWidth / 2 - 0.8} ${ANKLE_Y + 5.6} L ${xc + legWidth / 2 + 0.8 + side * 2.2} ${ANKLE_Y + 5.6}`} stroke={withAlpha('#3A1C0C', 0.75)} strokeWidth={1.5} />
              <Path d={`M ${xc + side * 2.4} ${ANKLE_Y + 0.6} C ${xc + side * 4.6} ${ANKLE_Y + 2.4} ${xc + side * 5} ${ANKLE_Y + 4.4} ${xc + side * 4} ${ANKLE_Y + 5.2}`} stroke={withAlpha(warmLight(shoe, 26, 0.3), 0.4)} strokeWidth={1.2} fill="none" />
            </G>
          );
        })}

        {/* Torso */}
        <GarmentBody cut={cut} top={outfit.top} accent={outfit.accent} shoulderHalf={shoulderHalf} waistHalf={waistHalf} hipY={hipY} />

        {/* Sleeves and hands */}
        {[-1, 1].map((side) => {
          const sign = side === 1 ? 1 : -1;
          const width = shape.armWidth - 1;
          const bottom = cuffY + (sign < 0 ? swing : -swing * 0.4);
          return (
            <G key={side}>
              <Path
                d={armPath(sign as 1 | -1, shoulderHalf, bottom, width, 0)}
                fill={`url(#${id('cloth')})`}
                stroke={clothFold}
                strokeWidth={0.85}
              />
              <Path
                d={`M ${CX + sign * (shoulderHalf - width * 0.2)} ${SHOULDER_Y + 4} C ${CX + sign * (shoulderHalf - width * 0.1)} ${bottom - 14} ${CX + sign * (shoulderHalf - width * 0.4)} ${bottom - 6} ${CX + sign * (shoulderHalf - width * 0.4)} ${bottom - 0.8}`}
                stroke={withAlpha(warmLight(outfit.top, 26, 0.28), 0.4)}
                strokeWidth={1.3}
                fill="none"
              />
              <Path
                d={`M ${CX + sign * (shoulderHalf - width * 0.9)} ${bottom - 4.4} L ${CX + sign * (shoulderHalf + 1.2)} ${bottom - 4.4}`}
                stroke={clothFold}
                strokeWidth={1.4}
              />
              <Path
                d={`M ${CX + sign * (shoulderHalf - width * 0.3)} ${bottom + 0.2} C ${CX + sign * (shoulderHalf + 0.4)} ${bottom + 1.6} ${CX + sign * (shoulderHalf - 0.4)} ${bottom + 3.4} ${CX + sign * (shoulderHalf - 1)} ${bottom + 5.4}`}
                stroke={skin}
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={`M ${CX + sign * (shoulderHalf - width * 0.5)} ${bottom + 1.2} C ${CX + sign * (shoulderHalf - width * 0.4)} ${bottom + 4.4} ${CX + sign * (shoulderHalf - 0.2)} ${bottom + 6} ${CX + sign * (shoulderHalf - 0.6)} ${bottom + 7.4} C ${CX + sign * (shoulderHalf - 2.6)} ${bottom + 7.4} ${CX + sign * (shoulderHalf - 3.4)} ${bottom + 3.4} ${CX + sign * (shoulderHalf - width * 0.5)} ${bottom + 1.2} Z`}
                fill={skin}
                stroke={withAlpha(skinShade, 0.7)}
                strokeWidth={0.6}
              />
              <Path
                d={`M ${CX + sign * (shoulderHalf - 1.4)} ${bottom + 3} C ${CX + sign * (shoulderHalf - 1.2)} ${bottom + 5} ${CX + sign * (shoulderHalf - 1.6)} ${bottom + 6} ${CX + sign * (shoulderHalf - 2.4)} ${bottom + 6.4}`}
                stroke={withAlpha(skinShade, 0.6)}
                strokeWidth={0.6}
                fill="none"
              />
            </G>
          );
        })}

        {/* Neck */}
        <Path d={`M ${CX - 4.4} ${CHIN_Y - 6} L ${CX - 4.2} ${NECK_Y - 0.4} C ${CX - 2} ${NECK_Y + 1.6} ${CX + 2} ${NECK_Y + 1.6} ${CX + 4.2} ${NECK_Y - 0.4} L ${CX + 4.4} ${CHIN_Y - 6} Z`} fill={`url(#${id('skin')})`} stroke={withAlpha(skinShade, 0.8)} strokeWidth={0.7} />
        <Path d={`M ${CX - 4.4} ${CHIN_Y - 6} L ${CX + 4.4} ${CHIN_Y - 6}`} stroke={withAlpha(skinDeep, 0.35)} strokeWidth={1.2} />

        {/* Head */}
        <G transform={`rotate(${mood.headTilt} ${CX} ${CHIN_Y})`}>
          <Ellipse cx={CX + 12.6} cy={EYE_Y - 0.6} rx={3.1} ry={4.2} fill={`url(#${id('skin')})`} stroke={withAlpha(skinShade, 0.85)} strokeWidth={0.7} />
          <Path d={`M ${CX + 11.6} ${EYE_Y - 1.4} C ${CX + 12.4} ${EYE_Y - 0.6} ${CX + 12.6} ${EYE_Y + 1.4} ${CX + 11.8} ${EYE_Y + 2.2}`} stroke={withAlpha(skinShade, 0.7)} strokeWidth={0.6} fill="none" />
          <Ellipse cx={CX - 12.4} cy={EYE_Y + 0.4} rx={2.4} ry={3.4} fill={`url(#${id('skin')})`} stroke={withAlpha(skinShade, 0.7)} strokeWidth={0.6} />

          <Path d={skullPath(1, 1)} fill={`url(#${id('skin')})`} stroke={withAlpha(skinShade, 0.9)} strokeWidth={0.8} />

          {withEyes ? <EyeLayer look={look} mood={mood} id={id} /> : null}
          <FacePaths look={look} mood={mood} id={id} />

          <HairFront style={look.hairstyle} color={hair} />
          <Accessory kind={look.accessory} accent={outfit.accent} skin={skin} />

          {/* Rim light on the right of the face, from the key light. */}
          <Path
            d={`M ${CX + 11.6} ${HEAD_CY - 10.6} C ${CX + 13.4} ${HEAD_CY - 4} ${CX + 13.2} ${HEAD_CY + 4} ${CX + 10.6} ${HEAD_CY + 12}`}
            stroke={`url(#${id('rim')})`}
            strokeWidth={2.4}
            fill="none"
          />
        </G>

        {/* Rim light down the right arm and leg. */}
        <Path
          d={`M ${CX + shoulderHalf + 0.6} ${SHOULDER_Y + 2} C ${CX + shoulderHalf + 2} ${SHOULDER_Y + 12} ${CX + shoulderHalf + 1.4} ${cuffY - 10} ${CX + shoulderHalf + 0.4} ${cuffY - 2}`}
          stroke={`url(#${id('rim')})`}
          strokeWidth={2}
          fill="none"
        />
      </G>
    </Svg>
  );
}

/** The eyes on their own, so the stage can blink them without redrawing. */
export function FigureEyes({ resident, width, height }: { resident: Resident; width: number; height: number }) {
  const look: Look = resident.look ?? FALLBACK_LOOK;
  const mood = MOOD_SHAPES[resident.mood] ?? MOOD_SHAPES.neutral;
  const id = useMemo(() => {
    const prefix = `eye-${resident.id.replace(/[^a-zA-Z0-9]/g, '')}`;
    return (part: string) => `${prefix}-${part}`;
  }, [resident.id]);

  return (
    <Svg
      viewBox={`${FIGURE_EYE_REGION.x} ${FIGURE_EYE_REGION.y} ${FIGURE_EYE_REGION.width} ${FIGURE_EYE_REGION.height}`}
      width={width}
      height={height}
      style={styles.overlay}
    >
      <Defs>
        <LinearGradient id={id('iris')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={warmLight(look.eyes, 24, 0.24)} />
          <Stop offset="0.6" stopColor={look.eyes} />
          <Stop offset="1" stopColor={warmShade(look.eyes, -20, 0.3)} />
        </LinearGradient>
        <LinearGradient id={id('lid')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={warmShade(look.skin, -30, 0.34)} />
          <Stop offset="1" stopColor={withAlpha(warmShade(look.skin, -30, 0.34), 0.1)} />
        </LinearGradient>
      </Defs>
      <EyeLayer look={look} mood={mood} id={id} />
    </Svg>
  );
}

export function moodOf(resident: Resident): MoodShape {
  return MOOD_SHAPES[resident.mood] ?? MOOD_SHAPES.neutral;
}

/** The drawing never takes a tap: the resident is pressed as one target. */
const styles = StyleSheet.create({ overlay: { pointerEvents: 'none' } });
