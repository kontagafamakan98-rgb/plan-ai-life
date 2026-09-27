/**
 * ResidentSprite: one resident standing in the scene.
 *
 * The drawing itself lives in Figure.tsx. This file adds what a figure needs to
 * feel alive on the stage: a warm aura keyed to the mood, a slow breath, a
 * blink, a walk bob, a pulse when an intervention lands, the mood badge, the
 * action bubble and the name tag.
 *
 * Two things are load bearing for the rest of the app: the box is exactly
 * SPRITE_BASE_WIDTH by SPRITE_BASE_HEIGHT, and the shoes stand on the line
 * SPRITE_GROUND_INSET pixels above its bottom edge, so the stage can put every
 * resident on one floor.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, type as typeTokens, world } from '../theme';
import { withAlpha } from '../game/art';
import { glyph } from '../game/icons';
import { useI18n } from '../game/i18n';
import type { Resident } from '../game/types';
import { BUST_REGION, EYE_REGION, Figure, FigureEyes, moodOf } from './Figure';
import { Icon } from './Icon';
import { usePrefs } from './ui';

const BASE_WIDTH = 96;
const BASE_HEIGHT = 156;

/** Where the shoes sit inside the sprite box, measured from its bottom edge. */
export const SPRITE_GROUND_INSET = 15;
export { BASE_WIDTH as SPRITE_BASE_WIDTH, BASE_HEIGHT as SPRITE_BASE_HEIGHT };

interface Props {
  resident: Resident;
  scale?: number;
  selected?: boolean;
  highlighted?: boolean;
  walking?: boolean;
  onPress?: (resident: Resident) => void;
  showName?: boolean;
  accessibilityHint?: string;
  /** Warm ambient light from the scene, 0 at night to 1 in full daylight. */
  light?: number;
}

