import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions,
} from 'react-native';
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

interface Building { id: string; emoji: string; name: string; x: number; y: number; }

interface Props {
  characters: Character[];
  location: Location | null;
  buildings: Building[];
  gameHour: number;
  onCharacterPress: (c: Character) => void;
  onLocationChange: () => void;
}

const OUTLINE = '#1a1a1a';
const OUTLINE_WIDTH = 2.5;

// Per-location-type palette + furniture layout (top-down OMORI-style room)
type Piece = { kind: string; x: number; y: number; w?: number; h?: number; color?: string };

interface LocSpec {
  wallColor: string;
  floorColor: string;
  floorPattern: 'planks' | 'tiles' | 'grass' | 'sand' | 'carpet';
  hasWindow: boolean;
  windowView: string[]; // gradient colors
  doorColor: string;
  pieces: Piece[];
}

const LOC_SPECS: Record<string, LocSpec> = {
  cafe: {
    wallColor: '#F2D8B5', floorColor: '#A06A3A', floorPattern: 'planks',
    hasWindow: true, windowView: ['#9DC4E8', '#FFE0B2'], doorColor: '#6B3F1F',
    pieces: [
      { kind: 'counter', x: 10, y: 28, w: 60, h: 18, color: '#7A4A2A' },
      { kind: 'espresso', x: 18, y: 30, w: 14, h: 12, color: '#3A2A1F' },
      { kind: 'pastry', x: 38, y: 32, w: 12, h: 10, color: '#FFD088' },
      { kind: 'table', x: 18, y: 62, w: 18, h: 18, color: '#8B5A2B' },
      { kind: 'chair', x: 8, y: 60, w: 8, h: 8, color: '#6B3F1F' },
      { kind: 'chair', x: 38, y: 60, w: 8, h: 8, color: '#6B3F1F' },
      { kind: 'table', x: 64, y: 62, w: 18, h: 18, color: '#8B5A2B' },
      { kind: 'chair', x: 54, y: 60, w: 8, h: 8, color: '#6B3F1F' },
      { kind: 'plant', x: 84, y: 30, w: 12, h: 14, color: '#3D8B3D' },
    ],
  },
  apartment: {
    wallColor: '#E8C9D9', floorColor: '#C7A57D', floorPattern: 'planks',
    hasWindow: true, windowView: ['#A4C7E8', '#E0E0FF'], doorColor: '#5C3B1F',
    pieces: [
      { kind: 'bed', x: 8, y: 30, w: 30, h: 20, color: '#D08AAB' },
      { kind: 'nightstand', x: 42, y: 32, w: 10, h: 12, color: '#8B5A2B' },
      { kind: 'lamp', x: 44, y: 28, w: 6, h: 8, color: '#FFE082' },
      { kind: 'sofa', x: 10, y: 62, w: 36, h: 14, color: '#7DA8C7' },
      { kind: 'rug', x: 50, y: 60, w: 30, h: 22, color: '#C77D9C' },
      { kind: 'tv', x: 70, y: 30, w: 22, h: 12, color: '#2A2A2A' },
      { kind: 'plant', x: 60, y: 28, w: 10, h: 14, color: '#4CAF50' },
    ],
  },
  office: {
    wallColor: '#E0E8F0', floorColor: '#9AA0A8', floorPattern: 'tiles',
    hasWindow: true, windowView: ['#7CA9D8', '#A8C8E8'], doorColor: '#3D5A7F',
    pieces: [
      { kind: 'desk', x: 10, y: 32, w: 32, h: 16, color: '#5A6470' },
      { kind: 'computer', x: 18, y: 30, w: 16, h: 12, color: '#1F2937' },
      { kind: 'chair', x: 22, y: 50, w: 10, h: 10, color: '#2A2A2A' },
      { kind: 'desk', x: 58, y: 32, w: 32, h: 16, color: '#5A6470' },
      { kind: 'computer', x: 66, y: 30, w: 16, h: 12, color: '#1F2937' },
      { kind: 'chair', x: 70, y: 50, w: 10, h: 10, color: '#2A2A2A' },
      { kind: 'plant', x: 50, y: 62, w: 10, h: 14, color: '#3D8B3D' },
      { kind: 'rug', x: 10, y: 70, w: 80, h: 14, color: '#5577AA' },
    ],
  },
  park: {
    wallColor: '#A4D8F0', floorColor: '#7DC474', floorPattern: 'grass',
    hasWindow: false, windowView: ['#A4D8F0', '#A4D8F0'], doorColor: '#5C8C3F',
    pieces: [
      { kind: 'tree', x: 8, y: 30, w: 18, h: 22, color: '#3D8B3D' },
      { kind: 'tree', x: 74, y: 30, w: 18, h: 22, color: '#4DAB4D' },
      { kind: 'bench', x: 30, y: 56, w: 30, h: 8, color: '#8B5A2B' },
      { kind: 'flowerbed', x: 12, y: 70, w: 24, h: 10, color: '#F5A0CC' },
      { kind: 'flowerbed', x: 62, y: 70, w: 24, h: 10, color: '#FFCC66' },
      { kind: 'path', x: 38, y: 30, w: 14, h: 50, color: '#C7A57D' },
    ],
  },
  gym: {
    wallColor: '#FFD4C2', floorColor: '#3D4250', floorPattern: 'tiles',
    hasWindow: true, windowView: ['#FF9E7D', '#FFC9A8'], doorColor: '#7A3A2A',
    pieces: [
      { kind: 'treadmill', x: 8, y: 30, w: 16, h: 24, color: '#2A2A2A' },
      { kind: 'treadmill', x: 28, y: 30, w: 16, h: 24, color: '#2A2A2A' },
      { kind: 'weights', x: 56, y: 32, w: 14, h: 8, color: '#1F2937' },
      { kind: 'bench', x: 56, y: 48, w: 24, h: 12, color: '#3D2A1F' },
      { kind: 'mat', x: 10, y: 64, w: 30, h: 16, color: '#3D8B3D' },
      { kind: 'mirror', x: 50, y: 68, w: 36, h: 14, color: '#B8E0F0' },
    ],
  },
  restaurant: {
    wallColor: '#F2C9B5', floorColor: '#7A4A2A', floorPattern: 'planks',
    hasWindow: true, windowView: ['#FFAB7D', '#FFD088'], doorColor: '#5C2A1F',
    pieces: [
      { kind: 'table', x: 14, y: 32, w: 18, h: 14, color: '#3D2A1F' },
      { kind: 'chair', x: 8, y: 50, w: 8, h: 8, color: '#3D2A1F' },
      { kind: 'chair', x: 30, y: 50, w: 8, h: 8, color: '#3D2A1F' },
      { kind: 'table', x: 58, y: 32, w: 18, h: 14, color: '#3D2A1F' },
      { kind: 'chair', x: 52, y: 50, w: 8, h: 8, color: '#3D2A1F' },
      { kind: 'chair', x: 74, y: 50, w: 8, h: 8, color: '#3D2A1F' },
      { kind: 'counter', x: 14, y: 66, w: 70, h: 14, color: '#6B3F1F' },
      { kind: 'plant', x: 86, y: 30, w: 10, h: 14, color: '#3D8B3D' },
    ],
  },
  club: {
    wallColor: '#7D5AAA', floorColor: '#2A1F3D', floorPattern: 'tiles',
    hasWindow: false, windowView: ['#7D5AAA', '#7D5AAA'], doorColor: '#1F1535',
    pieces: [
      { kind: 'dancefloor', x: 18, y: 30, w: 54, h: 30, color: '#C77AE0' },
      { kind: 'dj', x: 36, y: 64, w: 22, h: 12, color: '#1F1535' },
      { kind: 'bar', x: 10, y: 76, w: 80, h: 10, color: '#3D2A4F' },
      { kind: 'speaker', x: 14, y: 32, w: 10, h: 14, color: '#1F1535' },
      { kind: 'speaker', x: 76, y: 32, w: 10, h: 14, color: '#1F1535' },
    ],
  },
  beach: {
    wallColor: '#5AB4D8', floorColor: '#FFE082', floorPattern: 'sand',
    hasWindow: false, windowView: ['#5AB4D8', '#5AB4D8'], doorColor: '#3D8BC2',
    pieces: [
      { kind: 'palm', x: 6, y: 28, w: 16, h: 20, color: '#3D8B3D' },
      { kind: 'palm', x: 78, y: 28, w: 16, h: 20, color: '#3D8B3D' },
      { kind: 'umbrella', x: 30, y: 50, w: 20, h: 16, color: '#FF5A5A' },
      { kind: 'towel', x: 52, y: 56, w: 22, h: 12, color: '#5A95FF' },
      { kind: 'ball', x: 20, y: 76, w: 10, h: 10, color: '#FFCC44' },
      { kind: 'shell', x: 60, y: 78, w: 8, h: 6, color: '#FFFFFF' },
    ],
  },
  school: {
    wallColor: '#C4D8E8', floorColor: '#A0814A', floorPattern: 'planks',
    hasWindow: true, windowView: ['#7CA9D8', '#A8C8E8'], doorColor: '#3D2A1F',
    pieces: [
      { kind: 'blackboard', x: 14, y: 28, w: 60, h: 14, color: '#1F3D2A' },
      { kind: 'desk', x: 12, y: 52, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 32, y: 52, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 52, y: 52, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 72, y: 52, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 12, y: 70, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 32, y: 70, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 52, y: 70, w: 14, h: 10, color: '#8B5A2B' },
      { kind: 'desk', x: 72, y: 70, w: 14, h: 10, color: '#8B5A2B' },
    ],
  },
  hospital: {
    wallColor: '#E8F0F4', floorColor: '#E8E8E8', floorPattern: 'tiles',
    hasWindow: true, windowView: ['#A8C8E8', '#D8E8F4'], doorColor: '#7DA0B4',
    pieces: [
      { kind: 'bed', x: 10, y: 34, w: 30, h: 16, color: '#FFFFFF' },
      { kind: 'bed', x: 56, y: 34, w: 30, h: 16, color: '#FFFFFF' },
      { kind: 'monitor', x: 14, y: 30, w: 12, h: 8, color: '#1F2937' },
      { kind: 'monitor', x: 60, y: 30, w: 12, h: 8, color: '#1F2937' },
      { kind: 'cabinet', x: 14, y: 62, w: 16, h: 18, color: '#FFFFFF' },
      { kind: 'plant', x: 50, y: 68, w: 10, h: 14, color: '#3D8B3D' },
    ],
  },
  market: {
    wallColor: '#FFD088', floorColor: '#C7A57D', floorPattern: 'tiles',
    hasWindow: true, windowView: ['#FFAB7D', '#FFD088'], doorColor: '#7A3A2A',
    pieces: [
      { kind: 'stall', x: 10, y: 32, w: 24, h: 18, color: '#FF7A4A' },
      { kind: 'stall', x: 40, y: 32, w: 24, h: 18, color: '#FFD044' },
      { kind: 'stall', x: 70, y: 32, w: 24, h: 18, color: '#7AC44A' },
      { kind: 'crate', x: 12, y: 64, w: 12, h: 10, color: '#8B5A2B' },
      { kind: 'crate', x: 30, y: 64, w: 12, h: 10, color: '#8B5A2B' },
      { kind: 'crate', x: 70, y: 64, w: 12, h: 10, color: '#8B5A2B' },
      { kind: 'crate', x: 86, y: 64, w: 12, h: 10, color: '#8B5A2B' },
    ],
  },
  museum: {
    wallColor: '#D8C4E8', floorColor: '#9A8AAA', floorPattern: 'tiles',
    hasWindow: false, windowView: ['#D8C4E8', '#D8C4E8'], doorColor: '#5A4A7A',
    pieces: [
      { kind: 'painting', x: 12, y: 28, w: 18, h: 14, color: '#C77AE0' },
      { kind: 'painting', x: 40, y: 28, w: 18, h: 14, color: '#FFA0C4' },
      { kind: 'painting', x: 70, y: 28, w: 18, h: 14, color: '#7AC4E0' },
      { kind: 'statue', x: 40, y: 54, w: 14, h: 22, color: '#E0E0E0' },
      { kind: 'bench', x: 10, y: 72, w: 24, h: 8, color: '#8B5A2B' },
      { kind: 'bench', x: 70, y: 72, w: 24, h: 8, color: '#8B5A2B' },
    ],
  },
  cinema: {
    wallColor: '#3D2A5A', floorColor: '#5A2A3D', floorPattern: 'carpet',
    hasWindow: false, windowView: ['#3D2A5A', '#3D2A5A'], doorColor: '#1F1535',
    pieces: [
      { kind: 'screen', x: 8, y: 28, w: 80, h: 18, color: '#F5F5F5' },
      { kind: 'seat', x: 10, y: 52, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 28, y: 52, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 46, y: 52, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 64, y: 52, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 10, y: 68, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 28, y: 68, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 46, y: 68, w: 14, h: 10, color: '#7A1F1F' },
      { kind: 'seat', x: 64, y: 68, w: 14, h: 10, color: '#7A1F1F' },
    ],
  },
  temple: {
    wallColor: '#F5D088', floorColor: '#8B5A2B', floorPattern: 'planks',
    hasWindow: true, windowView: ['#FFC044', '#FFE088'], doorColor: '#5C2A1F',
    pieces: [
      { kind: 'altar', x: 32, y: 30, w: 36, h: 18, color: '#C7A57D' },
      { kind: 'candle', x: 36, y: 28, w: 6, h: 8, color: '#FFE082' },
      { kind: 'candle', x: 58, y: 28, w: 6, h: 8, color: '#FFE082' },
      { kind: 'incense', x: 46, y: 32, w: 8, h: 6, color: '#7A4A1F' },
      { kind: 'mat', x: 12, y: 58, w: 22, h: 18, color: '#C77AE0' },
      { kind: 'mat', x: 38, y: 58, w: 22, h: 18, color: '#C77AE0' },
      { kind: 'mat', x: 64, y: 58, w: 22, h: 18, color: '#C77AE0' },
    ],
  },
  mountain: {
    wallColor: '#A8C8E8', floorColor: '#6B8B5A', floorPattern: 'grass',
    hasWindow: false, windowView: ['#A8C8E8', '#A8C8E8'], doorColor: '#3D5A1F',
    pieces: [
      { kind: 'rock', x: 8, y: 32, w: 18, h: 16, color: '#6B6B6B' },
      { kind: 'rock', x: 74, y: 30, w: 22, h: 18, color: '#5B5B5B' },
      { kind: 'tent', x: 32, y: 52, w: 24, h: 18, color: '#C77A4A' },
      { kind: 'campfire', x: 14, y: 70, w: 12, h: 12, color: '#FF7A4A' },
      { kind: 'tree', x: 70, y: 66, w: 16, h: 18, color: '#3D8B3D' },
    ],
  },
};

