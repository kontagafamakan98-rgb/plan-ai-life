/**
 * Room: the shell of an interior, in one point perspective.
 *
 * A back wall and a floor band give a backdrop, not a room. What makes a place
 * is the box: a ceiling above, two side walls that come toward the viewer, and a
 * floor whose boards run to a vanishing point. Everything else in this file
 * follows from those four planes and from one rule: the further away something
 * is, the smaller and the hazier it is.
 *
 * Nothing here is a rectangle: the planes are quads, the sliding is a line that
 * follows the perspective, and the light that comes through a window lands on a
 * trapezoid instead of on a bar.
 */

import React from 'react';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { world } from '../theme';
import { ambientLight, mix, warmLight, warmShade, withAlpha } from '../game/art';
import { quad, type Point } from '../game/shape';

/** Wall, floor and trim of one location, as stored in the theme. */
export interface RoomTones {
  wall: [string, string];
  floor: string;
  floorAlt: string;
  accent: string;
  trim: string;
}

export interface RoomGeometry {
  /** Stage width and height. */
  width: number;
  height: number;
  /** Horizontal inset of the back wall: how much room we see on each side. */
  inset: number;
  /** Top edge of the back wall: the ceiling strip above it. */
  ceilingY: number;
  /** Where the back wall meets the floor. */
  wallBaseY: number;
  /**
   * The eye level of the room, and the one point every line running away from
   * the viewer meets. It is set so the ceiling rail leaves the frame exactly in
   * the top corner: the ceiling and the floor rails then have the same slope,
   * the box closes on itself instead of pinching, and the back wall sits
   * symmetrically around the horizon.
   */
  horizonY: number;
}

export function geometryOf(width: number, height: number): RoomGeometry {
  const inset = Math.round(Math.min(150, Math.max(58, width * 0.115)));
  const ceilingY = Math.round(height * 0.075);
  return {
    width,
    height,
    inset,
    ceilingY,
    wallBaseY: Math.round(height * 0.58),
    horizonY: Math.round((ceilingY * width) / (2 * inset)),
  };
}

/** Width of the floor at a depth: 0 is the back wall, 1 is the near edge. */
export function floorWidthAt(geometry: RoomGeometry, depth: number): number {
  return geometry.width - 2 * geometry.inset * (1 - depth);
}

/** Where a point at a given depth stands, in absolute pixels from the top. */
export function floorYAt(geometry: RoomGeometry, depth: number): number {
  return geometry.wallBaseY + depth * (geometry.height - geometry.wallBaseY);
}

/** How much smaller something is when it stands far away. */
export function depthScaleAt(depth: number): number {
  return 0.74 + 0.4 * Math.min(1.05, Math.max(0, depth));
}

/** Absolute left of a point at (x across the room, depth down the floor). */
export function floorXAt(geometry: RoomGeometry, x: number, depth: number): number {
  return geometry.width / 2 + (x - 0.5) * floorWidthAt(geometry, depth);
}

/**
 * The travel a rail needs to leave the frame through the bottom edge: 1 takes
 * the floor to the near edge of the picture, and the side walls need less.
 */
function nearLimit(geometry: RoomGeometry): number {
  return (geometry.height - geometry.wallBaseY) / (geometry.wallBaseY - geometry.horizonY);
}

/**
 * A point on a line that leaves the back wall and goes away from the viewer:
 * u is the travel, 0 on the back wall, 1 at the near edge of the floor.
 * Every rail in the room is this one function with different numbers.
 */
function along(geometry: RoomGeometry, x: number, y: number, u: number): Point {
  return { x: x + (x - geometry.width / 2) * u, y: y + (y - geometry.horizonY) * u };
}

