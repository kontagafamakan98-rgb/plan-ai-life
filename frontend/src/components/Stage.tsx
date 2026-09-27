/**
 * Stage: the place the Watcher is looking at right now.
 *
 * Layers, back to front: sky (hour-driven), celestial body, clouds and stars,
 * back wall, floor, scenery props, residents (depth-sorted by their floor
 * position), interface overlays. Everything is plain views, so it renders
 * identically on web, iOS and Android.
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
} from 'react-native';

import {
  defaultRoom,
  palette,
  radius,
  roomPalette,
  skyGradient,
  space,
  type,
  type as typeTokens,
} from '../theme';
import type { DimensionValue } from 'react-native';

import type { LocationView, Resident } from '../game/types';
import { glyph } from '../game/icons';
import { useI18n } from '../game/i18n';
import { Icon } from './Icon';
import { usePrefs } from './ui';
import { ResidentSprite } from './ResidentSprite';

type PropKind =
  | 'counter'
  | 'table'
  | 'plant'
  | 'tree'
  | 'machine'
  | 'screen'
  | 'mat'
  | 'lamp'
  | 'shelf'
  | 'bench'
  | 'water'
  | 'bed'
  | 'sofa'
  | 'desk'
  | 'altar'
  | 'stage'
  | 'stones';

interface Prop {
  kind: PropKind;
  x: number; // 0..1 across the floor
  y: number; // 0..1 down the floor
  size?: number;
}

const SCENERY: Record<string, Prop[]> = {
  cafe: [
    { kind: 'counter', x: 0.16, y: 0.22 },
    { kind: 'machine', x: 0.1, y: 0.12 },
    { kind: 'table', x: 0.68, y: 0.44 },
    { kind: 'table', x: 0.3, y: 0.66 },
    { kind: 'plant', x: 0.88, y: 0.2 },
    { kind: 'lamp', x: 0.52, y: 0.08 },
  ],
  apartment: [
    { kind: 'bed', x: 0.16, y: 0.3 },
    { kind: 'sofa', x: 0.62, y: 0.6 },
    { kind: 'shelf', x: 0.86, y: 0.2 },
    { kind: 'plant', x: 0.42, y: 0.16 },
    { kind: 'lamp', x: 0.5, y: 0.5 },
  ],
  office: [
    { kind: 'desk', x: 0.18, y: 0.3 },
    { kind: 'desk', x: 0.62, y: 0.3 },
    { kind: 'screen', x: 0.18, y: 0.16 },
    { kind: 'plant', x: 0.86, y: 0.62 },
    { kind: 'mat', x: 0.44, y: 0.8 },
  ],
  park: [
    { kind: 'tree', x: 0.12, y: 0.24 },
    { kind: 'tree', x: 0.84, y: 0.3 },
    { kind: 'bench', x: 0.46, y: 0.62 },
    { kind: 'plant', x: 0.3, y: 0.78 },
    { kind: 'stones', x: 0.68, y: 0.86 },
  ],
  gym: [
    { kind: 'machine', x: 0.14, y: 0.28 },
    { kind: 'machine', x: 0.34, y: 0.28 },
    { kind: 'bench', x: 0.68, y: 0.46 },
    { kind: 'mat', x: 0.24, y: 0.76 },
    { kind: 'mat', x: 0.62, y: 0.82 },
  ],
  restaurant: [
    { kind: 'table', x: 0.2, y: 0.32 },
    { kind: 'table', x: 0.66, y: 0.4 },
    { kind: 'counter', x: 0.46, y: 0.12 },
    { kind: 'plant', x: 0.88, y: 0.7 },
    { kind: 'lamp', x: 0.36, y: 0.66 },
  ],
  club: [
    { kind: 'stage', x: 0.5, y: 0.16 },
    { kind: 'machine', x: 0.16, y: 0.6 },
    { kind: 'lamp', x: 0.28, y: 0.34 },
    { kind: 'lamp', x: 0.72, y: 0.34 },
    { kind: 'mat', x: 0.5, y: 0.72 },
  ],
  beach: [
    { kind: 'water', x: 0.5, y: 0.1 },
    { kind: 'tree', x: 0.14, y: 0.52 },
    { kind: 'bench', x: 0.74, y: 0.6 },
    { kind: 'stones', x: 0.4, y: 0.8 },
    { kind: 'stones', x: 0.62, y: 0.88 },
  ],
  school: [
    { kind: 'desk', x: 0.22, y: 0.34 },
    { kind: 'desk', x: 0.5, y: 0.34 },
    { kind: 'desk', x: 0.78, y: 0.34 },
    { kind: 'shelf', x: 0.12, y: 0.72 },
    { kind: 'screen', x: 0.5, y: 0.12 },
  ],
  hospital: [
    { kind: 'bed', x: 0.2, y: 0.34 },
    { kind: 'bed', x: 0.6, y: 0.34 },
    { kind: 'machine', x: 0.86, y: 0.3 },
    { kind: 'mat', x: 0.44, y: 0.78 },
  ],
  market: [
    { kind: 'counter', x: 0.18, y: 0.3 },
    { kind: 'counter', x: 0.6, y: 0.3 },
    { kind: 'shelf', x: 0.88, y: 0.52 },
    { kind: 'plant', x: 0.3, y: 0.74 },
    { kind: 'stones', x: 0.7, y: 0.8 },
  ],
  museum: [
    { kind: 'altar', x: 0.3, y: 0.3 },
    { kind: 'altar', x: 0.7, y: 0.3 },
    { kind: 'stones', x: 0.14, y: 0.74 },
    { kind: 'plant', x: 0.86, y: 0.72 },
  ],
  cinema: [
    { kind: 'screen', x: 0.5, y: 0.1 },
    { kind: 'bench', x: 0.26, y: 0.52 },
    { kind: 'bench', x: 0.74, y: 0.52 },
    { kind: 'bench', x: 0.5, y: 0.82 },
  ],
  temple: [
    { kind: 'altar', x: 0.5, y: 0.26 },
    { kind: 'stones', x: 0.18, y: 0.74 },
    { kind: 'stones', x: 0.8, y: 0.74 },
    { kind: 'plant', x: 0.6, y: 0.86 },
  ],
  mountain: [
    { kind: 'stones', x: 0.2, y: 0.34 },
    { kind: 'stones', x: 0.7, y: 0.44 },
    { kind: 'tree', x: 0.88, y: 0.6 },
    { kind: 'stones', x: 0.44, y: 0.82 },
  ],
};

const DEFAULT_SCENERY: Prop[] = [
  { kind: 'plant', x: 0.18, y: 0.3 },
  { kind: 'bench', x: 0.6, y: 0.5 },
  { kind: 'stones', x: 0.36, y: 0.8 },
];

function SceneryProp({ prop, accent }: { prop: Prop; accent: string }) {
  const base = {
    position: 'absolute' as const,
    left: `${prop.x * 100}%`,
    top: `${prop.y * 100}%`,
  };
  switch (prop.kind) {
    case 'counter':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.counterTop, { backgroundColor: accent }]} />
          <View style={styles.counterBody} />
        </View>
      );
    case 'table':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.tableTop, { backgroundColor: accent }]} />
          <View style={styles.tableLeg} />
        </View>
      );
    case 'desk':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.deskTop, { backgroundColor: accent }]} />
          <View style={styles.deskLeg} />
        </View>
      );
    case 'bench':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.benchSeat, { backgroundColor: accent }]} />
          <View style={styles.benchBack} />
        </View>
      );
    case 'machine':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.machineBody, { borderColor: `${accent}88` }]}>
            <View style={[styles.machineLight, { backgroundColor: accent }]} />
          </View>
        </View>
      );
    case 'screen':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.screen, { borderColor: `${accent}99` }]}>
            <View style={[styles.screenGlow, { backgroundColor: `${accent}33` }]} />
          </View>
          <View style={styles.screenStand} />
        </View>
      );
    case 'shelf':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.shelf, { borderColor: `${accent}77` }]}>
            <View style={[styles.shelfBook, { backgroundColor: accent }]} />
            <View style={[styles.shelfBook, { backgroundColor: palette.steel, width: 5 }]} />
            <View style={[styles.shelfBook, { backgroundColor: palette.accent, width: 4 }]} />
          </View>
        </View>
      );
    case 'mat':
      return <View style={[styles.prop, base, styles.mat, { backgroundColor: `${accent}44` }]} />;
    case 'plant':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.leaf, { backgroundColor: accent }]} />
          <View style={[styles.leafAlt, { backgroundColor: accent }]} />
          <View style={styles.pot} />
        </View>
      );
    case 'tree':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.canopy, { backgroundColor: accent }]} />
          <View style={[styles.canopyAlt, { backgroundColor: accent }]} />
          <View style={styles.trunk} />
        </View>
      );
    case 'lamp':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.lampGlow, { backgroundColor: `${accent}55` }]} />
          <View style={[styles.lampBulb, { backgroundColor: accent }]} />
        </View>
      );
    case 'water':
      return <View style={[styles.prop, base, styles.water, { backgroundColor: `${accent}55` }]} />;
    case 'bed':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.bedBody, { backgroundColor: accent }]} />
          <View style={styles.bedPillow} />
        </View>
      );
    case 'sofa':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.sofaBody, { backgroundColor: accent }]} />
          <View style={styles.sofaArm} />
        </View>
      );
    case 'altar':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.altarTop, { backgroundColor: accent }]} />
          <View style={styles.altarBody} />
        </View>
      );
    case 'stage':
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.stageFloor, { backgroundColor: accent }]} />
          <View style={[styles.stageGlow, { backgroundColor: `${accent}44` }]} />
        </View>
      );
    case 'stones':
    default:
      return (
        <View style={[styles.prop, base]}>
          <View style={[styles.stone, { backgroundColor: `${accent}55` }]} />
          <View style={[styles.stoneSmall, { backgroundColor: `${accent}44` }]} />
        </View>
      );
  }
}

/** Fixed decorations: kept at module scope so the layout is identical on every
 * render (and so percentage offsets stay properly typed). */