const palette = (type: string) => LOC_SPECS[type] || LOC_SPECS.park;

// ============ OMORI-style character ============
const OmoriCharacter: React.FC<{
  char: Character;
  index: number;
  onPress: () => void;
}> = ({ char, index, onPress }) => {
  const bobAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: char.is_moving ? 220 : 1400, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(bobAnim, { toValue: 0, duration: char.is_moving ? 220 : 1400, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    bob.start();
    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(2500 + index * 600),
        Animated.timing(blinkAnim, { toValue: 0.05, duration: 80, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 80, useNativeDriver: false }),
      ])
    );
    blink.start();
    return () => { bob.stop(); blink.stop(); };
  }, [char.is_moving, index]);

  const translateY = bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, char.is_moving ? -5 : -2] });
  const skin = char.appearance?.skin_color || '#F2D0B0';
  const hair = char.appearance?.hair_color || '#2A1F1A';
  // Shirt color picked from a fixed palette based on character id (deterministic per char)
  const shirtPalette = ['#C77AE0', '#7AC4E0', '#FF9E7D', '#7AE0A0', '#E0CC7A', '#FFA0C4', '#7A95FF'];
  const shirtIdx = (char.id?.charCodeAt(0) || 0) % shirtPalette.length;
  const shirt = shirtPalette[shirtIdx];

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={omoriStyles.charWrap}>
      <Animated.View style={[omoriStyles.charInner, { transform: [{ translateY }] }]}>
        {/* Action bubble */}
        {char.current_action && char.current_action !== 'Idle' && (
          <View style={omoriStyles.actionBubble}>
            <Text style={omoriStyles.actionBubbleText}>{char.current_action.substring(0, 16)}</Text>
            <View style={omoriStyles.actionBubbleTail} />
          </View>
        )}

        {/* Hair back */}
        <View style={[omoriStyles.hairBack, { backgroundColor: hair }]} />

        {/* Head (round with thick outline) */}
        <View style={[omoriStyles.head, { backgroundColor: skin }]}>
          {/* Hair top cap */}
          <View style={[omoriStyles.hairTop, { backgroundColor: hair }]} />
          {/* Hair side bangs */}
          <View style={[omoriStyles.hairSideL, { backgroundColor: hair }]} />
          <View style={[omoriStyles.hairSideR, { backgroundColor: hair }]} />
          {/* Two black dot eyes */}
          <View style={omoriStyles.eyesRow}>
            <Animated.View style={[omoriStyles.eye, { transform: [{ scaleY: blinkAnim }] }]} />
            <Animated.View style={[omoriStyles.eye, { transform: [{ scaleY: blinkAnim }] }]} />
          </View>
          {/* Tiny mouth */}
          <View style={omoriStyles.mouth} />
        </View>

        {/* Torso (shirt) */}
        <View style={[omoriStyles.torso, { backgroundColor: shirt }]} />

        {/* Arms */}
        <View style={[omoriStyles.armL, { backgroundColor: shirt }]} />
        <View style={[omoriStyles.armR, { backgroundColor: shirt }]} />

        {/* Legs (pants) */}
        <View style={omoriStyles.legs}>
          <Animated.View style={[omoriStyles.legL, char.is_moving && { transform: [{ translateY: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]} />
          <Animated.View style={[omoriStyles.legR, char.is_moving && { transform: [{ translateY: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [-2, 0] }) }] }]} />
        </View>

        {/* Shadow under */}
        <View style={omoriStyles.shadow} />

        {/* Name */}
        <View style={omoriStyles.nameTag}>
          <Text style={omoriStyles.nameTagText}>{char.name.split(' ')[0]}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============ Furniture piece ============
const FurnitureView: React.FC<{ piece: Piece; canvasW: number; canvasH: number }> = ({ piece, canvasW, canvasH }) => {
  const left = (piece.x / 100) * canvasW;
  const top = (piece.y / 100) * canvasH;
  const w = ((piece.w || 12) / 100) * canvasW;
  const h = ((piece.h || 12) / 100) * canvasH;
  return (
    <View
      style={[
        omoriStyles.furniture,
        {
          left, top, width: w, height: h,
          backgroundColor: piece.color || '#888',
          borderRadius: piece.kind === 'ball' || piece.kind === 'shell' || piece.kind === 'campfire' ? 999 : piece.kind === 'mat' || piece.kind === 'rug' || piece.kind === 'towel' ? 6 : 4,
        },
      ]}
    >
      {/* Inner detail emoji as visual hint */}
      {DETAIL_EMOJI[piece.kind] && (
        <Text style={omoriStyles.furnitureLabel}>{DETAIL_EMOJI[piece.kind]}</Text>
      )}
    </View>
  );
};

const DETAIL_EMOJI: Record<string, string> = {
  espresso: '☕', pastry: '🥐', plant: '🪴', tv: '📺', bed: '🛏️', sofa: '🛋️',
  computer: '🖥️', tree: '🌳', bench: '', flowerbed: '🌸', treadmill: '🏃', weights: '🏋️',
  mirror: '🪞', mat: '', dancefloor: '✨', dj: '🎧', bar: '🍸', speaker: '🔊',
  palm: '🌴', umbrella: '⛱️', towel: '', ball: '⚽', shell: '🐚', blackboard: '📚',
  desk: '📝', monitor: '🩺', cabinet: '💊', stall: '🍎', crate: '📦', painting: '🖼️',
  statue: '🗿', screen: '🎬', seat: '', altar: '⛩️', candle: '🕯️', incense: '🍵',
  rock: '', tent: '⛺', campfire: '🔥', lamp: '💡', counter: '', chair: '', table: '',
  rug: '', nightstand: '', path: '',
};

// ============ Main scene ============
export const OmoriRoom: React.FC<Props> = ({ characters, location, buildings, gameHour, onCharacterPress, onLocationChange }) => {
  const spec = palette(location?.type || 'park');
  const locationChars = characters; // already filtered upstream
  const isNight = gameHour < 6 || gameHour > 19;

  // Canvas inner dimensions
  const canvasW = width - 30;
  const wallH = 110;
  const floorH = 270;
  const canvasH = wallH + floorH;

  // Distribute characters across the floor (avoid overlap with furniture by placing in safe lanes)
  const charPositions: { left: number; top: number }[] = [
    { left: canvasW * 0.5 - 25, top: floorH * 0.55 },
    { left: canvasW * 0.25 - 25, top: floorH * 0.78 },
    { left: canvasW * 0.75 - 25, top: floorH * 0.78 },
    { left: canvasW * 0.4 - 25, top: floorH * 0.4 },
    { left: canvasW * 0.6 - 25, top: floorH * 0.4 },
    { left: canvasW * 0.5 - 25, top: floorH * 0.85 },
  ];

  // Day/night overlay color for room
  const nightOverlay = isNight ? 'rgba(20,20,60,0.35)' : 'transparent';

  return (
    <View style={[omoriStyles.container, { width: canvasW + 16 }]}>
      {/* WALL (top portion) */}
      <View style={[omoriStyles.wall, { backgroundColor: spec.wallColor, height: wallH }]}>
        {/* Window (if applicable) */}
        {spec.hasWindow && (
          <View style={omoriStyles.window}>
            {/* Sky gradient using two colored bands */}
            <View style={[omoriStyles.windowSky1, { backgroundColor: isNight ? '#1a1a4e' : spec.windowView[0] }]} />
            <View style={[omoriStyles.windowSky2, { backgroundColor: isNight ? '#2a2a6e' : spec.windowView[1] }]} />
            {/* Sun or moon */}
            <View style={[omoriStyles.windowSun, { backgroundColor: isNight ? '#E8E8FF' : '#FFE082' }]} />
            {/* Window cross frame */}
            <View style={omoriStyles.windowCrossV} />
            <View style={omoriStyles.windowCrossH} />
          </View>
        )}

        {/* Door */}
        <View style={[omoriStyles.door, { backgroundColor: spec.doorColor }]}>
          <View style={omoriStyles.doorKnob} />
        </View>

        {/* Wall picture (decoration) */}
        <View style={omoriStyles.wallPic}>
          <Text style={omoriStyles.wallPicEmoji}>{location?.emoji || '🖼️'}</Text>
        </View>

        {/* Location label */}
        <TouchableOpacity style={omoriStyles.locationBar} onPress={onLocationChange}>
          <Text style={omoriStyles.locationName} numberOfLines={1}>{location?.name || 'Unknown'}</Text>
          <Text style={omoriStyles.locationCity} numberOfLines={1}>{location?.city}, {location?.country}</Text>
          <Ionicons name="chevron-down" size={14} color="#FFF" />
        </TouchableOpacity>

        {/* Top-right badges */}
        <View style={omoriStyles.topBadges}>
          <View style={omoriStyles.peopleBadge}>
            <Ionicons name="people" size={11} color="#FFF" />
            <Text style={omoriStyles.peopleBadgeText}>{locationChars.length}</Text>
          </View>
          <View style={omoriStyles.timeBadge}>
            <Text style={omoriStyles.timeBadgeText}>{String(gameHour).padStart(2, '0')}:00 {isNight ? '🌙' : '☀️'}</Text>
          </View>
        </View>
      </View>

      {/* FLOOR (bottom portion) */}
      <View style={[omoriStyles.floor, { backgroundColor: spec.floorColor, height: floorH }]}>
        {/* Floor pattern */}
        {spec.floorPattern === 'planks' && Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[omoriStyles.plankSeam, { top: (i * floorH) / 6 }]} />
        ))}
        {spec.floorPattern === 'tiles' && Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[omoriStyles.tileLine, i % 2 === 0 ? { top: (i * floorH) / 8 } : { left: (i * canvasW) / 8 }]} />
        ))}
        {spec.floorPattern === 'grass' && Array.from({ length: 30 }).map((_, i) => (
          <Text key={i} style={[omoriStyles.grassTuft, { left: (i * 37 + 10) % (canvasW - 20), top: (i * 53 + 20) % (floorH - 30) }]}>{i % 3 === 0 ? '🌿' : i % 5 === 0 ? '🌱' : ' '}</Text>
        ))}
        {spec.floorPattern === 'sand' && Array.from({ length: 24 }).map((_, i) => (
          <View key={i} style={[omoriStyles.sandSpeck, { left: (i * 41) % (canvasW - 16), top: (i * 67) % (floorH - 16) }]} />
        ))}

        {/* Furniture */}
        {spec.pieces.map((piece, i) => (
          <FurnitureView key={i} piece={piece} canvasW={canvasW} canvasH={floorH} />
        ))}

        {/* User-placed buildings */}
        {buildings.slice(0, 12).map((b, i) => {
          const left = (b.x / 100) * canvasW - 14;
          const top = (b.y / 100) * floorH - 14;
          return (
            <View key={b.id} style={[omoriStyles.userBuilding, { left, top }]}>
              <Text style={omoriStyles.userBuildingEmoji}>{b.emoji}</Text>
            </View>
          );
        })}

        {/* Characters */}
        {locationChars.map((c, i) => {
          const pos = charPositions[i % charPositions.length];
          return (
            <View key={c.id} style={{ position: 'absolute', left: pos.left, top: pos.top, zIndex: 50 + i }}>
              <OmoriCharacter char={c} index={i} onPress={() => onCharacterPress(c)} />
            </View>
          );
        })}

        {/* Empty state */}
        {locationChars.length === 0 && (
          <View style={omoriStyles.emptyState}>
            <Text style={omoriStyles.emptyEmoji}>👤</Text>
            <Text style={omoriStyles.emptyText}>No one here</Text>
            <Text style={omoriStyles.emptySub}>Tap a character to move them here</Text>
          </View>
        )}
      </View>

      {/* Night overlay */}
      <View pointerEvents="none" style={[omoriStyles.nightOverlay, { backgroundColor: nightOverlay }]} />
    </View>
  );
};

