import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { CharacterCreatorModal } from '../src/components/CharacterCreatorModal';
import { BuildModeModal } from '../src/components/BuildModeModal';
import { PremiumModal } from '../src/components/PremiumModal';
import { Scene3D } from '../src/components/Scene3D';
import { HaveBabyModal } from '../src/components/HaveBabyModal';
import { KawaiiScene } from '../src/components/KawaiiScene';

// Map character actions → overlay emoji shown next to them
const ACTION_ICONS: Record<string, string> = {
  coffee: '☕', drink: '☕', eat: '🍔', croissant: '🥐', dinner: '🍝', cook: '🍳',
  meal: '🍳', work: '💻', meeting: '📊', sleep: '💤', shower: '🚿', toilet: '🚽',
  exercise: '🏋️', lift: '🏋️', jog: '🏃', swim: '🏊', surf: '🏄', yoga: '🧘',
  dance: '💃', party: '🎉', music: '🎵', read: '📖', study: '📚', game: '🎮',
  tv: '📺', flirt: '😘', chat: '💬', meet: '👥', shop: '🛍️', bargain: '🛍️',
  pray: '🙏', meditate: '🧘‍♀️', hike: '🥾', climb: '🧗', ski: '⛷️', surf_: '🏄',
  paint: '🎨', sing: '🎤', walk: '🚶', relax: '🛋️', picnic: '🧺', sunbathe: '☀️',
  bal: '🩰', opera: '🎭', tea: '🍵',
};

const getActionIcon = (action: string): string => {
  if (!action) return '';
  const lower = action.toLowerCase();
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '';
};

const { width, height } = Dimensions.get('window');
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Character {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: string;
  avatar_emoji: string;
  location_id: string;
  position_x: number;
  position_y: number;
  is_moving: boolean;
  needs: Record<string, number>;
  attributes: Record<string, number>;
  current_action: string;
  mood: string;
  thoughts: string[];
  money: number;
  appearance: { skin_color: string; hair_color: string };
  is_npc: boolean;
}

interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  emoji: string;
  type: string;
}

