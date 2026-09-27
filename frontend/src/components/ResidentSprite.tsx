/**
 * ResidentSprite: the cast, drawn entirely with plain views.
 *
 * Art direction: the world inside the glass is warm. Every shadow is pulled
 * toward brown, every highlight toward cream, and every garment is built from a
 * named cut (shirt, jacket, hoodie, coat, tunic, wrap) so the six residents read
 * as six different people even in silhouette, at 40 pixels tall. Nothing is
 * derived from any existing property: faces, hair, clothes and accessories are
 * drawn here from the palette the engine sends for each resident.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, type, world } from '../theme';
import {
  garmentOf,
  SILHOUETTE_SHAPE,
  silhouetteOf,
  warmLight,
  warmShade,
  withAlpha,
  type Garment as GarmentCut,
} from '../game/art';
import { glyph } from '../game/icons';
import { useI18n } from '../game/i18n';
import type { Resident } from '../game/types';
import { Icon } from './Icon';
import { usePrefs } from './ui';

const BASE_WIDTH = 96;
const BASE_HEIGHT = 156;

/**
 * Where the shoes sit inside the sprite box, measured from its bottom edge.
 *
 * The stage anchors every resident on this line so two people standing at the
 * same depth share a floor, and so nobody floats above the boards.
 */
export const SPRITE_GROUND_INSET = 15;
export { BASE_WIDTH as SPRITE_BASE_WIDTH, BASE_HEIGHT as SPRITE_BASE_HEIGHT };

type MoodShape = {
  browTilt: number;
  browLift: number;
  mouth: 'smile' | 'flat' | 'frown' | 'open';
  cheek: number;
  eyeOpen: number;
  lid: number;
};

const MOOD_SHAPES: Record<string, MoodShape> = {
  radiant: { browTilt: -3, browLift: -1, mouth: 'open', cheek: 0.9, eyeOpen: 1, lid: 0 },
  content: { browTilt: -1.5, browLift: 0, mouth: 'smile', cheek: 0.75, eyeOpen: 1, lid: 0.1 },
  focused: { browTilt: 3, browLift: 1.5, mouth: 'flat', cheek: 0.25, eyeOpen: 0.96, lid: 0.25 },
  neutral: { browTilt: 0, browLift: 0, mouth: 'flat', cheek: 0.32, eyeOpen: 1, lid: 0.2 },
  tired: { browTilt: 1.5, browLift: 1, mouth: 'flat', cheek: 0.2, eyeOpen: 0.62, lid: 0.5 },
  anxious: { browTilt: 5, browLift: -1, mouth: 'frown', cheek: 0.35, eyeOpen: 1, lid: 0.1 },
  upset: { browTilt: 6, browLift: -2, mouth: 'frown', cheek: 0.55, eyeOpen: 0.88, lid: 0.2 },
  lost: { browTilt: 2.5, browLift: 2, mouth: 'flat', cheek: 0.15, eyeOpen: 0.8, lid: 0.3 },
};

/* ------------------------------------------------------------------ *
 * Hair
 * ------------------------------------------------------------------ */

