import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

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
  target_x: number;
  target_y: number;
  is_moving: boolean;
  needs: Record<string, number>;
  attributes: Record<string, number>;
  personality: Record<string, number>;
  objectives: string[];
  hobbies: string[];
  current_action: string;
  mood: string;
  thoughts: string[];
  money: number;
  appearance: { skin_color: string; hair_color: string; height: number };
  is_npc: boolean;
}

interface Location {
  id: string;
  name: string;
  description: string;
  city: string;
  country: string;
  emoji: string;
  available_actions: string[];
}

// Translations hook
const useTranslations = (lang: string) => {
  const [t, setT] = useState<Record<string, any>>({});
  useEffect(() => {
    axios.get(`${API_BASE}/api/translations/${lang}`).then(r => setT(r.data)).catch(() => {});
  }, [lang]);
  return t;
};

// 2D Character Sprite Component
const CharacterSprite: React.FC<{
  character: Character;
  onPress: () => void;
  worldWidth: number;
  worldHeight: number;
}> = ({ character, onPress, worldWidth, worldHeight }) => {
  const x = (character.position_x / 100) * worldWidth;
  const y = (character.position_y / 100) * (worldHeight - 60) + 30;
  
  return (
    <TouchableOpacity
      style={[
        styles.characterSprite,
        { left: x - 20, top: y - 40 }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Body */}
      <View style={[styles.spriteBody, { backgroundColor: character.appearance?.skin_color || '#F5D0C5' }]}>
        {/* Face */}
        <Text style={styles.spriteEmoji}>{character.avatar_emoji}</Text>
      </View>
      
      {/* Walking animation indicator */}
      {character.is_moving && (
        <View style={styles.walkingDots}>
          <View style={[styles.walkDot, styles.walkDot1]} />
          <View style={[styles.walkDot, styles.walkDot2]} />
          <View style={[styles.walkDot, styles.walkDot3]} />
        </View>
      )}
      
      {/* Name tag */}
      <View style={styles.spriteNameTag}>
        <Text style={styles.spriteNameText}>{character.name.split(' ')[0]}</Text>
      </View>
      
      {/* Thought bubble */}
      {character.thoughts.length > 0 && (
        <View style={styles.thoughtBubble}>
          <Text style={styles.thoughtEmoji}>💭</Text>
        </View>
      )}
      
      {/* Action indicator */}
      <View style={[styles.actionBubble, { backgroundColor: character.is_moving ? '#00D4FF' : '#4CAF50' }]}>
        <Text style={styles.actionText}>{character.current_action.substring(0, 12)}</Text>
      </View>
    </TouchableOpacity>
  );
};

// World View with 2D Characters
const WorldView: React.FC<{
  characters: Character[];
  currentLocation: Location | null;
  onCharacterPress: (char: Character) => void;
  onWorldTap: (x: number, y: number) => void;
}> = ({ characters, currentLocation, onCharacterPress, onWorldTap }) => {
  const worldWidth = width - 32;
  const worldHeight = 280;
  
  // Filter characters by current location - use ID comparison
  const locationChars = currentLocation 
    ? characters.filter(c => c.location_id === currentLocation.id)
    : [];
  
  // Debug log
  console.log('WorldView:', { 
    currentLocId: currentLocation?.id, 
    totalChars: characters.length,
    filteredChars: locationChars.length,
    charLocs: characters.map(c => c.location_id)
  });

  return (
    <View style={[styles.worldView, { width: worldWidth, height: worldHeight }]}>
      {/* Sky gradient */}
      <LinearGradient
        colors={['#87CEEB', '#B0E0E6', '#98FB98']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Clouds */}
      <View style={[styles.cloud, { left: 20, top: 20 }]}>
        <Text style={styles.cloudEmoji}>☁️</Text>
      </View>
      <View style={[styles.cloud, { left: worldWidth - 80, top: 30 }]}>
        <Text style={styles.cloudEmoji}>☁️</Text>
      </View>
      
      {/* Location info */}
      <View style={styles.worldHeader}>
        <Text style={styles.worldEmoji}>{currentLocation?.emoji || '🌍'}</Text>
        <Text style={styles.worldName}>{currentLocation?.name || 'World'}</Text>
        <Text style={styles.worldCity}>{currentLocation?.city}</Text>
      </View>

      {/* Ground */}
      <View style={styles.ground}>
        <View style={styles.groundGrass} />
      </View>

      {/* Trees/Objects */}
      <Text style={[styles.worldObject, { left: 10, bottom: 50 }]}>🌳</Text>
      <Text style={[styles.worldObject, { right: 20, bottom: 55 }]}>🌲</Text>
      
      {/* Characters - rendered as positioned views */}
      {locationChars.map((char, index) => {
        // Calculate position within visible area
        const charX = 30 + (index * 80); // Spread characters horizontally
        const charY = 100 + (index * 30); // Stagger vertically
        
        return (
          <TouchableOpacity
            key={char.id}
            style={{
              position: 'absolute',
              left: charX,
              top: charY,
              alignItems: 'center',
              zIndex: 100 + index,
              backgroundColor: 'transparent',
            }}
            onPress={() => onCharacterPress(char)}
            activeOpacity={0.8}
          >
            {/* Character body/head */}
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: char.appearance?.skin_color || '#F5D0C5',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 3,
              borderColor: '#FFF',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 3,
              elevation: 5,
            }}>
              <Text style={{ fontSize: 24 }}>{char.avatar_emoji}</Text>
            </View>
            {/* Walking indicator */}
            {char.is_moving && (
              <View style={styles.walkingDots}>
                <View style={[styles.walkDot, styles.walkDot1]} />
                <View style={[styles.walkDot, styles.walkDot2]} />
                <View style={[styles.walkDot, styles.walkDot3]} />
              </View>
            )}
            {/* Name */}
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.7)',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              marginTop: 4,
            }}>
              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>{char.name.split(' ')[0]}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Character count - shows how many are HERE */}
      <View style={styles.charCount}>
        <Ionicons name="people" size={14} color="#FFF" />
        <Text style={styles.charCountText}>{locationChars.length}</Text>
      </View>
      
      {/* Tap instruction */}
      {locationChars.length > 0 && (
        <View style={styles.tapInstruction}>
          <Text style={styles.tapText}>Tap character to select</Text>
        </View>
      )}
      
      {locationChars.length === 0 && (
        <View style={styles.emptyLocation}>
          <Text style={styles.emptyText}>No one here yet</Text>
        </View>
      )}
    </View>
  );
};

