/**
 * Figure: one resident, drawn as an illustration.
 *
 * The cast is built from the measurements in figure/skeleton.ts and the curves
 * in game/shape.ts. Nothing here is a rounded rectangle: limbs are spines that
 * taper, hair is a mass with locks, cloth folds under its own weight, and every
 * part carries a warm contour so the figure reads as a drawing and not as a
 * stack of coloured blocks.
 *
 * Three rules hold the cast together:
 * - one key light, high on the right, so every form is lit on the same side;
 * - a shadow turns brown (warmShade) and a highlight turns cream (warmLight);
 * - the mood changes the body as much as the face: shoulders, spine and head.
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
import { garmentOf, mix, warmLight, warmShade, withAlpha, type Garment as GarmentCut } from '../game/art';
import { limbOutline, smoothClosed, smoothOpen, type Node } from '../game/shape';
import type { Look, Resident } from '../game/types';
import {
  BUST_REGION,
  CX,
  EYE_REGION,
  GROUND,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  buildOf,
  moodOf,
  type Build,
} from './figure/skeleton';

export { EYE_REGION, BUST_REGION, moodOf, buildOf } from './figure/skeleton';
export {
  VIEW_WIDTH as FIGURE_WIDTH,
  VIEW_HEIGHT as FIGURE_HEIGHT,
  GROUND as FIGURE_GROUND,
} from './figure/skeleton';

const FALLBACK_LOOK: Look = {
  skin: '#E8C6A0',
  hair: '#4A3728',
  hairstyle: 'bob',
  eyes: '#3B2B20',
  outfit: { top: '#B4623C', bottom: '#4A3A2E', accent: '#D9A24A' },
  accessory: 'none',
};

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

interface Materials {
  skin: string;
  skinShade: string;
  skinDeep: string;
  skinLight: string;
  blush: string;
  hair: string;
  hairDeep: string;
  hairLit: string;
  hairSheen: string;
  cloth: string;
  clothFold: string;
  clothDeep: string;
  clothLit: string;
  trouser: string;
  trouserDeep: string;
  trouserLit: string;
  shoe: string;
  shoeLit: string;
  lip: string;
  lipLow: string;
  contour: string;
}

function materialsOf(look: Look, top: string, bottom: string): Materials {
  const skin = look.skin;
  const hair = look.hair;
  const clothDeep = warmShade(top, -50, 0.36);
  const trouserDeep = warmShade(bottom, -44, 0.36);
  const lip = mix(warmShade(skin, -52, 0.3), world.terracotta, 0.36);
  return {
    skin,
    skinShade: warmShade(skin, -28, 0.34),
    skinDeep: warmShade(skin, -46, 0.4),
    skinLight: warmLight(skin, 14, 0.42),
    blush: mix(skin, world.terracotta, 0.4),
    hair,
    hairDeep: warmShade(hair, -34, 0.3),
    hairLit: warmLight(hair, 30, 0.3),
    hairSheen: withAlpha(warmLight(hair, 46, 0.34), 0.5),
    cloth: top,
    clothFold: warmShade(top, -30, 0.3),
    clothDeep,
    clothLit: warmLight(top, 22, 0.26),
    trouser: bottom,
    trouserDeep,
    trouserLit: warmLight(bottom, 16, 0.26),
    shoe: warmShade(bottom, -58, 0.44),
    shoeLit: warmLight(warmShade(bottom, -40, 0.4), 20, 0.2),
    lip,
    lipLow: warmLight(lip, 18, 0.24),
    contour: withAlpha(warmShade(mix(world.shadow, hair, 0.2), 6, 0.5), 0.72),
  };
}

/* ------------------------------------------------------------------ *
 * Eyes
 * ------------------------------------------------------------------ */

interface PartProps {
  build: Build;
  colours: Materials;
}

