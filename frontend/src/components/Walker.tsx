/**
 * Walker: one resident, on the move.
 *
 * A walker owns the clock of its own walk: which stop it left, where it is
 * between two pieces of furniture, how far through a stride it is and which way
 * it points. It asks the room where that spot lands on the boards, draws the
 * sprite there, and tells the circulation hook where the body really is, so the
 * next route starts from the boards and not from the simulation.
 *
 * Only the walker repaints while it walks. The wall, the furniture, the light
 * and the rest of the cast are left alone, which is what makes a room full of
 * people walking affordable.
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { nowSeconds, onFrame } from '../game/clock';
import type { Point } from '../game/stations';
import type { Resident } from '../game/types';
import { poseAt, type Pose, type WalkPlan } from '../game/walk';
import {
  ResidentSprite,
  SPRITE_BASE_HEIGHT,
  SPRITE_BASE_WIDTH,
  SPRITE_GROUND_INSET,
} from './ResidentSprite';
import { usePrefs } from './ui';

interface Props {
  resident: Resident;
  plan: WalkPlan;
  /** Where the resident stands when reduce motion forbids the walk. */
  rest: Pose;
  /** Someone walking out of the room: they cannot be pressed any more. */
  leaving?: boolean;
  /** Where a point of the room lands on screen, and how big it looks there. */
  place: (x: number, y: number) => { cx: number; cy: number; scale: number };
  spriteScale: number;
  selected?: boolean;
  light?: number;
  onPress?: (resident: Resident) => void;
  accessibilityHint?: string;
  onReport?: (id: string, spot: Point) => void;
}

export function Walker({
  resident,
  plan,
  rest,
  leaving,
  place,
  spriteScale,
  selected,
  light,
  onPress,
  accessibilityHint,
  onReport,
}: Props) {
  const { reduceMotion } = usePrefs();
  const [pose, setPose] = useState<Pose>(() => (reduceMotion ? rest : poseAt(plan, 0)));
  const startedAt = useRef(nowSeconds());
  const latest = useRef(pose);
  const report = useRef(onReport);
  report.current = onReport;

  // A new plan is a new walk, and a walk starts at the top of its route.
  useEffect(() => {
    startedAt.current = nowSeconds();
    const first = reduceMotion ? rest : poseAt(plan, 0);
    latest.current = first;
    setPose(first);
    report.current?.(resident.id, { x: first.x, y: first.y });
  }, [plan, rest, reduceMotion, resident.id]);

  // One frame loop for the whole room, shared by every walker.
  useEffect(() => {
    if (reduceMotion) return undefined;
    return onFrame((now) => {
      const next = poseAt(plan, now - startedAt.current);
      const before = latest.current;
      if (
        next.x === before.x &&
        next.y === before.y &&
        next.stride === before.stride &&
        next.amp === before.amp &&
        next.facing === before.facing
      ) {
        return;
      }
      latest.current = next;
      setPose(next);
      report.current?.(resident.id, { x: next.x, y: next.y });
    });
  }, [plan, reduceMotion, resident.id]);

  const spot = place(pose.x, pose.y);
  const scale = spriteScale * spot.scale;
  const width = SPRITE_BASE_WIDTH * scale;

  return (
    <View
      testID={`stage-resident-${resident.id}`}
      style={[
        styles.slot,
        {
          left: spot.cx - width / 2,
          top: spot.cy - (SPRITE_BASE_HEIGHT - SPRITE_GROUND_INSET) * scale,
          width,
          zIndex: 10 + Math.round(pose.y * 1000),
        },
        leaving && styles.gone,
      ]}
    >
      <ResidentSprite
        resident={resident}
        scale={scale}
        selected={selected}
        stride={{ phase: pose.stride - Math.floor(pose.stride), amp: pose.amp, facing: pose.facing }}
        light={light}
        onPress={onPress}
        accessibilityHint={accessibilityHint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: 'absolute' },
  gone: { pointerEvents: 'none' },
});
