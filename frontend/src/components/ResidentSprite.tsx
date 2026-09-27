/**
 * ResidentSprite: original character art, drawn entirely with plain views.
 *
 * The previous version of this project represented people as an emoji on a
 * circle. This renders each resident as a layered figure whose silhouette,
 * hair, outfit, accessories and expression are all data-driven, so the six
 * residents are visibly different people rather than six copies of one shape.
 *
 * Nothing here is derived from any existing property: the faces, hairstyles and
 * outfits are drawn from the palette in `arcadia/content.py`.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, type } from '../theme';
import { glyph } from '../game/icons';
import { useI18n } from '../game/i18n';
import type { Resident } from '../game/types';
import { Icon } from './Icon';
import { usePrefs } from './ui';

const BASE_WIDTH = 92;
const BASE_HEIGHT = 150;

type MoodShape = {
  browTilt: number;
  mouth: 'smile' | 'flat' | 'frown' | 'open';
  cheek: number;
  eyeOpen: number;
};

const MOOD_SHAPES: Record<string, MoodShape> = {
  radiant: { browTilt: -3, mouth: 'open', cheek: 0.85, eyeOpen: 1 },
  content: { browTilt: -1.5, mouth: 'smile', cheek: 0.7, eyeOpen: 1 },
  focused: { browTilt: 2, mouth: 'flat', cheek: 0.25, eyeOpen: 0.92 },
  neutral: { browTilt: 0, mouth: 'flat', cheek: 0.3, eyeOpen: 1 },
  tired: { browTilt: 1.5, mouth: 'flat', cheek: 0.2, eyeOpen: 0.62 },
  anxious: { browTilt: 4, mouth: 'frown', cheek: 0.35, eyeOpen: 1 },
  upset: { browTilt: 5, mouth: 'frown', cheek: 0.5, eyeOpen: 0.85 },
  lost: { browTilt: 2.5, mouth: 'flat', cheek: 0.15, eyeOpen: 0.8 },
};

function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const numeric = parseInt(full || '808080', 16);
  const r = Math.max(0, Math.min(255, ((numeric >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((numeric >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (numeric & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Hair is drawn in two layers so it can sit both behind and in front of the head. */
function Hair({
  style: hairStyle,
  color,
  outfitAccent,
}: {
  style: string;
  color: string;
  outfitAccent: string;
}) {
  const dark = shade(color, -22);
  switch (hairStyle) {
    case 'braids':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: dark, top: 4, height: 44 }]} />
          <View style={[hair.sideLobe, { backgroundColor: color, left: -7, top: 20 }]} />
          <View style={[hair.sideLobe, { backgroundColor: color, right: -7, top: 20 }]} />
          <View style={[hair.fringeStraight, { backgroundColor: color }]} />
          <View style={[hair.partLine, { backgroundColor: dark }]} />
          <View style={[hair.tieSmall, { backgroundColor: outfitAccent, left: -3, top: 46 }]} />
          <View style={[hair.tieSmall, { backgroundColor: outfitAccent, right: -3, top: 46 }]} />
        </>
      );
    case 'undercut':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: dark, top: 3, height: 34 }]} />
          <View style={[hair.sideShort, { backgroundColor: shade(color, -34) }]} />
          <View style={[hair.fringeSweep, { backgroundColor: color }]} />
        </>
      );
    case 'bun':
      return (
        <>
          <View style={[hair.bunTop, { backgroundColor: color }]} />
          <View style={[hair.backWide, { backgroundColor: dark, top: 6, height: 36 }]} />
          <View style={[hair.fringeSweep, { backgroundColor: color }]} />
        </>
      );
    case 'curls':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: dark, top: 3, height: 42 }]} />
          <View style={[hair.curl, { backgroundColor: color, left: -6, top: 8, width: 20, height: 20 }]} />
          <View style={[hair.curl, { backgroundColor: color, right: -6, top: 8, width: 20, height: 20 }]} />
          <View style={[hair.curl, { backgroundColor: color, left: 12, top: 0, width: 22, height: 20 }]} />
          <View style={[hair.fringeCurly, { backgroundColor: color }]} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <View style={[hair.pony, { backgroundColor: dark }]} />
          <View style={[hair.backWide, { backgroundColor: dark, top: 4, height: 36 }]} />
          <View style={[hair.fringeSweep, { backgroundColor: color }]} />
          <View style={[hair.tieSmall, { backgroundColor: outfitAccent, right: -14, top: 12 }]} />
        </>
      );
    case 'swept':
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: dark, top: 5, height: 33 }]} />
          <View style={[hair.fringeSweep, { backgroundColor: shade(color, 6) }]} />
          <View style={[hair.sideShort, { backgroundColor: shade(color, -26) }]} />
        </>
      );
    case 'bob':
    default:
      return (
        <>
          <View style={[hair.backWide, { backgroundColor: dark, top: 5, height: 40 }]} />
          <View style={[hair.fringeStraight, { backgroundColor: color }]} />
        </>
      );
  }
}