const STARS: { top: number; left: DimensionValue }[] = [
  { top: 16, left: '12%' },
  { top: 34, left: '34%' },
  { top: 14, left: '62%' },
  { top: 40, left: '84%' },
  { top: 56, left: '24%' },
];

const CLOUDS: { top: number; left: DimensionValue; width: number }[] = [
  { top: 22, left: '8%', width: 62 },
  { top: 44, left: '46%', width: 48 },
  { top: 16, left: '72%', width: 38 },
];

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
  walkingIds?: string[];
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
  walkingIds = [],
}: StageProps) {
  const { t } = useI18n();
  const { contrast } = usePrefs();
  const [size, setSize] = useState({ width: 320, height: 300 });

  const room = roomPalette[location?.type ?? ''] ?? defaultRoom;
  const scenery = useMemo(
    () => SCENERY[location?.type ?? ''] ?? DEFAULT_SCENERY,
    [location?.type],
  );

  const isNight = gameHour < 6 || gameHour >= 20;
  const isDusk = gameHour >= 17 && gameHour < 20;
  const sky = skyGradient(gameHour);

  // Residents are depth-sorted so someone standing lower on the floor is drawn
  // in front of someone further back.
  const sorted = useMemo(
    () => [...residents].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)),
    [residents],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const spriteScale = Math.max(0.62, Math.min(1.05, size.width / 620));

  return (
    <View style={[styles.root, contrast && styles.rootContrast]} onLayout={onLayout}>
      {/* Sky */}
      <LinearGradient colors={sky} style={styles.sky} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />

      {/* Stars */}
      {isNight
        ? STARS.map((pos, index) => (
            <View
              key={index}
              style={[styles.star, { top: pos.top, left: pos.left, opacity: 0.4 + (index % 3) * 0.2 }]}
            />
          ))
        : null}

      {/* Celestial body */}
      <View
        style={[
          styles.celestial,
          {
            top: isNight ? 26 : isDusk ? size.height * 0.18 : 18,
            right: isNight ? size.width * 0.62 : size.width * 0.12,
            backgroundColor: isNight ? '#E8ECFF' : isDusk ? '#FFB56B' : '#FFF3B0',
          },
        ]}
      />

      {/* Clouds */}
      {!isNight
        ? CLOUDS.map((cloud, index) => (
            <View
              key={index}
              style={[
                styles.cloud,
                { top: cloud.top, left: cloud.left, width: cloud.width, opacity: isDusk ? 0.28 : 0.5 },
              ]}
            />
          ))
        : null}

      {/* Back wall: one flat material colour, no gradient wash. */}
      <View style={[styles.wall, { height: size.height * 0.46, backgroundColor: room.wall[0] }]}>
        <View style={[styles.wallAccent, { backgroundColor: room.accent }]} />
        {[0.2, 0.42, 0.64, 0.86].map((fraction) => (
          <View
            key={fraction}
            style={[styles.wallSeam, { left: `${fraction * 100}%` }]}
          />
        ))}
      </View>

      {/* Floor */}
      <View style={[styles.floor, { backgroundColor: room.floor, height: size.height * 0.56 }]}>
        {Array.from({ length: 9 }).map((_, index) => (
          <View
            key={`v${index}`}
            style={[
              styles.floorLineV,
              { left: `${(index / 8) * 100}%`, opacity: 0.10 + (index % 2) * 0.05 },
            ]}
          />
        ))}
        {Array.from({ length: 5 }).map((_, index) => (
          <View
            key={`h${index}`}
            style={[
              styles.floorLineH,
              { top: `${(index / 4) * 100}%`, backgroundColor: room.floorAlt, opacity: 0.55 },
            ]}
          />
        ))}
      </View>

      {/* Scenery */}
      <View style={[styles.scenery, { top: size.height * 0.28, height: size.height * 0.72 }]}>
        {scenery.map((prop, index) => (
          <SceneryProp key={`${prop.kind}-${index}`} prop={prop} accent={room.accent} />
        ))}
      </View>

      {/* Residents */}
      {sorted.map((resident, index) => {
        const depth = Math.round((resident.position?.y ?? 0.5) * 1000) + index;
        return (
          <View
            key={resident.id}
            style={[
              styles.residentSlot,
              {
                left: `${Math.min(88, Math.max(4, (resident.position?.x ?? 0.5) * 100))}%`,
                top: `${26 + (resident.position?.y ?? 0.5) * 54}%`,
                zIndex: 100 + depth,
              },
            ]}
          >
            <ResidentSprite
              resident={resident}
              scale={spriteScale}
              selected={selectedResidentId === resident.id}
              walking={walkingIds.includes(resident.id)}
              onPress={onSelectResident}
              accessibilityHint={t('common.tapToSelect')}
            />
          </View>
        );
      })}

      {/* Anomaly */}
      {anomalyVisible ? (
        <View style={styles.anomalyLayer} pointerEvents="none">
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
        <View style={styles.emptyWrap} pointerEvents="none">
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

      {/* Vignette */}
      <LinearGradient
        colors={['rgba(8,10,13,0.55)', 'transparent', 'rgba(8,10,13,0.62)']}
        locations={[0, 0.45, 1]}
        style={styles.vignette}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: palette.deep,
    minHeight: 300,
    aspectRatio: 1.6,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rootContrast: { borderColor: palette.borderStrong },

  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: '52%' },
  star: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  celestial: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    shadowColor: '#FFE9A8',
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 4,
  },
  cloud: { position: 'absolute', height: 13, borderRadius: 10, backgroundColor: '#FFFFFF' },

  wall: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.94 },
  wallAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.55 },
  wallSeam: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.16)' },

  floor: { position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  floorLineV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#000000' },
  floorLineH: { position: 'absolute', left: 0, right: 0, height: 1.4 },

  scenery: { position: 'absolute', left: 0, right: 0 },
  prop: {},

  counterTop: { width: 72, height: 9, borderRadius: 3, opacity: 0.92 },
  counterBody: { width: 72, height: 22, backgroundColor: 'rgba(0,0,0,0.32)', borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  tableTop: { width: 44, height: 7, borderRadius: 4, opacity: 0.92 },
  tableLeg: { width: 5, height: 16, backgroundColor: 'rgba(0,0,0,0.34)', marginLeft: 19 },
  deskTop: { width: 52, height: 7, borderRadius: 3, opacity: 0.9 },
  deskLeg: { width: 52, height: 18, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 2 },
  benchSeat: { width: 46, height: 7, borderRadius: 3, opacity: 0.9 },
  benchBack: { width: 46, height: 4, backgroundColor: 'rgba(0,0,0,0.30)', marginTop: 3, borderRadius: 2 },
  machineBody: { width: 26, height: 36, borderRadius: 5, borderWidth: 2, backgroundColor: 'rgba(10,12,26,0.75)', alignItems: 'flex-end', padding: 4 },
  machineLight: { width: 6, height: 6, borderRadius: 3 },
  screen: { width: 58, height: 34, borderRadius: 4, borderWidth: 2, backgroundColor: 'rgba(12,15,19,0.88)', overflow: 'hidden' },
  screenGlow: { flex: 1 },
  screenStand: { width: 12, height: 6, backgroundColor: 'rgba(0,0,0,0.4)', marginLeft: 23, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  shelf: { width: 34, height: 44, borderRadius: 4, borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.28)', padding: 3, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  shelfBook: { width: 7, height: 20, borderRadius: 1, opacity: 0.9 },
  mat: { width: 64, height: 26, borderRadius: 6 },
  leaf: { width: 26, height: 20, borderRadius: 14, opacity: 0.85 },
  leafAlt: { width: 18, height: 16, borderRadius: 12, opacity: 0.7, marginTop: -8, marginLeft: 12 },
  pot: { width: 20, height: 12, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.38)', marginTop: -4, marginLeft: 3 },
  canopy: { width: 48, height: 42, borderRadius: 24, opacity: 0.9 },
  canopyAlt: { width: 30, height: 26, borderRadius: 16, opacity: 0.75, marginTop: -32, marginLeft: 26 },
  trunk: { width: 8, height: 22, backgroundColor: 'rgba(0,0,0,0.4)', marginTop: -6, marginLeft: 20, borderRadius: 3 },
  lampGlow: { width: 40, height: 40, borderRadius: 20 },
  lampBulb: { position: 'absolute', top: 14, left: 16, width: 9, height: 12, borderRadius: 5 },
  water: { width: 220, height: 34, borderRadius: 16 },
  bedBody: { width: 74, height: 30, borderRadius: 6, opacity: 0.92 },
  bedPillow: { position: 'absolute', top: 4, left: 6, width: 20, height: 13, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.72)' },
  sofaBody: { width: 62, height: 26, borderRadius: 8, opacity: 0.92 },
  sofaArm: { position: 'absolute', right: 0, top: -8, width: 12, height: 20, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.24)' },
  altarTop: { width: 44, height: 8, borderRadius: 3, opacity: 0.95 },
  altarBody: { width: 34, height: 26, backgroundColor: 'rgba(0,0,0,0.32)', marginLeft: 5, borderRadius: 3 },
  stageFloor: { width: 110, height: 18, borderRadius: 9, opacity: 0.85 },
  stageGlow: { position: 'absolute', top: -32, left: 6, width: 98, height: 34, borderRadius: 18 },
  stone: { width: 30, height: 15, borderRadius: 10, opacity: 0.8 },
  stoneSmall: { width: 18, height: 10, borderRadius: 6, opacity: 0.7, marginTop: -3, marginLeft: 26 },

  residentSlot: { position: 'absolute', alignItems: 'center', marginLeft: -46 },

  anomalyLayer: { ...StyleSheet.absoluteFillObject },
  anomalyLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#FF5FA2' },
  anomalyTag: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(14,10,11,0.82)', borderWidth: 1, borderColor: 'rgba(201,154,69,0.6)', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '72%' },

  anomalyTextWrap: { flexShrink: 1 },
  anomalyName: { ...typeTokens.micro, color: '#FF9EC4', letterSpacing: 1.2 },
  anomalyText: { ...typeTokens.caption, color: palette.inkSoft },

  emptyWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', gap: 4, backgroundColor: 'rgba(9,11,15,0.7)', borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, maxWidth: 300 },
  emptyTitle: { ...type.title, color: palette.ink, fontSize: 14 },
  emptyHint: { ...type.caption, color: palette.inkMuted, textAlign: 'center' },

  topBar: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  placeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(9,11,15,0.74)', borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7, maxWidth: '60%' },

  placeText: { flexShrink: 1 },
  placeName: { ...type.label, color: palette.ink },
  placeCity: { ...type.micro, color: palette.inkMuted, fontWeight: '500', letterSpacing: 0 },
  statusChips: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(9,11,15,0.74)', borderWidth: 1, borderColor: palette.border, borderRadius: radius.xs, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipText: { ...type.micro, color: palette.inkSoft, letterSpacing: 0.3 },

  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});

export default Stage;