/** Hair is layered so it can sit behind the head, on it, and in front of it. */
function Hair({ style: hairStyle, color }: { style: string; color: string }) {
  const deep = warmShade(color, -26, 0.3);
  const lit = warmLight(color, 22, 0.28);
  const sheen = withAlpha(lit, 0.5);
  const root = warmShade(color, -12, 0.22);

  switch (hairStyle) {
    case 'braids':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: deep, top: 4, height: 46 }]} />
          {[0, 1, 2].map((step) => (
            <View
              key={`b${step}`}
              style={[hair.braid, { backgroundColor: step % 2 ? color : root, left: -9, top: 24 + step * 13 }]}
            />
          ))}
          {[0, 1, 2].map((step) => (
            <View
              key={`c${step}`}
              style={[hair.braid, { backgroundColor: step % 2 ? color : root, right: -9, top: 24 + step * 13 }]}
            />
          ))}
          <View style={[hair.fringeStraight, { backgroundColor: color }]} />
          <View style={[hair.sheenBand, { backgroundColor: sheen, left: 6, right: 16 }]} />
          <View style={[hair.partLine, { backgroundColor: deep }]} />
          <View style={[hair.tieSmall, { backgroundColor: lit, left: -6, top: 20 }]} />
          <View style={[hair.tieSmall, { backgroundColor: lit, right: -6, top: 20 }]} />
        </>
      );
    case 'undercut':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: deep, top: 3, height: 36 }]} />
          <View style={[hair.sideShort, { backgroundColor: warmShade(color, -40, 0.24) }]} />
          <View style={[hair.shavedLine, { backgroundColor: warmShade(color, -30, 0.2) }]} />
          <View style={[hair.fringeSweep, { backgroundColor: lit }]} />
          <View style={[hair.sweepUnder, { backgroundColor: color }]} />
        </>
      );
    case 'bun':
      return (
        <>
          <View style={[hair.bunWrap, { backgroundColor: root }]} />
          <View style={[hair.bunTop, { backgroundColor: color }]} />
          <View style={[hair.bunCoil, { backgroundColor: lit, opacity: 0.55 }]} />
          <View style={[hair.backWide, { backgroundColor: deep, top: 6, height: 38 }]} />
          <View style={[hair.fringeSweep, { backgroundColor: color }]} />
          <View style={[hair.sheenBand, { backgroundColor: sheen, left: 10, right: 14 }]} />
        </>
      );
    case 'curls':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: deep, top: 3, height: 44 }]} />
          {[
            { left: -7, top: 8, size: 21 },
            { right: -6, top: 9, size: 20 },
            { left: 10, top: -1, size: 22 },
            { left: 26, top: 2, size: 18 },
            { left: -2, top: 22, size: 16 },
            { left: 30, top: 20, size: 15 },
          ].map((curl, index) => (
            <View
              key={index}
              style={[
                hair.curl,
                {
                  backgroundColor: index % 3 === 1 ? root : index % 3 === 2 ? lit : color,
                  width: curl.size,
                  height: curl.size * 0.92,
                  left: curl.left,
                  top: curl.top,
                },
              ]}
            />
          ))}
          <View style={[hair.fringeCurly, { backgroundColor: color }]} />
          <View style={[hair.sheenBand, { backgroundColor: sheen, left: 12, right: 18 }]} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <View style={[hair.pony, { backgroundColor: deep }]} />
          <View style={[hair.ponyStrand, { backgroundColor: color }]} />
          <View style={[hair.backWide, { backgroundColor: deep, top: 4, height: 38 }]} />
          <View style={[hair.fringeSweep, { backgroundColor: color }]} />
          <View style={[hair.sheenBand, { backgroundColor: sheen, left: 8, right: 18 }]} />
          <View style={[hair.tieSmall, { backgroundColor: lit, right: -13, top: 12 }]} />
        </>
      );
    case 'swept':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: deep, top: 5, height: 35 }]} />
          <View style={[hair.fringeSweep, { backgroundColor: warmLight(color, 8, 0.2) }]} />
          <View style={[hair.sweepUnder, { backgroundColor: root }]} />
          <View style={[hair.sideShort, { backgroundColor: warmShade(color, -30, 0.22) }]} />
          <View style={[hair.sheenBand, { backgroundColor: sheen, left: 12, right: 10, top: 1 }]} />
        </>
      );
    case 'bob':
    default:
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: deep, top: 5, height: 42 }]} />
          <View style={[hair.fringeStraight, { backgroundColor: color }]} />
          <View style={[hair.sheenBand, { backgroundColor: sheen, left: 9, right: 15 }]} />
          <View style={[hair.partLine, { backgroundColor: deep, left: '52%' }]} />
        </>
      );
  }
}

/* ------------------------------------------------------------------ *
 * Accessories
 * ------------------------------------------------------------------ */