/** The eyes, as a group, so they can blink in their own layer on the stage. */
export function Eyes({
  build,
  colours,
  id,
  lid,
  open,
}: PartProps & { id: (part: string) => string; lid: number; open: number }) {
  const { eyeY, eyeGap, eyeHalf, eyeHalfTall } = build;
  const iris = eyeHalf * 0.74;

  return (
    <>
      {[0, 1].map((side) => {
        const sign = side === 0 ? -1 : 1;
        const ex = CX + sign * eyeGap;
        const almond = smoothClosed([
          { x: ex - eyeHalf, y: eyeY + eyeHalfTall * 0.12 },
          { x: ex - eyeHalf * 0.42, y: eyeY - eyeHalfTall * 0.82 },
          { x: ex + eyeHalf * 0.36, y: eyeY - eyeHalfTall * open },
          { x: ex + eyeHalf, y: eyeY - eyeHalfTall * 0.06 },
          { x: ex + eyeHalf * 0.52, y: eyeY + eyeHalfTall * 0.72 },
          { x: ex - eyeHalf * 0.5, y: eyeY + eyeHalfTall * 0.8 },
        ]);
        const cover = Math.max(0, Math.min(1, lid)) * (eyeHalfTall * 2.6);
        return (
          <G key={side}>
            <ClipPath id={id(`eyeclip${side}`)}>
              <Path d={almond} />
            </ClipPath>
            <Path d={almond} fill="#FFF7EC" />
            <G clipPath={`url(#${id(`eyeclip${side}`)})`}>
              <Rect
                x={ex - eyeHalf - 1}
                y={eyeY - eyeHalfTall - 1.4}
                width={eyeHalf * 2 + 2}
                height={eyeHalfTall * 2 + 2.8}
                fill={`url(#${id('lid')})`}
              />
              <Circle cx={ex} cy={eyeY + eyeHalfTall * 0.1} r={iris} fill={`url(#${id('iris')})`} />
              <Circle cx={ex} cy={eyeY + eyeHalfTall * 0.1} r={iris * 0.98} fill="none" stroke={withAlpha(colours.hairDeep, 0.5)} strokeWidth={0.5} />
              <Circle cx={ex} cy={eyeY + eyeHalfTall * 0.1} r={iris * 0.46} fill="#150C08" />
              <Circle cx={ex - iris * 0.34} cy={eyeY - eyeHalfTall * 0.24} r={iris * 0.31} fill="#FFFBF3" opacity={0.95} />
              <Circle cx={ex + iris * 0.4} cy={eyeY + eyeHalfTall * 0.42} r={iris * 0.15} fill="#FFFBF3" opacity={0.55} />
              <Path
                d={smoothOpen([
                  { x: ex - eyeHalf, y: eyeY + eyeHalfTall * 0.05 },
                  { x: ex - eyeHalf * 0.3, y: eyeY + eyeHalfTall * 0.92 },
                  { x: ex + eyeHalf * 0.6, y: eyeY + eyeHalfTall * 0.86 },
                ])}
                stroke={withAlpha(colours.skinShade, 0.55)}
                strokeWidth={0.7}
                fill="none"
              />
              <Rect
                x={ex - eyeHalf - 1}
                y={eyeY - eyeHalfTall - 1.4}
                width={eyeHalf * 2 + 2}
                height={cover}
                fill={`url(#${id('lid')})`}
              />
              <Path
                d={smoothOpen([
                  { x: ex - eyeHalf * 1.02, y: eyeY + eyeHalfTall * 0.06 },
                  { x: ex - eyeHalf * 0.3, y: eyeY - eyeHalfTall * 1.14 },
                  { x: ex + eyeHalf * 0.5, y: eyeY - eyeHalfTall * 1.16 },
                  { x: ex + eyeHalf * 1.16, y: eyeY - eyeHalfTall * 0.2 },
                ])}
                stroke={colours.hairDeep}
                strokeWidth={eyeHalf * 0.42}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={smoothOpen([
                  { x: ex - eyeHalf * 0.5, y: eyeY - eyeHalfTall * 1.9 },
                  { x: ex + eyeHalf * 0.4, y: eyeY - eyeHalfTall * 2.1 },
                ])}
                stroke={withAlpha(colours.skinShade, 0.5)}
                strokeWidth={0.6}
                fill="none"
              />
            </G>
          </G>
        );
      })}
      <Ellipse cx={CX - eyeGap} cy={eyeY + eyeHalfTall * 1.5} rx={eyeHalf * 0.7} ry={eyeHalfTall * 0.24} fill={withAlpha(colours.skinShade, 0.3)} />
      <Ellipse cx={CX + eyeGap} cy={eyeY + eyeHalfTall * 1.5} rx={eyeHalf * 0.7} ry={eyeHalfTall * 0.24} fill={withAlpha(colours.skinShade, 0.3)} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Face
 * ------------------------------------------------------------------ */

export function Face({
  build,
  colours,
  id,
  mood,
}: PartProps & { id: (part: string) => string; mood: ReturnType<typeof moodOf> }) {
  const { eyeY, eyeGap, eyeHalf, browY, noseY, mouthY, headHalf, headTall, chin } = build;
  const lift = mood.mouth === 'smile' ? -0.9 : mood.mouth === 'frown' ? 1.1 : 0;

  return (
    <>
      {/* Brows: a taper that thickens toward the outside, tilted by the mood. */}
      {[0, 1].map((side) => {
        const sign = side === 0 ? -1 : 1;
        const ex = CX + sign * eyeGap;
        const brow = limbOutline([
          { x: ex - sign * eyeHalf * 0.1, y: browY + 0.5, w: 1.1 },
          { x: ex + sign * eyeHalf * 0.5, y: browY, w: 2 },
          { x: ex + sign * eyeHalf * 1.08, y: browY + 0.35, w: 1.2 },
        ]);
        return (
          <G key={side} transform={`rotate(${sign * mood.browTilt} ${ex} ${browY})`}>
            <Path d={brow} fill={colours.hairDeep} opacity={0.95} />
          </G>
        );
      })}

      {/* Nose: bridge shadow, bridge light, base, nostril. */}
      <Path
        d={smoothOpen([
          { x: CX - 0.6, y: eyeY + 2.2 },
          { x: CX - 1.6, y: noseY - 2.4 },
          { x: CX - 0.9, y: noseY },
        ])}
        stroke={withAlpha(colours.skinShade, 0.8)}
        strokeWidth={0.85}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: CX + 0.9, y: eyeY + 2.6 },
          { x: CX + 1.9, y: noseY - 2.2 },
          { x: CX + 1.1, y: noseY - 0.2 },
        ])}
        stroke={withAlpha(colours.skinLight, 0.8)}
        strokeWidth={0.9}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: CX - 2.2, y: noseY + 0.3 },
          { x: CX - 0.7, y: noseY + 1.1 },
          { x: CX + 0.9, y: noseY + 0.9 },
          { x: CX + 2.2, y: noseY + 0.1 },
        ])}
        stroke={withAlpha(colours.skinDeep, 0.42)}
        strokeWidth={0.75}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={CX - 1.7} cy={noseY + 0.2} rx={0.45} ry={0.3} fill={withAlpha(colours.skinDeep, 0.5)} />
      <Ellipse cx={CX + 1.7} cy={noseY + 0.2} rx={0.45} ry={0.3} fill={withAlpha(colours.skinDeep, 0.5)} />

      {/* Cheeks */}
      <Ellipse cx={CX - headHalf * 0.62} cy={mouthY - 1.8} rx={headHalf * 0.34} ry={headHalf * 0.22} fill={`url(#${id('blush')})`} opacity={mood.cheek} />
      <Ellipse cx={CX + headHalf * 0.62} cy={mouthY - 1.8} rx={headHalf * 0.34} ry={headHalf * 0.22} fill={`url(#${id('blush')})`} opacity={mood.cheek} />

      {/* Mouth */}
      {mood.mouth === 'open' ? (
        <>
          <Path
            d={smoothClosed([
              { x: CX - eyeHalf * 0.9, y: mouthY },
              { x: CX - eyeHalf * 0.2, y: mouthY + 3.1 },
              { x: CX + eyeHalf * 0.85, y: mouthY + 2.6 },
              { x: CX + eyeHalf * 0.95, y: mouthY - 0.4 },
              { x: CX + eyeHalf * 0.1, y: mouthY - 1.3 },
            ])}
            fill={withAlpha(colours.skinDeep, 0.94)}
          />
          <Path
            d={smoothOpen([
              { x: CX - eyeHalf * 0.5, y: mouthY + 2.1 },
              { x: CX + eyeHalf * 0.3, y: mouthY + 2.7 },
            ])}
            stroke={withAlpha(colours.lip, 0.9)}
            strokeWidth={1.3}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={smoothOpen([
              { x: CX - eyeHalf * 0.9, y: mouthY - 0.2 },
              { x: CX, y: mouthY - 0.9 },
              { x: CX + eyeHalf * 0.9, y: mouthY - 0.5 },
            ])}
            stroke={withAlpha(colours.lip, 0.75)}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Path
            d={smoothClosed([
              { x: CX - eyeHalf * 0.95, y: mouthY + lift * 0.7 },
              { x: CX - eyeHalf * 0.3, y: mouthY - 0.9 },
              { x: CX + eyeHalf * 0.3, y: mouthY - 0.9 },
              { x: CX + eyeHalf * 0.95, y: mouthY + lift * 0.7 },
              { x: CX, y: mouthY - 0.1 },
            ])}
            fill={colours.lip}
          />
          <Path
            d={smoothClosed([
              { x: CX - eyeHalf * 0.78, y: mouthY + 0.7 },
              { x: CX - eyeHalf * 0.2, y: mouthY + 2.3 + lift },
              { x: CX + eyeHalf * 0.2, y: mouthY + 2.3 + lift },
              { x: CX + eyeHalf * 0.78, y: mouthY + 0.7 },
              { x: CX, y: mouthY + 0.9 },
            ])}
            fill={colours.lipLow}
          />
          <Path
            d={smoothOpen([
              { x: CX - eyeHalf * 0.86, y: mouthY + 0.7 },
              { x: CX, y: mouthY + 1 },
              { x: CX + eyeHalf * 0.86, y: mouthY + 0.7 },
            ])}
            stroke={withAlpha(warmShade(colours.lip, -34, 0.3), 0.7)}
            strokeWidth={0.6}
            fill="none"
          />
        </>
      )}
      <Ellipse cx={CX} cy={mouthY - 1.9} rx={1.5} ry={0.8} fill={withAlpha(colours.skinShade, 0.35)} />
      <Ellipse cx={CX} cy={mouthY + 3.4} rx={2.6} ry={1.2} fill={withAlpha(colours.skinLight, 0.4)} />

      {/* Light and shade on the face itself. */}
      <Ellipse cx={CX + headHalf * 0.5} cy={browY - headTall * 0.22} rx={headHalf * 0.42} ry={headTall * 0.2} fill={withAlpha(colours.skinLight, 0.34)} />
      <Ellipse cx={CX - headHalf * 0.78} cy={eyeY + headTall * 0.3} rx={headHalf * 0.3} ry={headTall * 0.42} fill={withAlpha(colours.skinShade, 0.26)} />
      <Ellipse cx={CX} cy={chin - 0.6} rx={headHalf * 0.3} ry={1.3} fill={withAlpha(colours.skinLight, 0.3)} />
      <Ellipse cx={CX} cy={chin + 2.6} rx={headHalf * 0.6} ry={2.4} fill={`url(#${id('jaw')})`} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Hair
 * ------------------------------------------------------------------ */

/** The mass that sits behind the head, so hair has thickness from every side. */
function backMass(build: Build, drop: number): string {
  const { headTop, headHalf, headTall, eyeY } = build;
  return smoothClosed([
    { x: CX, y: headTop - headHalf * 0.34 },
    { x: CX - headHalf * 0.92, y: headTop + headTall * 0.12 },
    { x: CX - headHalf * 1.16, y: eyeY - headTall * 0.1 },
    { x: CX - headHalf * 1.06, y: eyeY + drop },
    { x: CX - headHalf * 0.46, y: eyeY + drop + 1.6 },
    { x: CX + headHalf * 0.46, y: eyeY + drop + 1.6 },
    { x: CX + headHalf * 1.06, y: eyeY + drop },
    { x: CX + headHalf * 1.16, y: eyeY - headTall * 0.1 },
    { x: CX + headHalf * 0.92, y: headTop + headTall * 0.12 },
  ]);
}

