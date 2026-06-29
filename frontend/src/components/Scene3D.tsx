import React, { useRef, useMemo, Suspense } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Character {
  id: string;
  name: string;
  avatar_emoji: string;
  location_id: string;
  position_x: number;
  position_y: number;
  is_moving: boolean;
  current_action: string;
  mood: string;
  appearance: { skin_color: string; hair_color: string; height?: number };
}

interface Building {
  id: string; emoji: string; name: string; x: number; y: number;
}

interface Props {
  characters: Character[];
  locationType: string;
  locationName?: string;
  buildings: Building[];
  gameHour: number;
  onCharacterClick: (c: Character) => void;
}

// A single 3D character: body (capsule), head (sphere)
const Character3D: React.FC<{ char: Character; index: number; onClick: () => void }> = ({ char, index, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  // Spread characters in a grid to avoid full overlap
  const offsetX = ((index % 3) - 1) * 1.5;
  const offsetZ = (Math.floor(index / 3) % 2) * 1.5;

  // Convert backend 0-100 coords → world meters (-5..5)
  const worldX = ((char.position_x - 50) / 10) + offsetX;
  const worldZ = ((char.position_y - 50) / 10) + offsetZ;
  const heightScale = (char.appearance?.height || 170) / 170;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    if (char.is_moving) {
      // Bounce walking animation
      groupRef.current.position.y = Math.abs(Math.sin(t * 6 + index)) * 0.15;
      groupRef.current.rotation.y = Math.sin(t * 3 + index) * 0.2;
    } else {
      // Idle gentle float
      groupRef.current.position.y = Math.sin(t * 1.5 + index) * 0.05;
      groupRef.current.rotation.y = 0;
    }
  });

  const skinHex = char.appearance?.skin_color || '#F5D0C5';
  const hairHex = char.appearance?.hair_color || '#4A3728';
  const moodColor: Record<string, string> = {
    Happy: '#4CAF50', Excited: '#FF9800', Content: '#8BC34A', Focused: '#2196F3',
    Sad: '#5C6BC0', Tired: '#9E9E9E', Anxious: '#F44336', Bored: '#795548',
  };

  return (
    <group ref={groupRef} position={[worldX, 0, worldZ]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Shadow disc */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.3} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.18, 0.3, 0]} castShadow>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color="#3D5AFE" />
      </mesh>
      <mesh position={[0.18, 0.3, 0]} castShadow>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color="#3D5AFE" />
      </mesh>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.95 * heightScale, 0]} castShadow>
        <capsuleGeometry args={[0.4, 0.6 * heightScale, 8, 16]} />
        <meshStandardMaterial color={skinHex} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.65 * heightScale, 0]} castShadow>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color={skinHex} />
      </mesh>
      {/* Hair (smaller sphere on top) */}
      <mesh position={[0, 1.85 * heightScale, 0]}>
        <sphereGeometry args={[0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hairHex} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 1.65 * heightScale, 0.3]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <mesh position={[0.1, 1.65 * heightScale, 0.3]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      {/* Mood orb above head */}
      <mesh position={[0.4, 2.2 * heightScale, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color={moodColor[char.mood] || '#4CAF50'} emissive={moodColor[char.mood] || '#4CAF50'} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
};

// Static building/object placed by user — render as simple box with floating emoji
const Building3D: React.FC<{ building: Building }> = ({ building }) => {
  const worldX = (building.x - 50) / 10;
  const worldZ = (building.y - 50) / 10;
  // Color guess based on emoji (very simplistic)
  const palette: Record<string, string> = {
    '🛋️': '#a18a72', '🛏️': '#8B5E3C', '🪑': '#6D4C41', '📺': '#222', '🍳': '#fff',
    '🚽': '#fff', '🪴': '#4CAF50', '💡': '#FFD54F', '🏊': '#4FC3F7', '🛁': '#90CAF9',
    '🎹': '#1a1a1a', '🔥': '#FF5722', '🐠': '#03A9F4', '🎱': '#2E7D32', '🍸': '#8D6E63',
    '🏋️': '#37474F', '🖼️': '#D7A86E', '🤖': '#90A4AE', '🌳': '#2E7D32', '🌷': '#E91E63',
  };
  const color = palette[building.emoji] || '#8a6d4b';
  return (
    <group position={[worldX, 0, worldZ]}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.9, 0.7, 0.9]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
};

// Ground tile - colored plane matching location type
const Ground: React.FC<{ type: string }> = ({ type }) => {
  const colors: Record<string, string> = {
    cafe: '#D2B48C', apartment: '#718096', office: '#A0AEC0', park: '#228B22',
    gym: '#E53E3E', restaurant: '#DD6B20', club: '#44337A', beach: '#ECC94B',
    school: '#4A5568', hospital: '#FFFFFF', market: '#C53030', museum: '#6B46C1',
    cinema: '#4A5568', temple: '#D69E2E', mountain: '#48BB78',
  };
  return (
    <>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={colors[type] || '#228B22'} />
      </mesh>
      {/* Grid tiles overlay for depth */}
      {Array.from({ length: 11 }).map((_, i) => (
        <React.Fragment key={i}>
          <mesh position={[i - 5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.02, 20]} />
            <meshBasicMaterial color="#000" transparent opacity={0.06} />
          </mesh>
          <mesh position={[0, 0.01, i - 5]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[20, 0.02]} />
            <meshBasicMaterial color="#000" transparent opacity={0.06} />
          </mesh>
        </React.Fragment>
      ))}
    </>
  );
};

// Distant horizon — colored boxes acting as silhouettes
const Horizon: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const color = isNight ? '#1a1a4e' : '#2D3748';
  const positions: [number, number, number, number][] = [
    [-7, 0, -9, 2], [-4, 0, -10, 2.5], [-1, 0, -9, 1.8], [2, 0, -10, 2.2],
    [5, 0, -9, 2], [7, 0, -10, 2.8],
  ];
  return (
    <>
      {positions.map(([x, y, z, h], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <boxGeometry args={[1.2, h, 0.6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </>
  );
};

// Decorative emoji on the ground via sprite
const DecorObjects: React.FC<{ type: string }> = ({ type }) => {
  const decorMap: Record<string, string[]> = {
    cafe: ['☕', '🪑', '🌸', '🍰'], apartment: ['🛋️', '📺', '🪴', '🛏️'],
    office: ['💼', '📊', '🖥️', '☕'], park: ['🌳', '🌸', '🌷', '🌻'],
    gym: ['🏋️', '🥊', '🚲', '🤸'], restaurant: ['🍕', '🍷', '🕯️', '🍝'],
    club: ['🎵', '🎧', '💃', '🪩'], beach: ['🌴', '🌊', '⛱️', '🐚'],
    school: ['📚', '🎒', '🍎', '✏️'], hospital: ['💊', '🩺', '🛌', '💉'],
    market: ['🛒', '🍎', '🥖', '🍇'], museum: ['🎨', '🖼️', '🗿', '📜'],
    cinema: ['🎬', '🍿', '🎥', '🪑'], temple: ['⛩️', '🙏', '🔔', '🪷'],
    mountain: ['⛰️', '🌲', '⛺', '🦅'],
  };
  const items = decorMap[type] || decorMap.park;
  return (
    <>
      {items.map((emoji, i) => {
        const angle = (i / items.length) * Math.PI * 2;
        const radius = 3.5;
        return <Emoji3D key={i} position={[Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius]} text={emoji} size={0.8} />;
      })}
    </>
  );
};

// Render an emoji using a canvas-as-texture sprite (works on web)
const Emoji3D: React.FC<{ position: [number, number, number]; text: string; size?: number }> = ({ position, text, size = 1 }) => {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = '96px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text]);

  if (!texture) return null;
  return (
    <sprite position={position} scale={[size, size, size]}>
      <spriteMaterial attach="material" map={texture} transparent />
    </sprite>
  );
};

// Day/night lighting
const Lighting: React.FC<{ gameHour: number }> = ({ gameHour }) => {
  const isNight = gameHour < 6 || gameHour > 19;
  const isDusk = gameHour >= 17 && gameHour <= 19;
  if (isNight) {
    return (
      <>
        <ambientLight intensity={0.25} color="#3a3a8a" />
        <directionalLight position={[5, 10, 5]} intensity={0.5} color="#7777ff" castShadow />
        <pointLight position={[0, 8, 0]} intensity={0.8} color="#aaccff" />
      </>
    );
  }
  if (isDusk) {
    return (
      <>
        <ambientLight intensity={0.5} color="#ffaa66" />
        <directionalLight position={[10, 5, 5]} intensity={1.2} color="#ff8844" castShadow />
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 12, 5]} intensity={1.5} color="#ffffff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    </>
  );
};

export const Scene3D: React.FC<Props> = ({ characters, locationType, locationName, buildings, gameHour, onCharacterClick }) => {
  const isNight = gameHour < 6 || gameHour > 19;
  const isDusk = gameHour >= 17 && gameHour <= 19;
  const skyColor = isNight ? '#0a0a2e' : isDusk ? '#FF6B35' : '#87CEEB';

  // Web-only fallback: react-three/fiber requires DOM canvas
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeFallback}>
        <Text style={styles.fallbackText}>🎮 3D mode is available on Web only.</Text>
        <Text style={styles.fallbackSub}>Switch to 2D mode for native preview.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Canvas
        shadows
        camera={{ position: [8, 8, 8], fov: 45 }}
        style={{ background: skyColor }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <Lighting gameHour={gameHour} />
          <fog attach="fog" args={[skyColor, 10, 25]} />
          <Ground type={locationType} />
          <DecorObjects type={locationType} />
          <Horizon isNight={isNight} />
          {buildings.map((b) => <Building3D key={b.id} building={b} />)}
          {characters.map((c, i) => (
            <Character3D key={c.id} char={c} index={i} onClick={() => onCharacterClick(c)} />
          ))}
          {/* Sun / Moon */}
          <mesh position={[isNight ? -8 : 8, 9, -6]}>
            <sphereGeometry args={[0.7, 24, 24]} />
            <meshBasicMaterial color={isNight ? '#E8E8FF' : '#FFE082'} />
          </mesh>
        </Suspense>
      </Canvas>
      {/* Header overlay */}
      <View style={styles.headerOverlay} pointerEvents="none">
        <Text style={styles.locationLabel}>📍 {locationName || 'Unknown'}</Text>
        <Text style={styles.timeLabel}>{String(gameHour).padStart(2, '0')}:00 {isNight ? '🌙' : isDusk ? '🌇' : '☀️'}</Text>
      </View>
      <View style={styles.charCountOverlay} pointerEvents="none">
        <Text style={styles.charCountText}>👥 {characters.length}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', height: 360, borderRadius: 20, overflow: 'hidden', marginHorizontal: 10, position: 'relative' },
  headerOverlay: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  locationLabel: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  timeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  charCountOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  charCountText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  nativeFallback: { width: '100%', height: 360, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 20, marginHorizontal: 10 },
  fallbackText: { color: '#FFF', fontSize: 16 },
  fallbackSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
});
