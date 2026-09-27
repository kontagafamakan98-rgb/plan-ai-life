/**
 * Stations: the places a resident can stand, and the route between them.
 *
 * A room is not a backdrop with a person pasted in the middle of it. It is
 * furniture, and a life is spent moving from one piece of it to the next: the
 * counter, then a table, then back. This file names that furniture once, per
 * location type, says which action families each piece is for, and turns a
 * resident plus a cycle into a short looping route of stops on the floor.
 *
 * Everything here is pure: no React, no colour, no pixels. The stage decides
 * where a stop lands on screen, this file only decides where it stands in the
 * room, how long it stays, and which piece of furniture is next.
 *
 * Coordinates are room coordinates: x is 0 at the left wall and 1 at the right,
 * y is 0 at the back wall and 1 at the near edge of the floor.
 */

import { hashString } from './art';
import type { PropKind } from '../components/Scenery';

export interface Station {
  kind: PropKind;
  /** 0..1 across the room. */
  x: number;
  /** 0..1 down the floor. */
  y: number;
  size?: number;
}

/** A point on the floor, in room coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** A stop on a route: where the feet land, how long they stay, and where the body turns. */
export interface Stop {
  x: number;
  y: number;
  /** Seconds spent standing at this stop before moving on. */
  pause: number;
  /**
   * The x the body faces while it stands here, usually the piece of furniture
   * it is using. A resident who hides against the back wall would be as strange
   * as one standing sideways to the counter they are working at.
   */
  face?: number;
}

/**
 * Which action families belong at each piece of furniture.
 *
 * The families are the ones the engine resolves an action onto, so a resident
 * who is cooking walks to the counter and one who is training walks to a mat,
 * instead of everyone drifting to the middle of the room.
 */
export const STATION_USE: Record<PropKind, string[]> = {
  counter: ['cook', 'eat', 'drink', 'shop', 'work', 'network'],
  machine: ['work', 'game', 'drink', 'study', 'stream', 'exercise'],
  table: ['eat', 'drink', 'chat', 'study', 'create', 'network', 'flirt', 'family', 'watch'],
  desk: ['work', 'study', 'network', 'create', 'shop'],
  bed: ['sleep', 'calm', 'care'],
  sofa: ['calm', 'watch', 'stream', 'chat', 'flirt', 'family', 'idle'],
  bench: ['calm', 'watch', 'chat', 'idle', 'eat', 'drink'],
  shelf: ['study', 'create', 'shop', 'work'],
  mat: ['exercise', 'jog', 'calm', 'party', 'perform'],
  stage: ['perform', 'party', 'create', 'flirt'],
  altar: ['calm', 'study', 'perform', 'family'],
  screen: ['watch', 'stream', 'game', 'calm'],
  plant: ['calm', 'idle'],
  lamp: ['calm', 'idle', 'watch'],
  tree: ['hike', 'jog', 'calm', 'idle'],
  water: ['swim', 'calm', 'jog'],
  stones: ['hike', 'jog', 'calm', 'idle'],
};

/**
 * Where a body stands relative to the piece of furniture it is using: in front
 * of the counter, beside the table, at the foot of the bed. In room units, and
 * always further down the floor than the object, so the resident never stands
 * inside what they are using.
 */
const STAND_OFFSET: Record<PropKind, { dx: number; dy: number }> = {
  counter: { dx: 0, dy: 0.07 },
  machine: { dx: 0.03, dy: 0.05 },
  table: { dx: 0.05, dy: 0.04 },
  desk: { dx: 0, dy: 0.06 },
  bed: { dx: 0.08, dy: 0.03 },
  sofa: { dx: 0, dy: 0.05 },
  bench: { dx: 0, dy: 0.05 },
  shelf: { dx: 0.04, dy: 0.04 },
  mat: { dx: 0, dy: 0.02 },
  stage: { dx: 0, dy: 0.08 },
  altar: { dx: 0.05, dy: 0.05 },
  screen: { dx: 0, dy: 0.09 },
  plant: { dx: 0.04, dy: 0.03 },
  lamp: { dx: 0.03, dy: 0.03 },
  tree: { dx: 0.05, dy: 0.03 },
  water: { dx: 0, dy: 0.08 },
  stones: { dx: 0.04, dy: 0.02 },
};