/** The crown over the skull, ending at the hairline above the eyes. */
function crownMass(build: Build, sweep: number): string {
  const { headTop, headHalf, headTall, eyeY } = build;
  const low = eyeY - headTall * 0.42;
  return smoothClosed([
    { x: CX - headHalf * 1.02, y: low },
    { x: CX - headHalf * 0.99, y: headTop + headTall * 0.3 },
    { x: CX - headHalf * 0.46, y: headTop - headHalf * 0.26 },
    { x: CX + headHalf * 0.5, y: headTop - headHalf * 0.26 },
    { x: CX + headHalf * 0.99, y: headTop + headTall * 0.3 },
    { x: CX + headHalf * 1.04, y: low + sweep },
    { x: CX + headHalf * 0.62, y: headTop + headTall * 0.46 + sweep },
    { x: CX + headHalf * 0.05, y: headTop + headTall * 0.36 + sweep * 0.5 },
    { x: CX - headHalf * 0.54, y: headTop + headTall * 0.44 },
  ]);
}

function sheenSliver(build: Build): string {
  const { headTop, headHalf, headTall } = build;
  return smoothClosed([
    { x: CX - headHalf * 0.62, y: headTop + headTall * 0.18 },
    { x: CX - headHalf * 0.08, y: headTop + headTall * 0.06 },
    { x: CX + headHalf * 0.5, y: headTop + headTall * 0.14 },
    { x: CX + headHalf * 0.12, y: headTop + headTall * 0.38 },
    { x: CX - headHalf * 0.42, y: headTop + headTall * 0.34 },
  ]);
}

function templeLock(build: Build, side: 1 | -1, length: number, width: number): string {
  const { headTop, headHalf, headTall, eyeY } = build;
  /** Hair keeps its proportions with the head it sits on. */
  const H = headHalf / 12.8;
  return limbOutline([
    { x: CX + side * headHalf * 0.98, y: headTop + headTall * 0.46, w: width * H },
    { x: CX + side * headHalf * 1.1, y: eyeY - 1, w: width * 1.3 * H },
    { x: CX + side * headHalf * 0.96, y: eyeY + length * H, w: width * 0.5 * H },
  ]);
}

function HairBack({ build, colours, id, style: hairStyle }: PartProps & { id: (part: string) => string; style: string }) {
  const H = build.headHalf / 12.8;
  const drop =
    (hairStyle === 'braids' ? 11 : hairStyle === 'bob' ? 8 : hairStyle === 'bun' ? 7.5 : hairStyle === 'ponytail' ? 8 : hairStyle === 'curls' ? 9 : hairStyle === 'undercut' ? 3.4 : 5.4) * H;
  const fill = `url(#${id('hairBack')})`;

  if (hairStyle === 'ponytail') {
    const { headHalf, eyeY, headTop, headTall } = build;
    return (
      <>
        <Path d={backMass(build, drop)} fill={fill} stroke={colours.contour} strokeWidth={0.9} />
        <Path
          d={limbOutline([
            { x: CX + headHalf * 0.9, y: headTop + headTall * 0.6, w: 7 * H },
            { x: CX + headHalf * 1.7, y: eyeY + 5 * H, w: 9 * H },
            { x: CX + headHalf * 1.9, y: eyeY + 15 * H, w: 6 * H },
            { x: CX + headHalf * 1.6, y: eyeY + 24 * H, w: 2.4 * H },
          ])}
          fill={fill}
        />
      </>
    );
  }
  if (hairStyle === 'braids') {
    const { headHalf, eyeY } = build;
    return (
      <>
        <Path d={backMass(build, drop)} fill={fill} stroke={colours.contour} strokeWidth={0.9} />
        {[-1, 1].map((side) => (
          <Path
            key={side}
            d={limbOutline([
              { x: CX + side * headHalf * 1.0, y: eyeY + 3 * H, w: 6.6 * H },
              { x: CX + side * headHalf * 1.05, y: eyeY + 14 * H, w: 5.4 * H },
              { x: CX + side * headHalf * 0.92, y: eyeY + 24 * H, w: 3.2 * H },
            ])}
            fill={fill}
          />
        ))}
      </>
    );
  }
  return <Path d={backMass(build, drop)} fill={fill} stroke={colours.contour} strokeWidth={0.9} />;
}

function HairFront({ build, colours, id, style: hairStyle }: PartProps & { id: (part: string) => string; style: string }) {
  const fill = `url(#${id('hairFront')})`;
  const deep = colours.hairDeep;
  const stroke = withAlpha(warmShade(colours.hair, -50, 0.3), 0.6);
  const { headTop, headHalf, headTall, eyeY } = build;
  const H = headHalf / 12.8;
  const crown = (sweep: number) => <Path d={crownMass(build, sweep)} fill={fill} stroke={stroke} strokeWidth={0.6} />;
  const sheen = <Path d={sheenSliver(build)} fill={colours.hairSheen} />;

  switch (hairStyle) {
    case 'braids':
      return (
        <>
          {crown(0)}
          {[-1, 1].map((side) => (
            <G key={side}>
              {[0, 1, 2].map((bead) => (
                <Ellipse
                  key={bead}
                  cx={CX + side * (headHalf * (0.96 - bead * 0.04))}
                  cy={eyeY + (7 + bead * 5.6) * H}
                  rx={(3.5 - bead * 0.3) * H}
                  ry={(2.9 - bead * 0.25) * H}
                  fill={bead % 2 ? colours.hair : deep}
                  stroke={stroke}
                  strokeWidth={0.5}
                />
              ))}
              <Rect x={CX + side * headHalf * 0.9 - 3 * H} y={eyeY + 4.4 * H} width={6 * H} height={2 * H} rx={1} fill={colours.hairLit} opacity={0.8} />
            </G>
          ))}
          {sheen}
        </>
      );
    case 'curls': {
      const curls: Node[] = [
        { x: CX - headHalf * 1.05, y: headTop + headTall * 0.5, w: 6 * H },
        { x: CX - headHalf * 1.12, y: eyeY + 1, w: 6.4 * H },
        { x: CX - headHalf * 0.2, y: headTop - 3 * H, w: 7 * H },
        { x: CX + headHalf * 0.6, y: headTop + 1, w: 6.6 * H },
        { x: CX + headHalf * 1.1, y: eyeY - 1, w: 6 * H },
        { x: CX + headHalf * 1.05, y: eyeY + 6 * H, w: 5.4 * H },
        { x: CX - headHalf * 1, y: eyeY + 6 * H, w: 5.2 * H },
        { x: CX + headHalf * 0.4, y: headTop + 5, w: 5.6 * H },
      ];
      return (
        <>
          {crown(0)}
          {curls.map((curl, index) => (
            <Circle
              key={index}
              cx={curl.x}
              cy={curl.y}
              r={curl.w / 2}
              fill={index % 3 === 1 ? deep : index % 3 === 2 ? colours.hairLit : colours.hair}
              stroke={stroke}
              strokeWidth={0.5}
            />
          ))}
          {sheen}
        </>
      );
    }
    case 'bun':
      return (
        <>
          {crown(0)}
          <Path
            d={smoothClosed([
              { x: CX - 6.4 * H, y: headTop - 3 * H },
              { x: CX - 3 * H, y: headTop - 10.4 * H },
              { x: CX + 3.6 * H, y: headTop - 10.8 * H },
              { x: CX + 7 * H, y: headTop - 4 * H },
              { x: CX + 4 * H, y: headTop - 0.6 * H },
              { x: CX - 3.4 * H, y: headTop - 0.8 * H },
            ])}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.6}
          />
          <Path
            d={smoothOpen([
              { x: CX - 3.6 * H, y: headTop - 8.4 * H },
              { x: CX + 1.4 * H, y: headTop - 9.6 * H },
              { x: CX + 4.4 * H, y: headTop - 5.4 * H },
            ])}
            stroke={colours.hairSheen}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          {sheen}
        </>
      );
    case 'ponytail':
      return (
        <>
          {crown(0)}
          {sheen}
          <Path
            d={limbOutline([
              { x: CX + headHalf * 0.92, y: headTop + headTall * 0.5, w: 2.6 * H },
              { x: CX + headHalf * 1.14, y: eyeY - 2, w: 3.4 * H },
              { x: CX + headHalf * 1.0, y: eyeY + 5, w: 2 * H },
            ])}
            fill={colours.hair}
          />
        </>
      );
    case 'undercut':
      return (
        <>
          <Path d={crownMass(build, -0.6)} fill={fill} stroke={stroke} strokeWidth={0.6} />
          {[-1, 1].map((side) => (
            <Path
              key={side}
              d={limbOutline([
                { x: CX + side * headHalf * 1.02, y: headTop + headTall * 0.2, w: 1.6 * H },
                { x: CX + side * headHalf * 1.06, y: eyeY, w: 2.2 * H },
                { x: CX + side * headHalf * 1.0, y: eyeY + 3.6 * H, w: 0.8 * H },
              ])}
              fill={withAlpha(deep, 0.9)}
            />
          ))}
          <Path
            d={smoothOpen([
              { x: CX - headHalf * 0.9, y: headTop + headTall * 0.22 },
              { x: CX, y: headTop + headTall * 0.04 },
              { x: CX + headHalf * 0.85, y: headTop + headTall * 0.24 },
            ])}
            stroke={colours.hairSheen}
            strokeWidth={1.7}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case 'swept':
      return (
        <>
          {crown(1.2)}
          <Path d={templeLock(build, 1, 9, 3)} fill={fill} stroke={stroke} strokeWidth={0.5} />
          {sheen}
        </>
      );
    case 'bob':
    default:
      return (
        <>
          {crown(0)}
          {[-1, 1].map((side) => (
            <Path key={side} d={templeLock(build, side as 1 | -1, 6.5, 2.4)} fill={fill} />
          ))}
          <Path
            d={smoothOpen([
              { x: CX + headHalf * 0.06, y: headTop - headHalf * 0.2 },
              { x: CX + headHalf * 0.02, y: headTop + headTall * 0.3 },
            ])}
            stroke={withAlpha(warmShade(colours.hair, -50, 0.3), 0.6)}
            strokeWidth={0.8}
            fill="none"
          />
          {sheen}
        </>
      );
  }
}

