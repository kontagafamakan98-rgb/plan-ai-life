/**
 * Stage: the place the Watcher is looking at right now.
 *
 * Layers, back to front: ceiling hint, plaster wall with its windows and
 * wainscot, skirting, plank floor with light pools, scenery, residents
 * (depth-sorted), room light wash, interface overlays. Parks, beaches, the
 * market and the mountain get a real sky and a horizon instead of a wall.
 *
 * Art direction: the interface is cold, the world inside the glass is warm.
 * Every material has a name (plaster, oak, walnut, brass, linen, terracotta,
 * sage) and every shadow is pulled toward brown by the helpers in game/art.ts,
 * so nothing on this screen ever turns grey or blue except the Watcher's own
 * instruments.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';

import {
  defaultRoom,
  palette,
  radius,
  roomPalette,
  skyGradient,
  space,
  type as typeTokens,
  world,  } from '../theme';
import { ambientLight, mix, warmLight, warmShade, withAlpha } from '../game/art';
import type { LocationView, Resident } from '../game/types';
import { glyph } from '../game/icons';
import { useI18n } from '../game/i18n';
import { Icon } from './Icon';
import { usePrefs } from './ui';
import { PROP_BOX, SceneryPropArt } from './Scenery';
import { Dust, ForegroundFrame, HourGrade, SunBloom, Vignette, WallDressing } from './Atmosphere';
import { Room, depthScaleAt, floorXAt, floorYAt, geometryOf } from './Room';
import { stationsOf, type Station } from '../game/stations';
import { useCirculation } from './useCirculation';
import { Walker } from './Walker';


/** Rooms the Watcher sees from outside: sky and horizon instead of a wall. */
const OUTDOOR = new Set(['park', 'beach', 'mountain', 'market']);

/** Windows, as fractions of the wall. Interior rooms only. */
interface Opening {
  x: number;
  y: number;
  w: number;
  h: number;
}

const WINDOWS: Record<string, Opening[]> = {
  cafe: [
    { x: 0.05, y: 0.14, w: 0.3, h: 0.42 },
    { x: 0.66, y: 0.14, w: 0.28, h: 0.42 },
  ],
  apartment: [{ x: 0.1, y: 0.16, w: 0.28, h: 0.38 }],
  office: [
    { x: 0.04, y: 0.12, w: 0.36, h: 0.36 },
    { x: 0.62, y: 0.12, w: 0.32, h: 0.36 },
  ],
  restaurant: [{ x: 0.07, y: 0.16, w: 0.26, h: 0.36 }],
  school: [
    { x: 0.08, y: 0.12, w: 0.26, h: 0.36 },
    { x: 0.66, y: 0.12, w: 0.26, h: 0.36 },
  ],
  hospital: [{ x: 0.07, y: 0.12, w: 0.32, h: 0.36 }],
  gym: [{ x: 0.06, y: 0.16, w: 0.3, h: 0.34 }],
  museum: [
    { x: 0.28, y: 0.06, w: 0.16, h: 0.5 },
    { x: 0.56, y: 0.06, w: 0.16, h: 0.5 },
  ],
  temple: [{ x: 0.42, y: 0.04, w: 0.16, h: 0.52 }],
  club: [],
  cinema: [],
};

/** Rooms with no daylight: brass sconces along the wall, at these x fractions. */
const SCONCES: Record<string, number[]> = {
  club: [0.16, 0.5, 0.84],
  cinema: [0.12, 0.88],
  temple: [0.18, 0.82],
  museum: [0.14, 0.46, 0.86],
};

/** Plaster mottling: the wall is not one flat tone, but it never becomes noise. */
const PLASTER: { x: number; y: number; w: number; h: number; o: number }[] = [
  { x: 0.04, y: 0.34, w: 0.3, h: 0.3, o: 0.1 },
  { x: 0.44, y: 0.2, w: 0.36, h: 0.24, o: 0.07 },
  { x: 0.72, y: 0.44, w: 0.26, h: 0.26, o: 0.09 },
  { x: 0.24, y: 0.66, w: 0.28, h: 0.2, o: 0.07 },
];

type GroundKind = 'grass' | 'sand' | 'rock' | 'cobble';

const GROUND_OF: Record<string, GroundKind> = {
  park: 'grass',
  beach: 'sand',
  mountain: 'rock',
  market: 'cobble',
};

const STARS: { top: number; left: DimensionValue; size: number }[] = [
  { top: 14, left: '10%', size: 2 },
  { top: 30, left: '32%', size: 1.4 },
  { top: 12, left: '58%', size: 2.4 },
  { top: 38, left: '78%', size: 1.6 },
  { top: 52, left: '22%', size: 1.2 },
  { top: 24, left: '90%', size: 1.8 },
];

const CLOUDS: { top: number; left: DimensionValue; width: number; o: number }[] = [
  { top: 16, left: '6%', width: 72, o: 0.5 },
  { top: 34, left: '44%', width: 52, o: 0.4 },
  { top: 10, left: '70%', width: 44, o: 0.44 },
  { top: 46, left: '18%', width: 38, o: 0.3 },
];

const BIRDS: { top: number; left: DimensionValue; tilt: number }[] = [
  { top: 26, left: '30%', tilt: -8 },
  { top: 20, left: '38%', tilt: 6 },
  { top: 36, left: '64%', tilt: -4 },
];

/* ------------------------------------------------------------------ *
 * Wall
 * ------------------------------------------------------------------ */

/**
 * One window: a wooden frame, the sky seen through it, and the warm spill it
 * throws on the room. The glass shows the real hour, so a late cycle looks out
 * on a night city instead of a flat pane.
 */
