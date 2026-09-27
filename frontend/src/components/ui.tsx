/**
 * Interface primitives and accessibility preferences.
 *
 * Everything interactive here is a real button: it carries a role, a label, a
 * hint where useful, and a touch target of at least 44dp. Meters expose
 * progressbar semantics so screen readers announce real values.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { elevation, layout, palette, radius, space, type } from '../theme';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ *
 * Preferences
 * ------------------------------------------------------------------ */

const PREFS_KEY = 'arcadia9.prefs';

export interface Preferences {
  reduceMotion: boolean;
  contrast: boolean;
  haptics: boolean;
}

const DEFAULT_PREFS: Preferences = { reduceMotion: false, contrast: false, haptics: true };

interface PrefsValue extends Preferences {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  ready: boolean;
}

const PrefsContext = createContext<PrefsValue>({
  ...DEFAULT_PREFS,
  ready: true,
  setPreference: () => undefined,
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Follow the operating system's own reduce-motion setting by default.
    const applyOsSetting = AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => enabled)
      .catch(() => false);

    Promise.all([AsyncStorage.getItem(PREFS_KEY), applyOsSetting])
      .then(([stored, osReduceMotion]) => {
        if (cancelled) return;
        let next = { ...DEFAULT_PREFS, reduceMotion: osReduceMotion };
        if (stored) {
          try {
            next = { ...next, ...(JSON.parse(stored) as Partial<Preferences>) };
          } catch {
            // A corrupt preference blob must never block start-up.
          }
        }
        setPrefs(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback<PrefsValue['setPreference']>((key, value) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<PrefsValue>(() => ({ ...prefs, ready, setPreference }), [prefs, ready, setPreference]);

  return React.createElement(PrefsContext.Provider, { value }, children);
}

export function usePrefs(): PrefsValue {
  return useContext(PrefsContext);
}

/** Fire haptics only when the player asked for them and the platform supports it. */
export function useHaptics() {
  const { haptics } = usePrefs();
  return useCallback(
    (style: 'light' | 'medium' | 'success' = 'light') => {
      if (!haptics || Platform.OS === 'web') return;
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        success: Haptics.NotificationFeedbackType.Success,
      } as const;
      const run =
        style === 'success'
          ? Haptics.notificationAsync(map.success)
          : Haptics.impactAsync(style === 'medium' ? map.medium : map.light);
      run.catch(() => undefined);
    },
    [haptics],
  );
}

/* ------------------------------------------------------------------ *
 * Animation helper
 * ------------------------------------------------------------------ */

/** A looping/oneshot animation driver that honours reduce-motion. */
export function useAnimatedValue(initial = 0): Animated.Value {
  const value = useRef(new Animated.Value(initial)).current;
  return value;
}

export function useLoop(
  value: Animated.Value,
  toValue: number,
  durationMs: number,
  enabled = true,
): void {
  const { reduceMotion } = usePrefs();
  useEffect(() => {
    if (!enabled || reduceMotion) {
      value.stopAnimation();
      value.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [value, toValue, durationMs, enabled, reduceMotion]);
}

/** Entrance animation used for panels and cards. */
export function useEntrance(delay = 0) {
  const progress = useRef(new Animated.Value(0)).current;
  const { reduceMotion } = usePrefs();
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, reduceMotion]);
  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

/**
 * A flat surface. Panels used to carry a two-colour gradient; they now carry a
 * single tone bar on the left, which reads as an instrument label instead of
 * decoration.
 */
export function Panel({
  children,
  style,
  tone,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: string;
  accessibilityLabel?: string;
}) {
  const { contrast } = usePrefs();
  const entrance = useEntrance();
  return (
    <Animated.View style={[styles.panelWrap, style, entrance]}>
      <View
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.panel,
          tone ? { borderLeftWidth: 2, borderLeftColor: tone } : null,
          contrast && styles.panelContrast,
          elevation.card,
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon ? <Icon name={icon} size={16} color={palette.accent} /> : null}
        <View style={styles.sectionHeaderText}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Tag({
  label,
  icon,
  color = palette.ink,
  background,
  compact,
}: {
  label: string;
  icon?: IconName;
  color?: string;
  background?: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.tag,
        compact && styles.tagCompact,
        { borderColor: `${color}44`, backgroundColor: background ?? `${color}18` },
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={color} /> : null}
      <Text style={[styles.tagText, { color }, compact && { fontSize: 10 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A labelled meter with an accessible value and an optional animated delta. */
export function Meter({
  label,
  value,
  color,
  icon,
  delta,
  testLabel,
}: {
  label: string;
  value: number;
  color: string;
  icon?: IconName;
  delta?: number;
  testLabel?: string;
}) {
  const { reduceMotion } = usePrefs();
  const width = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      width.setValue(1);
      return;
    }
    const animation = Animated.timing(width, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [width, reduceMotion]);

  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      style={styles.meterRow}
      accessibilityRole="progressbar"
      accessibilityLabel={testLabel ?? label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <View style={styles.meterHead}>
        <View style={styles.meterLabelRow}>
          {icon ? <Icon name={icon} size={13} color={palette.inkMuted} /> : null}
          <Text style={styles.meterLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.meterValueRow}>
          {delta !== undefined && Math.abs(delta) >= 0.5 ? (
            <Text style={[styles.meterDelta, { color: delta > 0 ? palette.good : palette.over }]}>
              {delta > 0 ? '+' : ''}
              {Math.round(delta)}
            </Text>
          ) : null}
          <Text style={styles.meterValue}>{Math.round(clamped)}</Text>
        </View>
      </View>
      <View style={styles.meterTrack}>
        <Animated.View
          style={[
            styles.meterFill,
            {
              backgroundColor: color,
              width: width.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${clamped}%`],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Circular goal indicator drawn as a ring of dots: precise and cheap. */
export function DotRing({
  progress,
  size = 46,
  color,
  label,
  complete,
}: {
  progress: number;
  size?: number;
  color: string;
  label: string;
  complete?: boolean;
}) {
  const dots = 16;
  const filled = Math.round((Math.max(0, Math.min(100, progress)) / 100) * dots);
  const dotSize = Math.max(3, size / 12);
  return (
    <View
      style={[styles.ring, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
    >
      {Array.from({ length: dots }).map((_, index) => {
        const angle = (index / dots) * Math.PI * 2 - Math.PI / 2;
        const radiusPx = size / 2 - dotSize / 2 - 1;
        const active = index < filled;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: active ? color : 'rgba(255,255,255,0.14)',
              left: size / 2 + Math.cos(angle) * radiusPx - dotSize / 2,
              top: size / 2 + Math.sin(angle) * radiusPx - dotSize / 2,
            }}
          />
        );
      })}
      <Text style={[styles.ringText, complete && { color }]}>
        {complete ? <Icon name="checkmark" size={Math.round(size / 3)} color={color} /> : `${Math.round(progress)}`}
      </Text>
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  accessibilityHint,
  style,
  compact,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const haptics = useHaptics();
  const { reduceMotion } = usePrefs();
  const press = useRef(new Animated.Value(1)).current;

  const paletteFor = {
    primary: { bg: palette.accent, fg: '#04202B', border: 'transparent' },
    secondary: { bg: palette.surfaceStrong, fg: palette.ink, border: palette.border },
    ghost: { bg: 'transparent', fg: palette.inkSoft, border: palette.border },
    danger: { bg: palette.rose, fg: '#2A0713', border: 'transparent' },
    success: { bg: palette.green, fg: '#052718', border: 'transparent' },
  }[variant];

  const animateTo = (value: number) => {
    if (reduceMotion) return;
    Animated.spring(press, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: press }] }, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
        disabled={disabled || busy}
        activeOpacity={0.86}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        onPress={() => {
          haptics(variant === 'danger' ? 'medium' : 'light');
          onPress();
        }}
        style={[
          styles.button,
          compact && styles.buttonCompact,
          {
            backgroundColor: paletteFor.bg,
            borderColor: paletteFor.border,
            borderWidth: paletteFor.border === 'transparent' ? 0 : 1,
            opacity: disabled || busy ? 0.45 : 1,
          },
        ]}
      >
        {icon ? <Icon name={icon} size={compact ? 15 : 17} color={paletteFor.fg} /> : null}
        <Text style={[styles.buttonText, compact && { fontSize: 12 }, { color: paletteFor.fg }]}>
          {busy ? '…' : label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  active,
  tone = palette.ink,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  tone?: string;
}) {
  const haptics = useHaptics();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: Boolean(active) }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => {
        haptics('light');
        onPress();
      }}
      style={[
        styles.iconButton,
        active && { backgroundColor: `${palette.accent}26`, borderColor: `${palette.accent}66` },
      ]}
    >
      <Icon name={icon} size={19} color={active ? palette.accent : tone} />
    </TouchableOpacity>
  );
}

export function StatBlock({
  label,
  value,
  color,
  hint,
  icon,
  progress,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
  icon?: IconName;
  progress?: number;
}) {
  return (
    <View style={styles.statBlock} accessible accessibilityLabel={`${label}: ${value}. ${hint ?? ''}`}>
      <View style={styles.statHead}>
        {icon ? <Icon name={icon} size={12} color={color} /> : null}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {progress !== undefined ? (
        <View style={styles.statTrack}>
          <View
            style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, progress))}%`,
              backgroundColor: color,
              borderRadius: radius.xs,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export function DeltaChip({ delta, suffix = '' }: { delta: number; suffix?: string }) {
  const positive = delta > 0;
  const neutral = Math.abs(delta) < 0.05;
  const color = neutral ? palette.inkMuted : positive ? palette.good : palette.over;
  return (
    <View style={[styles.deltaChip, { borderColor: `${color}55`, backgroundColor: `${color}18` }]}>
      <Text style={[styles.deltaText, { color }]}>
        {neutral ? '±0' : `${positive ? '+' : ''}${delta.toFixed(Math.abs(delta) < 10 ? 1 : 0)}`}
        {suffix}
      </Text>
    </View>
  );
}

export function Row({
  children,
  style,
  justify,
  align = 'center',
  gap = space.sm,
  wrap,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  justify?: ViewStyle['justifyContent'];
  align?: ViewStyle['alignItems'];
  gap?: number;
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: justify, gap },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function BodyText({
  children,
  style,
  muted,
  numberOfLines,
  accessibilityRole,
  accessibilityLiveRegion,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  numberOfLines?: number;
  accessibilityRole?: 'summary' | 'text';
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      accessibilityLiveRegion={accessibilityLiveRegion}
      style={[styles.bodyText, muted && { color: palette.inkMuted }, style]}
    >
      {children}
    </Text>
  );
}

export const styles = StyleSheet.create({
  panelWrap: { width: '100%' },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: space.md,
    overflow: 'hidden',
  },
  panelContrast: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: palette.borderStrong,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    gap: space.sm,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  sectionHeaderText: { flexShrink: 1 },
  sectionTitle: { ...type.title, color: palette.ink },
  sectionSubtitle: { ...type.caption, color: palette.inkMuted, marginTop: 1 },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  tagCompact: { paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { ...type.caption, fontWeight: '600' },

  meterRow: { marginBottom: space.sm },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  meterLabel: { ...type.caption, color: palette.inkSoft, flexShrink: 1 },
  meterValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meterValue: { ...type.caption, color: palette.ink, fontWeight: '700' },
  meterDelta: { ...type.caption, fontWeight: '700' },
  meterTrack: {
    height: 5,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 4,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: radius.xs },

  ring: { alignItems: 'center', justifyContent: 'center' },
  ringText: { ...type.caption, color: palette.ink, fontWeight: '800' },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  buttonCompact: { minHeight: 34, paddingHorizontal: space.md },
  buttonText: { ...type.body, fontWeight: '700' },

  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },

  statBlock: { flex: 1, minWidth: 84 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { ...type.micro, color: palette.inkMuted, textTransform: 'uppercase' },
  statValue: { ...type.display, marginTop: 2 },
  statTrack: {
    height: 3,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 5,
    overflow: 'hidden',
  },

  deltaChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  deltaText: { ...type.micro },

  bodyText: { ...type.body, color: palette.inkSoft, lineHeight: 19 },
});