/* ------------------------------------------------------------------ *
 * Accessories
 * ------------------------------------------------------------------ */

function Accessory({ build, colours, kind, accent, id }: PartProps & { kind: string; accent: string; id: (part: string) => string }) {
  void id;
  const { headTop, headHalf, eyeY, neckY, shoulderY, hipY } = build;
  const leather = warmShade(accent, -48, 0.4);

  switch (kind) {
    case 'headphones':
      return (
        <>
          <Path
            d={smoothOpen([
              { x: CX - headHalf * 1.14, y: eyeY - 2 },
              { x: CX - headHalf * 0.9, y: headTop - 1.4 },
              { x: CX, y: headTop - 4 },
              { x: CX + headHalf * 0.9, y: headTop - 1.4 },
              { x: CX + headHalf * 1.14, y: eyeY - 2 },
            ])}
            stroke={world.brassDark}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
          {[-1, 1].map((side) => (
            <G key={side}>
              <Rect x={CX + side * headHalf * 1.16 - 3.8} y={eyeY - 1.4} width={7.6} height={10} rx={3.2} fill={leather} stroke={withAlpha(world.shadow, 0.4)} strokeWidth={0.6} />
              <Rect x={CX + side * headHalf * 1.16 - 2.2} y={eyeY + 0.2} width={4.4} height={6.2} rx={2.2} fill={warmShade(accent, -18, 0.3)} />
            </G>
          ))}
        </>
      );
    case 'stethoscope':
      return (
        <>
          <Path
            d={smoothOpen([
              { x: CX - 6.4, y: neckY - 1.4 },
              { x: CX - 5, y: neckY + 6 },
              { x: CX + 5, y: neckY + 6 },
              { x: CX + 6.4, y: neckY - 1.4 },
            ])}
            stroke={warmShade(accent, -24, 0.3)}
            strokeWidth={1.7}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={smoothOpen([
              { x: CX + 6, y: neckY + 3 },
              { x: CX + 5.6, y: neckY + 11 },
              { x: CX + 3.4, y: neckY + 17 },
            ])}
            stroke={warmShade(accent, -30, 0.3)}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={CX + 2.8} cy={neckY + 19} r={2.8} fill={world.brass} stroke={world.brassDark} strokeWidth={0.7} />
        </>
      );
    case 'apron':
      return (
        <>
          <Path d={`M ${CX - 8} ${neckY + 1} L ${CX + 8} ${neckY + 1}`} stroke={leather} strokeWidth={1.6} />
          <Path
            d={`M ${CX - 7} ${neckY + 2} L ${CX + 7} ${neckY + 2} L ${CX + 7.8} ${hipY - 2} L ${CX - 7.8} ${hipY - 2} Z`}
            fill={world.linen}
            stroke={warmShade(world.linen, -36, 0.2)}
            strokeWidth={0.8}
          />
          <Path d={`M ${CX - 6.2} ${hipY - 8} L ${CX + 6.2} ${hipY - 8} L ${CX + 6.2} ${hipY - 3} L ${CX - 6.2} ${hipY - 3} Z`} fill={warmShade(world.linen, -16, 0.18)} />
          <Path d={smoothOpen([{ x: CX - 11, y: neckY + 7 }, { x: CX - 8, y: neckY + 5.4 }, { x: CX - 6.8, y: neckY + 6.4 }])} stroke={leather} strokeWidth={1.3} fill="none" />
          <Path d={smoothOpen([{ x: CX + 11, y: neckY + 7 }, { x: CX + 8, y: neckY + 5.4 }, { x: CX + 6.8, y: neckY + 6.4 }])} stroke={leather} strokeWidth={1.3} fill="none" />
        </>
      );
    case 'visor':
      return (
        <>
          <Rect x={CX - headHalf * 1.06} y={eyeY - headHalf * 0.62} width={headHalf * 2.12} height={2.8} rx={1.4} fill={leather} />
          <Path
            d={smoothClosed([
              { x: CX - headHalf * 1.1, y: eyeY - headHalf * 0.12 },
              { x: CX - headHalf * 0.4, y: eyeY + 2.6 },
              { x: CX + headHalf * 0.6, y: eyeY + 2.4 },
              { x: CX + headHalf * 1.1, y: eyeY - headHalf * 0.2 },
              { x: CX, y: eyeY - headHalf * 0.3 },
            ])}
            fill={withAlpha(world.glow, 0.42)}
            stroke={world.brassDark}
            strokeWidth={0.8}
          />
          <Path d={smoothOpen([{ x: CX - headHalf * 0.7, y: eyeY + 0.6 }, { x: CX, y: eyeY + 1.3 }, { x: CX + headHalf * 0.5, y: eyeY + 0.9 }])} stroke={withAlpha(world.rim, 0.5)} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        </>
      );
    case 'scarf':
      return (
        <>
          <Path
            d={smoothClosed([
              { x: CX - 9.4, y: neckY - 1.6 },
              { x: CX - 7, y: neckY + 3.4 },
              { x: CX + 7, y: neckY + 3.4 },
              { x: CX + 9.4, y: neckY - 1.6 },
              { x: CX, y: neckY + 1.2 },
            ])}
            fill={accent}
            stroke={warmShade(accent, -38, 0.32)}
            strokeWidth={0.7}
          />
          <Path d={smoothOpen([{ x: CX - 7, y: neckY + 1.4 }, { x: CX, y: neckY + 3 }, { x: CX + 7, y: neckY + 1.4 }])} stroke={withAlpha(warmShade(accent, -34, 0.3), 0.7)} strokeWidth={0.8} fill="none" />
          <Path
            d={limbOutline([
              { x: CX + 3.6, y: neckY + 2.6, w: 4.4 },
              { x: CX + 5, y: neckY + 10, w: 4 },
              { x: CX + 3.4, y: neckY + 17, w: 3 },
            ])}
            fill={accent}
          />
        </>
      );
    case 'satchel':
      return (
        <>
          <Path d={`M ${CX - 8} ${shoulderY + 1} L ${CX + 9} ${shoulderY + 16}`} stroke={leather} strokeWidth={2.4} strokeLinecap="round" />
          <Rect x={CX + 5} y={shoulderY + 13} width={15} height={12} rx={2.2} fill={warmShade(accent, -28, 0.34)} stroke={leather} strokeWidth={0.8} />
          <Path d={`M ${CX + 5} ${shoulderY + 13} L ${CX + 20} ${shoulderY + 13} L ${CX + 20} ${shoulderY + 18} L ${CX + 5} ${shoulderY + 18} Z`} fill={warmShade(accent, -12, 0.3)} />
          <Rect x={CX + 11.6} y={shoulderY + 19} width={3} height={2.4} rx={0.6} fill={world.brass} />
        </>
      );
    case 'none':
    default:
      void colours;
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Body
 * ------------------------------------------------------------------ */

/** The spine of one arm, from the shoulder through the elbow to the wrist. */
function armSpine(build: Build, side: 1 | -1): Node[] {
  const { shoulderY, hipY, shoulder, armOut, upperArm, forearm, wrist, stance, hip } = build;
  const shoulderX = CX + side * (shoulder - 0.9);
  const elbowY = (shoulderY + hipY) / 2 + 1.6;
  let elbowX = CX + side * (shoulder + armOut + 0.8);
  let wristX = CX + side * (shoulder - 0.8 + armOut * 0.4);
  let wristY = hipY - 1.4;
  if (stance === 'clasped') {
    elbowX = CX + side * (shoulder + armOut + 0.2);
    wristX = CX + side * 3.2;
    wristY = hipY - 0.4;
  } else if (stance === 'pocket' && side === -1) {
    elbowX = CX + side * (shoulder + armOut + 1.8);
    wristX = CX - (hip - 1.6);
    wristY = hipY - 3.4;
  }
  return [
    { x: shoulderX, y: shoulderY + 1.2, w: upperArm * 1.1 },
    { x: (shoulderX + elbowX) / 2, y: (shoulderY + 2 + elbowY) / 2, w: upperArm },
    { x: elbowX, y: elbowY, w: upperArm * 0.9 },
    { x: (elbowX + wristX) / 2, y: (elbowY + wristY) / 2 + 0.5, w: forearm },
    { x: wristX, y: wristY, w: wrist },
  ];
}

function Arm({
  build,
  colours,
  id,
  cut,
  side,
}: PartProps & { id: (part: string) => string; cut: GarmentCut; side: 1 | -1 }) {
  const spine = armSpine(build, side);
  const wrist = spine[spine.length - 1];
  const short = cut === 'shirt' || cut === 'tunic';
  const cuffY = wrist.y - (short ? 5.8 : 1.4);
  const sleeve = limbOutline([...spine.slice(0, -1), { x: wrist.x, y: cuffY, w: build.wrist * 1.08 }]);
  const hand = limbOutline([
    { x: wrist.x, y: cuffY - 0.6, w: build.wrist * 1.04 },
    { x: wrist.x + side * 0.4, y: wrist.y + 3.4, w: build.wrist * 0.98 },
    { x: wrist.x + side * 0.8, y: wrist.y + 7.4, w: build.wrist * 0.78 },
  ]);

  return (
    <>
      <Path d={sleeve} fill={`url(#${id('cloth')})`} stroke={colours.contour} strokeWidth={1} />
      {/* Light down the outside of the sleeve, shade down the inside. */}
      <Path
        d={smoothOpen([
          { x: spine[0].x + side * build.upperArm * 0.5, y: spine[0].y + 1.4 },
          { x: spine[2].x + side * build.upperArm * 0.42, y: spine[2].y },
          { x: spine[4].x + side * build.wrist * 0.5, y: cuffY - 1 },
        ])}
        stroke={withAlpha(colours.clothLit, 0.42)}
        strokeWidth={1.4}
        fill="none"
      />
      <Path d={`M ${spine[0].x - side * build.upperArm * 0.46} ${spine[0].y + 2} L ${wrist.x - side * build.wrist * 0.4} ${cuffY - 1}`} stroke={withAlpha(colours.clothDeep, 0.4)} strokeWidth={1.2} />
      {/* Cuff, then the hand it reveals. */}
      <Path
        d={smoothOpen([
          { x: wrist.x - side * build.wrist * 0.56, y: cuffY + 0.4 },
          { x: wrist.x, y: cuffY + 1.2 },
          { x: wrist.x + side * build.wrist * 0.56, y: cuffY + 0.2 },
        ])}
        stroke={colours.clothDeep}
        strokeWidth={1.7}
        fill="none"
      />
      <Path d={hand} fill={`url(#${id('skin')})`} stroke={colours.contour} strokeWidth={0.7} />
      <Ellipse cx={wrist.x - side * build.wrist * 0.3} cy={wrist.y + 2.6} rx={1.7} ry={2.8} fill={colours.skin} stroke={withAlpha(colours.skinShade, 0.5)} strokeWidth={0.5} />
      <Path
        d={smoothOpen([
          { x: wrist.x - side * 0.6, y: wrist.y + 4.6 },
          { x: wrist.x + side * 0.4, y: wrist.y + 5.2 },
        ])}
        stroke={withAlpha(colours.skinShade, 0.55)}
        strokeWidth={0.6}
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: wrist.x - side * 0.4, y: wrist.y + 7 },
          { x: wrist.x + side * 0.6, y: wrist.y + 7.4 },
        ])}
        stroke={withAlpha(colours.skinShade, 0.45)}
        strokeWidth={0.55}
        fill="none"
      />
    </>
  );
}

