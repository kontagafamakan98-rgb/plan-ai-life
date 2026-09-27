/**
 * Walk: how a route becomes motion.
 *
 * A route says where a resident goes. This file says how long each leg takes,
 * where the body is between two stops, which way it points, and how far through
 * a stride it is at any instant. It is pure arithmetic over a list of stops: no
 * React, no pixels, no colours, so the rhythm of the room can be reasoned about,
 * and tested, without drawing anything.
 *
 * Four ideas hold the animation together:
 * - a stop is held for its pause, then the walk to the next stop is one leg;
 * - a body turns on the spot before it sets off, so nobody walks sideways;
 * - the stride is counted in room units travelled, not in seconds, so the feet
 *   keep up with the ground whatever the length of the leg;
 * - the amplitude of the swing fades in and out over a fixed share of the
 *   ground covered, so a step grows out of a standstill and settles back into
 *   one instead of being cut off mid air.
 */

import type { Point, Stop } from './stations';

/** Room units covered per second on the boards. */
export const WALK_SPEED = 0.3;
/** Room units covered by one full stride, that is two steps. */
export const STRIDE_LENGTH = 0.2;
/** A hop between two neighbouring pieces of furniture still takes a step. */
const MIN_LEG_SECONDS = 0.75;
/** Seconds spent turning before setting off, so a walk never starts sideways. */
const TURN_SECONDS = 0.22;
/** Share of a leg over which the swing grows into the walk and settles out of it. */
const SETTLE_SHARE = 0.26;

export interface Phase {
  kind: 'hold' | 'walk';
  from: Stop;
  to: Stop;
  start: number;
  end: number;
  /** Total strides walked at the beginning and at the end of the phase. */
  strideFrom: number;
  strideTo: number;
  /** Which way the body points at the beginning and at the end of the phase. */
  facingFrom: number;
  facingTo: number;
}

export interface WalkPlan {
  phases: Phase[];
  /** Seconds for the whole plan, one loop or one one way trip. */
  total: number;
  /** A one way route: it ends where it ends instead of closing the loop. */
  once: boolean;
}

export interface Pose {
  x: number;
  y: number;
  /** 1 walking towards the right of the room, -1 towards the left. */
  facing: number;
  /** Strides walked so far, continuously, so the legs never leave the ground. */
  stride: number;
  /** How much of the swing is on: 0 standing still, 1 at full pace. */
  amp: number;
  walking: boolean;
}

function smoothstep(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

/** Depth costs more than width: the floor is shorter than it is wide. */
function roomDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, (b.y - a.y) * 1.3);
}

/** Where a body looks while it stands on a stop. */
function facingOf(stop: Stop, fallback: number): number {
  if (stop.face === undefined) return fallback;
  const delta = stop.face - stop.x;
  return Math.abs(delta) < 0.02 ? fallback : Math.sign(delta);
}

/**
 * The timeline of one route.
 *
 * A loop of stops gives one hold and one walk per stop and comes back to where
 * it started. A one way route, an entrance or an exit, has no closing leg and
 * no hold on its last stop: it simply ends there.
 */
