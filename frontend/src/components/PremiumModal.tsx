import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Linking, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface Price {
  id: string; name: string; amount: number; currency: string; interval: string; savings?: string;
}

const FEATURES = [
  { icon: '🏊', text: 'Premium build items (Pool, Jacuzzi, Piano…)' },
  { icon: '🌍', text: 'Exclusive locations (Dubai Mall, Everest, Bolshoi…)' },
  { icon: '👶', text: 'Have unlimited children & family trees' },
  { icon: '⚡', text: '3x faster simulation speed' },
  { icon: '🎨', text: 'Advanced character customization' },
  { icon: '🚫', text: 'No ads, ever' },
];

export const PremiumModal: React.FC<Props> = ({ visible, onClose }) => {
  const [prices, setPrices] = useState<Price[]>([]);
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    axios.get(`${API_BASE}/api/stripe/prices`)
      .then(r => {
        const data = r.data;
        // Backend returns { prices: [...] } — handle both shapes defensively
        const list = Array.isArray(data) ? data : (data?.prices || []);
        setPrices(list);
      })
      .catch(e => console.error('Prices error', e))
      .finally(() => setLoading(false));
  }, [visible]);

  const handleSubscribe = async () => {
    setProcessing(true);
    try {
      const price = prices.find(p => p.id === selected);
      if (!price) throw new Error('Plan not found');
      const res = await axios.post(`${API_BASE}/api/stripe/create-checkout-session`, {
        price_id: selected,
        success_url: `${window.location.origin}?premium=success`,
        cancel_url: `${window.location.origin}?premium=cancel`,
      });
      if (res.data?.url) {
        await Linking.openURL(res.data.url);
      } else {
        Alert.alert('Error', 'No checkout URL returned');
      }
    } catch (e: any) {
      Alert.alert(
        'Login required',
        e?.response?.data?.detail || 'Please sign in to subscribe. Your build progress is safe.',
      );
    } finally { setProcessing(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <LinearGradient colors={['#FFD700', '#FFA500', '#FF6347']} style={styles.headerBg}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.crown}>👑</Text>
            <Text style={styles.title}>Life Premium</Text>
            <Text style={styles.tagline}>Unlock everything. Be the God you always wanted to be.</Text>
          </LinearGradient>

          <View style={styles.content}>
            {/* Features */}
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
              </View>
            ))}

            {/* Pricing plans */}
            {loading ? (
              <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.plansRow}>
                {prices.map(p => {
                  const isSel = selected === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.planCard, isSel && styles.planCardActive]}
                      onPress={() => setSelected(p.id as any)}
                    >
                      {p.savings && <Text style={styles.savingsBadge}>{p.savings}</Text>}
                      <Text style={styles.planName}>{p.name}</Text>
                      <Text style={styles.planAmount}>${p.amount}</Text>
                      <Text style={styles.planInterval}>/ {p.interval}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.cta, processing && { opacity: 0.6 }]}
              onPress={handleSubscribe}
              disabled={processing || loading}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="rocket" size={20} color="#FFF" />
                  <Text style={styles.ctaText}>Upgrade Now</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.fineprint}>Cancel anytime. Secure payment via Stripe.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  headerBg: { paddingTop: 30, paddingBottom: 24, alignItems: 'center', position: 'relative' },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  crown: { fontSize: 50 },
  title: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 6, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
  tagline: { color: 'rgba(255,255,255,0.95)', fontSize: 13, marginTop: 4, paddingHorizontal: 30, textAlign: 'center' },
  content: { padding: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureIcon: { fontSize: 20, width: 30 },
  featureText: { color: '#FFF', fontSize: 13, flex: 1, marginLeft: 4 },
  plansRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  planCard: { flex: 1, padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  planCardActive: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.1)' },
  savingsBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#4CAF50', color: '#FFF', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  planName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'capitalize' },
  planAmount: { color: '#FFD700', fontSize: 26, fontWeight: '900', marginTop: 4 },
  planInterval: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700', padding: 16, borderRadius: 14, marginTop: 18, gap: 8, shadowColor: '#FFD700', shadowOpacity: 0.5, shadowRadius: 10 },
  ctaText: { color: '#1a1a2e', fontWeight: '900', fontSize: 16 },
  fineprint: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 8 },
});