function Accessory({ kind, accent, skin }: { kind: string; accent: string; skin: string }) {
  switch (kind) {
    case 'headphones':
      return (
        <>
          <View style={[acc.headband, { borderColor: accent }]} />
          <View style={[acc.cup, { backgroundColor: accent, left: -8, top: 22 }]} />
          <View style={[acc.cup, { backgroundColor: accent, right: -8, top: 22 }]} />
        </>
      );
    case 'stethoscope':
      return (
        <>
          <View style={[acc.stethoLoop, { borderColor: accent }]} />
          <View style={[acc.stethoEnd, { backgroundColor: accent }]} />
          <View style={[acc.stethoTube, { backgroundColor: shade(accent, -30) }]} />
        </>
      );
    case 'apron':
      return (
        <>
          <View style={[acc.apronBib, { backgroundColor: accent }]} />
          <View style={[acc.apronString, { backgroundColor: shade(accent, -40) }]} />
        </>
      );
    case 'visor':
      return <View style={[acc.visor, { backgroundColor: `${accent}AA` }]} />;
    case 'scarf':
      return (
        <>
          <View style={[acc.scarf, { backgroundColor: accent }]} />
          <View style={[acc.scarfTail, { backgroundColor: shade(accent, -20) }]} />
        </>
      );
    case 'satchel':
      return (
        <>
          <View style={[acc.strap, { backgroundColor: shade(accent, -50) }]} />
          <View style={[acc.bag, { backgroundColor: accent }]} />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

interface Props {
  resident: Resident;
  scale?: number;
  selected?: boolean;
  highlighted?: boolean;
  walking?: boolean;
  onPress?: (resident: Resident) => void;
  showName?: boolean;
  accessibilityHint?: string;
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
}: Props) {
  const { reduceMotion, contrast } = usePrefs();
  const { lt } = useI18n();
  const bob = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const walk = useRef(new Animated.Value(0)).current;

  const look = resident.look ?? {
    skin: '#F0D3B4',
    hair: '#4A3728',
    hairstyle: 'bob',
    eyes: '#3B2B20',
    outfit: { top: '#5AB0F0', bottom: '#2E3440', accent: '#FFD166' },
    accessory: 'none',
  };
  const outfit = look.outfit ?? { top: '#5AB0F0', bottom: '#2E3440', accent: '#FFD166' };
  const mood = MOOD_SHAPES[resident.mood] ?? MOOD_SHAPES.neutral;
  const moodColor = resident.mood_color ?? palette.accent;

  // Idle bob + breathing.
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

  const torsoScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const leftLeg = walking
    ? walk.interpolate({ inputRange: [0, 1], outputRange: [0, -3] })
    : 0;
  const rightLeg = walking
    ? walk.interpolate({ inputRange: [0, 1], outputRange: [-3, 0] })
    : 0;
  const armSwing = walk.interpolate({ inputRange: [0, 1], outputRange: [-2.5, 2.5] });

  const ringOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] });

  const content = (
    <Animated.View style={[sprite.wrap, { width: BASE_WIDTH * scale, height: BASE_HEIGHT * scale }]}>
      <View style={[sprite.scaler, { transform: [{ scale }] }]}>
        {/* Aura */}
        <Animated.View
          style={[
            sprite.aura,
            { backgroundColor: moodColor, shadowColor: moodColor },
            { opacity: highlighted ? ringOpacity : 0.16 },
          ]}
        />

        <Animated.View style={{ transform: [{ translateY }] }}>
          {/* Shadow */}
          <View style={sprite.shadow} />

          <View style={[sprite.column, { height: BASE_HEIGHT - 24 }]}>
            {/* Mood badge */}
            <View style={[sprite.moodBadge, { borderColor: `${moodColor}88` }]}>
              <Icon name={glyph(resident.mood_icon)} size={12} color={moodColor} />
            </View>

            {/* Head */}
            <View style={sprite.headWrap}>
              <Hair style={look.hairstyle} color={look.hair} outfitAccent={outfit.accent} />

              <View style={[sprite.head, { backgroundColor: look.skin }]}>
                <View style={[sprite.headShine, { backgroundColor: shade(look.skin, 26) }]} />
                <View style={[sprite.ear, { backgroundColor: look.skin, left: -3.5 }]} />
                <View style={[sprite.ear, { backgroundColor: look.skin, right: -3.5 }]} />

                {/* Eyes */}
                <Animated.View style={[sprite.eyesRow, { transform: [{ scaleY: blink }] }]}>
                  {[0, 1].map((side) => (
                    <View key={side} style={sprite.eye}>
                      <View style={sprite.sclera} />
                      <View
                        style={[
                          sprite.iris,
                          {
                            backgroundColor: look.eyes,
                            height: 9 * mood.eyeOpen,
                          },
                        ]}
                      >
                        <View style={sprite.pupil} />
                        <View style={sprite.glint} />
                      </View>
                    </View>
                  ))}
                </Animated.View>

                {/* Brows */}
                <View style={sprite.browRow}>
                  <View
                    style={[
                      sprite.brow,
                      { backgroundColor: shade(look.hair, -10), transform: [{ rotate: `${mood.browTilt}deg` }] },
                    ]}
                  />
                  <View
                    style={[
                      sprite.brow,
                      { backgroundColor: shade(look.hair, -10), transform: [{ rotate: `${-mood.browTilt}deg` }] },
                    ]}
                  />
                </View>

                {/* Cheeks */}
                <View style={sprite.cheekRow}>
                  <View style={[sprite.cheek, { opacity: mood.cheek }]} />
                  <View style={[sprite.cheek, { opacity: mood.cheek }]} />
                </View>

                {/* Mouth */}
                <View style={sprite.mouthWrap}>
                  {mood.mouth === 'smile' ? <View style={sprite.mouthSmile} /> : null}
                  {mood.mouth === 'flat' ? <View style={sprite.mouthFlat} /> : null}
                  {mood.mouth === 'frown' ? <View style={sprite.mouthFrown} /> : null}
                  {mood.mouth === 'open' ? <View style={sprite.mouthOpen} /> : null}
                </View>
              </View>

              <Accessory kind={look.accessory} accent={outfit.accent} skin={look.skin} />
            </View>

            {/* Neck + torso */}
            <View style={[sprite.neck, { backgroundColor: shade(look.skin, -14) }]} />
            <Animated.View style={[sprite.torsoWrap, { transform: [{ scaleY: torsoScale }] }]}>
              <Animated.View
                style={[sprite.arm, { backgroundColor: shade(outfit.top, -18), transform: [{ rotate: '-11deg' }, { translateY: armSwing }] }]}
              />
              <Animated.View
                style={[sprite.arm, { backgroundColor: shade(outfit.top, -18), right: 2, transform: [{ rotate: '11deg' }, { translateY: armSwing }] }]}
              />
              <View style={[sprite.torso, { backgroundColor: outfit.top }]}>
                <View style={[sprite.collar, { backgroundColor: outfit.accent }]} />
                <View style={[sprite.belt, { backgroundColor: outfit.accent }]} />
              </View>
              <View style={[sprite.hand, { backgroundColor: look.skin, left: 1 }]} />
              <View style={[sprite.hand, { backgroundColor: look.skin, right: 1 }]} />
            </Animated.View>

            {/* Legs */}
            <View style={sprite.legs}>
              <Animated.View style={{ transform: [{ translateY: leftLeg }] }}>
                <View style={[sprite.leg, { backgroundColor: outfit.bottom }]} />
                <View style={[sprite.shoe, { backgroundColor: shade(outfit.bottom, -34) }]} />
              </Animated.View>
              <Animated.View style={{ transform: [{ translateY: rightLeg }] }}>
                <View style={[sprite.leg, { backgroundColor: outfit.bottom }]} />
                <View style={[sprite.shoe, { backgroundColor: shade(outfit.bottom, -34) }]} />
              </Animated.View>
            </View>
          </View>

          {/* Action bubble */}
          {resident.current_action?.icon ? (
            <View style={sprite.actionBubble}>
              <Icon name={glyph(resident.current_action.icon)} size={14} color={palette.ink} />
            </View>
          ) : null}

          {/* Name tag */}
          {showName ? (
            <View
              style={[
                sprite.nameTag,
                contrast && { backgroundColor: 'rgba(9,11,15,0.92)', borderColor: palette.borderStrong },
                selected && { borderColor: palette.accent, backgroundColor: 'rgba(78,157,180,0.20)', borderWidth: 1.5 },
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
  backWide: { position: 'absolute', left: -5, right: -5, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  sideLobe: { position: 'absolute', width: 11, height: 24, borderRadius: 6 },
  fringeStraight: { position: 'absolute', top: -3, left: 1, right: 1, height: 21, borderTopLeftRadius: 21, borderTopRightRadius: 21, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  fringeSweep: { position: 'absolute', top: -4, left: -1, right: -6, height: 19, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 9, borderBottomRightRadius: 3, transform: [{ rotate: '-6deg' }] },
  fringeCurly: { position: 'absolute', top: -5, left: 0, right: 0, height: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  partLine: { position: 'absolute', top: -3, left: '48%', width: 1.6, height: 16, borderRadius: 1 },
  bunTop: { position: 'absolute', top: -13, left: '27%', width: 22, height: 20, borderRadius: 11 },
  curl: { position: 'absolute', borderRadius: 999 },
  pony: { position: 'absolute', right: -17, top: 4, width: 20, height: 40, borderTopRightRadius: 12, borderBottomRightRadius: 12, transform: [{ rotate: '12deg' }] },
  sideShort: { position: 'absolute', left: -3, right: -3, top: 20, height: 12, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  tieSmall: { position: 'absolute', width: 8, height: 6, borderRadius: 3 },
});

const acc = StyleSheet.create({
  headband: { position: 'absolute', top: -9, left: 2, right: 2, height: 26, borderTopWidth: 4, borderRadius: 999 },
  cup: { position: 'absolute', width: 10, height: 15, borderRadius: 5 },
  stethoLoop: { position: 'absolute', top: 38, left: 10, right: 10, height: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderRightWidth: 3, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  stethoEnd: { position: 'absolute', bottom: 2, left: '46%', width: 7, height: 7, borderRadius: 4 },
  stethoTube: { position: 'absolute', top: 50, left: '48%', width: 2.5, height: 22, borderRadius: 2 },
  apronBib: { position: 'absolute', top: 62, left: 12, right: 12, height: 26, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, opacity: 0.95 },
  apronString: { position: 'absolute', top: 66, left: 8, right: 8, height: 2 },
  visor: { position: 'absolute', top: 12, left: -4, right: -4, height: 8, borderRadius: 4 },
  scarf: { position: 'absolute', top: 52, left: 8, right: 8, height: 8, borderRadius: 4 },
  scarfTail: { position: 'absolute', top: 58, left: 12, width: 7, height: 20, borderRadius: 4, transform: [{ rotate: '8deg' }] },
  strap: { position: 'absolute', top: 62, left: 8, width: 44, height: 4, borderRadius: 2, transform: [{ rotate: '34deg' }] },
  bag: { position: 'absolute', top: 78, right: 1, width: 16, height: 13, borderRadius: 4 },
});

const sprite = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  scaler: { alignItems: 'center', justifyContent: 'flex-end' },
  pressable: { alignItems: 'center' },
  aura: { position: 'absolute', top: 34, width: 84, height: 96, borderRadius: 48, opacity: 0.16, shadowOpacity: 0.8, shadowRadius: 18 },
  shadow: { position: 'absolute', bottom: 0, width: 42, height: 9, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.30)' },
  column: { alignItems: 'center', justifyContent: 'flex-end' },

  moodBadge: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(11,13,16,0.82)', alignItems: 'center', justifyContent: 'center' },


  headWrap: { width: 50, height: 48, alignItems: 'center', justifyContent: 'flex-start', marginBottom: -2 },
  head: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(0,0,0,0.20)', alignItems: 'center', overflow: 'hidden' },
  headShine: { position: 'absolute', top: 4, left: 8, width: 16, height: 7, borderRadius: 8, opacity: 0.28 },
  ear: { position: 'absolute', top: 18, width: 7, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.16)' },
  eyesRow: { flexDirection: 'row', gap: 11, marginTop: 15, alignItems: 'center' },
  eye: { width: 11, height: 12, alignItems: 'center', justifyContent: 'center' },
  sclera: { position: 'absolute', width: 11, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  iris: { width: 8, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  pupil: { width: 4, height: 4.5, borderRadius: 3, backgroundColor: '#0B0B12' },
  glint: { position: 'absolute', top: 1.5, left: 1.4, width: 2.1, height: 2.1, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.95)' },
  browRow: { flexDirection: 'row', gap: 13, marginTop: 2 },
  brow: { width: 11, height: 2.4, borderRadius: 2 },
  cheekRow: { flexDirection: 'row', gap: 20, marginTop: 2 },
  cheek: { width: 8, height: 4.5, borderRadius: 5, backgroundColor: '#F4737F' },
  mouthWrap: { marginTop: 3, height: 10, alignItems: 'center', justifyContent: 'center' },
  mouthSmile: { width: 12, height: 6, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderBottomWidth: 1.8, borderLeftWidth: 1.2, borderRightWidth: 1.2, borderColor: '#8A4A4A' },
  mouthFlat: { width: 9, height: 1.8, borderRadius: 2, backgroundColor: '#8A4A4A' },
  mouthFrown: { width: 11, height: 5, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderTopWidth: 1.8, borderLeftWidth: 1.2, borderRightWidth: 1.2, borderColor: '#8A4A4A' },
  mouthOpen: { width: 9, height: 8, borderRadius: 5, backgroundColor: '#7E3B3B' },

  neck: { width: 12, height: 7, borderRadius: 3, marginTop: -3 },
  torsoWrap: { width: 52, alignItems: 'center', justifyContent: 'flex-start', height: 38 },
  torso: { width: 36, height: 36, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, borderWidth: 2, borderColor: 'rgba(0,0,0,0.18)', alignItems: 'center' },
  collar: { width: 16, height: 5, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, marginTop: 1 },
  belt: { position: 'absolute', bottom: 6, left: 3, right: 3, height: 4, borderRadius: 3, opacity: 0.9 },
  arm: { position: 'absolute', top: 7, left: 1, width: 9, height: 27, borderRadius: 6, borderWidth: 1.6, borderColor: 'rgba(0,0,0,0.16)' },
  hand: { position: 'absolute', bottom: 1, width: 8, height: 8, borderRadius: 5 },
  legs: { flexDirection: 'row', gap: 7, marginTop: -3 },
  leg: { width: 10, height: 22, borderRadius: 6, borderWidth: 1.6, borderColor: 'rgba(0,0,0,0.16)' },
  shoe: { width: 12, height: 7, borderRadius: 5, marginTop: -2, marginLeft: -1 },

  actionBubble: { position: 'absolute', top: 6, left: -14, backgroundColor: 'rgba(11,13,16,0.86)', borderWidth: 1, borderColor: palette.border, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  nameTag: { marginTop: 5, paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: radius.xs, backgroundColor: 'rgba(11,13,16,0.80)', borderWidth: 1, borderColor: palette.border, maxWidth: 86 },
  nameText: { ...type.micro, color: palette.ink, letterSpacing: 0.3 },
});