/** One leg: a thigh, a knee, a calf and an ankle, in one tapered outline. */
function Leg({ build, colours, id, side }: PartProps & { id: (part: string) => string; side: 1 | -1 }) {
  const { hipY, kneeY, ankleY, legSpread, thigh, knee, ankle } = build;
  const hipX = CX + side * legSpread;
  const ankleX = hipX + side * 0.5;
  const leg = limbOutline([
    { x: hipX, y: hipY - 3, w: thigh },
    { x: hipX + side * 0.3, y: (hipY + kneeY) / 2, w: (thigh + knee) * 0.52 },
    { x: ankleX - side * 0.2, y: kneeY, w: knee },
    { x: ankleX + side * 0.2, y: kneeY + 7.5, w: (knee + ankle) * 0.54 },
    { x: ankleX, y: ankleY, w: ankle },
  ]);

  return (
    <>
      <Path d={leg} fill={`url(#${id('leg')})`} stroke={colours.contour} strokeWidth={1} />
      <Path
        d={smoothOpen([
          { x: hipX + side * thigh * 0.34, y: hipY + 2 },
          { x: hipX + side * knee * 0.32, y: kneeY - 2 },
          { x: ankleX + side * ankle * 0.28, y: ankleY - 3 },
        ])}
        stroke={withAlpha(colours.trouserLit, 0.34)}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: hipX - side * thigh * 0.3, y: hipY + 4 },
          { x: hipX - side * knee * 0.28, y: kneeY - 3 },
          { x: ankleX - side * ankle * 0.3, y: ankleY - 4 },
        ])}
        stroke={withAlpha(colours.trouserDeep, 0.5)}
        strokeWidth={1.5}
        fill="none"
      />
      {/* The fold a trouser keeps at the knee. */}
      <Path
        d={smoothOpen([
          { x: hipX - side * thigh * 0.4, y: kneeY + 1.4 },
          { x: hipX + side * 0.4, y: kneeY + 2.6 },
          { x: hipX + side * knee * 0.42, y: kneeY + 1 },
        ])}
        stroke={withAlpha(colours.trouserDeep, 0.42)}
        strokeWidth={0.8}
        fill="none"
      />
    </>
  );
}