/** The furniture of every location type. */
export const SCENERY: Record<string, Station[]> = {
  cafe: [
    { kind: 'counter', x: 0.2, y: 0.16 },
    { kind: 'machine', x: 0.06, y: 0.12 },
    { kind: 'table', x: 0.68, y: 0.42 },
    { kind: 'table', x: 0.32, y: 0.62 },
    { kind: 'plant', x: 0.9, y: 0.22 },
    { kind: 'lamp', x: 0.54, y: 0.06 },
  ],
  apartment: [
    { kind: 'bed', x: 0.18, y: 0.26 },
    { kind: 'sofa', x: 0.68, y: 0.56 },
    { kind: 'shelf', x: 0.88, y: 0.14 },
    { kind: 'plant', x: 0.4, y: 0.14 },
    { kind: 'lamp', x: 0.52, y: 0.48 },
  ],
  office: [
    { kind: 'desk', x: 0.18, y: 0.28 },
    { kind: 'desk', x: 0.64, y: 0.28 },
    { kind: 'plant', x: 0.88, y: 0.6 },
    { kind: 'shelf', x: 0.06, y: 0.5 },
    { kind: 'mat', x: 0.44, y: 0.82 },
  ],
  park: [
    { kind: 'tree', x: 0.12, y: 0.2 },
    { kind: 'tree', x: 0.86, y: 0.26 },
    { kind: 'bench', x: 0.46, y: 0.58 },
    { kind: 'plant', x: 0.3, y: 0.76 },
    { kind: 'stones', x: 0.68, y: 0.86 },
  ],
  gym: [
    { kind: 'machine', x: 0.14, y: 0.24 },
    { kind: 'machine', x: 0.34, y: 0.24 },
    { kind: 'bench', x: 0.7, y: 0.44 },
    { kind: 'mat', x: 0.24, y: 0.76 },
    { kind: 'mat', x: 0.64, y: 0.84 },
  ],
  restaurant: [
    { kind: 'table', x: 0.2, y: 0.3 },
    { kind: 'table', x: 0.68, y: 0.38 },
    { kind: 'counter', x: 0.46, y: 0.1 },
    { kind: 'plant', x: 0.9, y: 0.68 },
    { kind: 'lamp', x: 0.36, y: 0.64 },
  ],
  club: [
    { kind: 'stage', x: 0.5, y: 0.14 },
    { kind: 'machine', x: 0.16, y: 0.58 },
    { kind: 'lamp', x: 0.26, y: 0.3 },
    { kind: 'lamp', x: 0.74, y: 0.3 },
    { kind: 'mat', x: 0.5, y: 0.72 },
  ],
  beach: [
    { kind: 'water', x: 0.5, y: 0.06 },
    { kind: 'tree', x: 0.12, y: 0.5 },
    { kind: 'bench', x: 0.76, y: 0.58 },
    { kind: 'stones', x: 0.4, y: 0.8 },
    { kind: 'stones', x: 0.62, y: 0.9 },
  ],
  school: [
    { kind: 'desk', x: 0.22, y: 0.32 },
    { kind: 'desk', x: 0.5, y: 0.32 },
    { kind: 'desk', x: 0.78, y: 0.32 },
    { kind: 'shelf', x: 0.12, y: 0.7 },
    { kind: 'mat', x: 0.62, y: 0.76 },
  ],
  hospital: [
    { kind: 'bed', x: 0.2, y: 0.3 },
    { kind: 'bed', x: 0.6, y: 0.3 },
    { kind: 'machine', x: 0.88, y: 0.26 },
    { kind: 'mat', x: 0.44, y: 0.8 },
  ],
  market: [
    { kind: 'counter', x: 0.18, y: 0.28 },
    { kind: 'counter', x: 0.62, y: 0.28 },
    { kind: 'shelf', x: 0.9, y: 0.5 },
    { kind: 'plant', x: 0.3, y: 0.72 },
    { kind: 'stones', x: 0.72, y: 0.84 },
  ],
  museum: [
    { kind: 'altar', x: 0.3, y: 0.28 },
    { kind: 'altar', x: 0.7, y: 0.28 },
    { kind: 'stones', x: 0.14, y: 0.74 },
    { kind: 'plant', x: 0.88, y: 0.72 },
  ],
  cinema: [
    { kind: 'screen', x: 0.5, y: 0.08, size: 1.35 },
    { kind: 'bench', x: 0.26, y: 0.5 },
    { kind: 'bench', x: 0.74, y: 0.5 },
    { kind: 'bench', x: 0.5, y: 0.82 },
  ],
  temple: [
    { kind: 'altar', x: 0.5, y: 0.24, size: 1.25 },
    { kind: 'stones', x: 0.18, y: 0.74 },
    { kind: 'stones', x: 0.8, y: 0.74 },
    { kind: 'plant', x: 0.6, y: 0.86 },
  ],
  mountain: [
    { kind: 'stones', x: 0.2, y: 0.32 },
    { kind: 'stones', x: 0.7, y: 0.42 },
    { kind: 'tree', x: 0.88, y: 0.56 },
    { kind: 'stones', x: 0.44, y: 0.82 },
  ],
};

