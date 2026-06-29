import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Character {
  id: string;
  name: string;
  age: number;
  avatar_emoji: string;
  location_id: string;
  is_moving: boolean;
  current_action: string;
  mood: string;
  appearance: { skin_color?: string; hair_color?: string };
}

interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  emoji: string;
  type: string;
}

interface Building {
  id: string; emoji: string; name: string; x: number; y: number;
}

interface Props {
  characters: Character[];
  location: Location | null;
  buildings: Building[];
  gameHour: number;
  onCharacterPress: (c: Character) => void;
  onLocationChange: () => void;
}

// Kawaii pastel palette per location type
const PALETTES: Record<string, { sky: string[]; floor: string; trim: string; wall: string; accent: string }> = {
  cafe:       { sky: ['#FFE0EC', '#FFD6E0', '#FFEAEF'], floor: '#F5D5B3', trim: '#FFB6C1', wall: '#FFE4E1', accent: '#FF6B9D' },
  apartment:  { sky: ['#E0F0FF', '#FFE0EC', '#FFF0E0'], floor: '#F5C99B', trim: '#FFB6C1', wall: '#E1F5FE', accent: '#FFB6C1' },
  office:     { sky: ['#E8F4FF', '#F0F8FF', '#FFE4E1'], floor: '#D7BFA0', trim: '#A0CED9', wall: '#E8F4FF', accent: '#7EB6D9' },
  park:       { sky: ['#C8E6C9', '#E0F2E0', '#FFF0E0'], floor: '#A8D5A8', trim: '#FFB6C1', wall: '#D0F0D0', accent: '#88C988' },
  gym:        { sky: ['#FFE0B2', '#FFCCBC', '#FFE0EC'], floor: '#F5B895', trim: '#FF9F87', wall: '#FFE0B2', accent: '#FF6B6B' },
  restaurant: { sky: ['#FFD9C0', '#FFE4E1', '#FFEAEF'], floor: '#E8B894', trim: '#FFB6C1', wall: '#FFE4E1', accent: '#FF6B9D' },
  club:       { sky: ['#D1C4E9', '#E1BEE7', '#F8BBD0'], floor: '#9575CD', trim: '#CE93D8', wall: '#E1BEE7', accent: '#BA68C8' },
  beach:      { sky: ['#B3E5FC', '#FFF9C4', '#FFE0B2'], floor: '#FFE082', trim: '#81D4FA', wall: '#B3E5FC', accent: '#4FC3F7' },
  school:     { sky: ['#BBDEFB', '#E3F2FD', '#FFE4E1'], floor: '#D7BFA0', trim: '#90CAF9', wall: '#E3F2FD', accent: '#42A5F5' },
  hospital:   { sky: ['#E1F5FE', '#FFEBEE', '#F1F8E9'], floor: '#F5F5F5', trim: '#FFCDD2', wall: '#FFEBEE', accent: '#EF5350' },
  market:     { sky: ['#FFE0B2', '#FFCC80', '#FFE0EC'], floor: '#E8B894', trim: '#FFAB91', wall: '#FFE0B2', accent: '#FF7043' },
  museum:     { sky: ['#D1C4E9', '#E1BEE7', '#FFE4E1'], floor: '#BCAAA4', trim: '#CE93D8', wall: '#E1BEE7', accent: '#9C27B0' },
  cinema:     { sky: ['#9FA8DA', '#B39DDB', '#FFE4E1'], floor: '#7986CB', trim: '#9575CD', wall: '#B39DDB', accent: '#5C6BC0' },
  temple:     { sky: ['#FFE082', '#FFCC80', '#FFE0EC'], floor: '#FFB74D', trim: '#FFAB91', wall: '#FFE082', accent: '#FF8A65' },
  mountain:   { sky: ['#B3E5FC', '#E1F5FE', '#FFE4E1'], floor: '#A5D6A7', trim: '#81D4FA', wall: '#E1F5FE', accent: '#66BB6A' },
};