// Animated Walking Character Component
const WalkingCharacter: React.FC<{
  character: Character;
  index: number;
  onPress: () => void;
  worldWidth: number;
  worldHeight: number;
}> = ({ character, index, onPress, worldWidth, worldHeight }) => {
  const walkAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Walking bounce animation
    if (character.is_moving) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(walkAnim, { toValue: 1, duration: 150, useNativeDriver: false, easing: Easing.ease }),
          Animated.timing(walkAnim, { toValue: 0, duration: 150, useNativeDriver: false, easing: Easing.ease }),
        ])
      ).start();
    } else {
      walkAnim.setValue(0);
    }
    
    // Idle floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, [character.is_moving]);

  const bounceY = walkAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  
  // Calculate position with deterministic per-character offset so multiple
  // characters in the same location never fully overlap.
  const offsetX = ((index % 3) - 1) * 70; // -70, 0, +70
  const offsetY = (Math.floor(index / 3) % 2) * 50; // 0 or +50 (second row)
  const rawX = (character.position_x / 100) * worldWidth + offsetX;
  const rawY = (character.position_y / 100) * (worldHeight - 80) + 50 + offsetY;
  const x = Math.max(30, Math.min(worldWidth - 80, rawX));
  const y = Math.max(60, Math.min(worldHeight - 100, rawY));

  const moodColors: Record<string, string> = {
    'Happy': '#4CAF50', 'Excited': '#FF9800', 'Content': '#8BC34A', 'Focused': '#2196F3',
    'Sad': '#5C6BC0', 'Tired': '#9E9E9E', 'Anxious': '#F44336', 'Bored': '#795548',
  };

  return (
    <Animated.View
      style={[
        styles.walkingCharacter,
        {
          left: x,
          top: y,
          transform: [{ translateY: character.is_moving ? bounceY : floatY }],
          zIndex: 100 + index,
        }
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {/* Shadow */}
        <View style={styles.characterShadow} />
        
        {/* Chibi character sprite */}
        <View style={styles.chibiWrap}>
          {/* Hair back layer */}
          <View style={[styles.chibiHairBack, { backgroundColor: character.appearance?.hair_color || '#4A3728' }]} />
          {/* Round head with skin color */}
          <View style={[styles.chibiHead, { backgroundColor: character.appearance?.skin_color || '#F5D0C5' }]}>
            {/* Hair top cap */}
            <View style={[styles.chibiHairTop, { backgroundColor: character.appearance?.hair_color || '#4A3728' }]} />
            {/* Big chibi eyes */}
            <View style={styles.chibiEyesRow}>
              <View style={styles.chibiEye} />
              <View style={styles.chibiEye} />
            </View>
            {/* Pink cheeks */}
            <View style={styles.chibiCheeksRow}>
              <View style={styles.chibiCheek} />
              <View style={styles.chibiCheek} />
            </View>
            {/* Smile */}
            <View style={styles.chibiSmile} />
          </View>
          {/* Small body torso */}
          <View style={[styles.chibiBody, { backgroundColor: moodColors[character.mood] || '#4CAF50' }]} />
        </View>
        
        {/* Mood indicator */}
        <View style={[styles.moodDot, { backgroundColor: moodColors[character.mood] || '#4CAF50' }]} />

        {/* Action overlay icon (what they're actively doing) */}
        {getActionIcon(character.current_action) ? (
          <Animated.View
            style={[
              styles.actionOverlay,
              { transform: [{ translateY: floatY }] },
            ]}
          >
            <Text style={styles.actionOverlayIcon}>{getActionIcon(character.current_action)}</Text>
          </Animated.View>
        ) : null}
        
        {/* Name tag */}
        <View style={styles.nameTag}>
          <Text style={styles.nameTagText}>{character.name.split(' ')[0]}</Text>
        </View>
        
        {/* Action bubble (text label) */}
        <View style={styles.actionBubble}>
          <Text style={styles.actionBubbleText}>{character.current_action.substring(0, 15)}</Text>
        </View>
        
        {/* Walking legs animation */}
        {character.is_moving && (
          <View style={styles.walkingLegs}>
            <Animated.View style={[styles.leg, styles.leftLeg, { transform: [{ translateY: bounceY }] }]} />
            <Animated.View style={[styles.leg, styles.rightLeg, { transform: [{ translateY: walkAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]} />
          </View>
        )}
        
        {/* Thought bubble */}
        {character.thoughts && character.thoughts.length > 0 && (
          <View style={styles.thoughtCloud}>
            <Text style={styles.thoughtCloudText}>💭</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Isometric World View
const IsometricWorld: React.FC<{
  characters: Character[];
  location: Location | null;
  onCharacterPress: (char: Character) => void;
  onLocationChange: () => void;
  gameHour: number;
  buildings?: any[];
}> = ({ characters, location, onCharacterPress, onLocationChange, gameHour, buildings = [] }) => {
  const worldWidth = width - 20;
  const worldHeight = 360;
  
  const locationChars = location ? characters.filter(c => c.location_id === location.id) : [];
  
  // Location-specific backgrounds + RICH decor (8+ objects)
  const getLocationStyle = (type: string) => {
    const stylesMap: Record<string, { sky: string[]; ground: string; objects: { e: string; size?: number }[] }> = {
      'cafe': { sky: ['#87CEEB', '#FFE4B5'], ground: '#D2B48C', objects: [{e:'☕'},{e:'🪑'},{e:'🌸'},{e:'🍰'},{e:'🪟'},{e:'🥐'},{e:'🌹'},{e:'📰'},{e:'🪴'}] },
      'apartment': { sky: ['#4A5568', '#2D3748'], ground: '#718096', objects: [{e:'🛋️'},{e:'📺'},{e:'🪴'},{e:'🛏️'},{e:'🪟'},{e:'📚'},{e:'🖼️'},{e:'💡'},{e:'🪞'}] },
      'office': { sky: ['#E2E8F0', '#CBD5E0'], ground: '#A0AEC0', objects: [{e:'💼'},{e:'📊'},{e:'🖥️'},{e:'☕'},{e:'📝'},{e:'📞'},{e:'🗄️'},{e:'🪑'},{e:'📈'}] },
      'park': { sky: ['#87CEEB', '#98FB98'], ground: '#228B22', objects: [{e:'🌳'},{e:'🌸'},{e:'🦆'},{e:'🌷'},{e:'🪑'},{e:'🌺'},{e:'🦋'},{e:'🌻'},{e:'🐿️'}] },
      'gym': { sky: ['#F56565', '#ED8936'], ground: '#E53E3E', objects: [{e:'🏋️'},{e:'🥊'},{e:'💪'},{e:'🏃'},{e:'🚲'},{e:'🤸'},{e:'⚖️'},{e:'🥇'},{e:'💦'}] },
      'restaurant': { sky: ['#F6AD55', '#ED8936'], ground: '#DD6B20', objects: [{e:'🍕'},{e:'🍷'},{e:'🕯️'},{e:'🍝'},{e:'🧀'},{e:'🍞'},{e:'🍷'},{e:'🪑'},{e:'🌹'}] },
      'club': { sky: ['#553C9A', '#6B46C1'], ground: '#44337A', objects: [{e:'🎵'},{e:'🎧'},{e:'💃'},{e:'🍸'},{e:'🪩'},{e:'🎤'},{e:'🎸'},{e:'🕺'},{e:'✨'}] },
      'beach': { sky: ['#63B3ED', '#4FD1C5'], ground: '#ECC94B', objects: [{e:'🌴'},{e:'🏖️'},{e:'🌊'},{e:'🐚'},{e:'⛱️'},{e:'🏄'},{e:'🦀'},{e:'🍹'},{e:'🐠'}] },
      'school': { sky: ['#90CDF4', '#63B3ED'], ground: '#4A5568', objects: [{e:'📚'},{e:'✏️'},{e:'🎒'},{e:'🍎'},{e:'🪑'},{e:'📐'},{e:'🖍️'},{e:'🔬'},{e:'🎨'}] },
      'hospital': { sky: ['#E2E8F0', '#CBD5E0'], ground: '#FFFFFF', objects: [{e:'🏥'},{e:'💊'},{e:'🩺'},{e:'🛌'},{e:'💉'},{e:'🧬'},{e:'🧴'},{e:'🦠'},{e:'❤️'}] },
      'market': { sky: ['#F6AD55', '#FC8181'], ground: '#C53030', objects: [{e:'🛒'},{e:'🍎'},{e:'🧺'},{e:'🥕'},{e:'🥖'},{e:'🍇'},{e:'🌶️'},{e:'🧀'},{e:'🥦'}] },
      'museum': { sky: ['#B794F4', '#9F7AEA'], ground: '#6B46C1', objects: [{e:'🎨'},{e:'🖼️'},{e:'🏛️'},{e:'⚱️'},{e:'📜'},{e:'🗿'},{e:'🪙'},{e:'🎭'},{e:'🔍'}] },
      'cinema': { sky: ['#1A202C', '#2D3748'], ground: '#4A5568', objects: [{e:'🎬'},{e:'🍿'},{e:'🎥'},{e:'🎞️'},{e:'🪑'},{e:'🎫'},{e:'🥤'},{e:'🍫'},{e:'🎭'}] },
      'temple': { sky: ['#F6E05E', '#ECC94B'], ground: '#D69E2E', objects: [{e:'⛩️'},{e:'🙏'},{e:'🔔'},{e:'🕯️'},{e:'🪷'},{e:'🍵'},{e:'🌸'},{e:'🪙'},{e:'📿'}] },
      'mountain': { sky: ['#63B3ED', '#FFFFFF'], ground: '#48BB78', objects: [{e:'⛰️'},{e:'🏔️'},{e:'🌲'},{e:'🦅'},{e:'⛺'},{e:'🎿'},{e:'🐺'},{e:'🌨️'},{e:'🥾'}] },
    };
    return stylesMap[type] || stylesMap['park'];
  };

  const locStyle = getLocationStyle(location?.type || 'park');
  
  // Day/Night cycle based on game hour (0-23)
  const isNight = gameHour < 6 || gameHour > 19;
  const isDusk = gameHour >= 17 && gameHour <= 19;
  const skyColors = isNight 
    ? ['#0a0a2e', '#1a1a4e'] 
    : isDusk 
    ? ['#FF6B35', '#F7931E', '#FFC857']
    : locStyle.sky;
  const celestialIcon = isNight ? '🌙' : isDusk ? '🌇' : '☀️';

  return (
    <View style={[styles.isometricWorld, { width: worldWidth, height: worldHeight }]}>
      {/* Sky (with day/night colors) */}
      <LinearGradient colors={skyColors} style={styles.sky} />
      
      {/* Stars at night */}
      {isNight && (
        <>
          <Text style={[styles.star, { top: 15, left: 40 }]}>✨</Text>
          <Text style={[styles.star, { top: 30, left: 120 }]}>⭐</Text>
          <Text style={[styles.star, { top: 50, right: 80 }]}>✨</Text>
          <Text style={[styles.star, { top: 22, right: 30 }]}>⭐</Text>
        </>
      )}
      
      {/* Sun/Moon */}
      <View style={styles.celestialBody}>
        <Text style={styles.celestialEmoji}>{celestialIcon}</Text>
      </View>
      
      {/* Clouds (day only) */}
      {!isNight && (
        <>
          <View style={[styles.cloud, { left: 30, top: 25 }]}><Text style={styles.cloudText}>☁️</Text></View>
          <View style={[styles.cloud, { right: 50, top: 40 }]}><Text style={styles.cloudText}>☁️</Text></View>
          <View style={[styles.cloud, { left: 180, top: 15 }]}><Text style={[styles.cloudText, { fontSize: 22 }]}>☁️</Text></View>
        </>
      )}
      
      {/* Distant horizon mountains/buildings silhouette */}
      <View style={styles.horizonLayer}>
        <Text style={styles.horizonObj}>🏔️</Text>
        <Text style={[styles.horizonObj, { left: 90 }]}>🏢</Text>
        <Text style={[styles.horizonObj, { left: 170 }]}>🏛️</Text>
        <Text style={[styles.horizonObj, { right: 90 }]}>🏬</Text>
        <Text style={[styles.horizonObj, { right: 20 }]}>🗼</Text>
      </View>
      
      {/* Location header */}
      <TouchableOpacity style={styles.locationHeader} onPress={onLocationChange}>
        <View style={styles.locationFlag}>
          <Text style={styles.locationEmoji}>{location?.emoji || '🌍'}</Text>
        </View>
        <View style={styles.locationInfo}>
          <Text style={styles.locationName}>{location?.name || 'Unknown'}</Text>
          <Text style={styles.locationCity}>{location?.city}, {location?.country}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color="#FFF" />
      </TouchableOpacity>
      
      {/* Ground */}
      <View style={[styles.ground, { backgroundColor: locStyle.ground }]}>
        <View style={styles.groundPattern} />
        {/* Ground tiles for isometric look */}
        <View style={styles.tilesRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.tile} />
          ))}
        </View>
      </View>
      
      {/* Decorative objects - now 9 per scene, spread across the ground */}
      {locStyle.objects.map((obj, i) => {
        const cols = 3;
        const row = Math.floor(i / cols);
        const col = i % cols;
        const left = 20 + col * ((worldWidth - 60) / 2);
        const bottom = 30 + row * 30;
        return (
          <Text key={i} style={[styles.decorObject, { left, bottom, opacity: isNight ? 0.7 : 1 }]}>
            {obj.e}
          </Text>
        );
      })}

      {/* User-placed buildings (for my_home) */}
      {buildings.map((b: any) => (
        <View
          key={b.id}
          style={{
            position: 'absolute',
            left: (b.x / 100) * worldWidth - 18,
            top: (b.y / 100) * worldHeight - 18,
            zIndex: 30,
          }}
        >
          <Text style={{ fontSize: 30 }}>{b.emoji}</Text>
        </View>
      ))}
      
      {/* Characters */}
      {locationChars.map((char, index) => (
        <WalkingCharacter
          key={char.id}
          character={char}
          index={index}
          onPress={() => onCharacterPress(char)}
          worldWidth={worldWidth}
          worldHeight={worldHeight}
        />
      ))}
      
      {/* Empty state */}
      {locationChars.length === 0 && (
        <View style={styles.emptyWorld}>
          <Text style={styles.emptyText}>👻 No one here yet...</Text>
          <Text style={styles.emptySubtext}>Move a character here or change location</Text>
        </View>
      )}
      
      {/* Character count & time badge */}
      <View style={styles.charCounter}>
        <Ionicons name="people" size={16} color="#FFF" />
        <Text style={styles.charCounterText}>{locationChars.length}</Text>
      </View>
      <View style={styles.timeBadge}>
        <Text style={styles.timeBadgeText}>{String(gameHour).padStart(2, '0')}:00</Text>
      </View>
    </View>
  );
};

// God Control Panel
const GodControlPanel: React.FC<{
  onSimulate: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  isPaused: boolean;
  isSimulating: boolean;
  autoSimulate: boolean;
  onAutoToggle: () => void;
  speed: number;
}> = ({ onSimulate, onPause, onSpeedChange, isPaused, isSimulating, autoSimulate, onAutoToggle, speed }) => {
  return (
    <View style={styles.godPanel}>
      <View style={styles.godPanelHeader}>
        <Text style={styles.godPanelTitle}>⚡ GOD MODE</Text>
        <View style={[styles.statusDot, { backgroundColor: isPaused ? '#F44336' : '#4CAF50' }]} />
      </View>
      
      <View style={styles.controlsRow}>
        <TouchableOpacity 
          style={[styles.controlBtn, isSimulating && styles.controlBtnActive]}
          onPress={onSimulate}
          disabled={isSimulating}
        >
          {isSimulating ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="flash" size={20} color="#FFF" />
              <Text style={styles.controlBtnText}>Simulate</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlBtn, styles.controlBtnSecondary, isPaused && styles.controlBtnDanger]}
          onPress={onPause}
        >
          <Ionicons name={isPaused ? "play" : "pause"} size={20} color="#FFF" />
          <Text style={styles.controlBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlBtn, styles.controlBtnSmall, autoSimulate && styles.controlBtnActive]}
          onPress={onAutoToggle}
        >
          <Ionicons name={autoSimulate ? "sync" : "sync-outline"} size={18} color="#FFF" />
          <Text style={styles.controlBtnTextSmall}>Auto</Text>
        </TouchableOpacity>
      </View>
      
      {/* Speed control */}
      <View style={styles.speedRow}>
        <Text style={styles.speedLabel}>Speed:</Text>
        {[1, 2, 3].map(s => (
          <TouchableOpacity 
            key={s} 
            style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
            onPress={() => onSpeedChange(s)}
          >
            <Text style={styles.speedBtnText}>{s}x</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Location Selector Modal
const LocationSelector: React.FC<{
  visible: boolean;
  locations: Location[];
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}> = ({ visible, locations, currentId, onSelect, onClose }) => {
  // Group locations by country
  const grouped = locations.reduce((acc, loc) => {
    if (!acc[loc.country]) acc[loc.country] = [];
    acc[loc.country].push(loc);
    return acc;
  }, {} as Record<string, Location[]>);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.locationModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🌍 Travel To</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.locationList} showsVerticalScrollIndicator={false}>
            {Object.entries(grouped).map(([country, locs]) => (
              <View key={country}>
                <Text style={styles.countryHeader}>{country}</Text>
                {locs.map(loc => (
                  <TouchableOpacity
                    key={loc.id}
                    style={[styles.locationOption, currentId === loc.id && styles.locationOptionActive]}
                    onPress={() => { onSelect(loc.id); onClose(); }}
                  >
                    <Text style={styles.locationOptionEmoji}>{loc.emoji}</Text>
                    <View style={styles.locationOptionInfo}>
                      <Text style={styles.locationOptionName}>{loc.name}</Text>
                      <Text style={styles.locationOptionCity}>{loc.city}</Text>
                    </View>
                    {currentId === loc.id && <Ionicons name="checkmark-circle" size={20} color="#00D4FF" />}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Character Detail Modal
const CharacterDetailModal: React.FC<{
  character: Character | null;
  onClose: () => void;
  onTravel: () => void;
  onHaveBaby: (parent: Character) => void;
}> = ({ character, onClose, onTravel, onHaveBaby }) => {
  if (!character) return null;

  const needs = character.needs || {};
  const attrs = character.attributes || {};

  return (
    <Modal visible={!!character} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.characterModal}>
          <View style={styles.modalHeader}>
            <View style={styles.characterModalHeader}>
              <View style={[styles.bigAvatar, { backgroundColor: character.appearance?.skin_color || '#F5D0C5' }]}>
                <Text style={styles.bigAvatarEmoji}>{character.avatar_emoji}</Text>
              </View>
              <View style={styles.characterMainInfo}>
                <Text style={styles.characterModalName}>{character.name}</Text>
                <Text style={styles.characterModalJob}>{character.occupation}, {character.age}</Text>
                <Text style={styles.characterModalMood}>{character.mood}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.characterModalContent}>
            {/* Current Action */}
            <View style={styles.actionCard}>
              <Ionicons name="play-circle" size={20} color="#00D4FF" />
              <Text style={styles.actionCardText}>{character.current_action}</Text>
            </View>
            
            {/* Thought */}
            {character.thoughts && character.thoughts.length > 0 && (
              <View style={styles.thoughtCard}>
                <Text style={styles.thoughtCardText}>💭 "{character.thoughts[character.thoughts.length - 1]}"</Text>
              </View>
            )}
            
            {/* Needs */}
            <Text style={styles.sectionTitle}>Needs</Text>
            <View style={styles.needsGrid}>
              {Object.entries(needs).map(([key, value]) => {
                const icons: Record<string, string> = {
                  hunger: '🍔', energy: '⚡', social: '💬', hygiene: '🚿', fun: '🎮', bladder: '🚽', comfort: '🛋️'
                };
                const v = value as number;
                return (
                  <View key={key} style={styles.needCard}>
                    <Text style={styles.needIcon}>{icons[key] || '❓'}</Text>
                    <View style={styles.needBarBg}>
                      <View style={[styles.needBarFill, { width: `${v}%`, backgroundColor: v < 30 ? '#F44' : v < 50 ? '#F90' : '#4C5' }]} />
                    </View>
                    <Text style={styles.needValue}>{Math.round(v)}%</Text>
                  </View>
                );
              })}
            </View>
            
            {/* Attributes */}
            <Text style={styles.sectionTitle}>Attributes</Text>
            <View style={styles.attrsGrid}>
              {Object.entries(attrs).slice(0, 6).map(([key, value]) => {
                const icons: Record<string, string> = {
                  intelligence: '🧠', strength: '💪', charisma: '🗣️', beauty: '✨', creativity: '🎨', luck: '🍀'
                };
                return (
                  <View key={key} style={styles.attrCard}>
                    <Text style={styles.attrIcon}>{icons[key] || '⭐'}</Text>
                    <Text style={styles.attrLabel}>{key}</Text>
                    <Text style={styles.attrValue}>{Math.round(value as number)}</Text>
                  </View>
                );
              })}
            </View>
            
            {/* Money */}
            <View style={styles.moneyCard}>
              <Text style={styles.moneyIcon}>💰</Text>
              <Text style={styles.moneyValue}>${character.money.toFixed(0)}</Text>
            </View>
          </ScrollView>
          
          <View style={styles.modalActionsRow}>
            <TouchableOpacity style={styles.travelButton} onPress={onTravel}>
              <Ionicons name="airplane" size={18} color="#FFF" />
              <Text style={styles.travelButtonText}>Travel</Text>
            </TouchableOpacity>
            {character.age >= 18 && (
              <TouchableOpacity style={styles.babyButton} onPress={() => onHaveBaby(character)}>
                <Text style={styles.babyButtonEmoji}>👶</Text>
                <Text style={styles.travelButtonText}>Baby</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main App
export default function LifeSimulator() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [hobbiesList, setHobbiesList] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState('paris_cafe');
  const [isPaused, setIsPaused] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoSimulate, setAutoSimulate] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [language, setLanguage] = useState('en');
  const [showCreator, setShowCreator] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showHaveBaby, setShowHaveBaby] = useState(false);
  const [babyParent, setBabyParent] = useState<Character | null>(null);
  const [view3D, setView3D] = useState(false); // Default to Kawaii 2D scene
  const [gameHour, setGameHour] = useState(12); // start at noon for bright first view
  const [isPremium] = useState(false); // TODO: wire to auth user

  const fetchData = useCallback(async () => {
    try {
      const [charsRes, locsRes, logsRes, worldRes, objRes, hobRes, buildRes] = await Promise.all([
        axios.get(`${API_BASE}/api/characters`),
        axios.get(`${API_BASE}/api/locations`),
        axios.get(`${API_BASE}/api/logs?limit=10`),
        axios.get(`${API_BASE}/api/world`),
        axios.get(`${API_BASE}/api/objectives`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/hobbies`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/api/build/items?location_id=my_home`).catch(() => ({ data: [] })),
      ]);
      setCharacters(charsRes.data);
      setLocations(locsRes.data);
      setLogs(logsRes.data);
      setIsPaused(worldRes.data.is_paused || false);
      setObjectives(objRes.data || []);
      setHobbiesList(hobRes.data || []);
      setBuildings(buildRes.data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // In-game clock — advance one hour every 30 real seconds (or faster if speed>1)
  useEffect(() => {
    if (isPaused) return;
    const ms = Math.max(5000, 30000 / speed);
    const interval = setInterval(() => {
      setGameHour(h => (h + 1) % 24);
    }, ms);
    return () => clearInterval(interval);
  }, [speed, isPaused]);

  // Auto-simulate based on speed
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoSimulate && !isPaused) {
      const ms = Math.max(1500, 5000 / speed);
      interval = setInterval(simulateTick, ms);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [autoSimulate, isPaused, speed]);

  const simulateTick = async () => {
    if (isSimulating || isPaused) return;
    setIsSimulating(true);
    try {
      await axios.post(`${API_BASE}/api/simulate`);
      await fetchData();
    } catch (error) {
      console.error('Simulate error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const togglePause = async () => {
    const res = await axios.post(`${API_BASE}/api/world/pause`);
    setIsPaused(res.data.is_paused);
  };

  const moveCharacter = async (characterId: string, locationId: string) => {
    await axios.post(`${API_BASE}/api/characters/${characterId}/move?location_id=${locationId}`);
    await fetchData();
    setCurrentLocationId(locationId);
    setSelectedCharacter(null);
  };

  const currentLocation = locations.find(l => l.id === currentLocationId);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContent}>
          <Text style={styles.loadingEmoji}>🎮</Text>
          <Text style={styles.loadingTitle}>Life</Text>
          <Text style={styles.loadingSubtitle}>Virtual God Simulator</Text>
          <ActivityIndicator size="large" color="#00D4FF" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Life</Text>
          <Text style={styles.headerSubtitle}>God Simulator</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtnPremium} onPress={() => setShowPremium(true)}>
            <Text style={styles.headerCrown}>👑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowCreator(true)}>
            <Ionicons name="person-add" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => { setCurrentLocationId('my_home'); setShowBuilder(true); }}>
            <Ionicons name="hammer" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#00D4FF" />}
      >
        {/* Rich Isometric scene (default) or 3D World */}
        {view3D ? (
          <Scene3D
            characters={(currentLocation ? characters.filter(c => c.location_id === currentLocation.id) : []) as any}
            locationType={currentLocation?.type || 'park'}
            locationName={currentLocation?.name}
            buildings={currentLocationId === 'my_home' ? buildings : []}
            gameHour={gameHour}
            onCharacterClick={setSelectedCharacter}
          />
        ) : (
          <IsometricWorld
            characters={characters}
            location={currentLocation || null}
            onCharacterPress={setSelectedCharacter}
            onLocationChange={() => setShowLocationPicker(true)}
            gameHour={gameHour}
            buildings={currentLocationId === 'my_home' ? buildings : []}
          />
        )}

        {/* View toggle row */}
        <View style={styles.viewToggleRow}>
          <TouchableOpacity style={[styles.viewToggleBtn, !view3D && styles.viewToggleBtnActive]} onPress={() => setView3D(false)}>
            <Text style={styles.viewToggleText}>🗺️ Isometric</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewToggleBtn, view3D && styles.viewToggleBtnActive]} onPress={() => setView3D(true)}>
            <Text style={styles.viewToggleText}>🎮 3D</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.travelChipBtn} onPress={() => setShowLocationPicker(true)}>
            <Ionicons name="airplane" size={14} color="#FFF" />
            <Text style={styles.viewToggleText}>Travel</Text>
          </TouchableOpacity>
        </View>
        
        {/* God Control Panel */}
        <GodControlPanel
          onSimulate={simulateTick}
          onPause={togglePause}
          onSpeedChange={setSpeed}
          isPaused={isPaused}
          isSimulating={isSimulating}
          autoSimulate={autoSimulate}
          onAutoToggle={() => setAutoSimulate(!autoSimulate)}
          speed={speed}
        />
        
        {/* Quick Location Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickLocations}>
          {locations.slice(0, 20).map(loc => (
            <TouchableOpacity 
              key={loc.id} 
              style={[styles.quickLocBtn, currentLocationId === loc.id && styles.quickLocBtnActive]}
              onPress={() => setCurrentLocationId(loc.id)}
            >
              <Text style={styles.quickLocEmoji}>{loc.emoji}</Text>
              <Text style={styles.quickLocText}>{loc.city}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.quickLocBtnMore} onPress={() => setShowLocationPicker(true)}>
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.quickLocText}>More</Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Character List */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>👥 All Characters</Text>
          {characters.map(char => (
            <TouchableOpacity 
              key={char.id} 
              style={styles.charListItem}
              onPress={() => setSelectedCharacter(char)}
            >
              <View style={[styles.charListAvatar, { backgroundColor: char.appearance?.skin_color || '#F5D0C5' }]}>
                <Text style={styles.charListEmoji}>{char.avatar_emoji}</Text>
              </View>
              <View style={styles.charListInfo}>
                <Text style={styles.charListName}>{char.name}</Text>
                <Text style={styles.charListDetails}>{char.occupation} • {char.mood}</Text>
                <Text style={styles.charListAction}>{char.current_action}</Text>
              </View>
              <View style={styles.charListLocation}>
                <Text style={styles.charListLocEmoji}>{locations.find(l => l.id === char.location_id)?.emoji || '🌍'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>📜 Recent Activity</Text>
          <View style={styles.logContainer}>
            {logs.slice(0, 6).map((log, i) => (
              <View key={log.id || i} style={styles.logItem}>
                <Text style={styles.logChar}>{log.character_name}</Text>
                <Text style={styles.logAction}>{log.action}</Text>
                {log.thought && <Text style={styles.logThought}>"{log.thought}"</Text>}
              </View>
            ))}
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <LocationSelector
        visible={showLocationPicker}
        locations={locations}
        currentId={currentLocationId}
        onSelect={setCurrentLocationId}
        onClose={() => setShowLocationPicker(false)}
      />
      
      <CharacterDetailModal
        character={selectedCharacter}
        onClose={() => setSelectedCharacter(null)}
        onTravel={() => {
          if (selectedCharacter) {
            setShowLocationPicker(true);
          }
        }}
        onHaveBaby={(p) => {
          setBabyParent(p);
          setSelectedCharacter(null);
          setTimeout(() => setShowHaveBaby(true), 200);
        }}
      />

      {/* Have Baby Modal */}
      <HaveBabyModal
        visible={showHaveBaby}
        parent={babyParent as any}
        candidates={characters as any}
        onClose={() => { setShowHaveBaby(false); setBabyParent(null); }}
        onBabyCreated={(baby) => { fetchData(); alert(`👶 ${baby.name} is born! Welcome to the world!`); }}
      />
      
      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚙️ Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.settingLabel}>Language</Text>
            <View style={styles.langRow}>
              {[{c:'en',f:'🇬🇧'},{c:'fr',f:'🇫🇷'},{c:'es',f:'🇪🇸'},{c:'de',f:'🇩🇪'}].map(l => (
                <TouchableOpacity key={l.c} style={[styles.langBtn, language === l.c && styles.langBtnActive]} onPress={() => setLanguage(l.c)}>
                  <Text style={styles.langFlag}>{l.f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Character Creator (P2 Sandbox) */}
      <CharacterCreatorModal
        visible={showCreator}
        onClose={() => setShowCreator(false)}
        onCreated={(c) => {
          setCurrentLocationId(c.location_id || 'my_home');
          fetchData();
        }}
        objectives={objectives}
        hobbies={hobbiesList}
      />

      {/* Build Mode */}
      <BuildModeModal
        visible={showBuilder}
        onClose={() => { setShowBuilder(false); fetchData(); }}
        onUpgradeRequest={() => { setShowBuilder(false); setShowPremium(true); }}
        isPremium={isPremium}
      />

      {/* Premium */}
      <PremiumModal visible={showPremium} onClose={() => setShowPremium(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContent: { alignItems: 'center' },
  loadingEmoji: { fontSize: 60 },
  loadingTitle: { fontSize: 42, fontWeight: 'bold', color: '#00D4FF', marginTop: 10 },
  loadingSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerLeft: {},
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#00D4FF' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerBtnPremium: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,215,0,0.18)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  headerCrown: { fontSize: 18 },

  viewToggleRow: { flexDirection: 'row', marginHorizontal: 10, marginTop: 8, gap: 6 },
  viewToggleBtn: { flex: 1, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, alignItems: 'center' },
  viewToggleBtnActive: { backgroundColor: '#00D4FF' },
  viewToggleText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  travelChipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(233,30,99,0.6)', borderRadius: 10 },
  
  // Action overlay
  actionOverlay: { position: 'absolute', top: -8, right: -18, backgroundColor: '#FFF', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
  actionOverlayIcon: { fontSize: 14 },
  
  // Star, horizon, time badge, tile
  star: { position: 'absolute', fontSize: 12, opacity: 0.9 },
  horizonLayer: { position: 'absolute', left: 0, right: 0, top: '40%', flexDirection: 'row', justifyContent: 'space-around', opacity: 0.25 },
  horizonObj: { position: 'absolute', fontSize: 36 },
  timeBadge: { position: 'absolute', top: 70, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  timeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  tilesRow: { flexDirection: 'row', position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, opacity: 0.15 },
  tile: { flex: 1, borderRightWidth: 1, borderRightColor: '#000' },
  
  content: { flex: 1 },
  
  // Isometric World
  isometricWorld: { marginHorizontal: 10, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: '70%' },
  celestialBody: { position: 'absolute', top: 15, right: 25 },
  celestialEmoji: { fontSize: 32 },
  cloud: { position: 'absolute' },
  cloudText: { fontSize: 28, opacity: 0.8 },
  locationHeader: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, zIndex: 50 },
  locationFlag: { marginRight: 8 },
  locationEmoji: { fontSize: 24 },
  locationInfo: {},
  locationName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  locationCity: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%' },
  groundPattern: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: 'rgba(0,0,0,0.1)' },
  decorObject: { position: 'absolute', fontSize: 32, zIndex: 5 },
  emptyWorld: { position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center' },
  emptyText: { fontSize: 20, color: 'rgba(255,255,255,0.8)' },
  emptySubtext: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  charCounter: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  charCounterText: { color: '#FFF', fontSize: 14, fontWeight: '600', marginLeft: 5 },
  
  // Walking Character
  walkingCharacter: { position: 'absolute', alignItems: 'center' },
  characterShadow: { position: 'absolute', bottom: -5, width: 30, height: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 15 },
  characterBody: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  characterHair: { position: 'absolute', top: -5, width: 40, height: 18, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  characterFaceEmoji: { fontSize: 26 },

  // Chibi sprite (round head + small body, Toca-Boca-like)
  chibiWrap: { alignItems: 'center', justifyContent: 'flex-start', width: 56 },
  chibiHairBack: { position: 'absolute', top: 4, width: 48, height: 38, borderRadius: 24, zIndex: 0 },
  chibiHead: { width: 46, height: 46, borderRadius: 23, justifyContent: 'flex-start', alignItems: 'center', borderWidth: 2.5, borderColor: 'rgba(0,0,0,0.18)', position: 'relative', zIndex: 2, paddingTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4 },
  chibiHairTop: { position: 'absolute', top: -2, left: 0, right: 0, height: 16, borderTopLeftRadius: 23, borderTopRightRadius: 23 },
  chibiEyesRow: { flexDirection: 'row', gap: 10, marginTop: 4, zIndex: 3 },
  chibiEye: { width: 5, height: 7, borderRadius: 2.5, backgroundColor: '#000' },
  chibiCheeksRow: { flexDirection: 'row', gap: 16, position: 'absolute', top: 26 },
  chibiCheek: { width: 5, height: 3.5, borderRadius: 2, backgroundColor: 'rgba(255,105,180,0.55)' },
  chibiSmile: { position: 'absolute', bottom: 10, width: 10, height: 5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, borderWidth: 1.2, borderColor: '#000', borderTopWidth: 0, backgroundColor: 'transparent' },
  chibiBody: { width: 34, height: 22, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginTop: -4, borderWidth: 2, borderColor: 'rgba(0,0,0,0.18)', zIndex: 1 },
  moodDot: { position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFF' },
  nameTag: { backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  nameTagText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  actionBubble: { position: 'absolute', top: -30, left: -20, backgroundColor: '#00D4FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  actionBubbleText: { color: '#FFF', fontSize: 8, fontWeight: '600' },
  walkingLegs: { flexDirection: 'row', position: 'absolute', bottom: -8 },
  leg: { width: 6, height: 12, backgroundColor: '#555', borderRadius: 3, marginHorizontal: 2 },
  leftLeg: {},
  rightLeg: {},
  thoughtCloud: { position: 'absolute', top: -20, right: -15 },
  thoughtCloudText: { fontSize: 16 },
  
  // God Control Panel
  godPanel: { margin: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, padding: 12 },
  godPanelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  godPanelTitle: { color: '#FFD700', fontSize: 14, fontWeight: '700', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  controlsRow: { flexDirection: 'row', gap: 8 },
  controlBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00D4FF', paddingVertical: 12, borderRadius: 10, gap: 6 },
  controlBtnActive: { backgroundColor: '#0099CC' },
  controlBtnSecondary: { backgroundColor: '#6B7280' },
  controlBtnDanger: { backgroundColor: '#F44336' },
  controlBtnSmall: { flex: 0.6 },
  controlBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  controlBtnTextSmall: { color: '#FFF', fontWeight: '600', fontSize: 11 },
  speedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  speedLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  speedBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  speedBtnActive: { backgroundColor: '#00D4FF' },
  speedBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  
  // Quick Locations
  quickLocations: { paddingHorizontal: 10, paddingVertical: 8 },
  quickLocBtn: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, marginRight: 8 },
  quickLocBtnActive: { backgroundColor: '#00D4FF' },
  quickLocBtnMore: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' },
  quickLocEmoji: { fontSize: 22 },
  quickLocText: { color: '#FFF', fontSize: 10, marginTop: 2 },
  
  // Section
  section: { margin: 10 },
  sectionHeader: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  
  // Character List
  charListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8 },
  charListAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  charListEmoji: { fontSize: 24 },
  charListInfo: { flex: 1, marginLeft: 12 },
  charListName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  charListDetails: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  charListAction: { color: '#00D4FF', fontSize: 11, marginTop: 2 },
  charListLocation: {},
  charListLocEmoji: { fontSize: 22 },
  
  // Log
  logContainer: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 10 },
  logItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  logChar: { color: '#00D4FF', fontSize: 12, fontWeight: '600' },
  logAction: { color: '#FFF', fontSize: 11 },
  logThought: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  
  // Location Modal
  locationModal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height * 0.75 },
  locationList: { padding: 16 },
  countryHeader: { color: '#00D4FF', fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  locationOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8 },
  locationOptionActive: { backgroundColor: 'rgba(0,212,255,0.2)', borderWidth: 1, borderColor: '#00D4FF' },
  locationOptionEmoji: { fontSize: 28 },
  locationOptionInfo: { flex: 1, marginLeft: 12 },
  locationOptionName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  locationOptionCity: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  
  // Character Modal
  characterModal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height * 0.85 },
  characterModalHeader: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bigAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  bigAvatarEmoji: { fontSize: 32 },
  characterMainInfo: { marginLeft: 12 },
  characterModalName: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  characterModalJob: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  characterModalMood: { color: '#00D4FF', fontSize: 12, marginTop: 2 },
  characterModalContent: { padding: 16 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,212,255,0.1)', padding: 12, borderRadius: 10, marginBottom: 12 },
  actionCardText: { color: '#00D4FF', fontSize: 14, marginLeft: 8 },
  thoughtCard: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10, marginBottom: 16 },
  thoughtCardText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontStyle: 'italic' },
  sectionTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  needsGrid: { gap: 6, marginBottom: 16 },
  needCard: { flexDirection: 'row', alignItems: 'center' },
  needIcon: { width: 24, fontSize: 16 },
  needBarBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginHorizontal: 8 },
  needBarFill: { height: '100%', borderRadius: 4 },
  needValue: { width: 35, color: '#FFF', fontSize: 11, textAlign: 'right' },
  attrsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  attrCard: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', minWidth: 70 },
  attrIcon: { fontSize: 18 },
  attrLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 },
  attrValue: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  moneyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,215,0,0.1)', padding: 12, borderRadius: 10 },
  moneyIcon: { fontSize: 24 },
  moneyValue: { color: '#FFD700', fontSize: 24, fontWeight: '700', marginLeft: 8 },
  travelButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00D4FF', padding: 14, borderRadius: 12, gap: 8 },
  travelButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalActionsRow: { flexDirection: 'row', gap: 10, margin: 16 },
  babyButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E91E63', padding: 14, borderRadius: 12, gap: 8 },
  babyButtonEmoji: { fontSize: 20 },
  
  // Settings Modal
  settingsModal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  settingLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 16, marginBottom: 8 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  langBtnActive: { backgroundColor: '#00D4FF' },
  langFlag: { fontSize: 26 },
});