export const DEFAULT_SCENERY: Station[] = [
  { kind: 'plant', x: 0.18, y: 0.3 },
  { kind: 'bench', x: 0.6, y: 0.5 },
  { kind: 'stones', x: 0.36, y: 0.8 },
];

export function stationsOf(type: string): Station[] {
  return SCENERY[type] ?? DEFAULT_SCENERY;
}

/** Two bodies closer than this would stand in each other. */
const PERSONAL_SPACE = 0.09;

/** A stable number in 0..1 from a seed and a tag, so routes never shuffle. */
function roll(seed: number, tag: string): number {
  return (hashString(`${seed}:${tag}`) % 1000) / 1000;
}

function clamp01(value: number): number {
  return Math.max(0.04, Math.min(0.96, value));
}

/**
 * How far down the floor a body may stand. Not quite the near edge: a resident
 * whose feet reach the bottom of the frame has their own name plate below it,
 * and a life half out of the picture is a life the viewer cannot follow.
 */
function clampDepth(value: number): number {
  return Math.max(0.04, Math.min(0.88, value));
}

/** The spot a resident stands on to use a piece of furniture. */
export function standAt(station: Station, avoid: Point[] = [], shift = 0): Point {
  const offset = STAND_OFFSET[station.kind] ?? { dx: 0, dy: 0.05 };
  const y = station.y + offset.dy;
  const base = station.x + offset.dx + shift;
  // The side a resident slides to comes from their own seed, never from the
  // other body: two people who both pushed away from each other would drift
  // across the room, one piece at a time, every cycle.
  const side = shift >= 0 ? 1 : -1;
  let x = base;
  // Nobody stands inside anybody: a resident slides along the piece until the
  // spot is theirs, and stops at the wall rather than leaving the room.
  for (let pass = 0; pass < 5; pass += 1) {
    const clash = avoid.find(
      (other) => Math.abs(other.y - y) < PERSONAL_SPACE * 0.8 && Math.abs(other.x - x) < PERSONAL_SPACE,
    );
    if (!clash) break;
    x += side * PERSONAL_SPACE;
  }
  return { x: clamp01(x), y: clampDepth(y) };
}

/**
 * One stop at a piece of furniture: where the feet land, and which way the body
 * turns once it is there.
 */
function stationStop(station: Station, avoid: Point[], shift: number, pause: number): Stop {
  const spot = standAt(station, avoid, shift);
  const lean = spot.x - station.x;
  return {
    ...spot,
    pause,
    // A body does not face the room while it works, it faces the piece. Standing
    // square in front of it, it turns to the side it stands off.
    face: Math.abs(lean) > 0.02 ? station.x : station.x + (station.x < 0.5 ? -0.12 : 0.12),
  };
}