// Decor groupings per type — each group is a cluster of pastel items
const DECOR_GROUPS: Record<string, Array<{ items: string[]; bg?: string }>> = {
  cafe:       [{ items: ['☕', '🥐', '🍰', '🧁'], bg: '#FFCDD2' }, { items: ['🌹', '🌷', '🌸'], bg: '#F8BBD0' }, { items: ['📰', '📖', '🪴'], bg: '#FFE0B2' }],
  apartment:  [{ items: ['🛋️', '🪴', '📺'], bg: '#FFCDD2' }, { items: ['🛏️', '🧸', '💡'], bg: '#C5CAE9' }, { items: ['🪟', '🖼️', '🪞'], bg: '#B2DFDB' }],
  office:     [{ items: ['💼', '📊', '🖥️'], bg: '#BBDEFB' }, { items: ['☕', '📝', '📞'], bg: '#FFCCBC' }, { items: ['🪑', '📈', '🗄️'], bg: '#DCEDC8' }],
  park:       [{ items: ['🌳', '🌷', '🌻'], bg: '#C8E6C9' }, { items: ['🦋', '🌸', '🌺'], bg: '#F8BBD0' }, { items: ['🦆', '🪑', '🌿'], bg: '#FFF9C4' }],
  gym:        [{ items: ['🏋️', '💪', '🥊'], bg: '#FFCDD2' }, { items: ['🚲', '🏃', '🤸'], bg: '#FFE0B2' }, { items: ['🥇', '💦', '⚖️'], bg: '#E1BEE7' }],
  restaurant: [{ items: ['🍝', '🍕', '🍷'], bg: '#FFCDD2' }, { items: ['🕯️', '🌹', '🪑'], bg: '#F8BBD0' }, { items: ['🧀', '🍞', '🍰'], bg: '#FFE0B2' }],
  club:       [{ items: ['🎵', '🎧', '🪩'], bg: '#E1BEE7' }, { items: ['💃', '🕺', '🍸'], bg: '#F8BBD0' }, { items: ['🎤', '🎸', '✨'], bg: '#D1C4E9' }],
  beach:      [{ items: ['🌴', '🌊', '🐚'], bg: '#B3E5FC' }, { items: ['⛱️', '🏄', '🩴'], bg: '#FFE082' }, { items: ['🍹', '🦀', '🐠'], bg: '#FFCCBC' }],
  school:     [{ items: ['📚', '🎒', '🍎'], bg: '#BBDEFB' }, { items: ['✏️', '📐', '🖍️'], bg: '#FFCDD2' }, { items: ['🔬', '🎨', '⚽'], bg: '#DCEDC8' }],
  hospital:   [{ items: ['💊', '🩺', '💉'], bg: '#FFCDD2' }, { items: ['🛌', '🧴', '❤️'], bg: '#E1F5FE' }, { items: ['🧬', '🦠', '🌡️'], bg: '#F1F8E9' }],
  market:     [{ items: ['🍎', '🍇', '🥕'], bg: '#FFCDD2' }, { items: ['🥖', '🧀', '🛒'], bg: '#FFE0B2' }, { items: ['🌶️', '🥦', '🧺'], bg: '#DCEDC8' }],
  museum:     [{ items: ['🎨', '🖼️', '🏛️'], bg: '#E1BEE7' }, { items: ['🗿', '⚱️', '📜'], bg: '#FFCDD2' }, { items: ['🪙', '🔍', '🎭'], bg: '#D1C4E9' }],
  cinema:     [{ items: ['🎬', '🍿', '🥤'], bg: '#D1C4E9' }, { items: ['🎥', '🎞️', '🎫'], bg: '#F8BBD0' }, { items: ['🪑', '🍫', '🎭'], bg: '#FFCDD2' }],
  temple:     [{ items: ['⛩️', '🙏', '🔔'], bg: '#FFE082' }, { items: ['🪷', '🕯️', '🍵'], bg: '#FFCDD2' }, { items: ['📿', '🌸', '🪙'], bg: '#FFCCBC' }],
  mountain:   [{ items: ['🌲', '⛺', '🦅'], bg: '#C8E6C9' }, { items: ['🏔️', '🌨️', '🎿'], bg: '#E1F5FE' }, { items: ['🐺', '🥾', '🌿'], bg: '#FFCDD2' }],
};