export function ResidentSprite({
  resident,
  scale = 1,
  selected,
  highlighted,
  walking,
  onPress,
  showName = true,
  accessibilityHint,
  light = 0.85,
}: Props) {
  const { reduceMotion, contrast } = usePrefs();
  const { lt } = useI18n();
  const bob = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const walk = useRef(new Animated.Value(0)).current;

  const mood = moodOf(resident);
  const moodColor = resident.mood_color ?? palette.accent;

  // Idle bob and breathing.
  useEffect(() => {
    if (reduceMotion) {
      bob.setValue(0);
      breathe.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, breathe, reduceMotion]);

  // Blinking: a short scale-down on a randomised interval.
  useEffect(() => {
    if (reduceMotion) {
      blink.setValue(1);
      return;
    }
    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const schedule = () => {
      timeout = setTimeout(() => {
        if (cancelled) return;
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.08, duration: 70, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true }),
        ]).start(() => schedule());
      }, 2400 + Math.random() * 4200);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [blink, reduceMotion]);

  // Walking bob when the resident is relocating.
  useEffect(() => {
    if (!walking || reduceMotion) {
      walk.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walk, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(walk, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [walk, walking, reduceMotion]);

  // Pulse when an intervention lands on this resident.
  useEffect(() => {
    if (!highlighted || reduceMotion) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, highlighted, reduceMotion]);

  const translateY = Animated.add(
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.4] }),
    walk.interpolate({ inputRange: [0, 1], outputRange: [0, -2.8] }),
  );
  const breath = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.008] });
  const auraOpacity = highlighted
    ? glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.42] })
    : selected
      ? 0.24
      : 0.15;

  const content = (
    <Animated.View style={[sprite.wrap, { width: BASE_WIDTH * scale, height: BASE_HEIGHT * scale }]}>
      <View style={[sprite.scaler, { transform: [{ scale }] }]}>
        <Animated.View
          style={[
            sprite.aura,
            {
              backgroundColor: withAlpha(moodColor, 0.5),
              boxShadow: `0 0 22px ${withAlpha(moodColor, 0.45)}`,
              opacity: auraOpacity,
            },
          ]}
        />

        <Animated.View style={[sprite.box, { transform: [{ translateY }, { scaleY: breath }] }]}>
          <Figure resident={resident} light={light} withEyes={false} />

          {/* The eyes ride in their own layer, so they can blink. */}
          <Animated.View
            style={[
              sprite.eyes,
              {
                left: EYE_REGION.x,
                top: EYE_REGION.y,
                width: EYE_REGION.width,
                height: EYE_REGION.height,
                transform: [{ rotate: `${mood.headTilt}deg` }, { scaleY: blink }],
              },
            ]}
          >
            <FigureEyes resident={resident} width={EYE_REGION.width} height={EYE_REGION.height} />
          </Animated.View>

          {/* Mood badge: the resident's instrument readout, over the world. */}
          <View
            style={[
              sprite.moodBadge,
              { borderColor: withAlpha(moodColor, 0.6), backgroundColor: withAlpha(world.shadow, 0.78) },
            ]}
          >
            <Icon name={glyph(resident.mood_icon)} size={12} color={moodColor} />
          </View>

          {/* What the resident is doing right now. */}
          {resident.current_action?.icon ? (
            <View
              style={[
                sprite.actionBubble,
                { backgroundColor: withAlpha(world.shadow, 0.86), borderColor: withAlpha(world.brass, 0.4) },
              ]}
            >
              <Icon name={glyph(resident.current_action.icon)} size={14} color={world.linen} />
            </View>
          ) : null}

          {showName ? (
            <View style={sprite.nameWrap}>
              <View
                style={[
                  sprite.nameTag,
                  {
                    backgroundColor: withAlpha(world.shadow, 0.82),
                    borderColor: withAlpha(world.brass, 0.45),
                  },
                  contrast && { backgroundColor: withAlpha(world.shadow, 0.96), borderColor: world.brass },
                  selected && { borderColor: world.glow, backgroundColor: withAlpha(world.walnut, 0.92) },
                ]}
              >
                <View style={[sprite.namePin, { backgroundColor: withAlpha(moodColor, 0.9) }]} />
                <Text style={sprite.nameText} numberOfLines={1}>
                  {resident.name.split(' ')[0]}
                </Text>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${resident.name}, ${lt(resident.occupation)}, ${lt(
        resident.current_action?.label,
      )}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={() => onPress(resident)}
      style={sprite.pressable}
    >
      {content}
    </Pressable>
  );
}

/**
 * The resident as a portrait, for the roster and the sheet header.
 *
 * Same drawing, cropped to the head and shoulders: at this size the face, the
 * hair and the mood are finally legible, which is the whole point of the
 * roster. The ratio comes from the crop itself, so no size can distort it.
 */
export function ResidentPortrait({
  resident,
  size = 128,
}: {
  resident: Resident;
  size?: number;
}) {
  const ratio = BUST_REGION.w / BUST_REGION.h;
  const width = Math.round(size * ratio);
  const moodColor = resident.mood_color ?? palette.accent;
  return (
    <View
      testID={`resident-portrait-${resident.id}`}
      style={[
        sprite.portrait,
        {
          width,
          height: size,
          borderColor: withAlpha(world.brass, 0.4),
          boxShadow: `0 6px 16px ${withAlpha(world.shadow, 0.5)}`,
        },
      ]}
    >
      <Figure resident={resident} bust width={width} height={size} />
      <View style={[sprite.portraitPin, { backgroundColor: withAlpha(moodColor, 0.9) }]} />
    </View>
  );
}

const sprite = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  scaler: { alignItems: 'center', justifyContent: 'flex-end', width: BASE_WIDTH, height: BASE_HEIGHT },
  pressable: { alignItems: 'center' },
  box: { width: BASE_WIDTH, height: BASE_HEIGHT, alignItems: 'center', justifyContent: 'flex-end' },

  aura: { position: 'absolute', top: 46, left: 12, width: 72, height: 84, borderRadius: 44 },
  eyes: { position: 'absolute' },

  moodBadge: {
    position: 'absolute',
    top: 20,
    left: 66,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionBubble: {
    position: 'absolute',
    top: 40,
    left: 4,
    borderWidth: 1,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nameWrap: { position: 'absolute', top: 144, left: 0, right: 0, alignItems: 'center' },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    maxWidth: 92,
  },
  namePin: { width: 3, height: 9, borderRadius: 2 },
  nameText: { ...typeTokens.micro, color: world.linen, letterSpacing: 0.4 },

  portrait: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: world.walnut,
  },
  portraitPin: { position: 'absolute', top: 6, left: 6, width: 3, height: 12, borderRadius: 2 },
});