/** Cuts a polygon to the frame, so no plane and no beam can bleed outside it. */
function clipToFrame(points: Point[], width: number, height: number): Point[] {
  let poly = points;
  const edges = [
    { axis: 'x' as const, value: 0, keep: (v: number) => v >= 0 },
    { axis: 'x' as const, value: width, keep: (v: number) => v <= width },
    { axis: 'y' as const, value: 0, keep: (v: number) => v >= 0 },
    { axis: 'y' as const, value: height, keep: (v: number) => v <= height },
  ];
  for (const edge of edges) {
    const input: Point[] = poly;
    poly = [];
    for (let index = 0; index < input.length; index += 1) {
      const a = input[index];
      const b = input[(index + 1) % input.length];
      const aIn = edge.keep(a[edge.axis]);
      const bIn = edge.keep(b[edge.axis]);
      if (aIn) poly.push(a);
      if (aIn !== bIn) {
        const t = (edge.value - a[edge.axis]) / (b[edge.axis] - a[edge.axis]);
        poly.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (!poly.length) return [];
  }
  return poly;
}

/** Where a span of the back wall lands on the floor, as a fraction across. */
function roomFraction(geometry: RoomGeometry, imageX: number): number {
  return (imageX - geometry.width / 2) / floorWidthAt(geometry, 0) + 0.5;
}

const BOARDS = 11;

interface Props {
  geometry: RoomGeometry;
  room: RoomTones;
  hour: number;
  /** Openings on the back wall, as fractions of that wall. */
  openings: { x: number; y: number; w: number; h: number }[];
  /** The wall the openings sit on, narrower than the stage. */
  wall: { width: number; height: number };
}

export function Room({ geometry, room, hour, openings, wall }: Props) {
  const { width, height, inset, ceilingY, wallBaseY, horizonY } = geometry;
  const ambient = ambientLight(hour);
  const night = hour < 6 || hour >= 20;
  const floorDepth = height - wallBaseY;

  /**
   * The light in the room, as values rather than as hues.
   *
   * Daylight comes through the openings on the back wall, so that wall is the
   * brightest plane, the ceiling catches a wash of it, the floor is lit away
   * from the wall, and one side wall is in shade while the other keeps the
   * light. A room whose planes all sit between a fifth and a third of the range
   * looks dirty no matter how warm it is: these stay apart on purpose, and the
   * glow of the lamps is what pushes the highlights the last step.
   */
  const litPlaster = mix(room.wall[0], world.plaster, 0.58);
  const midPlaster = mix(room.wall[0], world.plaster, 0.38);
  const floorTone = mix(room.floor, world.oak, 0.36);
  const floorToneAlt = mix(room.floorAlt, world.walnut, 0.16);
  const plaster = litPlaster;
  const wainscot = mix(world.wainscot, room.accent, 0.12);
  const ceilingTone = mix(room.wall[1], world.plaster, 0.46);
  const skirt = mix(room.trim, world.oak, 0.66);

  const near = nearLimit(geometry);
  /** The rail of the ceiling that leaves the frame exactly in the top corner. */
  const ceilingNear = ceilingY / (horizonY - ceilingY);
  /** Where a rail of a side wall leaves the frame, on its own side. */
  const sideEdge = inset / (width / 2 - inset);

  const ceiling = quad(
    clipToFrame(
      [
        along(geometry, inset, ceilingY, ceilingNear),
        along(geometry, width - inset, ceilingY, ceilingNear),
        { x: width - inset, y: ceilingY },
        { x: inset, y: ceilingY },
      ],
      width,
      height,
    ),
  );
  const floor = quad(
    clipToFrame(
      [
        along(geometry, inset, wallBaseY, near),
        along(geometry, width - inset, wallBaseY, near),
        { x: width - inset, y: wallBaseY },
        { x: inset, y: wallBaseY },
      ],
      width,
      height,
    ),
  );
  const leftWall = quad(
    clipToFrame(
      [
        along(geometry, inset, ceilingY, 2),
        along(geometry, inset, wallBaseY, 2),
        { x: inset, y: wallBaseY },
        { x: inset, y: ceilingY },
      ],
      width,
      height,
    ),
  );
  const rightWall = quad(
    clipToFrame(
      [
        along(geometry, width - inset, ceilingY, 2),
        along(geometry, width - inset, wallBaseY, 2),
        { x: width - inset, y: wallBaseY },
        { x: width - inset, y: ceilingY },
      ],
      width,
      height,
    ),
  );

  /** A line along a side wall, at a chosen height on the back wall. */
  const wallRail = (side: 1 | -1, backY: number) => {
    const x = side === -1 ? inset : width - inset;
    return { from: { x, y: backY }, to: along(geometry, x, backY, sideEdge) };
  };

  /** The point at a fraction along a rail, from the back wall toward the frame. */
  const onRail = (rail: { from: Point; to: Point }, f: number): Point => ({
    x: rail.from.x + (rail.to.x - rail.from.x) * f,
    y: rail.from.y + (rail.to.y - rail.from.y) * f,
  });

  /** Where a point stands on the floor, in board coordinates. */
  const boardPoint = (f: number, v: number): Point =>
    along(geometry, inset + f * (width - 2 * inset), wallBaseY, v * near);

  /** The junctions where each side wall meets the ceiling. */
  const leftWallRail = wallRail(-1, ceilingY);
  const rightWallRail = wallRail(1, ceilingY);

  // Boards run away from the viewer, so their edges meet at the horizon.
  const boards = Array.from({ length: BOARDS }, (_, index) => {
    const f0 = index / BOARDS;
    const f1 = (index + 1) / BOARDS;
    const board = quad(
      clipToFrame(
        [boardPoint(f0, 1), boardPoint(f1, 1), boardPoint(f1, 0), boardPoint(f0, 0)],
        width,
        height,
      ),
    );
    return { f0, f1, board, tone: index % 3 };
  });

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        {/* Shade side: the wall the daylight does not reach. */}
        <LinearGradient id="roomLeft" x1="0" y1="0.2" x2="1" y2="0.5">
          <Stop offset="0" stopColor={warmShade(midPlaster, -34, 0.34)} />
          <Stop offset="1" stopColor={warmShade(midPlaster, -6, 0.22)} />
        </LinearGradient>
        {/* Lit side: it carries the light of the openings toward the viewer. */}
        <LinearGradient id="roomRight" x1="1" y1="0.2" x2="0" y2="0.5">
          <Stop offset="0" stopColor={warmShade(litPlaster, -14, 0.24)} />
          <Stop offset="1" stopColor={warmLight(litPlaster, 8, 0.22)} />
        </LinearGradient>
        <LinearGradient id="roomCeiling" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={warmLight(ceilingTone, 12, 0.3)} />
          <Stop offset="0.7" stopColor={ceilingTone} />
          <Stop offset="1" stopColor={warmShade(ceilingTone, -30, 0.36)} />
        </LinearGradient>
        {/* Floor: shaded where it meets the wall, lit where the beams land. */}
        <LinearGradient id="roomFloor" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={mix(floorToneAlt, world.shadow, 0.42)} />
          <Stop offset="0.34" stopColor={warmShade(floorTone, -8, 0.24)} />
          <Stop offset="1" stopColor={warmLight(floorTone, 34, 0.26)} />
        </LinearGradient>
        <LinearGradient id="roomFloorFade" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={withAlpha(world.shadow, 0.26)} />
          <Stop offset="0.35" stopColor={withAlpha(world.shadow, 0.06)} />
          <Stop offset="1" stopColor={withAlpha(world.shadow, 0)} />
        </LinearGradient>
        <RadialGradient id="roomPool" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={withAlpha(world.glowSoft, 0.86)} />
          <Stop offset="0.42" stopColor={withAlpha(world.glow, 0.4)} />
          <Stop offset="1" stopColor={withAlpha(world.glow, 0)} />
        </RadialGradient>
        <LinearGradient id="roomWarm" x1="0.5" y1="1" x2="0.5" y2="0">
          <Stop offset="0" stopColor={withAlpha(world.rim, 0.22)} />
          <Stop offset="1" stopColor={withAlpha(world.rim, 0)} />
        </LinearGradient>
      </Defs>

      {/* Ceiling: a plane above the room, in shade but never in the dark. */}
      <Path d={ceiling} fill="url(#roomCeiling)" />
      <Path d={ceiling} fill={withAlpha(world.shadow, night ? 0.34 : 0.14)} />
      <Path d={`M ${inset} ${ceilingY} L ${width - inset} ${ceilingY}`} stroke={warmLight(plaster, 20, 0.24)} strokeWidth={2.4} />
      <Path d={`M ${inset} ${ceilingY + 2.6} L ${width - inset} ${ceilingY + 2.6}`} stroke={withAlpha(world.shadow, 0.35)} strokeWidth={1.6} />

      {/* Side walls: they carry the room toward the viewer. */}
      <Path d={leftWall} fill="url(#roomLeft)" />
      <Path d={rightWall} fill="url(#roomRight)" />
      <Path
        d={`M ${leftWallRail.from.x} ${leftWallRail.from.y} L ${leftWallRail.to.x} ${leftWallRail.to.y}`}
        stroke={withAlpha(world.shadow, 0.4)}
        strokeWidth={1.6}
      />
      <Path
        d={`M ${rightWallRail.from.x} ${rightWallRail.from.y} L ${rightWallRail.to.x} ${rightWallRail.to.y}`}
        stroke={withAlpha(world.shadow, 0.3)}
        strokeWidth={1.6}
      />

      {/* Wainscot along both side walls, running on the same horizon. */}
      {([-1, 1] as const).map((side) => {
        const cap = wallRail(side, wallBaseY - (wallBaseY - ceilingY) * 0.24);
        const skirtRail = wallRail(side, wallBaseY - 5);
        const floorRail = wallRail(side, wallBaseY);
        const line = (rail: { from: Point; to: Point }) => `M ${rail.from.x} ${rail.from.y} L ${rail.to.x} ${rail.to.y}`;
        return (
          <G key={side}>
            <Path
              d={quad([cap.from, cap.to, floorRail.to, floorRail.from])}
              fill={wainscot}
              opacity={side === -1 ? 0.92 : 0.98}
            />
            <Path d={line(cap)} stroke={warmLight(wainscot, 26, 0.24)} strokeWidth={3} />
            <Path d={line({ from: onRail(cap, 0.06), to: onRail(cap, 1) })} stroke={withAlpha(world.shadow, 0.34)} strokeWidth={1.4} />
            <Path d={line(skirtRail)} stroke={skirt} strokeWidth={5} />
            <Path d={line(floorRail)} stroke={withAlpha(world.shadow, 0.3)} strokeWidth={2} />
            {/* Panelling: the joints stay vertical, only their ends slide. */}
            {[0.22, 0.5, 0.78].map((at) => {
              const top = onRail(cap, at);
              const bottom = onRail(floorRail, at);
              return (
                <Path
                  key={at}
                  d={`M ${top.x} ${top.y} L ${bottom.x} ${bottom.y}`}
                  stroke={withAlpha(world.shadow, 0.2)}
                  strokeWidth={1.2}
                />
              );
            })}
          </G>
        );
      })}

      {/* Floor */}
      <Path d={floor} fill="url(#roomFloor)" />
      {boards.map((board, index) => {
        const joint = 0.34 + (index % 3) * 0.2;
        const edgeNear = boardPoint(board.f0, 1);
        const edgeBack = boardPoint(board.f0, 0);
        const jointFrom = boardPoint(board.f0, joint);
        const jointTo = boardPoint(board.f1, joint);
        const grainFrom = boardPoint(board.f0 + 0.32, 0.2);
        const grainTo = boardPoint(board.f0 + 0.32, 0.92);
        return (
          <G key={index}>
            <Path
              d={board.board}
              fill={withAlpha(board.tone === 0 ? world.oak : board.tone === 1 ? world.walnut : world.shadow, 0.1 + board.tone * 0.05)}
            />
            {/* A joint across the board, at a different depth for each one. */}
            <Path
              d={`M ${jointFrom.x} ${jointFrom.y} L ${jointTo.x} ${jointTo.y}`}
              stroke={withAlpha(world.shadow, 0.24)}
              strokeWidth={1.1}
            />
            <Path
              d={`M ${grainFrom.x} ${grainFrom.y} L ${grainTo.x} ${grainTo.y}`}
              stroke={withAlpha(world.walnut, 0.18)}
              strokeWidth={1.6}
            />
            <Path
              d={`M ${edgeBack.x} ${edgeBack.y} L ${edgeNear.x} ${edgeNear.y}`}
              stroke={withAlpha(world.shadow, 0.36)}
              strokeWidth={1.2}
            />
            <Path
              d={`M ${edgeBack.x + 2} ${edgeBack.y} L ${edgeNear.x + 3} ${edgeNear.y}`}
              stroke={withAlpha(world.rim, 0.12)}
              strokeWidth={1}
            />
          </G>
        );
      })}

      {/*
       * The light each opening throws: the beam leaves the sill, and lands on the
       * floor further down and further out, exactly where the boards say it must.
       */}
      {openings.map((rect, index) => {
        const sillX0 = inset + rect.x * wall.width;
        const sillX1 = inset + (rect.x + rect.w) * wall.width;
        const sillY = ceilingY + (rect.y + rect.h) * wall.height;
        const fx0 = roomFraction(geometry, sillX0);
        const fx1 = roomFraction(geometry, sillX1);
        const d0 = 0.46 + (index % 2) * 0.1;
        const foot0 = { x: floorXAt(geometry, fx0, d0), y: floorYAt(geometry, d0) };
        const foot1 = { x: floorXAt(geometry, fx1, d0), y: floorYAt(geometry, d0) };
        const near0 = { x: floorXAt(geometry, fx0, 1.02), y: floorYAt(geometry, 1.02) };
        const near1 = { x: floorXAt(geometry, fx1, 1.02), y: floorYAt(geometry, 1.02) };
        const beam = quad(clipToFrame([{ x: sillX0, y: sillY }, { x: sillX1, y: sillY }, foot1, foot0], width, height));
        const landing = quad(clipToFrame([foot0, foot1, near1, near0], width, height));
        const pass = 0.34 + ambient.intensity * 0.5;
        return (
          <G key={`beam${index}`} opacity={pass}>
            <Path d={beam} fill={withAlpha(world.glowSoft, 0.22 + ambient.intensity * 0.26)} />
            <Path d={landing} fill={withAlpha(world.glowSoft, 0.3 + ambient.intensity * 0.34)} />
            <Path d={`M ${foot0.x} ${foot0.y} L ${foot1.x} ${foot1.y}`} stroke={withAlpha(world.rim, 0.4 + ambient.intensity * 0.4)} strokeWidth={2.4} />
          </G>
        );
      })}

      {/* Haze at the far end, warmth where the light lands, shade near. */}
      <Path d={floor} fill="url(#roomFloorFade)" opacity={0.9} />
      <Ellipse cx={width / 2} cy={wallBaseY + floorDepth * 0.44} rx={width * 0.44} ry={floorDepth * 0.52} fill="url(#roomPool)" opacity={0.42 + ambient.intensity * 0.34} />
      <Path d={floor} fill="url(#roomWarm)" opacity={0.6} />
      <Rect x={0} y={0} width={width} height={height} fill={withAlpha(world.haze, ambient.warmth * 0.06)} />
      {/* The hot edge where the daylight pools on the boards: the one place in
          the frame that is allowed to burn out. */}
      <Ellipse cx={width / 2} cy={wallBaseY + floorDepth * 0.62} rx={width * 0.2} ry={floorDepth * 0.14} fill={withAlpha(world.glowSoft, 0.16 + ambient.intensity * 0.26)} />
      <Ellipse cx={width * 0.46} cy={wallBaseY + floorDepth * 0.58} rx={width * 0.1} ry={floorDepth * 0.07} fill={withAlpha(world.rim, 0.16 + ambient.intensity * 0.22)} />
      <Path d={`M ${inset} ${wallBaseY} L ${width - inset} ${wallBaseY}`} stroke={withAlpha(world.shadow, 0.4)} strokeWidth={2.4} />
    </Svg>
  );
}