// One kawaii character (rounded head, simple body, big eyes, smile)
const KawaiiCharacter: React.FC<{ char: Character; index: number; onPress: () => void; accent: string }> = ({ char, index, onPress, accent }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Idle bounce
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 1, duration: char.is_moving ? 200 : 1200, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(bounceAnim, { toValue: 0, duration: char.is_moving ? 200 : 1200, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    bounceLoop.start();
    // Random blink every few seconds
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2000 + index * 700),
        Animated.timing(blinkAnim, { toValue: 0.1, duration: 90, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 90, useNativeDriver: false }),
      ])
    );
    blinkLoop.start();
    return () => { bounceLoop.stop(); blinkLoop.stop(); };
  }, [char.is_moving, index]);

  const translateY = bounceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, char.is_moving ? -8 : -3] });
  const skin = char.appearance?.skin_color || '#FFE0B2';
  const hair = char.appearance?.hair_color || '#5D4037';

  const moodEmoji: Record<string, string> = {
    Happy: '😊', Excited: '🤩', Content: '😌', Focused: '🤓',
    Sad: '😢', Tired: '😴', Anxious: '😰', Bored: '😐', Social: '😄',
  };

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.charContainer}>
      <Animated.View style={[styles.charInner, { transform: [{ translateY }] }]}>
        {/* Action bubble above */}
        {char.current_action && char.current_action !== 'Idle' && (
          <View style={[styles.actionBubble, { borderColor: accent }]}>
            <Text style={styles.actionBubbleText}>{char.current_action.substring(0, 14)}</Text>
          </View>
        )}

        {/* Hair (back layer) */}
        <View style={[styles.hairBack, { backgroundColor: hair }]} />

        {/* Head */}
        <View style={[styles.head, { backgroundColor: skin }]}>
          {/* Hair top */}
          <View style={[styles.hairTop, { backgroundColor: hair }]} />
          {/* Eyes */}
          <View style={styles.eyesRow}>
            <Animated.View style={[styles.eye, { transform: [{ scaleY: blinkAnim }] }]} />
            <Animated.View style={[styles.eye, { transform: [{ scaleY: blinkAnim }] }]} />
          </View>
          {/* Cheeks */}
          <View style={styles.cheeksRow}>
            <View style={styles.cheek} />
            <View style={styles.cheek} />
          </View>
          {/* Smile */}
          <View style={styles.smile} />
        </View>

        {/* Body — small chibi torso */}
        <View style={[styles.body, { backgroundColor: accent }]}>
          <View style={styles.bodyDetail} />
        </View>

        {/* Mood emoji floating */}
        <Text style={styles.moodFloat}>{moodEmoji[char.mood] || '😊'}</Text>

        {/* Name */}
        <View style={styles.nameTag}>
          <Text style={styles.nameTagText}>{char.name.split(' ')[0]}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// A pastel decoration cluster on a wooden shelf (Lv. X style group)
