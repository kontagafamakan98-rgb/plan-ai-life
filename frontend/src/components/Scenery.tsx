/**
 * Scenery: the furniture and the plants, drawn as objects.
 *
 * Every prop is one vector drawing inside its own footprint, with its contact
 * shadow inside that footprint and its base on the bottom edge, so the stage can
 * drop it anywhere on the boards and it will sit on the floor without floating.
 *
 * Materials are the same everywhere: oak, walnut, brass, linen, terracotta,
 * sage. A shadow turns brown and a highlight turns cream, exactly like the cast,
 * because the whole point of the direction is that the world inside the glass
 * belongs to one place and one hour.
 */

import React, { useMemo } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { StyleSheet } from 'react-native';

import { world } from '../theme';
import { mix, warmLight, warmShade, withAlpha } from '../game/art';

/** Props never take a tap: the residents are the only thing you can press. */
const styles = StyleSheet.create({ overlay: { pointerEvents: 'none' } });

export type PropKind =
  | 'counter'
  | 'table'
  | 'plant'
  | 'tree'
  | 'machine'
  | 'screen'
  | 'mat'
  | 'lamp'
  | 'shelf'
  | 'bench'
  | 'water'
  | 'bed'
  | 'sofa'
  | 'desk'
  | 'altar'
  | 'stage'
  | 'stones';

/** Footprint of each prop, in sprite units, used for anchoring and shadows. */
export const PROP_BOX: Record<PropKind, { w: number; h: number }> = {
  counter: { w: 136, h: 96 },
  table: { w: 66, h: 46 },
  desk: { w: 80, h: 72 },
  bench: { w: 84, h: 48 },
  machine: { w: 48, h: 70 },
  screen: { w: 92, h: 66 },
  shelf: { w: 56, h: 92 },
  mat: { w: 96, h: 34 },
  plant: { w: 48, h: 60 },
  tree: { w: 104, h: 132 },
  lamp: { w: 44, h: 96 },
  water: { w: 190, h: 46 },
  bed: { w: 110, h: 66 },
  sofa: { w: 118, h: 68 },
  altar: { w: 74, h: 80 },
  stage: { w: 200, h: 100 },
  stones: { w: 68, h: 32 },
};

interface Props {
  kind: PropKind;
  accent: string;
  trim: string;
  /** Unique per instance, so two props never share a gradient id. */
  uid: string;
}

/** A tuft of grass, used where a plant meets the boards. */
function tuft(x: number, y: number, h: number, color: string, key: string) {
  return (
    <Path
      key={key}
      d={`M ${x} ${y} C ${x - 1.4} ${y - h * 0.6} ${x - 2.4} ${y - h * 0.85} ${x - 3.4} ${y - h} C ${x - 1.6} ${y - h * 0.7} ${x - 0.4} ${y - h * 0.5} ${x + 0.4} ${y} Z`}
      fill={color}
    />
  );
}