// Character Creation Modal with full attributes
const CreateCharacterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  t: any;
}> = ({ visible, onClose, onCreated, t }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('25');
  const [gender, setGender] = useState('male');
  const [occupation, setOccupation] = useState('unemployed');
  const [skinColor, setSkinColor] = useState('#F5D0C5');
  const [hairColor, setHairColor] = useState('#4A3728');
  
  // Attributes
  const [intelligence, setIntelligence] = useState(50);
  const [strength, setStrength] = useState(50);
  const [charisma, setCharisma] = useState(50);
  const [beauty, setBeauty] = useState(50);
  const [creativity, setCreativity] = useState(50);
  const [luck, setLuck] = useState(50);
  
  // Personality
  const [extroversion, setExtroversion] = useState(50);
  const [kindness, setKindness] = useState(50);
  const [humor, setHumor] = useState(50);
  const [ambition, setAmbition] = useState(50);
  
  // Life setup
  const [objectives, setObjectives] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  
  const [creating, setCreating] = useState(false);

  const skinColors = ['#FFDFC4', '#F5D0C5', '#E8C4A0', '#D4A574', '#8D5524', '#5C3317'];
  const hairColors = ['#1A1A1A', '#4A3728', '#8B4513', '#D4A017', '#FF6B35', '#E8E8E8'];
  
  const objectivesList = ['become_rich', 'find_love', 'have_family', 'become_famous', 'travel_world', 'stay_healthy'];
  const hobbiesList = ['reading', 'gaming', 'cooking', 'sports', 'music', 'art', 'dancing', 'socializing'];

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const token = Platform.OS === 'web' ? localStorage.getItem('auth_token') : null;
      await axios.post(`${API_BASE}/api/characters/create`, {
        name, age: parseInt(age) || 25, gender, occupation, education: 'none', bio: '',
        skin_color: skinColor, hair_color: hairColor, eye_color: '#6B4423', height: 170, body_type: 'average',
        intelligence, strength, charisma, beauty, creativity, luck,
        extroversion, kindness, humor, ambition,
        objectives, hobbies
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      onCreated();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error creating character');
    } finally {
      setCreating(false);
    }
  };

  const AttributeSlider = ({ label, value, setValue, emoji }: { label: string; value: number; setValue: (v: number) => void; emoji: string }) => (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderEmoji}>{emoji}</Text>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${value}%` }]} />
      </View>
      <View style={styles.sliderButtons}>
        <TouchableOpacity onPress={() => setValue(Math.max(0, value - 10))} style={styles.sliderBtn}>
          <Text style={styles.sliderBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.sliderValue}>{value}</Text>
        <TouchableOpacity onPress={() => setValue(Math.min(100, value + 10))} style={styles.sliderBtn}>
          <Text style={styles.sliderBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const toggleItem = (item: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else if (list.length < 3) {
      setList([...list, item]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.createModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.create_character || 'Create Character'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.createForm} showsVerticalScrollIndicator={false}>
            {/* Preview */}
            <View style={styles.previewContainer}>
              <View style={[styles.previewAvatar, { backgroundColor: skinColor }]}>
                <Text style={styles.previewEmoji}>
                  {parseInt(age) < 13 ? '👶' : (gender === 'female' ? '👩' : '👨')}
                </Text>
              </View>
            </View>

            {/* Basic Info */}
            <Text style={styles.sectionLabel}>📝 Basic Info</Text>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder="Name..." placeholderTextColor="#666" />
            <TextInput style={styles.textInput} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Age" placeholderTextColor="#666" />

            {/* Gender */}
            <View style={styles.optionRow}>
              {[{id:'male', emoji:'👨'}, {id:'female', emoji:'👩'}, {id:'other', emoji:'🧑'}].map(g => (
                <TouchableOpacity key={g.id} style={[styles.optionBtn, gender === g.id && styles.optionBtnActive]} onPress={() => setGender(g.id)}>
                  <Text style={styles.optionEmoji}>{g.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Colors */}
            <Text style={styles.sectionLabel}>🎨 Appearance</Text>
            <Text style={styles.subLabel}>Skin</Text>
            <View style={styles.colorRow}>
              {skinColors.map(c => (
                <TouchableOpacity key={c} style={[styles.colorBtn, { backgroundColor: c }, skinColor === c && styles.colorBtnActive]} onPress={() => setSkinColor(c)} />
              ))}
            </View>
            <Text style={styles.subLabel}>Hair</Text>
            <View style={styles.colorRow}>
              {hairColors.map(c => (
                <TouchableOpacity key={c} style={[styles.colorBtn, { backgroundColor: c }, hairColor === c && styles.colorBtnActive]} onPress={() => setHairColor(c)} />
              ))}
            </View>

            {/* Attributes */}
            <Text style={styles.sectionLabel}>⭐ {t.attributes || 'Attributes'}</Text>
            <AttributeSlider label={t.intelligence || "Intelligence"} value={intelligence} setValue={setIntelligence} emoji="🧠" />
            <AttributeSlider label={t.strength || "Strength"} value={strength} setValue={setStrength} emoji="💪" />
            <AttributeSlider label={t.charisma || "Charisma"} value={charisma} setValue={setCharisma} emoji="🗣️" />
            <AttributeSlider label={t.beauty || "Beauty"} value={beauty} setValue={setBeauty} emoji="✨" />
            <AttributeSlider label={t.creativity || "Creativity"} value={creativity} setValue={setCreativity} emoji="🎨" />
            <AttributeSlider label={t.luck || "Luck"} value={luck} setValue={setLuck} emoji="🍀" />

            {/* Personality */}
            <Text style={styles.sectionLabel}>🎭 Personality</Text>
            <AttributeSlider label="Extroversion" value={extroversion} setValue={setExtroversion} emoji="🎉" />
            <AttributeSlider label="Kindness" value={kindness} setValue={setKindness} emoji="💖" />
            <AttributeSlider label="Humor" value={humor} setValue={setHumor} emoji="😂" />
            <AttributeSlider label="Ambition" value={ambition} setValue={setAmbition} emoji="🚀" />

            {/* Objectives */}
            <Text style={styles.sectionLabel}>🎯 {t.objectives || 'Life Objectives'} (max 3)</Text>
            <View style={styles.tagRow}>
              {objectivesList.map(obj => (
                <TouchableOpacity key={obj} style={[styles.tagBtn, objectives.includes(obj) && styles.tagBtnActive]} onPress={() => toggleItem(obj, objectives, setObjectives)}>
                  <Text style={styles.tagText}>{obj.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hobbies */}
            <Text style={styles.sectionLabel}>🎮 {t.hobbies || 'Hobbies'} (max 3)</Text>
            <View style={styles.tagRow}>
              {hobbiesList.map(h => (
                <TouchableOpacity key={h} style={[styles.tagBtn, hobbies.includes(h) && styles.tagBtnActive]} onPress={() => toggleItem(h, hobbies, setHobbies)}>
                  <Text style={styles.tagText}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <TouchableOpacity style={[styles.createButton, creating && styles.createButtonDisabled]} onPress={handleCreate} disabled={creating}>
            {creating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.createButtonText}>Create Character</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main App
export default function LifeApp() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState('paris_cafe');
  const [isPaused, setIsPaused] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoSimulate, setAutoSimulate] = useState(true);
  const [language, setLanguage] = useState('en');
  const [user, setUser] = useState<any>(null);

  const t = useTranslations(language);

  const fetchData = useCallback(async () => {
    try {
      const [charsRes, locsRes, logsRes, worldRes] = await Promise.all([
        axios.get(`${API_BASE}/api/characters`),
        axios.get(`${API_BASE}/api/locations`),
        axios.get(`${API_BASE}/api/logs?limit=15`),
        axios.get(`${API_BASE}/api/world`),
      ]);
      setCharacters(charsRes.data);
      setLocations(locsRes.data);
      setLogs(logsRes.data);
      setIsPaused(worldRes.data.is_paused || false);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Check auth
    if (Platform.OS === 'web') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        axios.get(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => setUser(r.data)).catch(() => {});
      }
    }
  }, [fetchData]);

  // Auto-simulate
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoSimulate && !isPaused) {
      interval = setInterval(simulateTick, 4000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [autoSimulate, isPaused]);

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
    setShowLocationPicker(false);
    setCurrentLocationId(locationId);
  };

  const walkCharacter = async (characterId: string, x: number, y: number) => {
    await axios.post(`${API_BASE}/api/characters/${characterId}/walk?target_x=${x}&target_y=${y}`);
  };

  const handleWorldTap = (x: number, y: number) => {
    if (selectedCharacter && selectedCharacter.location_id === currentLocationId) {
      walkCharacter(selectedCharacter.id, x, y);
    }
  };

  const loginWithGoogle = () => {
    const redirectUrl = Platform.OS === 'web' ? window.location.origin + '/' : '';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const currentLocation = locations.find(l => l.id === currentLocationId);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#00D4FF" />
        <Text style={styles.loadingText}>Loading Life...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Life</Text>
          <Text style={styles.subtitle}>Free AI Simulator</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={[styles.headerBtn, autoSimulate && styles.headerBtnActive]} onPress={() => setAutoSimulate(!autoSimulate)}>
            <Ionicons name={autoSimulate ? "sync" : "sync-outline"} size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, isPaused && styles.headerBtnPaused]} onPress={togglePause}>
            <Ionicons name={isPaused ? "play" : "pause"} size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#00D4FF" />}>
        {/* World View */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🌍 World</Text>
            <TouchableOpacity onPress={() => setShowLocationPicker(true)}>
              <Ionicons name="map-outline" size={22} color="#00D4FF" />
            </TouchableOpacity>
          </View>
          <WorldView
            characters={characters}
            currentLocation={currentLocation || null}
            onCharacterPress={setSelectedCharacter}
            onWorldTap={handleWorldTap}
          />
        </View>

        {/* Location Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationTabs}>
          {locations.slice(0, 8).map(loc => (
            <TouchableOpacity key={loc.id} style={[styles.locationTab, currentLocationId === loc.id && styles.locationTabActive]} onPress={() => setCurrentLocationId(loc.id)}>
              <Text style={styles.locationTabEmoji}>{loc.emoji}</Text>
              <Text style={styles.locationTabName}>{loc.city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.simBtn, (isSimulating || isPaused) && styles.simBtnDisabled]} onPress={simulateTick} disabled={isSimulating || isPaused}>
            {isSimulating ? <ActivityIndicator size="small" color="#FFF" /> : <><Ionicons name="sparkles" size={18} color="#FFF" /><Text style={styles.simBtnText}>{t.simulate || 'Simulate'}</Text></>}
          </TouchableOpacity>
          {user ? (
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="person-add" size={18} color="#FFF" /><Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginBtn} onPress={loginWithGoogle}>
              <Ionicons name="logo-google" size={18} color="#FFF" /><Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Characters List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Characters</Text>
          {characters.map(char => (
            <TouchableOpacity key={char.id} style={[styles.charCard, selectedCharacter?.id === char.id && styles.charCardSelected]} onPress={() => setSelectedCharacter(selectedCharacter?.id === char.id ? null : char)}>
              <View style={styles.charRow}>
                <View style={[styles.charAvatar, { backgroundColor: char.appearance?.skin_color || '#F5D0C5' }]}>
                  <Text style={styles.charEmoji}>{char.avatar_emoji}</Text>
                </View>
                <View style={styles.charInfo}>
                  <Text style={styles.charName}>{char.name}</Text>
                  <Text style={styles.charDetails}>{char.occupation}, {char.age} - {char.mood}</Text>
                  <Text style={styles.charAction}>{char.current_action}</Text>
                </View>
                {!char.is_npc && <View style={styles.youBadge}><Text style={styles.youText}>YOU</Text></View>}
              </View>

              {selectedCharacter?.id === char.id && (
                <View style={styles.charExpanded}>
                  {/* Needs */}
                  <View style={styles.needsGrid}>
                    {Object.entries(char.needs || {}).map(([k, v]) => (
                      <View key={k} style={styles.needItem}>
                        <Text style={styles.needLabel}>{k}</Text>
                        <View style={styles.needBar}><View style={[styles.needFill, { width: `${v}%`, backgroundColor: v < 30 ? '#F44' : v < 50 ? '#F90' : '#4C5' }]} /></View>
                        <Text style={styles.needVal}>{Math.round(v)}%</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Attributes */}
                  {char.attributes && (
                    <View style={styles.attrSection}>
                      <Text style={styles.attrTitle}>Attributes</Text>
                      <View style={styles.attrGrid}>
                        {Object.entries(char.attributes).slice(0, 6).map(([k, v]) => (
                          <View key={k} style={styles.attrItem}>
                            <Text style={styles.attrLabel}>{k}</Text>
                            <Text style={styles.attrVal}>{Math.round(v as number)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Thought */}
                  {char.thoughts.length > 0 && (
                    <View style={styles.thoughtBox}>
                      <Text style={styles.thoughtText}>{`💭 "${char.thoughts[char.thoughts.length - 1]}"`}</Text>
                    </View>
                  )}

                  <View style={styles.charActions}>
                    <TouchableOpacity style={styles.travelBtn} onPress={() => { setSelectedCharacter(char); setShowLocationPicker(true); }}>
                      <Ionicons name="airplane" size={14} color="#FFF" /><Text style={styles.travelText}>Travel</Text>
                    </TouchableOpacity>
                    <Text style={styles.moneyText}>💰 ${char.money}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Activity</Text>
          <View style={styles.logsBox}>
            {logs.slice(0, 8).map((log, i) => (
              <View key={log.id || i} style={styles.logItem}>
                <Text style={styles.logChar}>{log.character_name}</Text>
                <Text style={styles.logAction}>{log.action}</Text>
                {log.thought && <Text style={styles.logThought}>{`"${log.thought}"`}</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Location Picker */}
      <Modal visible={showLocationPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Travel</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <ScrollView>
              {locations.map(loc => (
                <TouchableOpacity key={loc.id} style={[styles.locItem, currentLocationId === loc.id && styles.locItemActive]} onPress={() => selectedCharacter ? moveCharacter(selectedCharacter.id, loc.id) : setCurrentLocationId(loc.id) || setShowLocationPicker(false)}>
                  <Text style={styles.locEmoji}>{loc.emoji}</Text>
                  <View style={styles.locInfo}><Text style={styles.locName}>{loc.name}</Text><Text style={styles.locCity}>{loc.city}</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <Text style={styles.settingLabel}>Language</Text>
            <View style={styles.langRow}>
              {[{c:'en',f:'🇬🇧',n:'English'},{c:'fr',f:'🇫🇷',n:'Français'},{c:'es',f:'🇪🇸',n:'Español'},{c:'de',f:'🇩🇪',n:'Deutsch'}].map(l => (
                <TouchableOpacity key={l.c} style={[styles.langBtn, language === l.c && styles.langBtnActive]} onPress={() => setLanguage(l.c)}>
                  <Text style={styles.langFlag}>{l.f}</Text><Text style={styles.langName}>{l.n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {user && <Text style={styles.userEmail}>{user.email}</Text>}
          </View>
        </View>
      </Modal>

      <CreateCharacterModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={fetchData} t={t} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', fontSize: 18, marginTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { fontSize: 26, fontWeight: 'bold', color: '#00D4FF' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  headerButtons: { flexDirection: 'row', gap: 6 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerBtnActive: { backgroundColor: '#00D4FF' },
  headerBtnPaused: { backgroundColor: '#F44' },
  content: { flex: 1 },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  
  // World View
  worldView: { borderRadius: 16, position: 'relative' },
  worldHeader: { position: 'absolute', top: 8, left: 10, zIndex: 10 },
  worldEmoji: { fontSize: 20 },
  worldName: { color: '#333', fontSize: 12, fontWeight: '600' },
  worldCity: { color: '#555', fontSize: 10 },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 35, backgroundColor: '#8B4513' },
  groundGrass: { height: 8, backgroundColor: '#228B22' },
  charCount: { position: 'absolute', top: 8, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  charCountText: { color: '#FFF', fontSize: 11, marginLeft: 4 },
  cloud: { position: 'absolute' },
  cloudEmoji: { fontSize: 28, opacity: 0.7 },
  worldObject: { position: 'absolute', fontSize: 28 },
  tapInstruction: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  tapText: { color: 'rgba(0,0,0,0.4)', fontSize: 10 },
  emptyLocation: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
  emptyText: { color: 'rgba(0,0,0,0.4)', fontSize: 12 },
  
  // Character Sprite
  characterSprite: { position: 'absolute', alignItems: 'center', zIndex: 5 },
  spriteBody: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  spriteEmoji: { fontSize: 22 },
  spriteNameTag: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  spriteNameText: { color: '#FFF', fontSize: 9, fontWeight: '600' },
  walkingDots: { flexDirection: 'row', position: 'absolute', bottom: -8 },
  walkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#00D4FF', marginHorizontal: 1 },
  walkDot1: { opacity: 0.3 },
  walkDot2: { opacity: 0.6 },
  walkDot3: { opacity: 1 },
  thoughtBubble: { position: 'absolute', top: -15, right: -10 },
  thoughtEmoji: { fontSize: 14 },
  actionBubble: { position: 'absolute', top: -25, left: -10, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  actionText: { color: '#FFF', fontSize: 7, fontWeight: '600' },
  
  // Location Tabs
  locationTabs: { paddingHorizontal: 12, marginBottom: 8 },
  locationTab: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, alignItems: 'center' },
  locationTabActive: { backgroundColor: '#00D4FF' },
  locationTabEmoji: { fontSize: 18 },
  locationTabName: { color: '#FFF', fontSize: 10, marginTop: 2 },
  
  // Action Buttons
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  simBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00D4FF', paddingVertical: 12, borderRadius: 10, gap: 6 },
  simBtnDisabled: { backgroundColor: '#555' },
  simBtnText: { color: '#FFF', fontWeight: '700' },
  createBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: 10, gap: 6 },
  createBtnText: { color: '#FFF', fontWeight: '700' },
  loginBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EA4335', paddingVertical: 12, borderRadius: 10, gap: 6 },
  loginBtnText: { color: '#FFF', fontWeight: '700' },
  
  // Character Card
  charCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10, marginBottom: 8 },
  charCardSelected: { borderWidth: 2, borderColor: '#00D4FF' },
  charRow: { flexDirection: 'row', alignItems: 'center' },
  charAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  charEmoji: { fontSize: 22 },
  charInfo: { flex: 1, marginLeft: 10 },
  charName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  charDetails: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  charAction: { color: '#00D4FF', fontSize: 11 },
  youBadge: { backgroundColor: '#4C5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  youText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  charExpanded: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  needsGrid: { gap: 4 },
  needItem: { flexDirection: 'row', alignItems: 'center' },
  needLabel: { width: 55, color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  needBar: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginHorizontal: 6 },
  needFill: { height: '100%', borderRadius: 2 },
  needVal: { width: 30, color: '#FFF', fontSize: 10, textAlign: 'right' },
  attrSection: { marginTop: 8 },
  attrTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  attrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  attrItem: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', gap: 4 },
  attrLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9 },
  attrVal: { color: '#00D4FF', fontSize: 9, fontWeight: '600' },
  thoughtBox: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 6, marginTop: 8 },
  thoughtText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontStyle: 'italic' },
  charActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  travelBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00D4FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  travelText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  moneyText: { color: '#FFD700', fontWeight: '600' },
  
  // Logs
  logsBox: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 10 },
  logItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  logChar: { color: '#00D4FF', fontSize: 12, fontWeight: '600' },
  logAction: { color: '#FFF', fontSize: 11 },
  logThought: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontStyle: 'italic' },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  pickerModal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: height * 0.6, padding: 16 },
  locItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, marginBottom: 8 },
  locItemActive: { borderWidth: 2, borderColor: '#00D4FF' },
  locEmoji: { fontSize: 26 },
  locInfo: { marginLeft: 12 },
  locName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  locCity: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  settingsModal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  settingLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 16, marginBottom: 8 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  langBtnActive: { backgroundColor: '#00D4FF' },
  langFlag: { fontSize: 18 },
  langName: { color: '#FFF', fontSize: 12 },
  userEmail: { color: 'rgba(255,255,255,0.6)', marginTop: 20, textAlign: 'center' },
  
  // Create Modal
  createModal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: height * 0.9 },
  createForm: { flex: 1, padding: 16 },
  previewContainer: { alignItems: 'center', marginBottom: 16 },
  previewAvatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF' },
  previewEmoji: { fontSize: 36 },
  sectionLabel: { color: '#00D4FF', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  subLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 8, marginBottom: 4 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, color: '#FFF', marginBottom: 8 },
  optionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  optionBtn: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  optionBtnActive: { backgroundColor: '#00D4FF' },
  optionEmoji: { fontSize: 24 },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorBtnActive: { borderColor: '#00D4FF' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sliderEmoji: { fontSize: 16, width: 24 },
  sliderLabel: { width: 80, color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  sliderTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginHorizontal: 6 },
  sliderFill: { height: '100%', backgroundColor: '#00D4FF', borderRadius: 3 },
  sliderButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sliderBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  sliderBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  sliderValue: { width: 28, color: '#FFF', fontSize: 11, textAlign: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  tagBtnActive: { backgroundColor: '#00D4FF' },
  tagText: { color: '#FFF', fontSize: 11 },
  createButton: { backgroundColor: '#00D4FF', margin: 16, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  createButtonDisabled: { backgroundColor: '#555' },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