function Window({
  rect,
  wall,
  sky,
  trim,
  night,
  hour,
}: {
  rect: Opening;
  wall: { width: number; height: number };
  sky: [string, string, ...string[]];
  trim: string;
  night: boolean;
  hour: number;
}) {
  const width = rect.w * wall.width;
  const height = rect.h * wall.height;
  const frameLit = warmLight(trim, 22, 0.24);
  const frameDeep = warmShade(trim, -18, 0.3);
  const dusk = hour >= 17 && hour < 20;
  /**
   * What the glass shows. The sky of the hour, pulled toward the room: a pane
   * of cold blue in the middle of a warm room reads as a hole, not as a window.
   */
  const glass = sky.map((tone) => mix(tone, world.glowSoft, 0.1));

  return (
    <View
      style={[
        styles.windowBox,
        {
          left: rect.x * wall.width,
          top: rect.y * wall.height,
          width,
          height: height + 8,
        },
      , { pointerEvents: 'none' }]}
    >
      <View
        style={[
          styles.windowFrame,
          { borderColor: frameDeep, backgroundColor: frameLit },
        ]}
      >
        <LinearGradient
          colors={glass as [string, string, ...string[]]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.windowGlass}
        >
          {night ? (
            <View style={styles.windowLights}>
              {[0.22, 0.46, 0.74].map((x, index) => (
                <View
                  key={x}
                  style={[
                    styles.cityLight,
                    {
                      left: `${x * 100}%`,
                      backgroundColor: withAlpha(world.glow, index === 1 ? 0.85 : 0.6),
                      top: index === 1 ? 8 : 14,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
          {dusk ? (
            <View style={[styles.windowBloom, { backgroundColor: withAlpha(world.glow, 0.3) }]} />
          ) : null}
          <View style={[styles.mullion, { backgroundColor: frameLit, left: width / 2 - 9 }]} />
          <View
            style={[
              styles.transom,
              { backgroundColor: frameLit, top: height * 0.3, width: width - 10 },
            ]}
          />
          <View style={[styles.glassSheen, { backgroundColor: withAlpha(world.rim, 0.14) }]} />
        </LinearGradient>
      </View>
      <View style={[styles.windowSill, { backgroundColor: warmLight(trim, 12, 0.2) }]}>
        <View style={[styles.windowSillShade, { backgroundColor: withAlpha(frameDeep, 0.5) }]} />
      </View>
    </View>
  );
}

/** Sconce: a brass plate with a lit shade, for rooms with no daylight. */
function Sconce({ x, wall }: { x: number; wall: { width: number; height: number } }) {
  return (
    <View
      style={[styles.sconce, { left: x * wall.width - 9, top: wall.height * 0.3 }, { pointerEvents: 'none' }]}
    >
      <View style={[styles.sconceGlow, { backgroundColor: withAlpha(world.glow, 0.3) }]} />
      <View style={[styles.sconceArm, { backgroundColor: world.brassDark }]} />
      <View style={[styles.sconceShade, { backgroundColor: world.brass }]}>
        <View style={[styles.sconceBulb, { backgroundColor: world.glowSoft }]} />
      </View>
    </View>
  );
}

/**
 * The back wall of an interior: plaster without windows that face the sky,
 * painted plaster above a wooden wainscot, a chair rail, and the warm light the
 * openings and the sconces throw across it.
 */
function Wall({
  roomType,
  room,
  wall,
  sky,
  hour,
}: {
  roomType: string;
  room: { wall: [string, string]; accent: string; trim: string };
  wall: { width: number; height: number };
  sky: [string, string, ...string[]];
  hour: number;
}) {
  const night = hour < 6 || hour >= 20;
  const windows = WINDOWS[roomType] ?? [];
  // No daylight means lamps on the wall, so no room is ever left unlit.
  const sconces = windows.length ? [] : SCONCES[roomType] ?? [0.24, 0.76];
  const ambient = ambientLight(hour);
  /**
   * The wall in daylight: the plaster takes the light of the openings, so it is
   * the brightest plane of the room, and only its lower third and the corner
   * under the ceiling keep a shade. The same values as the shell in Room.tsx,
   * or the back wall reads as a hole cut into it.
   */
  const plaster = mix(room.wall[0], world.plaster, 0.58);
  const plasterLow = mix(room.wall[0], world.plaster, 0.3);
  const wainscot = mix(world.wainscot, room.accent, 0.14);
  const rail = warmLight(wainscot, 30, 0.26);
  const ceiling = mix(room.wall[1], world.plaster, 0.34);

  return (
    <View style={[styles.wall, { height: wall.height }]}>
      {/* Painted plaster, lit from above. */}
      <View style={[styles.plasterField, { backgroundColor: plaster }]} />
      <LinearGradient
        colors={[withAlpha(world.glowSoft, 0.06 + ambient.intensity * 0.1), 'transparent', withAlpha(plasterLow, 0.34)]}
        locations={[0, 0.42, 1]}
        style={[styles.plasterField, { pointerEvents: 'none' }]}
      />
      {PLASTER.map((patch, index) => (
        <View
          key={index}
          style={[
            styles.plasterPatch,
            {
              left: patch.x * wall.width,
              top: patch.y * wall.height,
              width: patch.w * wall.width,
              height: patch.h * wall.height,
              backgroundColor: withAlpha(world.shadow, patch.o),
            },
          ]}
        />
      ))}

      {/* Ceiling hint and cornice, so the wall reads as a wall and not as a sky. */}
      <View
        style={[
          styles.ceiling,
          { height: wall.height * 0.1, backgroundColor: ceiling, opacity: 0.85 },
        ]}
      >
        <LinearGradient
          colors={[withAlpha(world.shadow, 0.2), 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={[styles.cornice, { backgroundColor: warmLight(plaster, 16, 0.3) }]} />
      <View style={[styles.corniceShade, { backgroundColor: withAlpha(world.shadow, 0.2) }]} />

      {/* Openings. */}
      {windows.map((rect, index) => (
        <Window
          key={index}
          rect={rect}
          wall={wall}
          sky={sky}
          trim={room.trim}
          night={night}
          hour={hour}
        />
      ))}

      {/* Warm spill from each opening, on the plaster below the sill. */}
      {windows.map((rect, index) => (
        <View
          key={`spill-${index}`}
          style={[
            styles.spill,
            {
              left: rect.x * wall.width - 10,
              top: (rect.y + rect.h) * wall.height,
              width: rect.w * wall.width + 20,
              height: wall.height * 0.54,
            },
          , { pointerEvents: 'none' }]}
        >
          <LinearGradient
            colors={[
              withAlpha(world.glowSoft, 0.3 * ambient.intensity + 0.1),
              withAlpha(world.glow, 0.1),
              'transparent',
            ]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ))}

      {/* Wainscot: wood below, plaster above. */}
      <View
        style={[
          styles.wainscot,
          {
            height: wall.height * 0.3,
            backgroundColor: wainscot,
            borderTopColor: rail,
            borderBottomColor: withAlpha(world.shadow, 0.4),
          },
        ]}
      >
        {[0.12, 0.32, 0.52, 0.72, 0.9].map((x) => (
          <View
            key={x}
            style={[
              styles.wainscotPanel,
              {
                left: x * wall.width,
                borderColor: withAlpha(world.shadow, 0.26),
                backgroundColor: withAlpha(world.oak, 0.14),
              },
            ]}
          />
        ))}
        <View style={[styles.wainscotGrain, { backgroundColor: withAlpha(world.oak, 0.18) }]} />
      </View>

      {sconces.map((x) => (
        <Sconce key={x} x={x} wall={wall} />
      ))}

      {/* The wall is lived in: pictures, boards, pipes, a pendant or two. */}
      <WallDressing roomType={roomType} wall={wall} trim={room.trim} accent={room.accent} />

      {/* Overall wash: warm light from above, a shade where the wall meets the
          floor, so the wall keeps a top and a bottom instead of one flat tone. */}
      <LinearGradient
        colors={[
          withAlpha(world.haze, 0.16 * ambient.warmth),
          'transparent',
          withAlpha(world.shadow, 0.18),
        ]}
        locations={[0, 0.5, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
    </View>
  );
}

/** Outdoor ground: grass, sand, rock slabs or cobbles, hazy at the horizon. */
function Ground({
  kind,
  room,
  height,
}: {
  kind: GroundKind;
  room: { floor: string; floorAlt: string };
  height: number;
}) {
  const base = mix(room.floor, kind === 'sand' ? world.sand : world.sage, 0.18);
  const tuftColor = withAlpha(world.sageDark, 0.4);
  const fleckCount = kind === 'rock' ? 12 : 22;

  return (
    <View style={[styles.floor, { height, backgroundColor: base }]}>
      <LinearGradient
        colors={[withAlpha(world.haze, 0.55), withAlpha(world.haze, 0.16), 'transparent']}
        locations={[0, 0.4, 1]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
      {kind === 'grass'
        ? Array.from({ length: fleckCount }).map((_, index) => {
            const x = (index * 37) % 100;
            const y = 12 + ((index * 53) % 80);
            return (
              <View
                key={index}
                style={[
                  styles.tuft,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    height: 6 + (index % 3) * 4,
                    backgroundColor: tuftColor,
                  },
                ]}
              />
            );
          })
        : null}
      {kind === 'sand'
        ? Array.from({ length: 6 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.ripple,
                {
                  top: `${14 + index * 14}%`,
                  left: `${(index % 2) * 6}%`,
                  right: `${(index % 3) * 4}%`,
                  backgroundColor: withAlpha(world.shadow, 0.1),
                },
              ]}
            />
          ))
        : null}
      {kind === 'rock' || kind === 'cobble'
        ? Array.from({ length: fleckCount }).map((_, index) => {
            const x = (index * 31) % 96;
            const y = 10 + ((index * 47) % 84);
            const w = kind === 'rock' ? 26 + (index % 4) * 14 : 16 + (index % 3) * 8;
            return (
              <View
                key={index}
                style={[
                  styles.slab,
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    width: w,
                    height: kind === 'rock' ? 8 + (index % 3) * 5 : 7,
                    borderRadius: kind === 'cobble' ? 5 : radius.xs,
                    backgroundColor: withAlpha(mix(room.floorAlt, world.shadow, 0.18), 0.55),
                    borderColor: withAlpha(world.rim, 0.08),
                  },
                ]}
              >
                <View style={[styles.slabLit, { backgroundColor: withAlpha(world.rim, 0.12) }]} />
              </View>
            );
          })
        : null}
      <View style={[styles.groundEdge, { backgroundColor: withAlpha(world.shadow, 0.18) }]} />
    </View>
  );
}

/** Distant scenery behind an outdoor room: skyline, sea band or ridges. */
function Horizon({
  type,
  room,
  width,
  horizon,
  height,
}: {
  type: string;
  room: { wall: [string, string]; accent: string };
  width: number;
  horizon: number;
  height: number;
}) {
  const far = mix(room.wall[1], world.haze, 0.35);
  const mid = mix(room.wall[0], world.haze, 0.22);

  if (type === 'beach') {
    return (
      <View style={[styles.horizon, { top: horizon - height, height }, { pointerEvents: 'none' }]}>
        <View style={[styles.seaBand, { backgroundColor: withAlpha(mix(world.sage, room.accent, 0.5), 0.5) }]}>
          <View style={[styles.seaLine, { backgroundColor: withAlpha(world.rim, 0.35) }]} />
          <View style={[styles.seaLine, { top: '62%', backgroundColor: withAlpha(world.rim, 0.2) }]} />
        </View>
      </View>
    );
  }

  if (type === 'mountain') {
    return (
      <View style={[styles.horizon, { top: horizon - height, height }, { pointerEvents: 'none' }]}>
        <View
          style={[
            styles.ridge,
            { left: -width * 0.1, width: width * 0.7, height: height * 0.5, backgroundColor: far },
          ]}
        />
        <View
          style={[
            styles.ridge,
            { left: width * 0.4, width: width * 0.8, height: height * 0.7, backgroundColor: mid },
          ]}
        />
        <View style={[styles.ridgeCap, { left: width * 0.62, backgroundColor: withAlpha(world.rim, 0.3) }]} />
      </View>
    );
  }

  // Park and market: a low skyline of warm blocks with lit windows at night.
  const blocks = [0.06, 0.2, 0.32, 0.46, 0.62, 0.78, 0.9];
  return (
    <View style={[styles.horizon, { top: horizon - height, height }, { pointerEvents: 'none' }]}>
      {blocks.map((x, index) => {
        const blockHeight = height * (0.26 + ((index * 7) % 5) * 0.09);
        return (
          <View
            key={x}
            style={[
              styles.block,
              {
                left: x * width,
                width: width * 0.11,
                height: blockHeight,
                backgroundColor: mix(far, world.shadow, 0.18 + (index % 3) * 0.08),
              },
            ]}
          >
            <View style={[styles.blockRoof, { backgroundColor: withAlpha(world.rim, 0.16) }]} />
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Scenery
 * ------------------------------------------------------------------ */

/**
 * One piece of furniture, placed on the boards.
 *
 * The drawing lives in Scenery.tsx, one vector object per kind. This wrapper
 * only does the placing: the footprint comes from PROP_BOX, the base sits on
 * the floor, and the bottom edge scales outwards when a prop is enlarged, so a
 * bigger object grows from the ground rather than through it.
 */
function SceneryProp({
  prop,
  accent,
  trim,
  index,
  left,
  bottom,
  scale,
  depth,
}: {
  prop: Station;
  accent: string;
  trim: string;
  index: number;
  left: number;
  bottom: number;
  scale: number;
  /** Where the prop stands, so a resident can stand in front of it, or behind. */
  depth: number;
}) {
  const box = PROP_BOX[prop.kind] ?? PROP_BOX.table;
  const size = (prop.size ?? 1) * scale;
  const wrapper: ViewStyle = {
    position: 'absolute',
    left,
    bottom,
    width: box.w,
    height: box.h,
    marginLeft: -box.w / 2,
    transform: [{ scale: size }],
    transformOrigin: 'bottom center',
    zIndex: 10 + Math.round(depth * 1000),
  };

  return (
    <View style={wrapper} testID={`stage-prop-${prop.kind}`}>
      <SceneryPropArt kind={prop.kind} accent={accent} trim={trim} uid={`prop-${index}`} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Stage
 * ------------------------------------------------------------------ */

interface StageProps {
  residents: Resident[];
  location: LocationView | null;
  gameHour: number;
  weatherIcon?: string;
  weatherLabel?: string;
  anomalyVisible?: boolean;
  anomalyText?: string;
  anomalyName?: string;
  selectedResidentId?: string | null;
  onSelectResident?: (resident: Resident) => void;
  onOpenLocationPicker?: () => void;
  /** The cycle the room is in: it is what changes what everyone is doing. */
  cycle?: number;
}

export function Stage({
  residents,
  location,
  gameHour,
  weatherIcon,
  weatherLabel,
  anomalyVisible,
  anomalyText,
  anomalyName,
  selectedResidentId,
  onSelectResident,
  onOpenLocationPicker,
  cycle = 0,
}: StageProps) {
  const { t } = useI18n();
  const { contrast } = usePrefs();
  const [size, setSize] = useState({ width: 320, height: 300 });

  const type = location?.type ?? '';
  const room = roomPalette[type] ?? defaultRoom;
  const outdoor = OUTDOOR.has(type);
  const scenery = useMemo(() => stationsOf(type), [type]);
  const openings = useMemo(() => (outdoor ? [] : WINDOWS[type] ?? []), [outdoor, type]);

  const isNight = gameHour < 6 || gameHour >= 20;
  const isDusk = gameHour >= 17 && gameHour < 20;
  const isDawn = gameHour >= 5 && gameHour < 8;
  const sky = skyGradient(gameHour);
  const ambient = ambientLight(gameHour);

  // The geometry of the room: where the back wall stands, where the floor starts
  // and how much of each side wall we see. Every placement below derives from
  // it, so a prop can never float and a resident can never change size between
  // two rooms without a reason.
  const geometry = useMemo(() => geometryOf(size.width, size.height), [size]);
  const wallHeight = outdoor ? size.height * 0.56 : geometry.wallBaseY;
  const floorHeight = size.height - wallHeight;
  const wall = useMemo(
    () =>
      outdoor
        ? { width: size.width, height: wallHeight }
        : {
            width: size.width - 2 * geometry.inset,
            height: Math.max(80, wallHeight - geometry.ceilingY),
          },
    [geometry.ceilingY, geometry.inset, outdoor, size.width, wallHeight],
  );

  /** Where a point of the room lands on screen, and how big it looks there. */
  const place = (x: number, y: number) => {
    const depth = Math.max(0.04, Math.min(1.04, y));
    if (outdoor) {
      return {
        cx: x * size.width,
        cy: wallHeight + depth * floorHeight,
        scale: 0.78 + 0.36 * depth,
      };
    }
    return {
      cx: floorXAt(geometry, x, depth),
      cy: floorYAt(geometry, depth),
      scale: depthScaleAt(depth),
    };
  };

  // Who is where, and how they got there: routes, steps, entrances and exits.
  const { walkers, report } = useCirculation({
    residents,
    type,
    cycle,
    locationId: location?.id ?? null,
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  /**
   * One scale for the whole cast, and the furniture keeps it too: a resident
   * and the counter beside them have to agree about how big the room is.
   */
  const spriteScale = Math.max(0.62, Math.min(1.55, size.width / 740));

  return (
    <View
      testID="stage"
      style={[styles.root, contrast && styles.rootContrast]}
      onLayout={onLayout}
    >
      {/* Sky: the whole frame for outdoor rooms, and the view through the glass. */}
      {outdoor ? (
        <>
          <LinearGradient
            colors={sky}
            style={[styles.sky, { height: wallHeight }]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          />
          {isNight
            ? STARS.map((pos, index) => (
                <View
                  key={index}
                  style={[
                    styles.star,
                    {
                      top: pos.top,
                      left: pos.left,
                      width: pos.size,
                      height: pos.size,
                      opacity: 0.45 + (index % 3) * 0.2,
                    },
                  ]}
                />
              ))
            : null}
          <SunBloom
            x={isNight ? size.width * 0.34 : size.width * 0.86}
            y={isNight ? size.height * 0.09 : isDusk || isDawn ? size.height * 0.22 : size.height * 0.07}
            size={isNight ? 150 : 280}
            night={isNight}
            dusk={isDusk}
            dawn={isDawn}
          />
          {!isNight
            ? CLOUDS.map((cloud, index) => (
                <View
                  key={index}
                  style={[
                    styles.cloud,
                    {
                      top: cloud.top,
                      left: cloud.left,
                      width: cloud.width,
                      opacity: cloud.o * (isDusk ? 0.7 : 1),
                    },
                  ]}
                >
                  <View style={[styles.cloudTop, { backgroundColor: withAlpha(world.rim, 0.7) }]} />
                </View>
              ))
            : null}
          {!isNight && !isDusk
            ? BIRDS.map((bird, index) => (
                <View key={index} style={[styles.bird, { top: bird.top, left: bird.left, transform: [{ rotate: `${bird.tilt}deg` }] }]}>
                  <View style={[styles.birdWing, { backgroundColor: withAlpha(world.shadow, 0.4) }]} />
                  <View style={[styles.birdWing, { backgroundColor: withAlpha(world.shadow, 0.4), left: undefined, right: 0 }]} />
                </View>
              ))
            : null}
          <Horizon
            type={type}
            room={room}
            width={size.width}
            horizon={wallHeight}
            height={size.height * 0.3}
          />
          <Ground kind={GROUND_OF[type] ?? 'grass'} room={room} height={floorHeight} />
        </>
      ) : (
        <>
          {/* The shell: ceiling, two side walls and a floor whose boards run to
              the vanishing point. The beams of the windows are in there too. */}
          <Room geometry={geometry} room={room} hour={gameHour} openings={openings} wall={wall} />

          {/* The back wall, inset, with its own plaster, openings and dressing. */}
          <View
            style={{
              position: 'absolute',
              left: geometry.inset,
              top: geometry.ceilingY,
              width: wall.width,
              height: wall.height,
              overflow: 'hidden',
            }}
          >
            <Wall roomType={type} room={room} wall={wall} sky={sky} hour={gameHour} />
          </View>
        </>
      )}

      {/* Scenery: everything stands on the boards, so the props share the
          floor band with the residents. */}
      <View testID="stage-scenery" style={[styles.scenery, { top: wallHeight, height: floorHeight }]}>
        {scenery.map((prop, index) => {
          const spot = place(prop.x, prop.y);
          return (
            <SceneryProp
              key={`${prop.kind}-${index}`}
              prop={prop}
              accent={room.accent}
              trim={room.trim}
              index={index}
              left={spot.cx}
              bottom={size.height - spot.cy}
              scale={spot.scale * spriteScale}
              depth={prop.y}
            />
          );
        })}
      </View>

      {/* Residents: each one walks its own route, and repaints only itself. */}
      {walkers.map((walker) => (
        <Walker
          key={walker.resident.id}
          resident={walker.resident}
          plan={walker.plan}
          rest={walker.rest}
          leaving={walker.leaving}
          place={place}
          spriteScale={spriteScale}
          selected={selectedResidentId === walker.resident.id}
          light={ambient.intensity}
          onPress={onSelectResident}
          accessibilityHint={t('common.tapToSelect')}
          onReport={report}
        />
      ))}

      {/* Air: dust drifting through the room light. */}
      <Dust width={size.width} height={size.height} intensity={ambient.intensity} />

      {/* Anomaly */}
      {anomalyVisible ? (
        <View style={[styles.anomalyLayer, { pointerEvents: 'none' }]}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <View
              key={index}
              style={[styles.anomalyLine, { top: `${index * 12.5}%`, opacity: index % 2 ? 0.05 : 0.11 }]}
            />
          ))}
          <View style={styles.anomalyTag}>
            <Icon name={glyph('anomaly')} size={16} color={palette.rose} />
            <View style={styles.anomalyTextWrap}>
              <Text style={styles.anomalyName}>{anomalyName ?? 'RÉSIDU-08'}</Text>
              <Text style={styles.anomalyText} numberOfLines={2}>
                {anomalyText}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Empty state */}
      {residents.length === 0 ? (
        <View style={[styles.emptyWrap, { pointerEvents: 'none' }]}>
          <View style={styles.emptyCard}>
            <Ionicons name="eye-outline" size={20} color={palette.inkSoft} />
            <Text style={styles.emptyTitle}>{t('stage.nobody')}</Text>
            <Text style={styles.emptyHint}>{t('stage.nobodyHint')}</Text>
          </View>
        </View>
      ) : null}

      {/* Top overlay: where we are */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('stage.place')}: ${location?.name ?? t('places.unknown')}. ${t('common.tapToSelect')}`}
          onPress={onOpenLocationPicker}
          style={styles.placeChip}
        >
          <Icon
            name={glyph(location?.icon ?? location?.type)}
            size={16}
            color={palette.inkSoft}
          />
          <View style={styles.placeText}>
            <Text style={styles.placeName} numberOfLines={1}>
              {location?.name ?? t('places.unknown')}
            </Text>
            <Text style={styles.placeCity} numberOfLines={1}>
              {[location?.city, location?.country].filter(Boolean).join(', ')}
            </Text>
          </View>
          {onOpenLocationPicker ? (
            <Ionicons name="chevron-down" size={15} color={palette.inkSoft} />
          ) : null}
        </Pressable>

        <View style={styles.statusChips}>
          <View style={styles.statusChip}>
            <Ionicons
              name={isNight ? 'moon' : isDusk ? 'partly-sunny' : 'sunny'}
              size={11}
              color={palette.inkSoft}
            />
            <Text style={styles.statusChipText}>
              {String(gameHour).padStart(2, '0')}:00
            </Text>
          </View>
          {weatherIcon ? (
            <View style={styles.statusChip}>
              <Icon name={glyph(weatherIcon)} size={11} color={palette.inkSoft} />
              <Text style={styles.statusChipText}>{weatherLabel}</Text>
            </View>
          ) : null}
          <View style={styles.statusChip}>
            <Ionicons name="people" size={11} color={palette.inkSoft} />
            <Text style={styles.statusChipText}>{residents.length}</Text>
          </View>
        </View>
      </View>

      {/* One grade over the whole frame, then the near edge, then the film
          vignette: sky, wall, boards and cast end up in the same photograph. */}
      <HourGrade hour={gameHour} height={size.height} />
      <ForegroundFrame roomType={type} width={size.width} height={size.height} hour={gameHour} />
      {/* Film edge: a wash front and back, then the corners. Both are light on
          purpose: a heavy hand here flattens every value the room was lit for. */}
      <LinearGradient
        colors={['rgba(24,12,5,0.1)', 'transparent', 'rgba(18,9,4,0.16)']}
        locations={[0, 0.54, 1]}
        style={[styles.vignette, { pointerEvents: 'none' }]}
      />
      <Vignette width={size.width} height={size.height} strength={0.26} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: palette.deep,
    minHeight: 300,
    aspectRatio: 1.6,
    borderWidth: 1,
    /** A warm hairline: the picture sits in the world it shows, not in a hole. */
    borderColor: withAlpha(world.shadow, 0.6),
  },
  rootContrast: { borderColor: world.brass, borderWidth: 2 },
  sky: { position: 'absolute', top: 0, left: 0, right: 0 },
  star: { position: 'absolute', borderRadius: 2, backgroundColor: '#F4EEDC' },
  celestial: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    boxShadow: '0 0 22px rgba(255, 233, 168, 0.7)',
    elevation: 3,
  },
  celestialHalo: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  cloud: {
    position: 'absolute',
    height: 14,
    borderRadius: 8,
    backgroundColor: withAlpha('#F6EBD8', 0.55),
    overflow: 'hidden',
  },
  cloudTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  bird: { position: 'absolute', width: 12, height: 6 },
  birdWing: { position: 'absolute', top: 2, left: 0, width: 6, height: 2 },

  horizon: { position: 'absolute', left: 0, right: 0 },
  seaBand: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  seaLine: { position: 'absolute', top: '30%', left: 0, right: 0, height: 1.5, opacity: 0.6 },
  ridge: { position: 'absolute', bottom: 0 },
  ridgeCap: { position: 'absolute', bottom: '34%', width: 26, height: 6, opacity: 0.5 },
  block: { position: 'absolute', bottom: 0, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  blockRoof: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },

  /* Wall */
  wall: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  plasterField: { ...StyleSheet.absoluteFillObject },
  plasterPatch: { position: 'absolute', borderRadius: 26 },
  ceiling: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  cornice: { position: 'absolute', top: '9.6%', left: 0, right: 0, height: 5, opacity: 0.9 },
  corniceShade: { position: 'absolute', top: '11%', left: 0, right: 0, height: 2 },
  windowBox: { position: 'absolute' },
  windowFrame: {
    flex: 1,
    borderWidth: 4,
    borderRadius: radius.xs,
    overflow: 'hidden',
    padding: 3,
  },
  windowGlass: { flex: 1, overflow: 'hidden' },
  windowLights: { ...StyleSheet.absoluteFillObject },
  cityLight: { position: 'absolute', width: 4, height: 4 },
  windowBloom: { position: 'absolute', left: 0, right: 0, top: '55%', bottom: 0 },
  mullion: { position: 'absolute', top: 0, bottom: 0, width: 3, opacity: 0.9 },
  transom: { position: 'absolute', left: 4, height: 3, opacity: 0.9 },
  glassSheen: { position: 'absolute', top: 8, left: 10, width: 26, height: 60, transform: [{ rotate: '18deg' }] },
  windowSill: { position: 'absolute', left: -6, right: -6, bottom: -6, height: 6, borderRadius: radius.xs },
  windowSillShade: { position: 'absolute', top: 4, left: 0, right: 0, height: 2 },
  spill: { position: 'absolute' },
  wainscot: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 2, borderBottomWidth: 1, overflow: 'hidden' },
  wainscotPanel: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: '9%',
    borderWidth: 1,
    borderRadius: radius.xs,
  },
  wainscotGrain: { position: 'absolute', top: '30%', left: 0, right: 0, height: 1 },
  sconce: { position: 'absolute', width: 18, alignItems: 'center' },
  sconceGlow: { position: 'absolute', top: 10, width: 34, height: 34, borderRadius: 17 },
  sconceArm: { width: 3, height: 12 },
  sconceShade: { width: 16, height: 10, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: 'center' },
  sconceBulb: { width: 5, height: 5, marginTop: 4, borderRadius: 2 },

  /* Floors */
  floor: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  floorRow: { position: 'absolute', left: 0, right: 0 },
  plank: { position: 'absolute', top: 0, bottom: 0, borderBottomWidth: 1, overflow: 'hidden' },
  plankGrain: { position: 'absolute', top: '38%', left: 3, height: 1 },
  plankTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  lightPool: { position: 'absolute', top: 0, overflow: 'hidden' },
  tuft: { position: 'absolute', width: 2 },
  ripple: { position: 'absolute', height: 1.5 },
  slab: { position: 'absolute', borderWidth: 1, overflow: 'hidden' },
  slabLit: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  groundEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },

  skirting: { position: 'absolute', left: 0, right: 0, height: 7, borderTopWidth: 1 },
  skirtingShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  scenery: { position: 'absolute', left: 0, right: 0 },

  /* Props: every part is placed from the ground line, so stacks stay upright. */
  part: { position: 'absolute' },
  contact: { position: 'absolute', bottom: -1, height: 7, borderRadius: 10 },

  counterBody: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 0,
    height: 46,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 6,
  },
  counterPanel: { flex: 1, borderWidth: 1, borderRadius: 2 },
  counterRail: { position: 'absolute', left: 0, right: 0, bottom: 5, height: 4, borderRadius: 2 },
  counterRailLit: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  counterTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 46,
    height: 11,
    borderWidth: 1,
    borderRadius: 2,
  },
  counterTopLit: { position: 'absolute', top: 1, left: 2, right: 2, height: 2 },
  counterItems: {
    position: 'absolute',
    left: 16,
    bottom: 57,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  cup: { width: 11, height: 12, borderWidth: 1, borderRadius: 1, alignItems: 'center' },
  cupRim: { top: 1, left: 2, width: 5, height: 2 },
  jar: { width: 14, height: 17, borderWidth: 1, borderRadius: 2, alignItems: 'center' },
  jarNeck: { top: -3, left: 3, width: 8, height: 3 },

  tableFoot: { position: 'absolute', left: 15, bottom: 0, width: 36, height: 5, borderRadius: 2 },
  tableColumn: { position: 'absolute', left: 28, bottom: 5, width: 10, height: 22 },
  tableColumnLit: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2 },
  tableApron: { position: 'absolute', left: 8, right: 8, bottom: 27, height: 6, borderRadius: 2 },
  tableApronLit: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  tableTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 33,
    height: 9,
    borderWidth: 1,
    borderRadius: 4,
  },
  tableTopLit: { position: 'absolute', top: 1, left: 2, right: 2, height: 2 },

  deskBody: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 0,
    height: 36,
    borderWidth: 1,
    borderRadius: 3,
    padding: 5,
    flexDirection: 'row',
    gap: 6,
  },
  deskDrawer: { flex: 1, borderWidth: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  deskHandle: { width: 10, height: 2 },
  deskTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 36,
    height: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  deskTopLit: { position: 'absolute', top: 1, left: 1, right: 1, height: 2 },
  deskItems: {
    position: 'absolute',
    left: 16,
    bottom: 46,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  deskLamp: { alignItems: 'center' },
  lampStem: { width: 3, height: 13 },
  lampHead: {
    width: 20,
    height: 9,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  deskBulb: { width: 6, height: 4, borderRadius: 2, marginBottom: 1 },
  papers: {
    width: 25,
    height: 5,
    borderWidth: 1,
    borderRadius: 1,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  paperLine: { left: 3, width: 18, height: 1 },

  benchLeg: { position: 'absolute', bottom: 0, width: 5, height: 16, borderRadius: 1 },
  benchSeat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    height: 10,
    borderWidth: 1,
    borderRadius: 2,
  },
  benchSeam: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  benchBack: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 26,
    height: 16,
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  benchBar: { height: 3, borderRadius: 1 },

  machineBase: { position: 'absolute', left: 1, right: 1, bottom: 0, height: 6, borderRadius: 2 },
  machineBody: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 6,
    height: 58,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  machinePanel: {
    width: 30,
    height: 20,
    borderWidth: 1,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  machineDial: { width: 7, height: 7, borderWidth: 1, borderRadius: 4 },
  machineLight: { width: 8, height: 8, borderRadius: 4 },
  machineHalo: { top: -5, left: -5, width: 16, height: 16, borderRadius: 8 },

  screenBase: { position: 'absolute', left: 29, bottom: 0, width: 34, height: 5, borderRadius: 2 },
  screenStand: { position: 'absolute', left: 41, bottom: 5, width: 10, height: 8 },
  screenFrame: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 13,
    height: 48,
    borderWidth: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  screenGlow: { flex: 1 },
  screenLine: { position: 'absolute', top: '30%', left: '8%', width: '68%', height: 2 },
  screenSheen: {
    top: 6,
    left: 10,
    width: 22,
    height: 34,
    transform: [{ rotate: '14deg' }],
  },

  shelf: {
    position: 'absolute',
    left: 2,
    right: 2,
    bottom: 0,
    height: 88,
    borderWidth: 2,
    borderRadius: 3,
    padding: 4,
    justifyContent: 'space-between',
  },
  shelfBay: { height: 24, borderBottomWidth: 2, justifyContent: 'flex-end' },
  shelfBooks: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  shelfBook: { width: 7, borderRadius: 1 },
  shelfBasket: { width: 34, height: 18, borderRadius: 2, padding: 3 },
  basketWeave: { flex: 1, borderRadius: 1 },

  mat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
    borderWidth: 1,
    borderRadius: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matBorder: { top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1, borderRadius: 2 },
  matWeave: { top: '36%', left: 0, right: 0, height: 1 },

  stem: { position: 'absolute', left: 22, bottom: 14, width: 3, height: 14, borderRadius: 1 },
  pot: { position: 'absolute', left: 11, bottom: 0, width: 26, height: 16, borderWidth: 1, borderRadius: 3 },
  potRim: { left: -1, bottom: 12, width: 28, height: 5, borderRadius: 2 },
  leaf: {
    position: 'absolute',
    left: 10,
    bottom: 22,
    width: 28,
    height: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  leafAlt: {
    position: 'absolute',
    left: 24,
    bottom: 30,
    width: 20,
    height: 17,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  leafSide: {
    position: 'absolute',
    left: 2,
    bottom: 26,
    width: 16,
    height: 17,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },

  trunk: { position: 'absolute', left: 46, bottom: 0, width: 12, height: 44, borderRadius: 3 },
  bark: { top: 6, left: 3, width: 1.5, bottom: 6 },
  canopy: { position: 'absolute', left: 10, bottom: 28, width: 84, height: 62, borderRadius: 34 },
  canopyMid: { position: 'absolute', left: 4, bottom: 46, width: 64, height: 48, borderRadius: 30 },
  canopyLit: { position: 'absolute', left: 44, bottom: 66, width: 42, height: 32, borderRadius: 22 },

  lampPool: { left: -10, bottom: -6, width: 64, height: 16, borderRadius: 10 },
  lampHalo: { left: -2, bottom: 36, width: 48, height: 48, borderRadius: 24 },
  lampBase: { position: 'absolute', left: 9, bottom: 0, width: 26, height: 6, borderRadius: 2 },
  lampPole: { position: 'absolute', left: 20, bottom: 6, width: 4, height: 58, borderRadius: 1 },
  lampGlass: { position: 'absolute', left: 18, bottom: 58, width: 8, height: 8, borderRadius: 4 },
  lampShade: {
    position: 'absolute',
    left: 3,
    bottom: 66,
    width: 38,
    height: 20,
    borderWidth: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  lampShadeLit: { top: 2, left: 4, right: 4, height: 5, borderRadius: 3 },

  water: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 6,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  waterLine: { top: '26%', left: '6%', width: '62%', height: 2, borderRadius: 1 },
  wetSand: { left: 11, bottom: -2, width: 168, height: 8, borderRadius: 4 },

  bedLeg: { position: 'absolute', bottom: 0, width: 7, height: 12, borderRadius: 1 },
  bedHead: {
    position: 'absolute',
    left: 3,
    bottom: 26,
    width: 104,
    height: 34,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  bedSlat: { width: 9, height: 18, borderRadius: 2 },
  bedFrame: { position: 'absolute', left: 0, right: 0, bottom: 10, height: 6, borderRadius: 2 },
  bedMattress: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 14,
    height: 24,
    borderWidth: 1,
    borderRadius: 3,
  },
  bedSheet: { top: 3, left: 4, right: 40, height: 5, borderRadius: 2 },
  bedPillow: { position: 'absolute', bottom: 34, width: 30, height: 12, borderRadius: 5 },
  bedThrow: {
    position: 'absolute',
    left: 46,
    bottom: 15,
    width: 62,
    height: 22,
    borderWidth: 1,
    borderRadius: 3,
  },
  bedFold: { top: 7, left: 0, right: 0, height: 2 },

  sofaLeg: { position: 'absolute', bottom: 0, width: 8, height: 10, borderRadius: 1 },
  sofaBack: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 26,
    height: 34,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  sofaBackLit: { top: 3, left: 8, right: 8, height: 4, borderRadius: 3 },
  sofaArm: { position: 'absolute', bottom: 10, width: 14, height: 30, borderRadius: 4 },
  sofaSeat: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 10,
    height: 22,
    borderWidth: 1,
    borderRadius: 4,
  },
  sofaCushion: { top: 4, width: 42, height: 12, borderRadius: 3 },

  altarStep: { position: 'absolute', left: 2, right: 2, bottom: 0, height: 8, borderRadius: 2 },
  altarBody: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  altarCarve: { width: 34, height: 3, borderRadius: 2 },
  altarTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    height: 11,
    borderWidth: 1,
    borderRadius: 2,
  },
  altarTopLit: { top: 1, left: 2, right: 2, height: 2 },
  altarHalo: { left: 20, bottom: 58, width: 34, height: 34, borderRadius: 17 },
  altarBowl: {
    position: 'absolute',
    left: 26,
    bottom: 55,
    width: 22,
    height: 10,
    borderWidth: 1,
    borderRadius: 4,
  },
  altarFlame: { position: 'absolute', left: 34, bottom: 65, width: 6, height: 9, borderRadius: 3 },

  stageCone: {
    left: 40,
    bottom: 44,
    width: 120,
    height: 56,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  stageFace: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 0,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageTrim: { width: 150, height: 2, borderRadius: 1 },
  stageTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    height: 12,
    borderWidth: 1,
    borderRadius: 3,
  },
  stageTopLit: { top: 2, left: 4, right: 4, height: 2 },
  stageLamps: {
    position: 'absolute',
    left: 30,
    right: 30,
    bottom: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageLamp: { width: 4, height: 22, borderRadius: 2, alignItems: 'center' },
  stageBulb: { width: 7, height: 7, borderRadius: 4 },

  rock: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 46,
    height: 28,
    borderWidth: 1,
    borderRadius: 9,
    overflow: 'hidden',
  },
  rockLit: { top: 2, left: 4, right: 8, height: 3, borderRadius: 2 },
  moss: { bottom: 3, left: 7, width: 13, height: 4, borderRadius: 2 },
  rockSmall: { position: 'absolute', left: 34, bottom: 0, width: 26, height: 18, borderRadius: 6 },

  /* Overlays */
  residentSlot: { position: 'absolute', alignItems: 'center' },
  anomalyLayer: { ...StyleSheet.absoluteFillObject },
  anomalyLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: palette.rose },
  anomalyTag: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(12,10,8,0.88)',
    borderWidth: 1,
    borderColor: palette.rose,
    maxWidth: 260,
  },
  anomalyTextWrap: { flexShrink: 1 },
  anomalyName: { ...typeTokens.micro, color: palette.rose },
  anomalyText: { ...typeTokens.caption, color: palette.ink, marginTop: 2 },
  emptyWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(12,10,8,0.82)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyTitle: { ...typeTokens.label, color: palette.ink },
  emptyHint: { ...typeTokens.caption, color: palette.inkMuted },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: space.sm,
    gap: space.sm,
  },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(12,10,8,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.36)',
    maxWidth: 220,
  },
  placeText: { flexShrink: 1 },
  placeName: { ...typeTokens.label, color: palette.ink },
  placeCity: { ...typeTokens.caption, color: palette.inkMuted, fontSize: 10 },
  statusChips: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(12,10,8,0.78)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  statusChipText: { ...typeTokens.caption, color: palette.inkSoft, fontSize: 10 },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

export default Stage;
