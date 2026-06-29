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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CharacterNeeds {
  hunger: number;
  energy: number;
  social: number;
  hygiene: number;
  fun: number;
  bladder: number;
  comfort: number;
}

interface Character {
  id: string;
  name: string;
  age: number;
  occupation: string;
  bio: string;
  avatar_emoji: string;
  location_id: string;
  needs: CharacterNeeds;
  current_action: string;
  mood: string;
  thoughts: string[];
  money: number;
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

interface ActionLog {
  id: string;
  character_name: string;
  action: string;
  location: string;
  thought: string;
  timestamp: string;
}

const MOOD_COLORS: Record<string, string> = {
  Happy: '#4CAF50',
  Sad: '#5C6BC0',
  Excited: '#FF9800',
  Tired: '#9E9E9E',
  Anxious: '#F44336',
  Content: '#8BC34A',
  Romantic: '#E91E63',
  Focused: '#2196F3',
  Social: '#9C27B0',
  Bored: '#795548',
};

const MOOD_EMOJIS: Record<string, string> = {
  Happy: '😊',
  Sad: '😢',
  Excited: '🤩',
  Tired: '😴',
  Anxious: '😰',
  Content: '😌',
  Romantic: '😍',
  Focused: '🎯',
  Social: '🗣️',
  Bored: '😐',
};

export default function SimAIGame() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [autoSimulate, setAutoSimulate] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [charsRes, locsRes, logsRes, worldRes] = await Promise.all([
        axios.get(`${API_BASE}/api/characters`),
        axios.get(`${API_BASE}/api/locations`),
        axios.get(`${API_BASE}/api/logs?limit=30`),
        axios.get(`${API_BASE}/api/world`),
      ]);
      setCharacters(charsRes.data);
      setLocations(locsRes.data);
      setLogs(logsRes.data);
      setIsPaused(worldRes.data.is_paused || false);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-simulate every 8 seconds when enabled
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoSimulate && !isPaused) {
      interval = setInterval(() => {
        simulateTick();
      }, 8000);
    }
    return () => clearInterval(interval);
  }, [autoSimulate, isPaused]);

  const simulateTick = async () => {
    if (isSimulating || isPaused) return;
    setIsSimulating(true);
    try {
      await axios.post(`${API_BASE}/api/simulate`);
      await fetchData();
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const togglePause = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/world/pause`);
      setIsPaused(res.data.is_paused);
    } catch (error) {
      console.error('Toggle pause error:', error);
    }
  };

  const moveCharacter = async (characterId: string, locationId: string) => {
    try {
      await axios.post(`${API_BASE}/api/characters/${characterId}/move?location_id=${locationId}`);
      await fetchData();
      setShowLocationPicker(false);
    } catch (error) {
      console.error('Move error:', error);
    }
  };

  const resetGame = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/reset`);
      await fetchData();
    } catch (error) {
      console.error('Reset error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationById = (id: string) => locations.find(l => l.id === id);

  const NeedBar = ({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) => (
    <View style={styles.needBarContainer}>
      <View style={styles.needLabelRow}>
        <Text style={styles.needIcon}>{icon}</Text>
        <Text style={styles.needLabel}>{label}</Text>
        <Text style={[styles.needValue, { color: value < 30 ? '#F44336' : value < 50 ? '#FF9800' : '#4CAF50' }]}>
          {Math.round(value)}%
        </Text>
      </View>
      <View style={styles.needBarBg}>
        <View style={[
          styles.needBarFill,
          { 
            width: `${value}%`, 
            backgroundColor: value < 30 ? '#F44336' : value < 50 ? '#FF9800' : color 
          }
        ]} />
      </View>
    </View>
  );

  const CharacterCard = ({ character }: { character: Character }) => {
    const location = getLocationById(character.location_id);
    const isSelected = selectedCharacter?.id === character.id;
    const moodColor = MOOD_COLORS[character.mood] || '#4CAF50';
    const moodEmoji = MOOD_EMOJIS[character.mood] || '😊';

    return (
      <TouchableOpacity
        style={[styles.characterCard, isSelected && styles.characterCardSelected]}
        onPress={() => setSelectedCharacter(isSelected ? null : character)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.characterCardGradient}
        >
          <View style={styles.characterHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatar}>{character.avatar_emoji}</Text>
              <View style={[styles.moodBadge, { backgroundColor: moodColor }]}>
                <Text style={styles.moodEmoji}>{moodEmoji}</Text>
              </View>
            </View>
            <View style={styles.characterInfo}>
              <Text style={styles.characterName}>{character.name}</Text>
              <Text style={styles.characterOccupation}>{character.occupation}, {character.age}</Text>
              <View style={styles.locationBadge}>
                <Text style={styles.locationEmoji}>{location?.emoji || '📍'}</Text>
                <Text style={styles.locationText}>{location?.name || 'Unknown'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionContainer}>
            <Ionicons name="play-circle" size={16} color="#00D4FF" />
            <Text style={styles.currentAction}>{character.current_action}</Text>
          </View>

          {character.thoughts.length > 0 && (
            <View style={styles.thoughtBubble}>
              <Text style={styles.thoughtText}>"{character.thoughts[character.thoughts.length - 1]}"</Text>
            </View>
          )}

          {isSelected && (
            <View style={styles.needsContainer}>
              <NeedBar label="Hunger" value={character.needs.hunger} icon="🍔" color="#FF6B6B" />
              <NeedBar label="Energy" value={character.needs.energy} icon="⚡" color="#FFE66D" />
              <NeedBar label="Social" value={character.needs.social} icon="💬" color="#4ECDC4" />
              <NeedBar label="Hygiene" value={character.needs.hygiene} icon="🚿" color="#45B7D1" />
              <NeedBar label="Fun" value={character.needs.fun} icon="🎮" color="#F38181" />
              <NeedBar label="Bladder" value={character.needs.bladder} icon="🚽" color="#AA96DA" />
              <NeedBar label="Comfort" value={character.needs.comfort} icon="🛋️" color="#A8E6CF" />
              
              <View style={styles.characterActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowLocationPicker(true)}
                >
                  <Ionicons name="airplane" size={18} color="#FFF" />
                  <Text style={styles.actionButtonText}>Travel</Text>
                </TouchableOpacity>
                <View style={styles.moneyBadge}>
                  <Text style={styles.moneyText}>💰 ${character.money.toFixed(0)}</Text>
                </View>
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const LocationPicker = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.locationPickerModal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Choose Destination</Text>
          <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.locationsList}>
          {locations.map(location => (
            <TouchableOpacity
              key={location.id}
              style={[
                styles.locationItem,
                selectedCharacter?.location_id === location.id && styles.locationItemCurrent
              ]}
              onPress={() => selectedCharacter && moveCharacter(selectedCharacter.id, location.id)}
              disabled={selectedCharacter?.location_id === location.id}
            >
              <Text style={styles.locationItemEmoji}>{location.emoji}</Text>
              <View style={styles.locationItemInfo}>
                <Text style={styles.locationItemName}>{location.name}</Text>
                <Text style={styles.locationItemCity}>{location.city}, {location.country}</Text>
              </View>
              {selectedCharacter?.location_id === location.id && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>HERE</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#00D4FF" />
        <Text style={styles.loadingText}>Loading SimAI...</Text>
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
          <Text style={styles.title}>SimAI</Text>
          <Text style={styles.subtitle}>Life Simulator</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, autoSimulate && styles.headerButtonActive]}
            onPress={() => setAutoSimulate(!autoSimulate)}
          >
            <Ionicons name={autoSimulate ? "sync" : "sync-outline"} size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, isPaused && styles.headerButtonPaused]}
            onPress={togglePause}
          >
            <Ionicons name={isPaused ? "play" : "pause"} size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={resetGame}>
            <Ionicons name="refresh" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#00D4FF" />
        }
      >
        {/* Characters Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Characters</Text>
          {characters.map(char => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </View>

        {/* Simulate Button */}
        <TouchableOpacity
          style={[styles.simulateButton, (isSimulating || isPaused) && styles.simulateButtonDisabled]}
          onPress={simulateTick}
          disabled={isSimulating || isPaused}
        >
          <LinearGradient
            colors={isSimulating || isPaused ? ['#555', '#333'] : ['#00D4FF', '#0099FF']}
            style={styles.simulateButtonGradient}
          >
            {isSimulating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={24} color="#FFF" />
                <Text style={styles.simulateButtonText}>
                  {isPaused ? 'Paused' : 'Simulate Life'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Activity Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          <View style={styles.logsContainer}>
            {logs.slice(0, 15).map((log, index) => (
              <View key={log.id || index} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.logCharacter}>{log.character_name}</Text>
                  <Text style={styles.logLocation}>@ {log.location}</Text>
                </View>
                <Text style={styles.logAction}>{log.action}</Text>
                {log.thought && <Text style={styles.logThought}>"{log.thought}"</Text>}
              </View>
            ))}
            {logs.length === 0 && (
              <Text style={styles.emptyLogs}>No activity yet. Press "Simulate Life" to start!</Text>
            )}
          </View>
        </View>

        {/* World Locations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>World Locations</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationsScroll}>
            {locations.map(loc => {
              const charsHere = characters.filter(c => c.location_id === loc.id);
              return (
                <View key={loc.id} style={styles.locationCard}>
                  <Text style={styles.locationCardEmoji}>{loc.emoji}</Text>
                  <Text style={styles.locationCardName}>{loc.name}</Text>
                  <Text style={styles.locationCardCity}>{loc.city}</Text>
                  {charsHere.length > 0 && (
                    <View style={styles.charsHereBadge}>
                      <Text style={styles.charsHereText}>
                        {charsHere.map(c => c.avatar_emoji).join(' ')}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Location Picker Modal */}
      {showLocationPicker && selectedCharacter && <LocationPicker />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00D4FF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonActive: {
    backgroundColor: '#00D4FF',
  },
  headerButtonPaused: {
    backgroundColor: '#F44336',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 16,
    letterSpacing: 1,
  },
  characterCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  characterCardSelected: {
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  characterCardGradient: {
    padding: 16,
  },
  characterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    fontSize: 48,
  },
  moodBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 14,
  },
  characterInfo: {
    marginLeft: 16,
    flex: 1,
  },
  characterName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  characterOccupation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  locationEmoji: {
    fontSize: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#FFF',
    marginLeft: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(0,212,255,0.1)',
    padding: 10,
    borderRadius: 8,
  },
  currentAction: {
    fontSize: 14,
    color: '#00D4FF',
    marginLeft: 8,
    fontWeight: '600',
  },
  thoughtBubble: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#9C27B0',
  },
  thoughtText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
  },
  needsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  needBarContainer: {
    marginBottom: 10,
  },
  needLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  needIcon: {
    fontSize: 14,
    width: 20,
  },
  needLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
    marginLeft: 6,
  },
  needValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  needBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  needBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  characterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  moneyBadge: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  moneyText: {
    color: '#FFD700',
    fontWeight: '600',
  },
  simulateButton: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  simulateButtonDisabled: {
    opacity: 0.6,
  },
  simulateButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  simulateButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  logsContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  logItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logCharacter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D4FF',
  },
  logLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 8,
  },
  logAction: {
    fontSize: 13,
    color: '#FFF',
    marginTop: 4,
  },
  logThought: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyLogs: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    padding: 20,
  },
  locationsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  locationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 140,
    alignItems: 'center',
  },
  locationCardEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  locationCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    textAlign: 'center',
  },
  locationCardCity: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  charsHereBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(0,212,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  charsHereText: {
    fontSize: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  locationPickerModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    width: '100%',
    maxHeight: height * 0.7,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  locationsList: {
    padding: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  locationItemCurrent: {
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderWidth: 1,
    borderColor: '#00D4FF',
  },
  locationItemEmoji: {
    fontSize: 32,
  },
  locationItemInfo: {
    marginLeft: 16,
    flex: 1,
  },
  locationItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  locationItemCity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  currentBadge: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