const DecorCluster: React.FC<{ group: { items: string[]; bg?: string }; level: number; coinLabel?: string }> = ({ group, level, coinLabel }) => {
  return (
    <View style={styles.decorClusterWrap}>
      {/* Lv badge */}
      <View style={styles.lvBadge}>
        <Text style={styles.lvBadgeText}>Lv. {level}</Text>
      </View>
      {/* Coin label */}
      {coinLabel && (
        <View style={styles.coinChip}>
          <Text style={styles.coinChipEmoji}>🪙</Text>
          <Text style={styles.coinChipText}>{coinLabel}</Text>
        </View>
      )}
      {/* Decor items in a row */}
      <View style={styles.decorRow}>
        {group.items.map((item, i) => (
          <View key={i} style={[styles.decorBubble, { backgroundColor: group.bg || '#FFCDD2' }]}>
            <Text style={styles.decorEmoji}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// A single horizontal wooden shelf "floor"
const Shelf: React.FC<{
  floorColor: string;
  trimColor: string;
  children: React.ReactNode;
}> = ({ floorColor, trimColor, children }) => {
  return (
    <View style={styles.shelfWrap}>
      <View style={styles.shelfContent}>{children}</View>
      <View style={[styles.shelfFloor, { backgroundColor: floorColor }]}>
        {/* Wood plank lines */}
        <View style={[styles.plankLine, { left: '15%' }]} />
        <View style={[styles.plankLine, { left: '35%' }]} />
        <View style={[styles.plankLine, { left: '60%' }]} />
        <View style={[styles.plankLine, { left: '82%' }]} />
      </View>
      <View style={[styles.shelfTrim, { backgroundColor: trimColor }]} />
    </View>
  );
};

export const KawaiiScene: React.FC<Props> = ({ characters, location, buildings, gameHour, onCharacterPress, onLocationChange }) => {
  const palette = PALETTES[location?.type || 'park'] || PALETTES.park;
  const decorGroups = DECOR_GROUPS[location?.type || 'park'] || DECOR_GROUPS.park;
  const locationChars = characters; // already pre-filtered upstream

  const isNight = gameHour < 6 || gameHour > 19;
  // At night, darken the sky a bit
  const nightSky = ['#2C3E50', '#34495E', '#3D5A7F'];
  const skyColors = isNight ? nightSky : palette.sky;

  // Distribute characters across the 3 shelves (round-robin)
  const charsPerShelf: Character[][] = [[], [], []];
  locationChars.forEach((c, i) => { charsPerShelf[i % 3].push(c); });

  return (
    <View style={styles.container}>
      {/* Pastel sky background */}
      <LinearGradient colors={skyColors} style={StyleSheet.absoluteFill} />

      {/* Vertical wall stripes (subtle) */}
      <View style={styles.wallStripes} pointerEvents="none">
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={[styles.stripe, { left: `${i * 14 + 4}%`, backgroundColor: 'rgba(255,255,255,0.15)' }]} />
        ))}
      </View>

      {/* Stars at night */}
      {isNight && (
        <>
          <Text style={[styles.star, { top: 14, left: 30 }]}>✨</Text>
          <Text style={[styles.star, { top: 28, left: 130 }]}>⭐</Text>
          <Text style={[styles.star, { top: 18, right: 60 }]}>✨</Text>
        </>
      )}
      {!isNight && (
        <>
          <Text style={[styles.cloudKawaii, { top: 14, left: 25 }]}>☁️</Text>
          <Text style={[styles.cloudKawaii, { top: 28, right: 30 }]}>☁️</Text>
        </>
      )}

      {/* Header */}
      <TouchableOpacity style={styles.locationHeader} onPress={onLocationChange}>
        <Text style={styles.locationEmoji}>{location?.emoji || '🌍'}</Text>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.locationName}>{location?.name || 'Unknown'}</Text>
          <Text style={styles.locationCity}>{location?.city}, {location?.country}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#FFF" />
      </TouchableOpacity>

      {/* Time + people count */}
      <View style={styles.topRightBadges}>
        <View style={styles.peopleBadge}>
          <Ionicons name="people" size={12} color="#FFF" />
          <Text style={styles.peopleBadgeText}>{locationChars.length}</Text>
        </View>
        <View style={styles.timeBadge}>
          <Text style={styles.timeBadgeText}>{String(gameHour).padStart(2, '0')}:00 {isNight ? '🌙' : '☀️'}</Text>
        </View>
      </View>

      {/* Stacked shelves */}
      <ScrollView style={styles.shelvesScroll} contentContainerStyle={styles.shelvesContent} showsVerticalScrollIndicator={false}>
        {[0, 1, 2].map((floorIdx) => {
          const groupIdx = floorIdx % decorGroups.length;
          const group = decorGroups[groupIdx];
          const charsHere = charsPerShelf[floorIdx];
          // Mock level & coin label per shelf
          const level = 100 - floorIdx * 3;
          const coinLabels = ['82.9B', '2.07B', '51.8M'];
          return (
            <Shelf key={floorIdx} floorColor={palette.floor} trimColor={palette.trim}>
              <View style={styles.shelfRow}>
                {/* Decor cluster on the left/middle */}
                <DecorCluster group={group} level={level} coinLabel={coinLabels[floorIdx]} />
                {/* Characters on this shelf */}
                <View style={styles.charsOnShelf}>
                  {charsHere.map((c, idx) => (
                    <KawaiiCharacter key={c.id} char={c} index={idx + floorIdx * 10} onPress={() => onCharacterPress(c)} accent={palette.accent} />
                  ))}
                </View>
              </View>
            </Shelf>
          );
        })}

        {/* User buildings shelf (only for my_home) */}
        {buildings.length > 0 && (
          <Shelf floorColor={palette.floor} trimColor={palette.trim}>
            <View style={styles.buildingsRow}>
              {buildings.slice(0, 8).map((b) => (
                <View key={b.id} style={[styles.decorBubble, { backgroundColor: '#FFF0E0' }]}>
                  <Text style={styles.decorEmoji}>{b.emoji}</Text>
                </View>
              ))}
            </View>
          </Shelf>
        )}

        {/* Empty state */}
        {locationChars.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🫧</Text>
            <Text style={styles.emptyText}>No one here yet</Text>
            <Text style={styles.emptySub}>Move a character to this place or pick another location</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: width - 20, marginHorizontal: 10, height: 380, borderRadius: 22, overflow: 'hidden', position: 'relative', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  wallStripes: { ...StyleSheet.absoluteFillObject },
  stripe: { position: 'absolute', top: 0, bottom: 0, width: 3 },
  star: { position: 'absolute', fontSize: 11, opacity: 0.9 },
  cloudKawaii: { position: 'absolute', fontSize: 20, opacity: 0.85 },
  locationHeader: { position: 'absolute', top: 10, left: 10, right: 80, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, zIndex: 100 },
  locationEmoji: { fontSize: 22 },
  locationName: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  locationCity: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  topRightBadges: { position: 'absolute', top: 10, right: 10, gap: 4, zIndex: 100, alignItems: 'flex-end' },
  peopleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  peopleBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  timeBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  timeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '600' },

  shelvesScroll: { marginTop: 60, flex: 1 },
  shelvesContent: { paddingBottom: 12 },

  shelfWrap: { position: 'relative', marginBottom: 2 },
  shelfContent: { paddingHorizontal: 8, paddingBottom: 4, minHeight: 70 },
  shelfFloor: { height: 14, position: 'relative', overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  shelfTrim: { height: 3 },
  plankLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.12)' },

  shelfRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 70 },

  decorClusterWrap: { position: 'relative', alignItems: 'center', paddingTop: 22 },
  lvBadge: { position: 'absolute', top: 0, backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1.5, borderColor: '#FFCDD2', zIndex: 10 },
  lvBadgeText: { color: '#888', fontSize: 9, fontWeight: '800' },
  coinChip: { position: 'absolute', top: 4, right: -28, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 8, zIndex: 9 },
  coinChipEmoji: { fontSize: 9 },
  coinChipText: { color: '#9C27B0', fontSize: 9, fontWeight: '800' },

  decorRow: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  decorBubble: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.06)', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  decorEmoji: { fontSize: 22 },

  charsOnShelf: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 4 },

  charContainer: { paddingHorizontal: 2 },
  charInner: { alignItems: 'center', position: 'relative', width: 50 },

  // Action bubble above
  actionBubble: { position: 'absolute', top: -18, backgroundColor: '#FFF', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, borderWidth: 1.5, zIndex: 10 },
  actionBubbleText: { color: '#444', fontSize: 8, fontWeight: '700' },

  // Head
  hairBack: { position: 'absolute', top: 6, width: 38, height: 32, borderRadius: 19, zIndex: 0 },
  head: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', position: 'relative', zIndex: 2 },
  hairTop: { position: 'absolute', top: -3, width: 38, height: 14, borderTopLeftRadius: 19, borderTopRightRadius: 19 },
  eyesRow: { flexDirection: 'row', gap: 7, marginTop: 6 },
  eye: { width: 4, height: 6, borderRadius: 2, backgroundColor: '#000' },
  cheeksRow: { flexDirection: 'row', gap: 12, position: 'absolute', top: 18 },
  cheek: { width: 4, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,105,180,0.5)' },
  smile: { position: 'absolute', bottom: 8, width: 8, height: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, borderWidth: 1, borderColor: '#000', borderTopWidth: 0, backgroundColor: 'transparent' },

  // Body
  body: { width: 28, height: 18, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: -3, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  bodyDetail: { width: 14, height: 4, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 },

  moodFloat: { position: 'absolute', top: -2, right: -10, fontSize: 14 },

  nameTag: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, marginTop: 2 },
  nameTagText: { color: '#FFF', fontSize: 8, fontWeight: '700' },

  buildingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8, justifyContent: 'center' },

  emptyState: { padding: 30, alignItems: 'center' },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: '#FFF', fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptySub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