/** A shoe: heel, sole, toe, and the small break where the trouser meets it. */
function Shoe({ build, colours, side }: PartProps & { side: 1 | -1 }) {
  const { ankleY, legSpread, ankle } = build;
  const { trouserDeep } = colours;
  const cx = CX + side * legSpread + side * 0.5;
  const foot = limbOutline([
    { x: cx - side * (ankle * 0.5 + 1.6), y: ankleY + 4.4, w: 8 },
    { x: cx + side * 1.4, y: ankleY + 6, w: 8.6 },
    { x: cx + side * 4.2, y: ankleY + 4.6, w: 6.2 },
  ]);

  return (
    <>
      <Path d={foot} fill={colours.shoe} stroke={colours.contour} strokeWidth={0.8} />
      <Path
        d={smoothOpen([
          { x: cx - side * (ankle * 0.5 + 1.8), y: ankleY + 7.6 },
          { x: cx + side * 1.6, y: ankleY + 9.4 },
          { x: cx + side * 4.4, y: ankleY + 7.6 },
        ])}
        stroke={withAlpha(world.shadow, 0.6)}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: cx + side * 1.6, y: ankleY + 2.4 },
          { x: cx + side * 3.4, y: ankleY + 3.4 },
          { x: cx + side * 4.4, y: ankleY + 5 },
        ])}
        stroke={withAlpha(colours.shoeLit, 0.5)}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: cx - side * 1.6, y: ankleY + 1.2 },
          { x: cx + side * 0.4, y: ankleY + 1.8 },
        ])}
        stroke={withAlpha(trouserDeep, 0.7)}
        strokeWidth={1.2}
        fill="none"
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Garments
 * ------------------------------------------------------------------ */