const omoriStyles = StyleSheet.create({
  container: { marginHorizontal: 8, borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: OUTLINE, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },

  // Wall
  wall: { position: 'relative', borderBottomWidth: 3, borderBottomColor: OUTLINE, overflow: 'hidden' },
  window: { position: 'absolute', top: 14, right: 18, width: 70, height: 60, backgroundColor: '#A8C8E8', borderWidth: 3, borderColor: OUTLINE, borderRadius: 4, overflow: 'hidden' },
  windowSky1: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  windowSky2: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  windowSun: { position: 'absolute', top: 8, right: 12, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: OUTLINE },
  windowCrossV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, marginLeft: -1.5, backgroundColor: OUTLINE },
  windowCrossH: { position: 'absolute', left: 0, right: 0, top: '50%', height: 3, marginTop: -1.5, backgroundColor: OUTLINE },

  door: { position: 'absolute', left: 16, top: 30, width: 32, height: 70, borderWidth: 3, borderColor: OUTLINE, borderRadius: 2 },
  doorKnob: { position: 'absolute', right: 4, top: 32, width: 6, height: 6, borderRadius: 3, borderWidth: 2, borderColor: OUTLINE, backgroundColor: '#FFD700' },

  wallPic: { position: 'absolute', top: 16, left: 70, width: 36, height: 28, backgroundColor: '#FFF', borderWidth: 3, borderColor: OUTLINE, borderRadius: 3, justifyContent: 'center', alignItems: 'center' },
  wallPicEmoji: { fontSize: 18 },

  locationBar: { position: 'absolute', bottom: 6, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: '60%' },
  locationName: { color: '#FFF', fontSize: 11, fontWeight: '700', marginRight: 6 },
  locationCity: { color: 'rgba(255,255,255,0.75)', fontSize: 9, marginRight: 4 },

  topBadges: { position: 'absolute', top: 8, right: 100, alignItems: 'flex-end', gap: 4 },
  peopleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  peopleBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  timeBadge: { backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  timeBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '600' },

  // Floor
  floor: { position: 'relative', overflow: 'hidden' },
  plankSeam: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(0,0,0,0.18)' },
  tileLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  grassTuft: { position: 'absolute', fontSize: 10, opacity: 0.85 },
  sandSpeck: { position: 'absolute', width: 3, height: 3, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 1.5 },

  furniture: { position: 'absolute', borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.18, shadowRadius: 2 },
  furnitureLabel: { fontSize: 14 },

  userBuilding: { position: 'absolute', width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: OUTLINE, zIndex: 40 },
  userBuildingEmoji: { fontSize: 18 },

  // OMORI Character
  charWrap: { width: 50 },
  charInner: { alignItems: 'center', position: 'relative' },

  hairBack: { position: 'absolute', top: 8, width: 36, height: 28, borderRadius: 18, zIndex: 0, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE },

  head: { width: 32, height: 32, borderRadius: 16, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, justifyContent: 'flex-start', alignItems: 'center', position: 'relative', zIndex: 2, paddingTop: 10 },
  hairTop: { position: 'absolute', top: -3, left: -3, right: -3, height: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, borderBottomWidth: 0, zIndex: 3 },
  hairSideL: { position: 'absolute', top: 8, left: -4, width: 6, height: 14, borderRadius: 3, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, zIndex: 3 },
  hairSideR: { position: 'absolute', top: 8, right: -4, width: 6, height: 14, borderRadius: 3, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, zIndex: 3 },

  eyesRow: { flexDirection: 'row', gap: 7, marginTop: 6, zIndex: 4 },
  eye: { width: 3.5, height: 6, borderRadius: 2, backgroundColor: OUTLINE },
  mouth: { position: 'absolute', bottom: 7, width: 6, height: 1.5, backgroundColor: OUTLINE, borderRadius: 1 },

  torso: { width: 26, height: 18, marginTop: -2, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, borderTopLeftRadius: 4, borderTopRightRadius: 4, zIndex: 1 },
  armL: { position: 'absolute', top: 33, left: -2, width: 6, height: 14, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, borderRadius: 3, zIndex: 0 },
  armR: { position: 'absolute', top: 33, right: -2, width: 6, height: 14, borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, borderRadius: 3, zIndex: 0 },

  legs: { flexDirection: 'row', gap: 2, marginTop: 0 },
  legL: { width: 8, height: 11, backgroundColor: '#3D3D5A', borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  legR: { width: 8, height: 11, backgroundColor: '#3D3D5A', borderWidth: OUTLINE_WIDTH, borderColor: OUTLINE, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

  shadow: { position: 'absolute', bottom: -3, width: 26, height: 5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 13 },

  actionBubble: { position: 'absolute', top: -20, backgroundColor: '#FFF', borderWidth: 2, borderColor: OUTLINE, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6, zIndex: 10 },
  actionBubbleText: { color: OUTLINE, fontSize: 8, fontWeight: '700' },
  actionBubbleTail: { position: 'absolute', bottom: -5, left: '50%', marginLeft: -3, width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: OUTLINE },

  nameTag: { backgroundColor: OUTLINE, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  nameTagText: { color: '#FFF', fontSize: 9, fontWeight: '700' },

  emptyState: { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' },
  emptyEmoji: { fontSize: 36 },
  emptyText: { color: OUTLINE, fontSize: 13, fontWeight: '700', marginTop: 4 },
  emptySub: { color: 'rgba(0,0,0,0.55)', fontSize: 10, marginTop: 2, textAlign: 'center' },

  nightOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 200 },
});