/**
 * The stops a resident walks through in one room.
 *
 * The figure is a loop, so a room never goes still: from where they stand, to
 * the piece of furniture their action belongs to, across the open floor to the
 * next piece, then a moment in the room before starting again. The first stop is
 * where the simulation put them, so a plan begins on the boards and never
 * somewhere they never were.
 *
 * The furniture is visited in an order settled once per resident, and each lap
 * starts at the next piece in it: a resident works their way round the room
 * instead of wearing out the seat of one chair for a whole life. Two residents
 * never take the same route, because the order and the timings are keyed on the
 * id and the cycle.
 */
export function routeFor(options: {
  type: string;
  action?: string;
  /** Stable per resident. */
  seed: number;
  cycle: number;
  /** How many times this resident has already walked their room. */
  lap?: number;
  from: Point;
  /** A resident walking in from outside starts here, off the frame. */
  enter?: Point;
  /** Spots the other residents of the room are standing on. */
  avoid?: Point[];
}): Stop[] {
  const { type, action, seed, cycle, lap = 0, from, enter, avoid = [] } = options;
  const stations = stationsOf(type);
  if (!stations.length) return [{ x: clamp01(from.x), y: clampDepth(from.y), pause: 9 }];

  const near = (station: Station) => Math.abs(station.y - from.y) + Math.abs(station.x - from.x) * 0.6;
  const matches = action ? stations.filter((station) => (STATION_USE[station.kind] ?? []).includes(action)) : [];
  const pool = matches.length ? matches : [...stations].sort((a, b) => near(a) - near(b)).slice(0, 3);

  // One settled order of this room's furniture, walked lap after lap, so the
  // resident who is cooking is at the counter on one lap and at the machine on
  // the next instead of haunting a single seat.
  const order = pool
    .map((station, index) => ({ station, rank: roll(seed, `order${index}`) }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.station);
  const first = order[lap % order.length];
  const second = order[(lap + 1) % order.length];
  const shift = (roll(seed, 'spread') - 0.5) * 0.06;
  // A new lap is a new errand: its timings and its crossings are keyed on it.
  const lapSeed = seed + cycle + lap * 13;

  const stops: Stop[] = [];
  if (enter) {
    // Walking in: the first stop is the doorway, so the plan starts outside.
    stops.push({ x: enter.x, y: clampDepth(enter.y), pause: 0, face: first.x });
  } else {
    stops.push({
      x: clamp01(from.x),
      y: clampDepth(from.y),
      pause: 0.7 + roll(lapSeed, 'p0') * 0.9,
      face: first.x,
    });
  }

  const at = stationStop(first, avoid, shift, 2.2 + roll(lapSeed, 'p1') * 2.4);
  stops.push(at);

  if (second !== first) {
    const other = stationStop(second, avoid, -shift, 1.8 + roll(lapSeed, 'p2') * 2.2);
    // Halfway between the two pieces of furniture, out in the open floor: the
    // room gets crossed rather than cut through in a straight line.
    stops.push({
      x: clamp01((at.x + other.x) / 2 + (roll(lapSeed, 'cross') - 0.5) * 0.16),
      y: clampDepth((at.y + other.y) / 2 + 0.05 + roll(lapSeed, 'crossy') * 0.08),
      pause: 0.6 + roll(lapSeed, 'crossp') * 0.9,
      face: other.x,
    });
    stops.push(other);
  }

  // Somewhere to breathe, between two pieces of furniture and never in a wall.
  stops.push({
    x: clamp01(from.x + (roll(lapSeed, 'wander') - 0.5) * 0.3),
    y: clampDepth(from.y + 0.05 + roll(seed, 'settle') * 0.12),
    pause: 1.4 + roll(lapSeed, 'p3') * 1.8,
    face: first.x,
  });
  return stops;
}

/** How long a resident walks the whole loop, at least, before it repeats. */
export function routeLength(stops: Stop[]): number {
  return stops.reduce((total, stop) => total + stop.pause, 0);
}

/** A resident leaving the room: the nearest side of the frame, out of it. */
export function exitStop(from: Point): Stop {
  return { x: from.x < 0.5 ? -0.12 : 1.12, y: from.y, pause: 0 };
}

/** A resident arriving: they walk in from the nearest side of the frame. */
export function entryStop(to: Point): Stop {
  return { x: to.x < 0.5 ? -0.12 : 1.12, y: clampDepth(to.y), pause: 0 };
}