export function planWalk(stops: Stop[], options: { once?: boolean; speed?: number } = {}): WalkPlan {
  const speed = options.speed ?? WALK_SPEED;
  const once = options.once ?? false;
  const phases: Phase[] = [];
  let cursor = 0;
  let stride = 0;
  let facing = 1;
  const legs = once ? Math.max(1, stops.length - 1) : Math.max(1, stops.length);

  const hold = (stop: Stop, seconds: number, facingTo: number): void => {
    if (seconds <= 0) return;
    phases.push({
      kind: 'hold',
      from: stop,
      to: stop,
      start: cursor,
      end: cursor + seconds,
      strideFrom: stride,
      strideTo: stride,
      facingFrom: facing,
      facingTo,
    });
    cursor += seconds;
    facing = facingTo;
  };

  for (let index = 0; index < legs; index += 1) {
    const from = stops[index % stops.length];
    const to = stops[(index + 1) % stops.length];

    // Standing at a stop, the body turns to the piece it is using before it has
    // finished arriving, which is what a person does with their shoulders.
    hold(from, from.pause, facingOf(from, facing));

    // Crossing the room mostly sideways, the body follows the floor. A leg that
    // only goes deeper keeps the heading it arrived with.
    const heading = Math.abs(to.x - from.x) > 0.015 ? Math.sign(to.x - from.x) : facing;
    // Turning on the spot first: a walk never starts sideways, and the feet do
    // not slide while the shoulders catch up.
    hold(from, facing === heading ? 0 : TURN_SECONDS, heading);

    const length = roomDistance(from, to);
    const seconds = Math.max(MIN_LEG_SECONDS, length / speed);
    phases.push({
      kind: 'walk',
      from,
      to,
      start: cursor,
      end: cursor + seconds,
      strideFrom: stride,
      strideTo: stride + length / STRIDE_LENGTH,
      facingFrom: heading,
      facingTo: heading,
    });
    stride += length / STRIDE_LENGTH;
    cursor += seconds;
  }

  if (!phases.length) {
    const stop = stops[0] ?? { x: 0.5, y: 0.5, pause: 1 };
    phases.push({
      kind: 'hold',
      from: stop,
      to: stop,
      start: 0,
      end: 1,
      strideFrom: 0,
      strideTo: 0,
      facingFrom: 1,
      facingTo: 1,
    });
  }

  return { phases, total: cursor, once };
}

/** The state of a walker part way through its plan. */
export function poseAt(plan: WalkPlan, elapsed: number): Pose {
  const total = plan.total > 0 ? plan.total : 1;
  const looped = ((elapsed % total) + total) % total;
  const t = plan.once ? Math.max(0, Math.min(elapsed, total - 0.0001)) : looped;

  let phase = plan.phases[plan.phases.length - 1];
  for (const candidate of plan.phases) {
    if (t < candidate.end) {
      phase = candidate;
      break;
    }
  }

  const span = Math.max(0.0001, phase.end - phase.start);
  // Turning always takes its own short moment, whether it happens inside a long
  // stand or in a phase of its own before the body sets off.
  const turn = smoothstep((t - phase.start) / Math.min(TURN_SECONDS, span));
  const facing = phase.facingFrom + (phase.facingTo - phase.facingFrom) * turn;

  if (phase.kind === 'hold') {
    return {
      x: phase.from.x,
      y: phase.from.y,
      facing,
      stride: phase.strideFrom,
      amp: 0,
      walking: false,
    };
  }

  const travelled = (t - phase.start) / span;
  const progress = smoothstep(travelled);
  // The swing grows over the first quarter of the ground covered and fades over
  // the last, so a leg starts and settles with the distance walked rather than
  // with a time that would be as long on a hop as on a crossing.
  const amp = smoothstep(Math.min(travelled, 1 - travelled) / SETTLE_SHARE);

  return {
    x: phase.from.x + (phase.to.x - phase.from.x) * progress,
    y: phase.from.y + (phase.to.y - phase.from.y) * progress,
    facing,
    stride: phase.strideFrom + (phase.strideTo - phase.strideFrom) * progress,
    amp,
    walking: true,
  };
}

/**
 * Where a resident stands when nothing is allowed to move: at the furniture
 * that matches what they are doing, so a still room is still a composed one.
 */
export function restPose(stops: Stop[]): Pose {
  const stop = stops[Math.min(1, stops.length - 1)] ?? { x: 0.5, y: 0.5, pause: 0 };
  const delta = (stop.face ?? stop.x + 0.1) - stop.x;
  return {
    x: stop.x,
    y: stop.y,
    facing: Math.abs(delta) < 0.02 ? 1 : Math.sign(delta),
    stride: 0,
    amp: 0,
    walking: false,
  };
}
