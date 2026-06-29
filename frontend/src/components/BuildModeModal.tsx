import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');

interface CatalogItem {
  id: string; name: string; emoji: string; category: string; size: number; cost: number; premium: boolean;
}

interface PlacedItem {
  id: string; catalog_id: string; emoji: string; name: string; x: number; y: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpgradeRequest: () => void;
  isPremium: boolean;
}

const CATEGORIES = ['all', 'furniture', 'electronics', 'appliance', 'decor', 'outdoor', 'luxury'];

export const BuildModeModal: React.FC<Props> = ({ visible, onClose, onUpgradeRequest, isPremium }) => {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/build/catalog`),
        axios.get(`${API_BASE}/api/build/items?location_id=my_home`),
      ]);
      setCatalog(catRes.data);
      setPlaced(itemsRes.data);
    } catch (e) {
      console.error('Build load error', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const handleCanvasPress = async (evt: any) => {
    if (!selectedItem) {
      Alert.alert('Pick an item first', 'Tap an item from the catalog below, then tap on the canvas to place it.');
      return;
    }
    if (selectedItem.premium && !isPremium) {
      onUpgradeRequest();
      return;
    }
    const { locationX, locationY } = evt.nativeEvent;
    const canvasWidth = width - 40;
    const canvasHeight = 240;
    const x = Math.max(5, Math.min(95, (locationX / canvasWidth) * 100));
    const y = Math.max(5, Math.min(95, (locationY / canvasHeight) * 100));

    try {
      const res = await axios.post(`${API_BASE}/api/build/place`, {
        catalog_id: selectedItem.id, x, y, location_id: 'my_home',
      });
      setPlaced(prev => [...prev, res.data]);
    } catch (e: any) {
      if (e?.response?.status === 402) {
        onUpgradeRequest();
      } else {
        Alert.alert('Error', e?.response?.data?.detail || 'Failed to place item');
      }
    }
  };

  const removeItem = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/build/items/${id}`);
      setPlaced(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e); }
  };

  const clearAll = () => {
    Alert.alert('Clear all?', 'Remove every item from your home.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await axios.post(`${API_BASE}/api/build/clear?location_id=my_home`);
        setPlaced([]);
      } },
    ]);
  };

  const filtered = category === 'all' ? catalog : catalog.filter(c => c.category === category);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🏗️ Build Mode</Text>
              <Text style={styles.subtitle}>Design your dream home</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
                <Ionicons name="trash-outline" size={18} color="#F44" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#FFF" /></TouchableOpacity>
            </View>
          </View>

          {/* Canvas — the user's home */}
          <View style={styles.canvasContainer}>
            <LinearGradient colors={['#87CEEB', '#FFE4B5']} style={styles.canvasSky} />
            <View style={styles.canvasFloor} />
            <TouchableOpacity activeOpacity={1} style={styles.canvasArea} onPress={handleCanvasPress}>
              {placed.map((item) => {
                const left = (item.x / 100) * (width - 40) - 18;
                const top = (item.y / 100) * 240 - 18;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.placedItem, { left, top }]}
                    onLongPress={() => removeItem(item.id)}
                  >
                    <Text style={styles.placedEmoji}>{item.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
              {placed.length === 0 && (
                <Text style={styles.canvasHint}>👆 Pick an item then tap here to place</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.canvasFootHint}>Long-press an item to remove</Text>
          </View>

          {/* Selected item indicator */}
          {selectedItem && (
            <View style={styles.selectedBar}>
              <Text style={styles.selectedEmoji}>{selectedItem.emoji}</Text>
              <Text style={styles.selectedName}>{selectedItem.name}</Text>
              {selectedItem.premium && <Text style={styles.premiumBadge}>👑 Premium</Text>}
              <Text style={styles.selectedCost}>${selectedItem.cost}</Text>
            </View>
          )}

          {/* Category filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={{ paddingHorizontal: 10 }}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.catBtn, category === c && styles.catBtnActive]} onPress={() => setCategory(c)}>
                <Text style={styles.catBtnText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Catalog */}
          {loading ? (
            <ActivityIndicator color="#00D4FF" style={{ marginTop: 20 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catalogScroll}>
              {filtered.map(c => {
                const locked = c.premium && !isPremium;
                const isSel = selectedItem?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catalogCard, isSel && styles.catalogCardActive, locked && styles.catalogCardLocked]}
                    onPress={() => locked ? onUpgradeRequest() : setSelectedItem(c)}
                  >
                    {c.premium && <Text style={styles.crown}>👑</Text>}
                    <Text style={styles.catalogEmoji}>{c.emoji}</Text>
                    <Text style={styles.catalogName} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.catalogCost, locked && { color: '#FFD700' }]}>
                      {locked ? '🔒 Premium' : `$${c.cost}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 12, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clearBtn: { padding: 6 },
  canvasContainer: { margin: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#2D3748', height: 260 },
  canvasSky: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  canvasFloor: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', backgroundColor: '#D2B48C' },
  canvasArea: { flex: 1, position: 'relative' },
  placedItem: { position: 'absolute', width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  placedEmoji: { fontSize: 28 },
  canvasHint: { position: 'absolute', top: '45%', left: 0, right: 0, textAlign: 'center', color: 'rgba(0,0,0,0.45)', fontSize: 13, fontWeight: '600' },
  canvasFootHint: { position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  selectedBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,212,255,0.15)', marginHorizontal: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 8 },
  selectedEmoji: { fontSize: 20 },
  selectedName: { color: '#FFF', fontWeight: '700', flex: 1 },
  premiumBadge: { color: '#FFD700', fontSize: 11, fontWeight: '700' },
  selectedCost: { color: '#4CAF50', fontWeight: '700' },
  categoryRow: { marginTop: 10, maxHeight: 38 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, marginRight: 8 },
  catBtnActive: { backgroundColor: '#00D4FF' },
  catBtnText: { color: '#FFF', fontSize: 12, textTransform: 'capitalize' },
  catalogScroll: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 16, gap: 8 },
  catalogCard: { width: 80, padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, alignItems: 'center', marginRight: 8, borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  catalogCardActive: { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.15)' },
  catalogCardLocked: { opacity: 0.6 },
  crown: { position: 'absolute', top: 2, right: 4, fontSize: 12 },
  catalogEmoji: { fontSize: 34 },
  catalogName: { color: '#FFF', fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'center' },
  catalogCost: { color: '#4CAF50', fontSize: 10, marginTop: 2, fontWeight: '700' },
});
