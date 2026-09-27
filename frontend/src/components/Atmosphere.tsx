/**
 * Atmosphere: everything between the room and the eye.
 *
 * A room lit by flat panels reads as a diagram. What makes it read as a place
 * is what happens in the air and at the edges:
 * - windows throw a real shaft of light across the boards, with the dust of the
 *   room drifting in it;
 * - the back wall is lived in (a framed print, a clock, a shelf, a chalkboard),
 *   so the eye has something to find behind the residents;
 * - a dark near band frames the bottom of the picture, so the scene has a front
 *   and a back instead of being one flat plane;
 * - one grade over the whole frame, keyed to the hour, ties sky, wall, floor and
 *   cast into a single photograph.
 *
 * All of it is warm: haze is amber, shade is brown, and the only thing allowed
 * to be cool on this screen is the Watcher's own instrument panel.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { world } from '../theme';
import { hashString, mix, warmLight, warmShade, withAlpha } from '../game/art';
import { usePrefs } from './ui';

/* ------------------------------------------------------------------ *
 * Light through the openings
 * ------------------------------------------------------------------ */

interface Opening {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The beam a window throws, and the pane of light it lands on.
 *
 * The beam starts at the sill and skews to the left as it falls, as if the sun
 * were high on the right, which is also where every resident is lit from.
 */
export function WindowLight({
  openings,
  wall,
  height,
  floorHeight,
  intensity,
  warmth,
}: {
  openings: Opening[];
  wall: { width: number; height: number };
  height: number;
  floorHeight: number;
  intensity: number;
  warmth: number;
}) {
  if (!openings.length || intensity < 0.34) return null;
  const alpha = 0.07 + intensity * 0.15;
  const skew = floorHeight * 0.34;

  return (
    <Svg width={wall.width} height={height} viewBox={`0 0 ${wall.width} ${height}`} style={styles.layer}>
      <Defs>
        <SvgGradient id="beam" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={withAlpha(world.glowSoft, alpha)} />
          <Stop offset="0.55" stopColor={withAlpha(world.glow, alpha * 0.5)} />
          <Stop offset="1" stopColor={withAlpha(world.glow, 0)} />
        </SvgGradient>
        <SvgGradient id="pane" x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={withAlpha(world.glowSoft, alpha * 1.5)} />
          <Stop offset="0.7" stopColor={withAlpha(world.glow, alpha * 0.6)} />
          <Stop offset="1" stopColor={withAlpha(world.glow, 0)} />
        </SvgGradient>
      </Defs>
      {openings.map((rect, index) => {
        const x0 = rect.x * wall.width;
        const x1 = (rect.x + rect.w) * wall.width;
        const sill = (rect.y + rect.h) * wall.height;
        const foot = wall.height + floorHeight;
        return (
          <G key={index}>
            <Path
              d={`M ${x0} ${sill} L ${x1} ${sill} L ${x1 - skew} ${foot} L ${x0 - skew * 1.3} ${foot} Z`}
              fill="url(#beam)"
            />
            <Path
              d={`M ${x0 - skew} ${foot} L ${x1 - skew} ${foot} L ${x1 - skew * 1.6} ${foot - floorHeight * 0.42} L ${x0 - skew * 1.9} ${foot - floorHeight * 0.42} Z`}
              fill="url(#pane)"
            />
          </G>
        );
      })}
      <Rect x={0} y={0} width={wall.width} height={height} fill={withAlpha(world.haze, warmth * 0.04)} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ *
 * Sun
 * ------------------------------------------------------------------ */

/**
 * The sun or the moon, with a real bloom and long rays at dusk.
 *
 * A flat disc with a grey ring around it is what makes a summer sky look like a
 * diagram. A radial bloom in three warm stops is what makes it look like light.
 */
export function SunBloom({
  x,
  y,
  size = 260,
  night,
  dusk,
  dawn,
}: {
  x: number;
  y: number;
  size?: number;
  night: boolean;
  dusk: boolean;
  dawn: boolean;
}) {
  const core = night ? '#EDE6D4' : world.glowSoft;
  const glow = night ? '#C9BBA4' : world.glow;
  const rays = dusk || dawn;
  const half = size / 2;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={[styles.layer, { left: x - half, top: y - half }]}
    >
      <Defs>
        <RadialGradient id="sunBloom" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(core, night ? 0.85 : 0.8)} />
          <Stop offset="0.16" stopColor={withAlpha(glow, 0.4)} />
          <Stop offset="0.46" stopColor={withAlpha(glow, 0.14)} />
          <Stop offset="1" stopColor={withAlpha(glow, 0)} />
        </RadialGradient>
        <SvgGradient id="sunRay" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={withAlpha(glow, 0.3)} />
          <Stop offset="1" stopColor={withAlpha(glow, 0)} />
        </SvgGradient>
        <SvgGradient id="sunRayUp" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={withAlpha(glow, 0.26)} />
          <Stop offset="1" stopColor={withAlpha(glow, 0)} />
        </SvgGradient>
      </Defs>
      {rays ? (
        <G>
          <Rect x={half} y={half - 15} width={half} height={30} fill="url(#sunRay)" />
          <Rect x={half} y={half - 7} width={half} height={14} fill="url(#sunRay)" />
          <Rect x={half - 13} y={4} width={26} height={half} fill="url(#sunRayUp)" />
        </G>
      ) : null}
      <Circle cx={half} cy={half} r={half} fill="url(#sunBloom)" />
      <Circle cx={half} cy={half} r={size * 0.07} fill={withAlpha(core, night ? 0.95 : 0.9)} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ *
 * Dust
 * ------------------------------------------------------------------ */

const MOTES: { x: number; y: number; size: number; amp: number; speed: number }[] = Array.from(
  { length: 16 },
  (_, index) => {
    const seed = hashString(`mote:${index}`);
    return {
      x: 0.05 + ((seed % 900) / 900) * 0.9,
      y: 0.16 + (((seed >> 9) % 640) / 640) * 0.7,
      size: 1.4 + ((seed >> 4) % 24) / 10,
      amp: 26 + ((seed >> 6) % 40),
      speed: 9000 + ((seed >> 8) % 60) * 160,
    };
  },
);

/** Dust in the room light: weightless, warm, and still under reduced motion. */
export function Dust({ width, height, intensity }: { width: number; height: number; intensity: number }) {
  const { reduceMotion } = usePrefs();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      drift.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, reduceMotion]);

  if (intensity < 0.3) return null;

  return (
    <View style={styles.layer}>
      {MOTES.map((mote, index) => (
        <Animated.View
          key={index}
          style={[
            styles.mote,
            {
              left: mote.x * width,
              top: mote.y * height,
              width: mote.size,
              height: mote.size,
              opacity: (0.16 + intensity * 0.24) * (index % 3 === 0 ? 1 : 0.6),
              transform: [
                {
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [mote.amp * 0.5, -mote.amp * 0.5],
                  }),
                },
                { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-mote.amp * 0.3, mote.amp * 0.3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * The near edge
 * ------------------------------------------------------------------ */

/**
 * A dark, close band at the bottom of the frame, with a leaf on one side and the
 * corner of a table on the other. Nothing in it is in focus: it exists to tell
 * the eye that the room continues past the bottom of the picture.
 */
export function ForegroundFrame({
  roomType,
  width,
  height,
  hour,
}: {
  roomType: string;
  width: number;
  height: number;
  hour: number;
}) {
  const band = Math.max(44, height * 0.12);
  const deep = mix(world.shadow, world.walnut, 0.34);
  const dark = withAlpha(world.shadow, 0.5);

  return (
    <View style={[styles.foreground, { height: band }]}>
      <Svg width={width} height={band} viewBox={`0 0 ${width} ${band}`} style={styles.layer}>
        <Defs>
          <SvgGradient id="nearFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={withAlpha(world.shadow, 0)} />
            <Stop offset="0.55" stopColor={withAlpha(deep, 0.3)} />
            <Stop offset="1" stopColor={withAlpha(deep, 0.62)} />
          </SvgGradient>
          <SvgGradient id="leaf" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={withAlpha(mix(world.sageDark, world.shadow, 0.42), 0.92)} />
            <Stop offset="1" stopColor={withAlpha(world.shadow, 0.95)} />
          </SvgGradient>
        </Defs>

        {/* The corner of a table, close to the glass, on the right. */}
        <Path d={`M ${width} ${band * 0.34} L ${width - 74} ${band * 0.5} L ${width - 54} ${band} L ${width} ${band} Z`} fill={withAlpha(mix(world.walnut, world.shadow, 0.3), 0.86)} />
        <Path d={`M ${width} ${band * 0.3} L ${width - 78} ${band * 0.46} L ${width - 70} ${band * 0.58} L ${width} ${band * 0.44} Z`} fill={withAlpha(warmLight(world.oak, 8, 0.2), 0.2)} />

        {/* Leaves, out of focus, on the left. */}
        <G>
          <Path d={`M -6 ${band} C ${width * 0.03} ${band * 0.7} ${width * 0.07} ${band * 0.38} ${width * 0.045} ${band * 0.1} C ${width * 0.1} ${band * 0.42} ${width * 0.13} ${band * 0.72} ${width * 0.08} ${band} Z`} fill="url(#leaf)" />
          <Path d={`M -8 ${band} C ${width * 0.01} ${band * 0.62} ${width * 0.02} ${band * 0.34} ${width * 0.012} ${band * 0.06} C ${width * 0.02} ${band * 0.4} ${width * 0.035} ${band * 0.7} ${width * 0.02} ${band} Z`} fill="url(#leaf)" opacity={0.85} />
        </G>

        {/* Whatever is nearest the glass, at the very bottom. */}          <Rect x={0} y={0} width={width} height={band} fill="url(#nearFade)" />
          {/* Kept light on purpose: the near plane frames the room, it does not
              become the picture. */}
        {roomType === 'beach' || roomType === 'market' ? (
          <G>
            <Path d={`M ${width * 0.3} ${band} C ${width * 0.34} ${band * 0.62} ${width * 0.42} ${band * 0.44} ${width * 0.52} ${band * 0.4} C ${width * 0.44} ${band * 0.58} ${width * 0.4} ${band * 0.78} ${width * 0.38} ${band} Z`} fill={withAlpha(world.shadow, 0.4)} />
            <Path d={`M ${width * 0.72} ${band} C ${width * 0.7} ${band * 0.7} ${width * 0.74} ${band * 0.5} ${width * 0.8} ${band * 0.42} C ${width * 0.78} ${band * 0.66} ${width * 0.82} ${band * 0.8} ${width * 0.84} ${band} Z`} fill={withAlpha(world.shadow, 0.34)} />
          </G>
        ) : null}
      </Svg>
      <LinearGradient
        colors={['transparent', withAlpha(deep, 0.2), withAlpha(deep, 0.44)]}
        locations={[0, 0.5, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
      <View style={[styles.nearShadow, { backgroundColor: dark, opacity: hour < 6 || hour >= 20 ? 0.22 : 0.12 }]} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * The grade
 * ------------------------------------------------------------------ */

/**
 * One grade over the whole frame, so the hour reaches the boards, the walls and
 * the cast at the same time. Night is deep brown, never blue: the world inside
 * the glass keeps its own temperature even after dark.
 */
export function HourGrade({ hour, height }: { hour: number; height: number }) {
  const night = hour < 6 || hour >= 20;
  const dusk = hour >= 17 && hour < 20;
  const dawn = hour >= 5 && hour < 8;

  const top = night
    ? withAlpha(world.shadow, 0.34)
    : dusk
      ? withAlpha(world.haze, 0.2)
      : dawn
        ? withAlpha(world.glow, 0.14)
        : withAlpha(world.rim, 0.06);
  const bottom = night ? withAlpha(world.shadow, 0.32) : withAlpha(world.shadow, dusk ? 0.22 : 0.12);
  const amber = night ? 0.09 : dusk ? 0.22 : dawn ? 0.17 : 0.05;

  return (
    <View style={[styles.layer, { pointerEvents: 'box-none' }]}>
      <LinearGradient
        colors={[top, 'transparent', bottom]}
        locations={[0, night ? 0.42 : 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[withAlpha(world.glow, amber), 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 0.9 }}
        style={[StyleSheet.absoluteFill, { height: height * 0.72 }]}
      />
      <LinearGradient
        colors={['transparent', withAlpha(world.shadow, night ? 0.26 : 0.14)]}
        start={{ x: 0.28, y: 0.1 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', withAlpha(world.shadow, night ? 0.26 : 0.14)]}
        start={{ x: 0.72, y: 0.1 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Wall dressing
 * ------------------------------------------------------------------ */

type DressingKind = 'image' | 'board' | 'clock' | 'shelf' | 'pipes' | 'banner' | 'panel' | 'sign' | 'pendant';

interface Dressing {
  kind: DressingKind;
  x: number;
  y: number;
  scale?: number;
}

/** What hangs on the wall of each room. Nothing here is generic filler. */
const DRESSING: Record<string, Dressing[]> = {
  cafe: [
    { kind: 'image', x: 0.36, y: 0.24, scale: 1.1 },
    { kind: 'board', x: 0.44, y: 0.52, scale: 0.9 },
    { kind: 'shelf', x: 0.84, y: 0.34 },
    { kind: 'pendant', x: 0.5, y: 0.02 },
  ],
  apartment: [
    { kind: 'image', x: 0.46, y: 0.26 },
    { kind: 'shelf', x: 0.78, y: 0.44, scale: 0.9 },
    { kind: 'pendant', x: 0.55, y: 0.02 },
  ],
  office: [
    { kind: 'clock', x: 0.5, y: 0.2 },
    { kind: 'board', x: 0.28, y: 0.46 },
    { kind: 'pipes', x: 0.06, y: 0.1 },
  ],
  school: [
    { kind: 'board', x: 0.42, y: 0.34, scale: 1.5 },
    { kind: 'image', x: 0.8, y: 0.3 },
    { kind: 'clock', x: 0.12, y: 0.16 },
  ],
  gym: [
    { kind: 'pipes', x: 0.14, y: 0.08 },
    { kind: 'sign', x: 0.5, y: 0.22 },
    { kind: 'board', x: 0.76, y: 0.44 },
  ],
  hospital: [
    { kind: 'clock', x: 0.5, y: 0.16 },
    { kind: 'board', x: 0.72, y: 0.44 },
    { kind: 'sign', x: 0.24, y: 0.22 },
  ],
  restaurant: [
    { kind: 'image', x: 0.3, y: 0.26 },
    { kind: 'shelf', x: 0.52, y: 0.36 },
    { kind: 'pendant', x: 0.62, y: 0.02 },
    { kind: 'pendant', x: 0.86, y: 0.02 },
  ],
  club: [
    { kind: 'pipes', x: 0.3, y: 0.06 },
    { kind: 'sign', x: 0.66, y: 0.18 },
  ],
  cinema: [
    { kind: 'image', x: 0.24, y: 0.26 },
    { kind: 'image', x: 0.76, y: 0.26 },
    { kind: 'sign', x: 0.5, y: 0.12, scale: 0.8 },
  ],
  museum: [
    { kind: 'panel', x: 0.14, y: 0.26 },
    { kind: 'panel', x: 0.86, y: 0.26 },
    { kind: 'banner', x: 0.5, y: 0.1 },
  ],
  temple: [
    { kind: 'banner', x: 0.5, y: 0.06 },
    { kind: 'panel', x: 0.2, y: 0.3, scale: 0.8 },
    { kind: 'panel', x: 0.8, y: 0.3, scale: 0.8 },
  ],
};

function DressingArt({ kind, trim, accent }: { kind: DressingKind; trim: string; accent: string }) {
  const frame = mix(world.brass, trim, 0.3);
  const frameDeep = warmShade(frame, -30, 0.34);
  const paper = warmLight(world.linen, 6, 0.2);

  switch (kind) {
    case 'image':
      return (
        <>
          <Rect x={-22} y={-16} width={44} height={32} rx={2} fill={frame} stroke={frameDeep} strokeWidth={1.4} />
          <Rect x={-17} y={-12} width={34} height={24} fill={mix(world.plaster, world.haze, 0.22)} />
          <Path d="M -17 6 L -4 -6 L 6 4 L 14 -4 L 17 2 L 17 12 L -17 12 Z" fill={withAlpha(world.sageDark, 0.6)} />
          <Circle cx={9} cy={-6} r={3.4} fill={withAlpha(world.glow, 0.8)} />
          <Rect x={-17} y={-12} width={34} height={24} fill="none" stroke={withAlpha(world.shadow, 0.3)} strokeWidth={0.8} />
        </>
      );
    case 'board':
      return (
        <>
          <Rect x={-30} y={-20} width={60} height={40} rx={3} fill={mix(world.walnut, world.shadow, 0.42)} stroke={frameDeep} strokeWidth={1.6} />
          <Path d="M -23 -10 L -4 -10" stroke={withAlpha(paper, 0.55)} strokeWidth={1.6} />
          <Path d="M -23 -4 L 6 -4" stroke={withAlpha(paper, 0.4)} strokeWidth={1.6} />
          <Path d="M -23 2 L 12 2" stroke={withAlpha(paper, 0.34)} strokeWidth={1.6} />
          <Path d="M -23 8 L -8 8" stroke={withAlpha(world.glow, 0.4)} strokeWidth={1.6} />
          <Rect x={-30} y={20} width={60} height={4} rx={2} fill={warmShade(world.oak, -18, 0.3)} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx={0} cy={0} r={17} fill={frame} stroke={frameDeep} strokeWidth={1.6} />
          <Circle cx={0} cy={0} r={13.4} fill={paper} />
          <Circle cx={0} cy={0} r={13.4} fill="none" stroke={withAlpha(world.shadow, 0.24)} strokeWidth={0.8} />
          <Path d="M 0 0 L 0 -8.6" stroke={withAlpha(world.shadow, 0.7)} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M 0 0 L 6 3.6" stroke={withAlpha(world.shadow, 0.7)} strokeWidth={1.3} strokeLinecap="round" />
          <Circle cx={0} cy={0} r={1.4} fill={world.brass} />
        </>
      );
    case 'shelf':
      return (
        <>
          <Rect x={-30} y={6} width={60} height={5} rx={1.6} fill={warmShade(world.oak, -8, 0.28)} stroke={warmShade(world.oak, -34, 0.34)} strokeWidth={0.8} />
          <Rect x={-30} y={11} width={60} height={2} fill={withAlpha(world.shadow, 0.28)} />
          {[
            { x: -22, w: 13, h: 11, tone: mix(world.terracotta, world.shadow, 0.2) },
            { x: -7, w: 9, h: 14, tone: mix(world.sage, world.shadow, 0.24) },
            { x: 4, w: 11, h: 9, tone: mix(world.brass, world.shadow, 0.2) },
            { x: 17, w: 8, h: 12, tone: mix(world.linen, world.shadow, 0.28) },
          ].map((jar, index) => (
            <Rect key={index} x={jar.x} y={6 - jar.h} width={jar.w} height={jar.h} rx={2} fill={jar.tone} stroke={withAlpha(world.shadow, 0.3)} strokeWidth={0.6} />
          ))}
          <Path d="M -30 5 L 30 5" stroke={withAlpha(world.rim, 0.32)} strokeWidth={1} />
        </>
      );
    case 'pipes':
      return (
        <>
          <Rect x={-40} y={-8} width={80} height={5} rx={2.4} fill={mix(world.brass, world.shadow, 0.4)} />
          <Rect x={-40} y={4} width={80} height={4} rx={2} fill={mix(world.brass, world.shadow, 0.5)} />
          <Circle cx={-22} cy={-5} r={3.4} fill={world.brassDark} />
          <Circle cx={12} cy={-5} r={3.4} fill={world.brassDark} />
        </>
      );
    case 'banner':
      return (
        <>
          <Path d="M -22 -26 L 22 -26 L 24 -6 C 12 -2 -12 -2 -24 -6 Z" fill={accent} stroke={warmShade(accent, -32, 0.34)} strokeWidth={0.9} />
          <Path d="M -24 -6 L -20 22 L 0 16 L 20 22 L 24 -6 C 12 -2 -12 -2 -24 -6 Z" fill={warmShade(accent, -14, 0.28)} stroke={warmShade(accent, -32, 0.34)} strokeWidth={0.9} />
          <Path d="M -14 4 C -6 10 6 10 14 4" stroke={withAlpha(world.brass, 0.7)} strokeWidth={2} fill="none" />
          <Circle cx={0} cy={12} r={4} fill={withAlpha(world.brass, 0.7)} />
        </>
      );
    case 'panel':
      return (
        <>
          <Rect x={-26} y={-22} width={52} height={44} rx={2} fill={mix(world.plaster, world.shadow, 0.24)} stroke={frameDeep} strokeWidth={2} />
          <Path d="M -14 -10 C -6 -16 6 -16 14 -10 C 6 -6 -6 -6 -14 -10 Z" fill={withAlpha(world.brass, 0.6)} />
          <Path d="M -12 2 C -6 -2 6 -2 12 2" stroke={withAlpha(world.sand, 0.5)} strokeWidth={1.4} fill="none" />
          <Path d="M -10 10 L 10 10" stroke={withAlpha(world.sand, 0.4)} strokeWidth={1.2} />
          <Ellipse cx={-16} cy={-24} rx={10} ry={4} fill={withAlpha(world.glow, 0.18)} />
        </>
      );
    case 'sign':
      return (
        <>
          <Rect x={-26} y={-12} width={52} height={24} rx={3} fill={warmShade(accent, -36, 0.34)} stroke={frame} strokeWidth={1.4} />
          <Rect x={-22} y={-8} width={44} height={16} rx={2} fill={withAlpha(world.glow, 0.34)} />
          <Path d="M -14 -1 L -6 -1 M 0 -6 L 0 5 M 6 -1 L 14 -1" stroke={withAlpha(world.glowSoft, 0.85)} strokeWidth={2.4} strokeLinecap="round" />
          <Ellipse cx={0} cy={0} rx={40} ry={22} fill={withAlpha(world.glow, 0.12)} />
        </>
      );
    case 'pendant':
    default:
      return null;
  }
}

/** A pendant lamp hanging from the ceiling, cord and all, lit. */
function Pendant({ trim, height }: { trim: string; height: number }) {
  return (
    <>
      <Rect x={-1.2} y={-height} width={2.4} height={height} fill={withAlpha(world.shadow, 0.7)} />
      <Path d="M -19 25 L 19 25 L 12 0 L -12 0 Z" fill={mix(trim, world.brass, 0.34)} stroke={world.brassDark} strokeWidth={1} />
      <Ellipse cx={0} cy={25} rx={19} ry={6} fill={warmLight(mix(trim, world.brass, 0.34), 18, 0.3)} stroke={world.brassDark} strokeWidth={0.8} />
      <Ellipse cx={0} cy={27} rx={17} ry={5} fill={withAlpha(world.glowSoft, 0.5)} />
      <Ellipse cx={0} cy={34} rx={44} ry={30} fill={withAlpha(world.glow, 0.16)} />
    </>
  );
}

/**
 * The wall behind the room: pictures, boards, pipes, a pendant or two. It is
 * drawn in one SVG over the wall so the wall itself keeps its material, and it
 * stops above the wainscot so it never competes with the furniture.
 */
export function WallDressing({
  roomType,
  wall,
  trim,
  accent,
}: {
  roomType: string;
  wall: { width: number; height: number };
  trim: string;
  accent: string;
}) {
  const items = DRESSING[roomType];
  if (!items?.length) return null;

  return (
    <Svg width={wall.width} height={wall.height * 0.66} viewBox={`0 0 ${wall.width} ${wall.height * 0.66}`} style={styles.layer}>
      {items.map((item, index) => (
        <G key={index} transform={`translate(${item.x * wall.width} ${item.y * wall.height}) scale(${item.scale ?? 1})`}>
          {item.kind === 'pendant' ? (
            <Pendant trim={trim} height={item.y * wall.height + 26} />
          ) : (
            <DressingArt kind={item.kind} trim={trim} accent={accent} />
          )}
        </G>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
  mote: { position: 'absolute', borderRadius: 4, backgroundColor: world.glowSoft },
  foreground: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  nearShadow: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },
});
