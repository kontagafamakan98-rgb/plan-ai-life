/**
 * Circulation: the room, alive.
 *
 * The simulation hands us a list of residents and an action each. This hook
 * turns that into a route per resident, remembers where each one actually is
 * (which is not where the simulation thinks they are any more), keeps the
 * residents who are walking out of the room on screen until they are out, and
 * makes the ones who walk in come through the frame instead of appearing on the
 * boards.
 *
 * A resident keeps their plan until what they are doing changes, a new cycle
 * starts, the room changes, or they have finished walking it, so a walk is
 * never restarted just because the screen was redrawn, and a room that stays
 * open for an hour still works its way round its furniture.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { hashString } from '../game/art';
import { entryStop, exitStop, routeFor, type Point, type Stop } from '../game/stations';
import { planWalk, restPose, type Pose, type WalkPlan } from '../game/walk';
import type { Resident } from '../game/types';

export interface WalkerPlan {
  resident: Resident;
  plan: WalkPlan;
  /** Where the resident stands when nothing is allowed to move. */
  rest: Pose;
  /** Someone on their way out of the room: not one of its residents any more. */
  leaving: boolean;
  /** When a departing resident is out of the frame, in milliseconds. 0 otherwise. */
  until: number;
  /** When this walk is walked out and the next leg of the life begins. */
  endsAt: number;
}

interface Options {
  /** The residents the simulation puts in the room we are looking at. */
  residents: Resident[];
  /** The kind of room we are looking at. */
  type: string;
  /** The cycle the room is in: a new action means a new route. */
  cycle: number;
  locationId: string | null;
}

interface Stored {
  key: string;
  /** How many laps of this room the resident has already walked. */
  lap: number;
  resident: Resident;
  plan: WalkPlan;
  rest: Pose;
  /** A lap is over here, and the next one starts from the piece after it. */
  endsAt: number;
}

interface Ghost {
  resident: Resident;
  plan: WalkPlan;
  rest: Pose;
  until: number;
}

/**
 * How late a timer is allowed to be and still count as the end of a lap. A lap
 * would otherwise be missed by a millisecond and the room would go still for
 * good, which is exactly the failure this stopwatch must not have.
 */
const LAP_GRACE = 150;

function simPoint(resident: Resident): Point {
  return { x: resident.position?.x ?? 0.5, y: resident.position?.y ?? 0.5 };
}

export function useCirculation({ residents, type, cycle, locationId }: Options): {
  walkers: WalkerPlan[];
  report: (id: string, spot: Point) => void;
} {
  const [walkers, setWalkers] = useState<WalkerPlan[]>([]);
  const [generation, setGeneration] = useState(0);
  const store = useRef(new Map<string, Stored>());
  const ghosts = useRef(new Map<string, Ghost>());
  const spots = useRef(new Map<string, Point>());
  const seen = useRef(new Map<string, Resident>());
  const here = useRef(new Set<string>());
  const room = useRef<string | null>(null);

  /** A walker tells us where it really is, so no route ever starts from a lie. */
  const report = useCallback((id: string, spot: Point) => {
    spots.current.set(id, spot);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const present = new Set(residents.map((resident) => resident.id));
    const changedRoom = room.current !== locationId;
    if (changedRoom) {
      // Another place entirely: nobody is walking in from the room we left, so
      // the cast is simply put down where the simulation says it stands.
      spots.current.clear();
      seen.current.clear();
      here.current.clear();
      store.current.clear();
      ghosts.current.clear();
    }
    room.current = locationId;

    // Whoever is not in the room any more walks out through the nearest side of
    // the frame, and only then stops existing.
    if (!changedRoom) {
      for (const id of [...here.current]) {
        if (present.has(id)) continue;
        const gone = seen.current.get(id);
        const spot = spots.current.get(id);
        if (!gone || !spot) continue;
        const stops: Stop[] = [{ x: spot.x, y: spot.y, pause: 0 }, exitStop(spot)];
        const plan = planWalk(stops, { once: true });
        ghosts.current.set(id, {
          resident: gone,
          plan,
          rest: restPose(stops),
          until: now + plan.total * 1000 + 200,
        });
      }
    }

    const spotsNow = new Map<string, Point>();
    for (const resident of residents) {
      spotsNow.set(resident.id, spots.current.get(resident.id) ?? simPoint(resident));
    }

    // Stable order, so two residents aiming at the same counter resolve their
    // places the same way on every rebuild.
    for (const resident of [...residents].sort((a, b) => a.id.localeCompare(b.id))) {
      const id = resident.id;
      const action = resident.current_action?.id ?? 'idle';
      const stored = store.current.get(id);
      // The walk is over: the resident starts the next lap of their room, at the
      // piece of furniture after the one they have just left. They are standing
      // still where the loop put them back, so the next route starts there.
      const lap = stored ? stored.lap + (stored.endsAt - now <= LAP_GRACE ? 1 : 0) : 0;
      const key = `${action}|${cycle}|${type}|${lap}`;
      if (stored && stored.key === key) {
        // Same walk: only the mood, the need or the label changed under it.
        stored.resident = resident;
        continue;
      }

      const from = spotsNow.get(id) ?? simPoint(resident);
      const avoid: Point[] = [];
      for (const [otherId, spot] of spotsNow) {
        if (otherId !== id) avoid.push(spot);
      }
      const arrived =
        !changedRoom &&
        !here.current.has(id) &&
        seen.current.has(id) === true &&
        seen.current.get(id)?.location_id !== locationId;
      const stops = routeFor({
        type,
        action,
        seed: hashString(id),
        cycle,
        lap,
        from,
        avoid,
        enter: arrived ? entryStop(simPoint(resident)) : undefined,
      });
      const plan = planWalk(stops);
      store.current.set(id, {
        key,
        lap,
        resident,
        plan,
        rest: restPose(stops),
        endsAt: now + plan.total * 1000,
      });
    }

    for (const id of [...store.current.keys()]) {
      if (!present.has(id)) store.current.delete(id);
    }
    for (const [id, ghost] of [...ghosts.current]) {
      if (ghost.until <= now) ghosts.current.delete(id);
    }

    here.current = present;
    seen.current = new Map(residents.map((resident) => [resident.id, resident]));

    const next: WalkerPlan[] = [];
    for (const stored of store.current.values()) {
      next.push({
        resident: stored.resident,
        plan: stored.plan,
        rest: stored.rest,
        leaving: false,
        until: 0,
        endsAt: stored.endsAt,
      });
    }
    for (const ghost of ghosts.current.values()) {
      next.push({
        resident: ghost.resident,
        plan: ghost.plan,
        rest: ghost.rest,
        leaving: true,
        until: ghost.until,
        endsAt: ghost.until,
      });
    }
    setWalkers(next);
  }, [residents, type, cycle, locationId, generation]);

  // One timer for the whole room: the next thing that happens is either a lap
  // ending or a departing resident finally out of frame. Nothing ticks until
  // then, so a room of standing people costs nothing to watch.
  const wakeAt = walkers.reduce((earliest, walker) => Math.min(earliest, walker.endsAt), Infinity);
  useEffect(() => {
    if (!Number.isFinite(wakeAt)) return undefined;
    const delay = Math.max(120, wakeAt - Date.now() + 80);
    const timer = setTimeout(() => setGeneration((value) => value + 1), delay);
    return () => clearTimeout(timer);
  }, [wakeAt]);

  return { walkers, report };
}