export function SceneryPropArt({ kind, accent, trim, uid }: Props) {
  const box = PROP_BOX[kind] ?? PROP_BOX.table;
  const w = box.w;
  const h = box.h;
  const id = useMemo(() => (part: string) => `${uid}-${part}`, [uid]);

  const wood = mix(world.oak, trim, 0.28);
  const woodDeep = warmShade(wood, -34, 0.34);
  const woodLit = warmLight(wood, 20, 0.24);
  const accentLit = warmLight(accent, 24, 0.28);
  const accentDeep = warmShade(accent, -38, 0.32);
  const brass = world.brass;
  const fabric = warmShade(accent, -12, 0.26);

  const ground = (
    <G>
      <Ellipse cx={w / 2} cy={h - 1.6} rx={w * 0.44} ry={h * 0.075 + 3} fill={`url(#${id('ground')})`} />
      <Ellipse cx={w / 2} cy={h - 2.4} rx={w * 0.24} ry={h * 0.035 + 1.6} fill={withAlpha(world.shadow, 0.3)} />
    </G>
  );

  const shell = (children: React.ReactNode) => (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={styles.overlay}>
      <Defs>
        <LinearGradient id={id('wood')} x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={woodDeep} />
          <Stop offset="0.42" stopColor={wood} />
          <Stop offset="1" stopColor={woodLit} />
        </LinearGradient>
        <LinearGradient id={id('top')} x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor={woodLit} />
          <Stop offset="0.6" stopColor={wood} />
          <Stop offset="1" stopColor={woodDeep} />
        </LinearGradient>
        <LinearGradient id={id('cloth')} x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={accentDeep} />
          <Stop offset="0.5" stopColor={fabric} />
          <Stop offset="1" stopColor={accentLit} />
        </LinearGradient>
        <LinearGradient id={id('brass')} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={warmLight(brass, 26, 0.3)} />
          <Stop offset="0.55" stopColor={brass} />
          <Stop offset="1" stopColor={world.brassDark} />
        </LinearGradient>
        <RadialGradient id={id('lit')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.glow, 0.62)} />
          <Stop offset="0.5" stopColor={withAlpha(world.glow, 0.22)} />
          <Stop offset="1" stopColor={withAlpha(world.glow, 0)} />
        </RadialGradient>
        <RadialGradient id={id('ground')} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.shadow, 0.38)} />
          <Stop offset="0.62" stopColor={withAlpha(world.shadow, 0.16)} />
          <Stop offset="1" stopColor={withAlpha(world.shadow, 0)} />
        </RadialGradient>
      </Defs>
      {children}
    </Svg>
  );

  switch (kind) {
    case 'counter':
      return shell(
        <>
          {ground}
          {/* Panelled front, seen slightly from above. */}
          <Path
            d={`M 6 ${h - 12} L ${w - 6} ${h - 12} L ${w - 2} ${h - 6} L 2 ${h - 6} Z`}
            fill={woodDeep}
          />
          <Rect x={6} y={26} width={w - 12} height={h - 38} rx={3} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.8} />
          {[0, 1, 2, 3].map((panel) => (
            <Rect
              key={panel}
              x={14 + panel * 30}
              y={34}
              width={22}
              height={h - 54}
              rx={2.4}
              fill={withAlpha(world.shadow, 0.16)}
              stroke={withAlpha(world.brass, 0.34)}
              strokeWidth={0.8}
            />
          ))}
          <Rect x={4} y={22} width={w - 8} height={9} rx={2.4} fill={`url(#${id('top')})`} stroke={woodDeep} strokeWidth={0.7} />
          <Path d={`M 6 24 L ${w - 6} 24`} stroke={withAlpha(world.rim, 0.4)} strokeWidth={1.6} />
          <Rect x={4} y={31} width={w - 8} height={2} fill={withAlpha(world.shadow, 0.35)} />
          <Rect x={10} y={16} width={w - 20} height={3} rx={1.4} fill={`url(#${id('brass')})`} />
          {/* What is on the counter: a cup, a jar, a folded cloth. */}
          <Path d={`M 26 22 L 38 22 L 36.5 10 C 35 8.6 29 8.6 27.5 10 Z`} fill={`url(#${id('cloth')})`} />
          <Ellipse cx={32} cy={10} rx={5.6} ry={1.8} fill={world.linen} stroke={withAlpha(world.shadow, 0.3)} strokeWidth={0.6} />
          <Rect x={96} y={4} width={12} height={18} rx={3} fill={`url(#${id('brass')})`} stroke={world.brassDark} strokeWidth={0.7} />
          <Rect x={98} y={1} width={8} height={4} rx={1.4} fill={world.brassDark} />
          <Ellipse cx={64} cy={22} rx={9} ry={3} fill={world.linen} opacity={0.9} />
          <Path d={`M 55 21 C 60 18 68 18 73 21`} stroke={withAlpha(world.shadow, 0.22)} strokeWidth={0.9} fill="none" />
        </>,
      );

    case 'table':
      return shell(
        <>
          {ground}
          <Ellipse cx={w / 2} cy={h - 6} rx={18} ry={5} fill={woodDeep} />
          <Path d={`M ${w / 2 - 5} 12 L ${w / 2 + 5} 12 L ${w / 2 + 7} ${h - 6} L ${w / 2 - 7} ${h - 6} Z`} fill={`url(#${id('wood')})`} />
          <Ellipse cx={w / 2} cy={h - 6} rx={17} ry={4.4} fill={woodDeep} stroke={withAlpha(world.rim, 0.14)} strokeWidth={0.7} />
          <Ellipse cx={w / 2} cy={13} rx={w / 2 - 1} ry={13} fill={`url(#${id('top')})`} stroke={woodDeep} strokeWidth={0.9} />
          <Ellipse cx={w / 2} cy={12} rx={w / 2 - 5} ry={9.6} fill={withAlpha(world.rim, 0.16)} />
          <Ellipse cx={w / 2 - 6} cy={9} rx={7} ry={3} fill={withAlpha(world.rim, 0.24)} />
          <Ellipse cx={w / 2} cy={13} rx={w / 2 - 3} ry={10.6} fill="none" stroke={withAlpha(world.shadow, 0.22)} strokeWidth={0.7} />
        </>,
      );

    case 'desk':
      return shell(
        <>
          {ground}
          <Rect x={6} y={20} width={w - 12} height={h - 34} rx={2} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.9} />
          {[0, 1].map((drawer) => (
            <G key={drawer}>
              <Rect x={12} y={30 + drawer * 20} width={w - 24} height={16} rx={2} fill={withAlpha(world.shadow, 0.18)} stroke={withAlpha(world.brass, 0.36)} strokeWidth={0.8} />
              <Rect x={w / 2 - 8} y={36.5 + drawer * 20} width={16} height={3} rx={1.5} fill={`url(#${id('brass')})`} />
            </G>
          ))}
          <Rect x={2} y={14} width={w - 4} height={8} rx={2} fill={`url(#${id('top')})`} stroke={woodDeep} strokeWidth={0.8} />
          <Path d={`M 4 16 L ${w - 4} 16`} stroke={withAlpha(world.rim, 0.38)} strokeWidth={1.4} />
          {/* A brass lamp and a sheet of paper, the two things a desk is for. */}
          <Path d={`M 16 ${76} L 22 ${76} L 22 26 L 16 26 Z`} fill={world.brassDark} />
          <Path d={`M 8 26 L 30 26 L 24 12 L 14 12 Z`} fill={`url(#${id('brass')})`} stroke={world.brassDark} strokeWidth={0.7} />
          <Ellipse cx={19} cy={28} rx={9} ry={4} fill={`url(#${id('lit')})`} />
          <Rect x={44} y={4} width={26} height={12} rx={1.4} fill={world.linen} stroke={withAlpha(world.shadow, 0.24)} strokeWidth={0.6} />
          <Path d={`M 47 8 L 67 8`} stroke={withAlpha(world.shadow, 0.24)} strokeWidth={0.8} />
          <Path d={`M 47 11 L 62 11`} stroke={withAlpha(world.shadow, 0.2)} strokeWidth={0.8} />
        </>,
      );

    case 'bench':
      return shell(
        <>
          {ground}
          {[10, 20, w - 24, w - 14].map((x, index) => (
            <Path
              key={index}
              d={`M ${x} 12 L ${x + 5} 12 L ${x + 3} ${h - 2} L ${x - 2} ${h - 2} Z`}
              fill={warmShade(trim, -18, 0.36)}
            />
          ))}
          <Rect x={4} y={10} width={w - 8} height={9} rx={2.6} fill={`url(#${id('top')})`} stroke={woodDeep} strokeWidth={0.8} />
          {[0, 1, 2].map((slat) => (
            <Path key={slat} d={`M 8 ${11 + slat * 3} L ${w - 8} ${11 + slat * 3}`} stroke={withAlpha(world.shadow, 0.24)} strokeWidth={0.7} />
          ))}
          <Path d={`M 6 11 L ${w - 6} 11`} stroke={withAlpha(world.rim, 0.35)} strokeWidth={1.3} />
        </>,
      );

    case 'machine':
      return shell(
        <>
          {ground}
          <Path d={`M ${w / 2 - 14} 12 L ${w / 2 + 14} 12 L ${w / 2 + 16} ${h - 4} L ${w / 2 - 16} ${h - 4} Z`} fill={warmShade(trim, -22, 0.34)} stroke={woodDeep} strokeWidth={0.8} />
          <Rect x={w / 2 - 10} y={18} width={20} height={10} rx={2} fill={`url(#${id('cloth')})`} />
          <Rect x={w / 2 - 7} y={34} width={14} height={4} rx={1.6} fill={brass} />
          {[0, 1, 2, 3].map((plate) => (
            <Rect key={plate} x={w / 2 - 12} y={44 + plate * 8} width={24} height={5} rx={1.4} fill={withAlpha(world.shadow, 0.3)} stroke={withAlpha(brass, 0.4)} strokeWidth={0.6} />
          ))}
          <Circle cx={w / 2} cy={30} r={5} fill={brass} stroke={world.brassDark} strokeWidth={0.8} />
          <Circle cx={w / 2} cy={30} r={2} fill={accentDeep} />
        </>,
      );

    case 'screen':
      return shell(
        <>
          {ground}
          <Path d={`M 4 2 L ${w - 4} 2 L ${w - 4} ${h - 10} L 4 ${h - 10} Z`} fill={warmShade(trim, -40, 0.34)} stroke={woodDeep} strokeWidth={0.9} />
          <Path d={`M 9 6 L ${w - 9} 6 L ${w - 9} ${h - 14} L 9 ${h - 14} Z`} fill={`url(#${id('cloth')})`} />
          <Path d={`M 9 6 L ${w - 9} 6 L ${w - 9} ${h - 14} L 9 ${h - 14} Z`} fill={withAlpha(world.rim, 0.16)} />
          <Ellipse cx={w / 2} cy={h - 22} rx={w * 0.5} ry={16} fill={`url(#${id('lit')})`} opacity={0.7} />
          <Path d={`M 20 ${h - 6} L ${w - 20} ${h - 6}`} stroke={withAlpha(world.shadow, 0.5)} strokeWidth={1.4} />
        </>,
      );

    case 'shelf':
      return shell(
        <>
          {ground}
          <Rect x={3} y={2} width={w - 6} height={h - 4} rx={2.4} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.9} />
          {[0, 1, 2].map((shelf) => {
            const y = 8 + shelf * (h / 3.4);
            return (
              <G key={shelf}>
                <Rect x={6} y={y + h / 4.4} width={w - 12} height={3.4} rx={1.2} fill={woodDeep} />
                {[0, 1, 2, 3, 4].map((book) => {
                  const bh = 16 + ((book * 7 + shelf * 5) % 9);
                  const bw = 5 + ((book * 3) % 3);
                  const tone = [accent, world.sage, world.terracotta, world.brass, world.walnut][(book + shelf) % 5];
                  return (
                    <Rect
                      key={book}
                      x={9 + book * 8}
                      y={y + h / 4.4 - bh}
                      width={bw}
                      height={bh}
                      rx={0.8}
                      fill={tone}
                      stroke={withAlpha(world.shadow, 0.28)}
                      strokeWidth={0.5}
                    />
                  );
                })}
              </G>
            );
          })}
          <Path d={`M 5 3 L ${w - 5} 3`} stroke={withAlpha(world.rim, 0.3)} strokeWidth={1.2} />
        </>,
      );

    case 'mat':
      return shell(
        <>
          {ground}
          <Path
            d={`M 4 ${h - 12} C 10 ${h - 24} 20 ${h - 24} 30 ${h - 16} L ${w - 6} ${h - 12} C ${w - 2} ${h - 6} 20 ${h - 4} 8 ${h - 6} Z`}
            fill={`url(#${id('cloth')})`}
            stroke={accentDeep}
            strokeWidth={0.8}
          />
          <Ellipse cx={14} cy={h - 14} rx={11} ry={8} fill={`url(#${id('cloth')})`} stroke={accentDeep} strokeWidth={0.8} />
          <Ellipse cx={14} cy={h - 14} rx={5.4} ry={3.8} fill={withAlpha(world.rim, 0.24)} />
          {[0, 1, 2].map((stripe) => (
            <Path
              key={stripe}
              d={`M ${40 + stripe * 18} ${h - 15} C ${44 + stripe * 18} ${h - 18} ${52 + stripe * 18} ${h - 18} ${58 + stripe * 18} ${h - 14}`}
              stroke={withAlpha(world.rim, 0.22)}
              strokeWidth={1.6}
              fill="none"
            />
          ))}
        </>,
      );

    case 'plant': {
      const potTop = h - 22;
      return shell(
        <>
          {ground}
          <Path d={`M ${w / 2 - 15} ${potTop} L ${w / 2 + 15} ${potTop} L ${w / 2 + 11} ${h - 3} L ${w / 2 - 11} ${h - 3} Z`} fill={`url(#${id('cloth')})`} stroke={accentDeep} strokeWidth={0.9} />
          <Rect x={w / 2 - 17} y={potTop - 5} width={34} height={6} rx={2} fill={warmShade(accent, -6, 0.26)} stroke={accentDeep} strokeWidth={0.8} />
          <Ellipse cx={w / 2} cy={potTop - 5} rx={16} ry={4.4} fill={world.walnut} />
          {[
            { dx: 0, dy: -8, len: 34, bend: -7 },
            { dx: -6, dy: -4, len: 28, bend: -12 },
            { dx: 7, dy: -3, len: 26, bend: 11 },
            { dx: -11, dy: 2, len: 20, bend: -16 },
            { dx: 12, dy: 3, len: 19, bend: 15 },
          ].map((leaf, index) => {
            const x = w / 2 + leaf.dx;
            const y = potTop + leaf.dy;
            return (
              <Path
                key={index}
                d={`M ${x} ${y} C ${x + leaf.bend * 0.4} ${y - leaf.len * 0.4} ${x + leaf.bend} ${y - leaf.len * 0.75} ${x + leaf.bend * 0.6} ${y - leaf.len} C ${x + leaf.bend * 0.1} ${y - leaf.len * 0.7} ${x + 0.6} ${y - leaf.len * 0.35} ${x} ${y} Z`}
                fill={index % 2 ? world.sage : warmLight(world.sageDark, 12, 0.24)}
                stroke={withAlpha(world.sageDark, 0.6)}
                strokeWidth={0.6}
              />
            );
          })}
        </>,
      );
    }

    case 'tree':
      return shell(
        <>
          {ground}
          <Path d={`M ${w / 2 - 9} ${h - 4} C ${w / 2 - 7} ${h - 30} ${w / 2 - 6} ${h - 52} ${w / 2 - 4} ${h - 74} L ${w / 2 + 4} ${h - 74} C ${w / 2 + 6} ${h - 52} ${w / 2 + 7} ${h - 30} ${w / 2 + 9} ${h - 4} Z`} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.8} />
          <Path d={`M ${w / 2 - 2} ${h - 74} C ${w / 2 - 14} ${h - 84} ${w / 2 - 22} ${h - 88} ${w / 2 - 28} ${h - 92}`} stroke={woodDeep} strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <Path d={`M ${w / 2 + 2} ${h - 74} C ${w / 2 + 14} ${h - 84} ${w / 2 + 22} ${h - 90} ${w / 2 + 26} ${h - 96}`} stroke={woodDeep} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          {[
            { cx: w / 2, cy: h - 96, rx: 34, ry: 26 },
            { cx: w / 2 - 24, cy: h - 84, rx: 24, ry: 18 },
            { cx: w / 2 + 26, cy: h - 88, rx: 22, ry: 17 },
          ].map((crown, index) => (
            <G key={index}>
              <Path
                d={`M ${crown.cx - crown.rx} ${crown.cy + crown.ry * 0.2} C ${crown.cx - crown.rx * 1.1} ${crown.cy - crown.ry} ${crown.cx + crown.rx * 1.1} ${crown.cy - crown.ry} ${crown.cx + crown.rx} ${crown.cy + crown.ry * 0.2} C ${crown.cx + crown.rx * 0.6} ${crown.cy + crown.ry} ${crown.cx - crown.rx * 0.6} ${crown.cy + crown.ry} ${crown.cx - crown.rx} ${crown.cy + crown.ry * 0.2} Z`}
                fill={index === 0 ? world.sage : mix(world.sageDark, world.shadow, 0.14)}
                stroke={withAlpha(world.sageDark, 0.6)}
                strokeWidth={0.7}
              />
              <Path
                d={`M ${crown.cx - crown.rx * 0.6} ${crown.cy - crown.ry * 0.4} C ${crown.cx - crown.rx * 0.1} ${crown.cy - crown.ry * 0.9} ${crown.cx + crown.rx * 0.4} ${crown.cy - crown.ry * 0.8} ${crown.cx + crown.rx * 0.7} ${crown.cy - crown.ry * 0.3}`}
                stroke={withAlpha(warmLight(world.sage, 26, 0.3), 0.45)}
                strokeWidth={1.6}
                fill="none"
              />
            </G>
          ))}
          {[0, 1, 2, 3].map((blade) => tuft(w / 2 - 16 + blade * 11, h - 4, 7 + (blade % 2) * 3, withAlpha(world.sageDark, 0.6), `t${blade}`))}
        </>,
      );

    case 'lamp':
      return shell(
        <>
          {ground}
          <Ellipse cx={w / 2} cy={h - 4} rx={16} ry={4.4} fill={woodDeep} />
          <Rect x={w / 2 - 1.6} y={20} width={3.2} height={h - 24} fill={`url(#${id('brass')})`} />
          <Path d={`M ${w / 2 - 16} 20 L ${w / 2 + 16} 20 L ${w / 2 + 11} 2 L ${w / 2 - 11} 2 Z`} fill={`url(#${id('cloth')})`} stroke={accentDeep} strokeWidth={0.8} />
          <Ellipse cx={w / 2} cy={20} rx={16} ry={5} fill={warmLight(accent, 18, 0.3)} stroke={accentDeep} strokeWidth={0.7} />
          <Ellipse cx={w / 2} cy={21} rx={22} ry={16} fill={`url(#${id('lit')})`} />
          <Ellipse cx={w / 2} cy={h - 4} rx={26} ry={7} fill={`url(#${id('lit')})`} opacity={0.5} />
        </>,
      );

    case 'water':
      return shell(
        <>
          <Path d={`M 2 ${h - 16} C ${w * 0.25} ${h - 26} ${w * 0.6} ${h - 12} ${w - 2} ${h - 20} L ${w - 2} ${h - 4} L 2 ${h - 4} Z`} fill={mix(world.sage, world.walnut, 0.42)} opacity={0.9} />
          <Path d={`M 2 ${h - 16} C ${w * 0.25} ${h - 26} ${w * 0.6} ${h - 12} ${w - 2} ${h - 20}`} stroke={withAlpha(world.rim, 0.5)} strokeWidth={1.6} fill="none" />
          {[0.18, 0.42, 0.68, 0.86].map((x, index) => (
            <Path
              key={index}
              d={`M ${w * x} ${h - 12 - index * 1.6} C ${w * x + 10} ${h - 16 - index * 1.6} ${w * x + 18} ${h - 16 - index * 1.6} ${w * x + 26} ${h - 11 - index * 1.6}`}
              stroke={withAlpha(world.linen, 0.45)}
              strokeWidth={1.2}
              fill="none"
            />
          ))}
        </>,
      );

    case 'bed':
      return shell(
        <>
          {ground}
          <Rect x={4} y={10} width={11} height={h - 16} rx={3} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.8} />
          <Rect x={4} y={h - 12} width={w - 8} height={8} rx={2} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.8} />
          <Rect x={12} y={h - 26} width={w - 20} height={16} rx={4} fill={`url(#${id('cloth')})`} stroke={accentDeep} strokeWidth={0.8} />
          <Path d={`M ${w - 16} ${h - 26} C ${w * 0.62} ${h - 34} ${w * 0.5} ${h - 32} ${w * 0.42} ${h - 24}`} fill={warmShade(accent, -6, 0.24)} stroke={accentDeep} strokeWidth={0.7} />
          <Ellipse cx={w * 0.3} cy={h - 30} rx={17} ry={8} fill={world.linen} stroke={withAlpha(world.shadow, 0.26)} strokeWidth={0.7} />
          <Ellipse cx={w * 0.3} cy={h - 31} rx={12} ry={5} fill={withAlpha(world.rim, 0.4)} />
          <Path d={`M 16 ${h - 20} L ${w - 22} ${h - 20}`} stroke={withAlpha(world.shadow, 0.2)} strokeWidth={1} />
          <Path d={`M 16 ${h - 16} L ${w - 22} ${h - 16}`} stroke={withAlpha(world.rim, 0.18)} strokeWidth={0.9} />
        </>,
      );

    case 'sofa':
      return shell(
        <>
          {ground}
          {[8, w - 14].map((x, index) => (
            <Rect key={index} x={x} y={h - 10} width={6} height={7} rx={2} fill={woodDeep} />
          ))}
          <Path d={`M 4 ${h - 22} C 4 ${h - 40} 14 ${h - 46} 26 ${h - 46} L ${w - 26} ${h - 46} C ${w - 14} ${h - 46} ${w - 4} ${h - 40} ${w - 4} ${h - 22} Z`} fill={`url(#${id('cloth')})`} stroke={accentDeep} strokeWidth={0.9} />
          <Rect x={10} y={h - 34} width={w - 20} height={14} rx={5} fill={warmShade(accent, -18, 0.28)} stroke={accentDeep} strokeWidth={0.8} />
          <Path d={`M ${w / 2} ${h - 34} L ${w / 2} ${h - 20}`} stroke={accentDeep} strokeWidth={1} />
          <Path d={`M 14 ${h - 44} C ${w / 2} ${h - 50} ${w - 14} ${h - 44} ${w - 8} ${h - 34}`} stroke={withAlpha(world.rim, 0.3)} strokeWidth={1.6} fill="none" />
          <Rect x={4} y={h - 30} width={12} height={18} rx={5} fill={warmShade(accent, -26, 0.3)} stroke={accentDeep} strokeWidth={0.8} />
          <Rect x={w - 16} y={h - 30} width={12} height={18} rx={5} fill={warmShade(accent, -26, 0.3)} stroke={accentDeep} strokeWidth={0.8} />
          <Ellipse cx={w / 2} cy={h - 12} rx={w * 0.36} ry={5} fill={`url(#${id('ground')})`} />
        </>,
      );

    case 'altar':
      return shell(
        <>
          {ground}
          <Path d={`M 6 ${h - 4} L ${w - 6} ${h - 4} L ${w - 12} 52 L 12 52 Z`} fill={warmShade(trim, -30, 0.36)} stroke={withAlpha(world.shadow, 0.4)} strokeWidth={0.8} />
          <Rect x={2} y={42} width={w - 4} height={12} rx={2.4} fill={`url(#${id('top')})`} stroke={woodDeep} strokeWidth={0.8} />
          <Path d={`M 6 44 L ${w - 6} 44`} stroke={withAlpha(world.rim, 0.4)} strokeWidth={1.6} />
          {[0, 1, 2].map((mark) => (
            <Path key={mark} d={`M ${18 + mark * 16} ${h - 12} L ${18 + mark * 16} ${h - 22}`} stroke={withAlpha(world.brass, 0.5)} strokeWidth={1.4} />
          ))}
          <Path d={`M ${w / 2 - 8} 42 L ${w / 2 + 8} 42 L ${w / 2 + 5} 26 C ${w / 2 + 2} 22 ${w / 2 - 2} 22 ${w / 2 - 5} 26 Z`} fill={`url(#${id('brass')})`} stroke={world.brassDark} strokeWidth={0.8} />
          <Ellipse cx={w / 2} cy={26} rx={9} ry={7} fill={`url(#${id('lit')})`} />
          <Path d={`M ${w / 2} 24 C ${w / 2 - 2} 16 ${w / 2 + 2} 12 ${w / 2} 6 C ${w / 2 - 2} 12 ${w / 2 - 4} 18 ${w / 2} 24 Z`} fill={withAlpha(world.glow, 0.85)} />
        </>,
      );

    case 'stage':
      return shell(
        <>
          {ground}
          <Path d={`M 2 ${h - 12} L ${w - 2} ${h - 12} L ${w - 6} ${h - 2} L 6 ${h - 2} Z`} fill={warmShade(trim, -44, 0.34)} />
          <Rect x={4} y={h - 34} width={w - 8} height={24} rx={3} fill={`url(#${id('wood')})`} stroke={woodDeep} strokeWidth={0.9} />
          <Rect x={4} y={h - 36} width={w - 8} height={6} rx={2} fill={`url(#${id('top')})`} />
          {[0.16, 0.5, 0.84].map((x, index) => (
            <G key={index}>
              <Ellipse cx={w * x} cy={16} rx={16} ry={13} fill={`url(#${id('lit')})`} />
              <Path d={`M ${w * x - 4} 4 L ${w * x + 4} 4 L ${w * x + 7} 12 L ${w * x - 7} 12 Z`} fill={warmShade(trim, -30, 0.3)} stroke={world.brassDark} strokeWidth={0.6} />
              <Path d={`M ${w * x - 3} 12 L ${w * x + 3} 12 L ${w * x + 20} ${h - 38} L ${w * x - 20} ${h - 38} Z`} fill={withAlpha(world.glow, 0.14)} />
            </G>
          ))}
          {[14, w - 30].map((x, index) => (
            <Rect key={index} x={x} y={h - 60} width={16} height={28} rx={2.4} fill={`url(#${id('cloth')})`} stroke={accentDeep} strokeWidth={0.8} />
          ))}
        </>,
      );

    case 'stones':
      return shell(
        <>
          {ground}
          {[
            { cx: 18, cy: h - 10, rx: 16, ry: 10 },
            { cx: 42, cy: h - 13, rx: 13, ry: 12 },
            { cx: 58, cy: h - 8, rx: 9, ry: 7 },
          ].map((rock, index) => (
            <G key={index}>
              <Path
                d={`M ${rock.cx - rock.rx} ${rock.cy + rock.ry * 0.4} C ${rock.cx - rock.rx * 1.05} ${rock.cy - rock.ry * 0.5} ${rock.cx - rock.rx * 0.5} ${rock.cy - rock.ry} ${rock.cx} ${rock.cy - rock.ry * 0.9} C ${rock.cx + rock.rx * 0.6} ${rock.cy - rock.ry} ${rock.cx + rock.rx} ${rock.cy - rock.ry * 0.4} ${rock.cx + rock.rx} ${rock.cy + rock.ry * 0.4} C ${rock.cx + rock.rx * 0.4} ${rock.cy + rock.ry * 0.9} ${rock.cx - rock.rx * 0.4} ${rock.cy + rock.ry * 0.9} ${rock.cx - rock.rx} ${rock.cy + rock.ry * 0.4} Z`}
                fill={mix(warmShade(trim, -22, 0.32), world.sand, 0.34)}
                stroke={withAlpha(world.shadow, 0.34)}
                strokeWidth={0.8}
              />
              <Path
                d={`M ${rock.cx - rock.rx * 0.5} ${rock.cy - rock.ry * 0.3} C ${rock.cx - rock.rx * 0.1} ${rock.cy - rock.ry * 0.8} ${rock.cx + rock.rx * 0.3} ${rock.cy - rock.ry * 0.7} ${rock.cx + rock.rx * 0.55} ${rock.cy - rock.ry * 0.2}`}
                stroke={withAlpha(warmLight(world.sand, 24, 0.3), 0.5)}
                strokeWidth={1.3}
                fill="none"
              />
            </G>
          ))}
        </>,
      );

    default:
      return null;
  }
}