function Torso({
  build,
  colours,
  id,
  cut,
  accent,
}: PartProps & { id: (part: string) => string; cut: GarmentCut; accent: string }) {
  const { shoulderY, hipY, shoulder, chest, waist, hip, neckY } = build;
  const hem = cut === 'coat' ? 5.5 : cut === 'wrap' ? 3.6 : 1.6;
  const body = limbOutline([
    { x: CX, y: shoulderY, w: shoulder * 2 },
    { x: CX, y: shoulderY + (hipY - shoulderY) * 0.32, w: chest * 2 },
    { x: CX, y: hipY - (hipY - shoulderY) * 0.3, w: waist * 2 },
    { x: CX, y: hipY + hem, w: hip * 2 },
  ]);
  const armpit = shoulderY + (hipY - shoulderY) * 0.26;

  return (
    <>
      {/* The cloth drops from the shoulders and keeps its own weight. */}
      <Path d={body} fill={`url(#${id('cloth')})`} stroke={colours.contour} strokeWidth={1} />

      {/* Tension folds from under each arm to the waist. */}
      {[-1, 1].map((side) => (
        <Path
          key={side}
          d={smoothOpen([
            { x: CX + side * shoulder * 0.86, y: armpit },
            { x: CX + side * (waist + 1.4), y: hipY - (hipY - shoulderY) * 0.16 },
            { x: CX + side * waist * 0.6, y: hipY + hem - 1 },
          ])}
          stroke={withAlpha(colours.clothDeep, 0.42)}
          strokeWidth={1.5}
          fill="none"
        />
      ))}
      <Path
        d={smoothOpen([
          { x: CX - shoulder + 1, y: shoulderY + 3 },
          { x: CX - shoulder - 0.4, y: shoulderY + 12 },
          { x: CX - waist - 1.4, y: hipY - 2 },
          { x: CX - waist - 1.8, y: hipY + hem - 0.6 },
        ])}
        stroke={withAlpha(colours.clothDeep, 0.5)}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d={smoothOpen([
          { x: CX + shoulder - 1, y: shoulderY + 3 },
          { x: CX + shoulder + 0.4, y: shoulderY + 12 },
          { x: CX + waist + 1.4, y: hipY - 2 },
          { x: CX + waist + 1.8, y: hipY + hem - 0.6 },
        ])}
        stroke={withAlpha(world.rim, 0.34)}
        strokeWidth={1.5}
        fill="none"
      />

      {/* Collar on every cut, then what makes each cut itself. */}
      <Path
        d={smoothClosed([
          { x: CX - 5.4, y: neckY - 3.4 },
          { x: CX - 2.2, y: shoulderY + 2.6 },
          { x: CX, y: neckY - 0.6 },
          { x: CX + 2.2, y: shoulderY + 2.6 },
          { x: CX + 5.4, y: neckY - 3.4 },
          { x: CX, y: neckY - 4.6 },
        ])}
        fill={colours.clothLit}
        stroke={colours.clothDeep}
        strokeWidth={0.7}
      />

      {cut === 'shirt' ? (
        <>
          <Path
            d={smoothClosed([
              { x: CX - 6, y: neckY - 3.6 },
              { x: CX - 0.6, y: neckY + 3.4 },
              { x: CX - 4.6, y: neckY + 4.4 },
              { x: CX - 8.4, y: neckY - 2.2 },
            ])}
            fill={colours.clothLit}
            stroke={colours.clothDeep}
            strokeWidth={0.6}
          />
          <Path
            d={smoothClosed([
              { x: CX + 6, y: neckY - 3.6 },
              { x: CX + 0.6, y: neckY + 3.4 },
              { x: CX + 4.6, y: neckY + 4.4 },
              { x: CX + 8.4, y: neckY - 2.2 },
            ])}
            fill={colours.clothLit}
            stroke={colours.clothDeep}
            strokeWidth={0.6}
          />
          <Path d={`M ${CX + 0.4} ${neckY + 3.4} L ${CX + 0.4} ${hipY}`} stroke={withAlpha(colours.clothDeep, 0.7)} strokeWidth={0.9} />
          {[0, 1, 2].map((button) => (
            <Circle key={button} cx={CX + 0.4} cy={neckY + 10 + button * 8} r={0.9} fill={world.linen} stroke={colours.clothDeep} strokeWidth={0.3} />
          ))}
        </>
      ) : null}

      {cut === 'jacket' ? (
        <>
          <Path d={`M ${CX + 0.2} ${shoulderY + 1} L ${CX + 0.2} ${hipY}`} stroke={withAlpha(colours.clothLit, 0.85)} strokeWidth={3.2} />
          {[-1, 1].map((side) => (
            <Path
              key={side}
              d={smoothClosed([
                { x: CX + side * 6.6, y: neckY - 3.4 },
                { x: CX + side * 1.2, y: shoulderY + 10 },
                { x: CX + side * 7, y: shoulderY + 12.4 },
                { x: CX + side * 10, y: neckY - 1.6 },
              ])}
              fill={withAlpha(colours.clothFold, 0.85)}
              stroke={colours.clothDeep}
              strokeWidth={0.7}
            />
          ))}
          {[-1, 1].map((side) => (
            <Rect
              key={side}
              x={CX + side * (waist + 1) - (side > 0 ? 8 : 0)}
              y={hipY - 9}
              width={8}
              height={5.4}
              rx={1}
              fill={withAlpha(colours.clothDeep, 0.32)}
              stroke={withAlpha(colours.clothDeep, 0.6)}
              strokeWidth={0.5}
            />
          ))}
        </>
      ) : null}

      {cut === 'hoodie' ? (
        <>
          <Path
            d={smoothClosed([
              { x: CX - 11, y: shoulderY + 1 },
              { x: CX - 9, y: neckY - 7 },
              { x: CX, y: neckY - 9.4 },
              { x: CX + 9, y: neckY - 7 },
              { x: CX + 11, y: shoulderY + 1 },
              { x: CX + 5, y: neckY + 1 },
              { x: CX - 5, y: neckY + 1 },
            ])}
            fill={withAlpha(colours.clothFold, 0.9)}
            stroke={colours.clothDeep}
            strokeWidth={0.8}
          />
          {[-1, 1].map((side) => (
            <Path
              key={side}
              d={smoothOpen([
                { x: CX + side * 2.4, y: neckY + 1.4 },
                { x: CX + side * 2.8, y: neckY + 8 },
              ])}
              stroke={colours.clothLit}
              strokeWidth={1.3}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          <Path
            d={smoothClosed([
              { x: CX - 9, y: hipY - 7 },
              { x: CX + 9, y: hipY - 7 },
              { x: CX + 7.6, y: hipY + 0.6 },
              { x: CX - 7.6, y: hipY + 0.6 },
            ])}
            fill={withAlpha(colours.clothDeep, 0.32)}
            stroke={withAlpha(colours.clothDeep, 0.5)}
            strokeWidth={0.6}
          />
        </>
      ) : null}

      {cut === 'coat' ? (
        <>
          <Path d={`M ${CX + 0.2} ${shoulderY + 1} L ${CX + 0.2} ${hipY + 4}`} stroke={withAlpha(colours.clothLit, 0.8)} strokeWidth={2.8} />
          {[-1, 1].map((side) => (
            <Path
              key={side}
              d={smoothClosed([
                { x: CX + side * 7.4, y: neckY - 3.4 },
                { x: CX + side * 1, y: shoulderY + 15 },
                { x: CX + side * 8.6, y: shoulderY + 17 },
                { x: CX + side * 11.4, y: neckY - 1.4 },
              ])}
              fill={withAlpha(colours.clothFold, 0.9)}
              stroke={colours.clothDeep}
              strokeWidth={0.7}
            />
          ))}
          <Rect x={CX - waist - 2} y={hipY - 13} width={(waist + 2) * 2} height={4.6} fill={colours.clothFold} />
          <Rect x={CX - 2.2} y={hipY - 14.4} width={4.4} height={7.2} rx={1} fill={world.brass} stroke={world.brassDark} strokeWidth={0.6} />
          {[0, 1, 2].map((button) => (
            <Circle key={button} cx={CX + 5} cy={neckY + 16 + button * 7} r={1.1} fill={world.brass} stroke={world.brassDark} strokeWidth={0.4} />
          ))}
        </>
      ) : null}

      {cut === 'tunic' ? (
        <>
          <Path
            d={limbOutline([
              { x: CX - 9.6, y: shoulderY + 1.4, w: 5.4 },
              { x: CX, y: shoulderY + 11, w: 5.4 },
              { x: CX + 9.4, y: shoulderY + 19, w: 5.4 },
            ])}
            fill={withAlpha(colours.clothDeep, 0.85)}
          />
          <Path
            d={limbOutline([
              { x: CX + 9.6, y: shoulderY + 1.4, w: 5.2 },
              { x: CX, y: shoulderY + 11, w: 5.2 },
              { x: CX - 9.4, y: shoulderY + 19, w: 5.2 },
            ])}
            fill={withAlpha(colours.clothLit, 0.9)}
          />
          <Path
            d={smoothClosed([
              { x: CX - waist - 2.4, y: hipY - 10 },
              { x: CX + waist + 2.4, y: hipY - 10 },
              { x: CX + waist + 2, y: hipY - 5.6 },
              { x: CX - waist - 2, y: hipY - 5.6 },
            ])}
            fill={accent}
            stroke={warmShade(accent, -34, 0.3)}
            strokeWidth={0.6}
          />
          <Path
            d={limbOutline([
              { x: CX + waist + 3.6, y: hipY - 9, w: 3 },
              { x: CX + waist + 7.6, y: hipY - 2.6, w: 2.4 },
            ])}
            fill={warmShade(accent, -18, 0.3)}
          />
        </>
      ) : null}

      {cut === 'wrap' ? (
        <>
          <Path
            d={smoothClosed([
              { x: CX - 9.8, y: shoulderY + 1 },
              { x: CX + 6.4, y: hipY + 1 },
              { x: CX + 9.8, y: hipY + 1 },
              { x: CX - 6, y: shoulderY + 0.6 },
            ])}
            fill={withAlpha(colours.clothFold, 0.95)}
            stroke={colours.clothDeep}
            strokeWidth={0.6}
          />
          <Path
            d={smoothClosed([
              { x: CX + 9.8, y: shoulderY + 1 },
              { x: CX - 6.4, y: hipY + 1 },
              { x: CX - 9.8, y: hipY + 1 },
              { x: CX + 6, y: shoulderY + 0.6 },
            ])}
            fill={withAlpha(colours.clothLit, 0.9)}
            stroke={colours.clothDeep}
            strokeWidth={0.6}
          />
          <Path
            d={smoothClosed([
              { x: CX - waist - 3, y: hipY - 10.4 },
              { x: CX + waist + 3, y: hipY - 10.4 },
              { x: CX + waist + 2, y: hipY - 4.8 },
              { x: CX - waist - 2, y: hipY - 4.8 },
            ])}
            fill={accent}
            stroke={warmShade(accent, -34, 0.3)}
            strokeWidth={0.6}
          />
        </>
      ) : null}

      {/* Cloth casts a little shade on the cloth below it. */}
      <Ellipse cx={CX} cy={hipY + hem + 1.6} rx={hip * 0.92} ry={2.4} fill={`url(#${id('clothShadow')})`} />
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

export function Figure({ resident, light = 0.85, withEyes = true, width, height, bust = false }: FigureProps) {
  const look: Look = resident.look ?? FALLBACK_LOOK;
  const outfit = look.outfit ?? FALLBACK_LOOK.outfit;
  const mood = moodOf(resident);
  const cut = garmentOf(resident);
  const build = buildOf(resident);
  const colours = materialsOf(look, outfit.top, outfit.bottom);

  const id = useMemo(() => {
    const prefix = `fig-${resident.id.replace(/[^a-zA-Z0-9]/g, '')}-${bust ? 'b' : 'f'}`;
    return (part: string) => `${prefix}-${part}`;
  }, [resident.id, bust]);

  const { headTop, headHalf, headTall, chin, neckY, eyeY, shoulderY, hipY, shoulder, waist, legSpread, ankleY } = build;
  const lightEdge = 0.16 + Math.max(0, Math.min(1, light)) * 0.24;

  const skull = smoothClosed([
    { x: CX, y: headTop },
    { x: CX - headHalf * 0.62, y: headTop + headTall * 0.14 },
    { x: CX - headHalf * 0.97, y: headTop + headTall * 0.58 },
    { x: CX - headHalf, y: eyeY + headTall * 0.16 },
    { x: CX - headHalf * 0.86, y: chin - headTall * 0.36 },
    { x: CX - headHalf * 0.46, y: chin - headTall * 0.06 },
    { x: CX, y: chin },
    { x: CX + headHalf * 0.46, y: chin - headTall * 0.06 },
    { x: CX + headHalf * 0.86, y: chin - headTall * 0.36 },
    { x: CX + headHalf, y: eyeY + headTall * 0.16 },
    { x: CX + headHalf * 0.97, y: headTop + headTall * 0.58 },
    { x: CX + headHalf * 0.62, y: headTop + headTall * 0.14 },
  ]);

  const neck = limbOutline([
    { x: CX, y: chin - 3, w: headHalf * 0.7 },
    { x: CX, y: neckY + 1.6, w: headHalf * 0.84 },
  ]);

  return (
    <Svg
      viewBox={bust ? `${BUST_REGION.x} ${BUST_REGION.y} ${BUST_REGION.w} ${BUST_REGION.h}` : `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width ?? VIEW_WIDTH}
      height={height ?? VIEW_HEIGHT}
      style={styles.overlay}
    >
      <Defs>
        <LinearGradient id={id('skin')} x1="0.12" y1="0.08" x2="1" y2="0.9">
          <Stop offset="0" stopColor={colours.skinShade} />
          <Stop offset="0.4" stopColor={colours.skin} />
          <Stop offset="1" stopColor={colours.skinLight} />
        </LinearGradient>
        <LinearGradient id={id('hairFront')} x1="0.2" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={colours.hairLit} />
          <Stop offset="0.48" stopColor={colours.hair} />
          <Stop offset="1" stopColor={colours.hairDeep} />
        </LinearGradient>
        <LinearGradient id={id('hairBack')} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={warmShade(colours.hair, -8, 0.26)} />
          <Stop offset="1" stopColor={colours.hairDeep} />
        </LinearGradient>
        <LinearGradient id={id('cloth')} x1="0.05" y1="0" x2="0.95" y2="1">
          <Stop offset="0" stopColor={colours.clothFold} />
          <Stop offset="0.44" stopColor={colours.cloth} />
          <Stop offset="1" stopColor={colours.clothLit} />
        </LinearGradient>
        <LinearGradient id={id('leg')} x1="0" y1="0" x2="1" y2="0.5">
          <Stop offset="0" stopColor={colours.trouserDeep} />
          <Stop offset="0.58" stopColor={colours.trouser} />
          <Stop offset="1" stopColor={colours.trouserLit} />
        </LinearGradient>
        <LinearGradient id={id('iris')} x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={warmLight(look.eyes, 30, 0.26)} />
          <Stop offset="0.62" stopColor={look.eyes} />
          <Stop offset="1" stopColor={warmShade(look.eyes, -22, 0.3)} />
        </LinearGradient>
        <LinearGradient id={id('lid')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={withAlpha(colours.skinShade, 0.95)} />
          <Stop offset="0.7" stopColor={withAlpha(colours.skinShade, 0.35)} />
          <Stop offset="1" stopColor={withAlpha(colours.skinShade, 0)} />
        </LinearGradient>
        <RadialGradient id={id('blush')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(colours.blush, 0.6)} />
          <Stop offset="1" stopColor={withAlpha(colours.blush, 0)} />
        </RadialGradient>
        <RadialGradient id={id('jaw')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(colours.skinDeep, 0.5)} />
          <Stop offset="1" stopColor={withAlpha(colours.skinDeep, 0)} />
        </RadialGradient>
        <RadialGradient id={id('ground')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.shadow, 0.44)} />
          <Stop offset="0.6" stopColor={withAlpha(world.shadow, 0.2)} />
          <Stop offset="1" stopColor={withAlpha(world.shadow, 0)} />
        </RadialGradient>
        <RadialGradient id={id('clothShadow')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.shadow, 0.34)} />
          <Stop offset="1" stopColor={withAlpha(world.shadow, 0)} />
        </RadialGradient>
        <RadialGradient id={id('rim')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.rim, lightEdge)} />
          <Stop offset="1" stopColor={withAlpha(world.rim, 0)} />
        </RadialGradient>
        <LinearGradient id={id('bust')} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={mix(world.plaster, world.walnut, 0.38)} />
          <Stop offset="0.55" stopColor={mix(world.walnut, world.shadow, 0.28)} />
          <Stop offset="1" stopColor={mix(world.walnut, world.shadow, 0.6)} />
        </LinearGradient>
      </Defs>

      {bust ? (
        <>
          <Rect x={BUST_REGION.x} y={BUST_REGION.y} width={BUST_REGION.w} height={BUST_REGION.h} fill={`url(#${id('bust')})`} />
          <Ellipse cx={CX + 7} cy={30} rx={30} ry={22} fill={`url(#${id('rim')})`} opacity={0.75} />
        </>
      ) : null}

      {/* What the figure does to the floor: a contact patch and a soft shadow
          thrown away from the key light. */}
      <Ellipse cx={CX} cy={GROUND + 0.4} rx={19} ry={4.6} fill={`url(#${id('ground')})`} />
      <Path
        d={smoothClosed([
          { x: CX - 5, y: GROUND - 1.4 },
          { x: CX - 17, y: GROUND + 1.6 },
          { x: CX - 15, y: GROUND + 4 },
          { x: CX + 3, y: GROUND + 3.6 },
        ])}
        fill={`url(#${id('ground')})`}
        opacity={0.7}
      />

      <G transform={`rotate(${build.spineLean * 0.4} ${CX} ${GROUND})`}>
        <HairBack build={build} colours={colours} id={id} style={look.hairstyle} />

        {([-1, 1] as const).map((side) => (
          <Leg key={`leg${side}`} build={build} colours={colours} id={id} side={side} />
        ))}
        {([-1, 1] as const).map((side) => (
          <Shoe key={`shoe${side}`} build={build} colours={colours} side={side} />
        ))}

        <Torso build={build} colours={colours} id={id} cut={cut} accent={outfit.accent} />

        {([-1, 1] as const).map((side) => (
          <Arm key={`arm${side}`} build={build} colours={colours} id={id} cut={cut} side={side} />
        ))}

        <Path d={neck} fill={`url(#${id('skin')})`} stroke={colours.contour} strokeWidth={0.8} />
        <Ellipse cx={CX} cy={chin + 3} rx={headHalf * 0.7} ry={2.8} fill={withAlpha(colours.skinDeep, 0.4)} />

        <G transform={`rotate(${build.headTilt} ${CX} ${chin})`}>
          {([-1, 1] as const).map((side) => (
            <Ellipse
              key={side}
              cx={CX + side * (headHalf - 0.4)}
              cy={eyeY + 0.6}
              rx={build.earRx}
              ry={build.earRy}
              fill={`url(#${id('skin')})`}
              stroke={withAlpha(colours.skinShade, 0.85)}
              strokeWidth={0.7}
            />
          ))}
          {([-1, 1] as const).map((side) => (
            <Path
              key={side}
              d={smoothOpen([
                { x: CX + side * (headHalf - 0.9), y: eyeY - 1 },
                { x: CX + side * (headHalf - 0.1), y: eyeY + 0.6 },
                { x: CX + side * (headHalf - 0.7), y: eyeY + 2.6 },
              ])}
              stroke={withAlpha(colours.skinShade, 0.7)}
              strokeWidth={0.6}
              fill="none"
            />
          ))}

          <Path d={skull} fill={`url(#${id('skin')})`} stroke={colours.contour} strokeWidth={0.9} />

          {withEyes ? <Eyes build={build} colours={colours} id={id} lid={mood.lid} open={mood.eyeOpen} /> : null}
          <Face build={build} colours={colours} id={id} mood={mood} />
          <HairFront build={build} colours={colours} id={id} style={look.hairstyle} />
          <Accessory build={build} colours={colours} kind={look.accessory} accent={outfit.accent} id={id} />

          <Path
            d={smoothOpen([
              { x: CX + headHalf * 0.9, y: headTop + headTall * 0.4 },
              { x: CX + headHalf * 0.99, y: eyeY + headTall * 0.2 },
              { x: CX + headHalf * 0.82, y: chin - headTall * 0.32 },
            ])}
            stroke={`url(#${id('rim')})`}
            strokeWidth={2.4}
            fill="none"
          />
        </G>

        {/* Rim light down the lit side of the body. */}
        <Path
          d={smoothOpen([
            { x: CX + shoulder - 0.6, y: shoulderY + 2 },
            { x: CX + waist + 1.6, y: hipY - 2 },
          ])}
          stroke={`url(#${id('rim')})`}
          strokeWidth={2.6}
          fill="none"
        />
        <Path
          d={smoothOpen([
            { x: CX + legSpread + build.ankle * 0.7, y: hipY + 4 },
            { x: CX + legSpread + 0.4 + build.ankle * 0.7, y: ankleY - 3 },
          ])}
          stroke={`url(#${id('rim')})`}
          strokeWidth={2.2}
          fill="none"
        />
      </G>
    </Svg>
  );
}

/** The eyes on their own, so the stage can blink them without a redraw. */
export function FigureEyes({ resident, width, height }: { resident: Resident; width: number; height: number }) {
  const look: Look = resident.look ?? FALLBACK_LOOK;
  const outfit = look.outfit ?? FALLBACK_LOOK.outfit;
  const mood = moodOf(resident);
  const build = buildOf(resident);
  const colours = materialsOf(look, outfit.top, outfit.bottom);
  const id = useMemo(() => {
    const prefix = `eye-${resident.id.replace(/[^a-zA-Z0-9]/g, '')}`;
    return (part: string) => `${prefix}-${part}`;
  }, [resident.id]);

  return (
    <Svg
      viewBox={`${EYE_REGION.x} ${EYE_REGION.y} ${EYE_REGION.width} ${EYE_REGION.height}`}
      width={width}
      height={height}
      style={styles.overlay}
    >
      <Defs>
        <LinearGradient id={id('iris')} x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={warmLight(look.eyes, 30, 0.26)} />
          <Stop offset="0.62" stopColor={look.eyes} />
          <Stop offset="1" stopColor={warmShade(look.eyes, -22, 0.3)} />
        </LinearGradient>
        <LinearGradient id={id('lid')} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={withAlpha(colours.skinShade, 0.95)} />
          <Stop offset="0.7" stopColor={withAlpha(colours.skinShade, 0.35)} />
          <Stop offset="1" stopColor={withAlpha(colours.skinShade, 0)} />
        </LinearGradient>
      </Defs>
      <Eyes build={build} colours={colours} id={id} lid={mood.lid} open={mood.eyeOpen} />
    </Svg>
  );
}

const styles = StyleSheet.create({ overlay: { pointerEvents: 'none' } });