function Accessory({ kind, accent, skin }: { kind: string; accent: string; skin: string }) {
  const leather = warmShade(accent, -46, 0.4);
  switch (kind) {
    case 'headphones':
      return (
        <>
          <View style={[acc.headband, { borderColor: withAlpha(world.brass, 0.9) }]} />
          <View style={[acc.cup, { backgroundColor: leather, left: -9, top: 24 }]}>
            <View style={[acc.cupFoam, { backgroundColor: warmShade(accent, -18, 0.3) }]} />
          </View>
          <View style={[acc.cup, { backgroundColor: leather, right: -9, top: 24 }]}>
            <View style={[acc.cupFoam, { backgroundColor: warmShade(accent, -18, 0.3) }]} />
          </View>
        </>
      );
    case 'stethoscope':
      return (
        <>
          <View style={[acc.stethoLoop, { borderColor: warmShade(accent, -18, 0.25) }]} />
          <View style={[acc.stethoTube, { backgroundColor: warmShade(accent, -30, 0.3) }]} />
          <View style={[acc.stethoEnd, { backgroundColor: world.brass, borderColor: world.brassDark }]} />
        </>
      );
    case 'apron':
      return (
        <>
          <View style={[acc.apronString, { backgroundColor: leather }]} />
          <View style={[acc.apronBib, { backgroundColor: world.linen, borderColor: warmShade(world.linen, -34) }]}>
            <View style={[acc.apronPocket, { backgroundColor: warmShade(world.linen, -12) }]} />
          </View>
          <View style={[acc.apronTie, { backgroundColor: leather }]} />
        </>
      );
    case 'visor':
      return (
        <>
          <View style={[acc.visorBand, { backgroundColor: leather }]} />
          <View style={[acc.visor, { backgroundColor: withAlpha(world.glow, 0.55), borderColor: world.brassDark }]} />
          <View style={[acc.visorSheen, { backgroundColor: withAlpha(world.rim, 0.4) }]} />
        </>
      );
    case 'scarf':
      return (
        <>
          <View style={[acc.scarf, { backgroundColor: accent }]} />
          <View style={[acc.scarfFold, { backgroundColor: warmShade(accent, -22, 0.3) }]} />
          <View style={[acc.scarfTail, { backgroundColor: warmShade(accent, -14, 0.3) }]} />
        </>
      );
    case 'satchel':
      return (
        <>
          <View style={[acc.strap, { backgroundColor: leather }]} />
          <View style={[acc.bag, { backgroundColor: warmShade(accent, -28, 0.34), borderColor: leather }]}>
            <View style={[acc.bagFlap, { backgroundColor: warmShade(accent, -14, 0.3) }]} />
            <View style={[acc.bagBuckle, { backgroundColor: world.brass }]} />
          </View>
        </>
      );
    case 'none':
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ *
 * Garments
 * ------------------------------------------------------------------ */

/**
 * One cut per resident.
 *
 * The cut is what makes two people in similar colours look different: a coat
 * covers the hips, a hoodie puts a mass behind the head, a wrap crosses at the
 * front. Each one also carries its own shading, in warm tones.
 */
function Garment({
  cut,
  top,
  accent,
  skin,
  width,
  height,
  shoulder,
  waist,
  armWidth,
  armSwing,
}: {
  cut: GarmentCut;
  top: string;
  accent: string;
  skin: string;
  width: number;
  height: number;
  shoulder: number;
  waist: number;
  armWidth: number;
  armSwing: Animated.AnimatedInterpolation<number> | number;
}) {
  const cloth = warmShade(top, -20, 0.24);
  const fold = warmShade(top, -34, 0.3);
  const lit = warmLight(top, 26, 0.26);
  const sleeve = (side: 'left' | 'right') => (
    <Animated.View
      key={side}
      style={[
        garment.arm,
        {
          backgroundColor: cloth,
          borderColor: fold,
          width: armWidth,
          left: side === 'left' ? 1 : undefined,
          right: side === 'right' ? 1 : undefined,
          transform: [{ rotate: side === 'left' ? '-11deg' : '11deg' }, { translateY: armSwing }],
        },
      ]}
    >
      <View style={[garment.sleeveHem, { backgroundColor: fold }]} />
    </Animated.View>
  );

  return (
    <>
      {cut === 'hoodie' ? (
        <View style={[garment.hood, { backgroundColor: cloth, borderColor: fold }]} />
      ) : null}
      {sleeve('left')}
      {sleeve('right')}

      <View
        style={[
          garment.body,
          {
            backgroundColor: top,
            borderColor: fold,
            width,
            height,
            borderTopLeftRadius: shoulder,
            borderTopRightRadius: shoulder,
            borderBottomLeftRadius: waist,
            borderBottomRightRadius: waist,
          },
        ]}
      >
        {/* Warm rim light down the lit side of every torso. */}
        <View style={[garment.rim, { backgroundColor: withAlpha(world.rim, 0.22) }]} />
        <View style={[garment.foldLine, { backgroundColor: withAlpha(fold, 0.5) }]} />

        {cut === 'shirt' ? (
          <>
            <View style={[garment.collarLeft, { backgroundColor: lit, borderColor: fold }]} />
            <View style={[garment.collarRight, { backgroundColor: lit, borderColor: fold }]} />
            <View style={[garment.placket, { backgroundColor: fold }]} />
            <View style={[garment.hem, { backgroundColor: fold }]} />
          </>
        ) : null}

        {cut === 'jacket' ? (
          <>
            <View style={[garment.inner, { backgroundColor: lit }]} />
            <View style={[garment.lapelLeft, { backgroundColor: cloth, borderColor: fold }]} />
            <View style={[garment.lapelRight, { backgroundColor: cloth, borderColor: fold }]} />
            <View style={[garment.pocket, { backgroundColor: withAlpha(fold, 0.6), left: 4 }]} />
            <View style={[garment.pocket, { backgroundColor: withAlpha(fold, 0.6), right: 4 }]} />
          </>
        ) : null}

        {cut === 'hoodie' ? (
          <>
            <View style={[garment.drawstring, { backgroundColor: lit, left: '42%' }]} />
            <View style={[garment.drawstring, { backgroundColor: lit, left: '56%' }]} />
            <View style={[garment.kangaroo, { backgroundColor: withAlpha(fold, 0.55) }]} />
          </>
        ) : null}

        {cut === 'coat' ? (
          <>
            <View style={[garment.inner, { backgroundColor: lit }]} />
            <View style={[garment.lapelLeft, { backgroundColor: cloth, borderColor: fold, height: height * 0.5 }]} />
            <View style={[garment.lapelRight, { backgroundColor: cloth, borderColor: fold, height: height * 0.5 }]} />
            <View style={[garment.belt, { backgroundColor: fold }]} />
            <View style={[garment.buckle, { backgroundColor: world.brass, borderColor: world.brassDark }]} />
            {[0, 1, 2].map((index) => (
              <View key={index} style={[garment.button, { backgroundColor: world.brass, top: height * 0.34 + index * 9 }]} />
            ))}
          </>
        ) : null}

        {cut === 'tunic' ? (
          <>
            <View style={[garment.crossLeft, { backgroundColor: cloth, borderColor: fold }]} />
            <View style={[garment.crossRight, { backgroundColor: lit, borderColor: fold }]} />
            <View style={[garment.sash, { backgroundColor: accent }]} />
          </>
        ) : null}

        {cut === 'wrap' ? (
          <>
            <View style={[garment.wrapLeft, { backgroundColor: cloth, borderColor: fold }]} />
            <View style={[garment.wrapRight, { backgroundColor: top, borderColor: fold }]} />
            <View style={[garment.sash, { backgroundColor: accent, top: height * 0.52 }]} />
            <View style={[garment.hem, { backgroundColor: fold }]} />
          </>
        ) : null}
      </View>

      <View style={[garment.hand, { backgroundColor: skin, left: 1 }]} />
      <View style={[garment.hand, { backgroundColor: skin, right: 1 }]} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Sprite
 * ------------------------------------------------------------------ */

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

  const look = resident.look ?? {
    skin: '#E8C6A0',
    hair: '#4A3728',
    hairstyle: 'bob',
    eyes: '#3B2B20',
    outfit: { top: '#B4623C', bottom: '#4A3A2E', accent: '#D9A24A' },
    accessory: 'none',
  };
  const outfit = look.outfit ?? { top: '#B4623C', bottom: '#4A3A2E', accent: '#D9A24A' };
  const mood = MOOD_SHAPES[resident.mood] ?? MOOD_SHAPES.neutral;
  const moodColor = resident.mood_color ?? palette.accent;
  const cut = garmentOf(resident);
  const shape = SILHOUETTE_SHAPE[silhouetteOf(resident)];

  // Skin is rendered in three warm tones: base, shadow, light.
  const skin = look.skin;
  const skinShadow = warmShade(skin, -26, 0.34);
  const skinLight = warmLight(skin, 20, 0.4);
  const hairShadow = warmShade(look.hair, -18, 0.28);
  const irisDeep = warmShade(look.eyes, -22, 0.3);

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
          Animated.timing(blink, { toValue: 0.1, duration: 70, useNativeDriver: true }),
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
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3.5] }),
    walk.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }),
  );

  const torsoScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.022] });
  const leftLeg = walking ? walk.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) : 0;
  const rightLeg = walking ? walk.interpolate({ inputRange: [0, 1], outputRange: [-3, 0] }) : 0;
  const armSwing = walk.interpolate({ inputRange: [0, 1], outputRange: [-2.5, 2.5] });

  const ringOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] });
  const rimOpacity = 0.14 + Math.max(0, Math.min(1, light)) * 0.2;

  const content = (
    <Animated.View style={[sprite.wrap, { width: BASE_WIDTH * scale, height: BASE_HEIGHT * scale }]}>
      <View style={[sprite.scaler, { transform: [{ scale }] }]}>
        {/* Warm aura, keyed to the resident's mood. */}
        <Animated.View
          style={[
            sprite.aura,
            { backgroundColor: moodColor, boxShadow: `0 0 18px ${withAlpha(moodColor, 0.4)}` },
            { opacity: highlighted ? ringOpacity : 0.14 },
          ]}
        />

        <Animated.View style={{ transform: [{ translateY }] }}>
          {/* Contact shadow: warm brown, never neutral black. */}
          <View style={sprite.shadow} />
          <View style={sprite.shadowCore} />

          <View style={[sprite.column, { height: BASE_HEIGHT - 26 }]}>
            <View style={[sprite.moodBadge, { borderColor: withAlpha(moodColor, 0.55), backgroundColor: withAlpha(world.shadow, 0.8) }]}>
              <Icon name={glyph(resident.mood_icon)} size={12} color={moodColor} />
            </View>

            {/* Head */}
            <View style={sprite.headWrap}>
              <Hair style={look.hairstyle} color={look.hair} />

              <View style={[sprite.head, { backgroundColor: skin, borderColor: withAlpha(world.shadow, 0.34) }]}>
                <View style={[sprite.headLight, { backgroundColor: withAlpha(skinLight, 0.5) }]} />
                <View style={[sprite.jawShade, { backgroundColor: withAlpha(skinShadow, 0.45) }]} />
                <View style={[sprite.ear, { backgroundColor: skin, borderColor: withAlpha(skinShadow, 0.6), left: -4 }]}>
                  <View style={[sprite.earInner, { backgroundColor: withAlpha(skinShadow, 0.5) }]} />
                </View>
                <View style={[sprite.ear, { backgroundColor: skin, borderColor: withAlpha(skinShadow, 0.6), right: -4 }]}>
                  <View style={[sprite.earInner, { backgroundColor: withAlpha(skinShadow, 0.5) }]} />
                </View>

                {/* Eyes */}
                <Animated.View style={[sprite.eyesRow, { transform: [{ scaleY: blink }] }]}>
                  {[0, 1].map((side) => (
                    <View key={side} style={sprite.eye}>
                      <View style={sprite.sclera} />
                      <View
                        style={[
                          sprite.iris,
                          { backgroundColor: look.eyes, height: 10 * mood.eyeOpen },
                        ]}
                      >
                        <View style={[sprite.irisDeep, { backgroundColor: irisDeep }]} />
                        <View style={sprite.pupil} />
                        <View style={sprite.glint} />
                      </View>
                      <View style={[sprite.upperLash, { backgroundColor: withAlpha(hairShadow, 0.85) }]} />
                      <View
                        style={[
                          sprite.lid,
                          { height: 5 * mood.lid, backgroundColor: withAlpha(skinShadow, 0.9) },
                        ]}
                      />
                    </View>
                  ))}
                </Animated.View>

                {/* Brows */}
                <View style={[sprite.browRow, { marginTop: 1 + mood.browLift }]}>
                  <View
                    style={[
                      sprite.brow,
                      { backgroundColor: withAlpha(hairShadow, 0.95), transform: [{ rotate: `${mood.browTilt}deg` }] },
                    ]}
                  />
                  <View
                    style={[
                      sprite.brow,
                      { backgroundColor: withAlpha(hairShadow, 0.95), transform: [{ rotate: `${-mood.browTilt}deg` }] },
                    ]}
                  />
                </View>

                {/* Nose */}
                <View style={sprite.noseWrap}>
                  <View style={[sprite.nose, { backgroundColor: withAlpha(skinShadow, 0.75) }]} />
                </View>

                {/* Cheeks and mouth */}
                <View style={sprite.cheekRow}>
                  <View style={[sprite.cheek, { opacity: mood.cheek }]} />
                  <View style={[sprite.cheek, { opacity: mood.cheek }]} />
                </View>

                <View style={sprite.mouthWrap}>
                  {mood.mouth === 'smile' ? <View style={[sprite.mouthSmile, { borderColor: withAlpha(warmShade(skin, -74, 0.4), 0.85) }]} /> : null}
                  {mood.mouth === 'flat' ? <View style={[sprite.mouthFlat, { backgroundColor: withAlpha(warmShade(skin, -74, 0.4), 0.8) }]} /> : null}
                  {mood.mouth === 'frown' ? <View style={[sprite.mouthFrown, { borderColor: withAlpha(warmShade(skin, -74, 0.4), 0.85) }]} /> : null}
                  {mood.mouth === 'open' ? <View style={[sprite.mouthOpen, { backgroundColor: withAlpha(warmShade(skin, -92, 0.45), 0.9) }]} /> : null}
                </View>
              </View>

              <View style={[sprite.headRim, { backgroundColor: withAlpha(world.rim, rimOpacity) }]} />
              <Accessory kind={look.accessory} accent={outfit.accent} skin={skin} />
            </View>

            {/* Neck and torso */}
            <View style={[sprite.neck, { backgroundColor: skin, borderColor: withAlpha(skinShadow, 0.7) }]}>
              <View style={[sprite.neckShade, { backgroundColor: withAlpha(skinShadow, 0.55) }]} />
            </View>
            <Animated.View style={[sprite.torsoWrap, { transform: [{ scaleY: torsoScale }] }]}>
              <Garment
                cut={cut}
                top={outfit.top}
                accent={outfit.accent}
                skin={skin}
                width={shape.torsoWidth}
                height={shape.torsoHeight + (cut === 'coat' ? 6 : 0)}
                shoulder={shape.shoulder}
                waist={shape.waist}
                armWidth={shape.armWidth}
                armSwing={armSwing}
              />
            </Animated.View>

            {/* Legs */}
            <View style={sprite.legs}>
              <Animated.View style={{ transform: [{ translateY: leftLeg }] }}>
                <View
                  style={[
                    sprite.leg,
                    {
                      backgroundColor: outfit.bottom,
                      borderColor: withAlpha(warmShade(outfit.bottom, -30, 0.3), 0.85),
                      width: shape.legWidth,
                    },
                  ]}
                >
                  <View style={[sprite.legFold, { backgroundColor: withAlpha(warmShade(outfit.bottom, -26, 0.3), 0.6) }]} />
                </View>
                <View style={[sprite.shoe, { backgroundColor: warmShade(outfit.bottom, -46, 0.42), width: shape.legWidth + 4 }]}>
                  <View style={[sprite.sole, { backgroundColor: withAlpha(world.shadow, 0.55) }]} />
                </View>
              </Animated.View>
              <Animated.View style={{ transform: [{ translateY: rightLeg }] }}>
                <View
                  style={[
                    sprite.leg,
                    {
                      backgroundColor: outfit.bottom,
                      borderColor: withAlpha(warmShade(outfit.bottom, -30, 0.3), 0.85),
                      width: shape.legWidth,
                    },
                  ]}
                >
                  <View style={[sprite.legFold, { backgroundColor: withAlpha(warmShade(outfit.bottom, -26, 0.3), 0.6) }]} />
                </View>
                <View style={[sprite.shoe, { backgroundColor: warmShade(outfit.bottom, -46, 0.42), width: shape.legWidth + 4 }]}>
                  <View style={[sprite.sole, { backgroundColor: withAlpha(world.shadow, 0.55) }]} />
                </View>
              </Animated.View>
            </View>
          </View>

          {/* Action bubble */}
          {resident.current_action?.icon ? (
            <View style={[sprite.actionBubble, { backgroundColor: withAlpha(world.shadow, 0.86), borderColor: withAlpha(world.brass, 0.4) }]}>
              <Icon name={glyph(resident.current_action.icon)} size={14} color={world.linen} />
            </View>
          ) : null}

          {/* Name tag: parchment over the scene, never a floating UI chip. */}
          {showName ? (
            <View
              style={[
                sprite.nameTag,
                {
                  backgroundColor: withAlpha(world.shadow, 0.82),
                  borderColor: withAlpha(world.brass, 0.45),
                },
                contrast && { backgroundColor: withAlpha(world.shadow, 0.96), borderColor: world.brass },
                selected && { borderColor: world.glow, backgroundColor: withAlpha(world.walnut, 0.9), borderWidth: 1.5 },
              ]}
            >
              <Text style={sprite.nameText} numberOfLines={1}>
                {resident.name.split(' ')[0]}
              </Text>
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

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

const hair = StyleSheet.create({
  backWide: {
    position: 'absolute',
    left: -6,
    right: -6,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  sideLobe: { position: 'absolute', width: 12, height: 26, borderRadius: 7 },
  braid: { position: 'absolute', width: 10, height: 15, borderRadius: 5 },
  fringeStraight: {
    position: 'absolute',
    top: -4,
    left: 1,
    right: 1,
    height: 23,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  fringeSweep: {
    position: 'absolute',
    top: -5,
    left: -1,
    right: -7,
    height: 21,
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 4,
    transform: [{ rotate: '-6deg' }],
  },
  sweepUnder: {
    position: 'absolute',
    top: 6,
    left: 2,
    right: 6,
    height: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  fringeCurly: {
    position: 'absolute',
    top: -6,
    left: 0,
    right: 0,
    height: 19,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
  },
  partLine: { position: 'absolute', top: -4, left: '48%', width: 1.8, height: 17, borderRadius: 1 },
  sheenBand: { position: 'absolute', top: 2, height: 4, borderRadius: 3 },
  bunWrap: { position: 'absolute', top: -15, left: '25%', width: 26, height: 22, borderRadius: 11 },
  bunTop: { position: 'absolute', top: -12, left: '27%', width: 22, height: 18, borderRadius: 9 },
  bunCoil: { position: 'absolute', top: -10, left: '31%', width: 14, height: 5, borderRadius: 3 },
  curl: { position: 'absolute', borderRadius: 999 },
  pony: {
    position: 'absolute',
    right: -18,
    top: 4,
    width: 22,
    height: 44,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    transform: [{ rotate: '12deg' }],
  },
  ponyStrand: {
    position: 'absolute',
    right: -13,
    top: 10,
    width: 8,
    height: 32,
    borderRadius: 5,
    opacity: 0.75,
    transform: [{ rotate: '10deg' }],
  },
  sideShort: { position: 'absolute', left: -4, right: -4, top: 21, height: 13, borderBottomLeftRadius: 9, borderBottomRightRadius: 9 },
  shavedLine: { position: 'absolute', left: -2, right: 12, top: 25, height: 2.5, borderRadius: 2, opacity: 0.55 },
  tieSmall: { position: 'absolute', width: 9, height: 7, borderRadius: 3 },
});

const acc = StyleSheet.create({
  headband: { position: 'absolute', top: -10, left: 1, right: 1, height: 28, borderTopWidth: 4, borderRadius: 999 },
  cup: { position: 'absolute', width: 12, height: 17, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  cupFoam: { width: 7, height: 10, borderRadius: 4 },
  stethoLoop: { position: 'absolute', top: 40, left: 10, right: 10, height: 17, borderBottomWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderBottomLeftRadius: 11, borderBottomRightRadius: 11 },
  stethoTube: { position: 'absolute', top: 52, left: '47%', width: 3, height: 24, borderRadius: 2 },
  stethoEnd: { position: 'absolute', top: 74, left: '42%', width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  apronString: { position: 'absolute', top: 64, left: 7, right: 7, height: 2.5 },
  apronBib: { position: 'absolute', top: 64, left: 11, right: 11, height: 30, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, borderWidth: 1 },
  apronPocket: { position: 'absolute', bottom: 6, left: 5, right: 5, height: 9, borderRadius: 3 },
  apronTie: { position: 'absolute', top: 92, left: 9, right: 9, height: 3 },
  visorBand: { position: 'absolute', top: 8, left: -5, right: -5, height: 5, borderRadius: 3 },
  visor: { position: 'absolute', top: 13, left: -5, right: -5, height: 10, borderRadius: 5, borderWidth: 1 },
  visorSheen: { position: 'absolute', top: 15, left: 0, width: 12, height: 3, borderRadius: 2 },
  scarf: { position: 'absolute', top: 54, left: 7, right: 7, height: 10, borderRadius: 5 },
  scarfFold: { position: 'absolute', top: 61, left: 7, right: 7, height: 3, borderRadius: 2 },
  scarfTail: { position: 'absolute', top: 62, left: 11, width: 8, height: 22, borderRadius: 4, transform: [{ rotate: '8deg' }] },
  strap: { position: 'absolute', top: 64, left: 7, width: 46, height: 4.5, borderRadius: 2, transform: [{ rotate: '34deg' }] },
  bag: { position: 'absolute', top: 80, right: 0, width: 18, height: 15, borderRadius: 4, borderWidth: 1.5 },
  bagFlap: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  bagBuckle: { position: 'absolute', bottom: 3, left: '42%', width: 4, height: 4, borderRadius: 1 },
});

const garment = StyleSheet.create({
  body: {
    borderWidth: 1.5,
    alignItems: 'center',
    overflow: 'hidden',
  },
  rim: { position: 'absolute', top: 4, right: 1, width: 3, bottom: 4, borderRadius: 2 },
  foldLine: { position: 'absolute', top: 4, left: 3, width: 2.5, bottom: 6, borderRadius: 2 },
  arm: {
    position: 'absolute',
    top: 6,
    height: 29,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sleeveHem: { width: '100%', height: 3 },
  hand: { position: 'absolute', bottom: 0, width: 9, height: 9, borderRadius: 5 },
  hood: { position: 'absolute', top: -10, width: 46, height: 30, borderRadius: 16, borderWidth: 1.5 },
  collarLeft: { position: 'absolute', top: 2, left: 4, width: 13, height: 9, borderRadius: 2, borderWidth: 1, transform: [{ rotate: '12deg' }] },
  collarRight: { position: 'absolute', top: 2, right: 4, width: 13, height: 9, borderRadius: 2, borderWidth: 1, transform: [{ rotate: '-12deg' }] },
  placket: { position: 'absolute', top: 4, left: '47%', width: 2.5, bottom: 6 },
  hem: { position: 'absolute', bottom: 2, left: 2, right: 2, height: 3, borderRadius: 2 },
  inner: { position: 'absolute', top: 3, left: '34%', right: '34%', height: '60%' },
  lapelLeft: { position: 'absolute', top: 2, left: 2, width: 13, height: 17, borderRadius: 2, borderWidth: 1, transform: [{ rotate: '8deg' }] },
  lapelRight: { position: 'absolute', top: 2, right: 2, width: 13, height: 17, borderRadius: 2, borderWidth: 1, transform: [{ rotate: '-8deg' }] },
  pocket: { position: 'absolute', bottom: 10, width: 11, height: 7, borderRadius: 2 },
  drawstring: { position: 'absolute', top: 8, width: 2, height: 12, borderRadius: 2 },
  kangaroo: { position: 'absolute', bottom: 8, left: '18%', right: '18%', height: 11, borderRadius: 4 },
  belt: { position: 'absolute', bottom: 16, left: 1, right: 1, height: 5 },
  buckle: { position: 'absolute', bottom: 14, left: '44%', width: 7, height: 7, borderRadius: 2, borderWidth: 1.2 },
  button: { position: 'absolute', left: '47%', width: 4, height: 4, borderRadius: 2 },
  crossLeft: { position: 'absolute', top: 3, left: 2, width: '58%', height: '78%', borderRadius: 3, borderWidth: 1, transform: [{ rotate: '7deg' }] },
  crossRight: { position: 'absolute', top: 3, right: 2, width: '56%', height: '76%', borderRadius: 3, borderWidth: 1, transform: [{ rotate: '-7deg' }] },
  wrapLeft: { position: 'absolute', top: 3, left: 2, width: '60%', height: '86%', borderRadius: 3, borderWidth: 1, transform: [{ rotate: '5deg' }] },
  wrapRight: { position: 'absolute', top: 3, right: 2, width: '60%', height: '86%', borderRadius: 3, borderWidth: 1, transform: [{ rotate: '-5deg' }] },
  sash: { position: 'absolute', top: '44%', left: 1, right: 1, height: 6, borderRadius: 2 },
});

const sprite = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  scaler: { alignItems: 'center', justifyContent: 'flex-end' },
  pressable: { alignItems: 'center' },
  aura: { position: 'absolute', top: 36, width: 88, height: 100, borderRadius: 50, opacity: 0.14 },
  shadow: { position: 'absolute', bottom: 0, width: 48, height: 11, borderRadius: 24, backgroundColor: withAlpha(world.shadow, 0.28) },
  shadowCore: { position: 'absolute', bottom: 1.5, width: 30, height: 6, borderRadius: 15, backgroundColor: withAlpha(world.shadow, 0.3) },
  column: { alignItems: 'center', justifyContent: 'flex-end' },

  moodBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headWrap: { width: 54, height: 52, alignItems: 'center', justifyContent: 'flex-start', marginBottom: -3 },
  head: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center',
    overflow: 'hidden',
  },
  headLight: { position: 'absolute', top: 3, left: 6, width: 20, height: 9, borderRadius: 10 },
  jawShade: { position: 'absolute', bottom: 0, left: 6, right: 6, height: 7, borderRadius: 8 },
  ear: { position: 'absolute', top: 19, width: 8, height: 11, borderRadius: 5, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  earInner: { width: 3.5, height: 5.5, borderRadius: 3 },
  headRim: { position: 'absolute', top: 12, right: -2, width: 3.5, height: 26, borderRadius: 3 },

  eyesRow: { flexDirection: 'row', gap: 11, marginTop: 14, alignItems: 'center' },
  eye: { width: 12, height: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sclera: { position: 'absolute', width: 12, height: 13, borderRadius: 6, backgroundColor: '#FFF7EC' },
  iris: { width: 9, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  irisDeep: { position: 'absolute', bottom: 0, width: 9, height: 4, borderRadius: 5, opacity: 0.55 },
  pupil: { width: 4.2, height: 4.8, borderRadius: 3, backgroundColor: '#140C0A' },
  glint: { position: 'absolute', top: 1.6, left: 1.5, width: 2.3, height: 2.3, borderRadius: 2, backgroundColor: 'rgba(255,252,244,0.95)' },
  upperLash: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.6, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  lid: { position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.5 },

  browRow: { flexDirection: 'row', gap: 12, marginTop: 1 },
  brow: { width: 12.5, height: 2.8, borderRadius: 2 },
  noseWrap: { marginTop: 1.5, alignItems: 'center' },
  nose: { width: 2.6, height: 3.4, borderRadius: 2 },
  cheekRow: { flexDirection: 'row', gap: 21, marginTop: 0.5 },
  cheek: { width: 8.5, height: 4.6, borderRadius: 5, backgroundColor: withAlpha('#C9633F', 0.5) },
  mouthWrap: { marginTop: 2.5, height: 10, alignItems: 'center', justifyContent: 'center' },
  mouthSmile: { width: 13, height: 6.5, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, borderBottomWidth: 1.9, borderLeftWidth: 1.2, borderRightWidth: 1.2 },
  mouthFlat: { width: 10, height: 1.9, borderRadius: 2 },
  mouthFrown: { width: 12, height: 5.5, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderTopWidth: 1.9, borderLeftWidth: 1.2, borderRightWidth: 1.2 },
  mouthOpen: { width: 10, height: 8.5, borderRadius: 5 },

  neck: { width: 14, height: 8, borderRadius: 3, marginTop: -4, borderWidth: 1, alignItems: 'center' },
  neckShade: { width: '100%', height: 3, marginTop: 5 },
  torsoWrap: { width: 58, alignItems: 'center', justifyContent: 'flex-start', height: 42 },
  legs: { flexDirection: 'row', gap: 7, marginTop: -4 },
  leg: { height: 24, borderRadius: 6, borderWidth: 1.4, alignItems: 'center' },
  legFold: { width: '100%', height: 2.5, marginTop: 3 },
  shoe: { height: 8, borderRadius: 5, marginTop: -2, marginLeft: -2, justifyContent: 'flex-end' },
  sole: { width: '100%', height: 2.5 },

  actionBubble: {
    position: 'absolute',
    top: 4,
    left: -16,
    borderWidth: 1,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nameTag: {
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    maxWidth: 88,
  },
  nameText: { ...type.micro, color: world.linen, letterSpacing: 0.4 },
});
