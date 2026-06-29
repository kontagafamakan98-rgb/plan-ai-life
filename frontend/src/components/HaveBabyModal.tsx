import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Character {
  id: string; name: string; age: number; gender: string; avatar_emoji: string;
  appearance?: { skin_color?: string; hair_color?: string };
}

interface Props {
  visible: boolean;
  parent: Character | null;
  candidates: Character[];
  onClose: () => void;
  onBabyCreated: (baby: any) => void;
}

export const HaveBabyModal: React.FC<Props> = ({ visible, parent, candidates, onClose, onBabyCreated }) => {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState('');
  const [babyGender, setBabyGender] = useState<'male' | 'female'>('female');
  const [loading, setLoading] = useState(false);

  // Eligible partners: adult, different gender than parent, not the parent itself
  const eligible = candidates.filter(c =>
    c.id !== parent?.id &&
    c.age >= 18 &&
    (parent ? c.gender !== parent.gender : true)
  );

  const submit = async () => {
    if (!parent || !partnerId) { Alert.alert('Pick a partner', 'Select someone to be the other parent'); return; }
    if (!babyName.trim()) { Alert.alert('Name', 'Give your baby a name'); return; }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/characters/${parent.id}/have-baby?partner_id=${partnerId}&baby_name=${encodeURIComponent(babyName.trim())}&baby_gender=${babyGender}`
      );
      onBabyCreated(res.data);
      setPartnerId(null); setBabyName('');
      onClose();
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Failed to create baby';
      Alert.alert('Login required', `${detail}\n\nNote: This endpoint currently requires a logged-in user.`);
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>👶 Have a Baby</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#FFF" /></TouchableOpacity>
          </View>

          {parent && (
            <View style={styles.parentBar}>
              <View style={[styles.avatarSm, { backgroundColor: parent.appearance?.skin_color || '#F5D0C5' }]}>
                <Text style={styles.avatarEmoji}>{parent.avatar_emoji}</Text>
              </View>
              <Text style={styles.parentText}>Parent 1: <Text style={styles.parentName}>{parent.name}</Text></Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: 540 }}>
            <Text style={styles.sectionLabel}>Choose Parent 2</Text>
            {eligible.length === 0 ? (
              <Text style={styles.empty}>No eligible partners (must be adult, different gender)</Text>
            ) : (
              eligible.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.partnerCard, partnerId === c.id && styles.partnerCardActive]}
                  onPress={() => setPartnerId(c.id)}
                >
                  <View style={[styles.avatarSm, { backgroundColor: c.appearance?.skin_color || '#F5D0C5' }]}>
                    <Text style={styles.avatarEmoji}>{c.avatar_emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.partnerName}>{c.name}</Text>
                    <Text style={styles.partnerSub}>{c.age} • {c.gender}</Text>
                  </View>
                  {partnerId === c.id && <Ionicons name="checkmark-circle" size={22} color="#00D4FF" />}
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionLabel}>Baby Name</Text>
            <TextInput
              style={styles.input}
              value={babyName}
              onChangeText={setBabyName}
              placeholder="e.g. Sunny"
              placeholderTextColor="#888"
            />

            <Text style={styles.sectionLabel}>Baby Gender</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.genderBtn, babyGender === 'female' && styles.genderBtnActive]} onPress={() => setBabyGender('female')}>
                <Text style={styles.genderEmoji}>👧</Text>
                <Text style={styles.genderText}>Girl</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.genderBtn, babyGender === 'male' && styles.genderBtnActive]} onPress={() => setBabyGender('male')}>
                <Text style={styles.genderEmoji}>👦</Text>
                <Text style={styles.genderText}>Boy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>💡 The baby inherits a mix of both parents&apos; skin color, hair color, and attributes (intelligence, strength, charisma, beauty).</Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.cta, (loading || !partnerId || !babyName.trim()) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading || !partnerId || !babyName.trim()}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Text style={styles.ctaEmoji}>👶</Text>
                <Text style={styles.ctaText}>Bring baby to life</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 0, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  parentBar: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,182,193,0.1)' },
  avatarSm: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  avatarEmoji: { fontSize: 22 },
  parentText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginLeft: 10 },
  parentName: { color: '#FFF', fontWeight: '700' },
  sectionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 8, paddingHorizontal: 16 },
  partnerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  partnerCardActive: { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.1)' },
  partnerName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  partnerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  empty: { color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFF', padding: 12, borderRadius: 10, fontSize: 15, marginHorizontal: 16 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  genderBtn: { flex: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  genderBtnActive: { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.1)' },
  genderEmoji: { fontSize: 32 },
  genderText: { color: '#FFF', fontSize: 13, marginTop: 4 },
  infoBox: { margin: 16, padding: 12, backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 10 },
  infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E91E63', margin: 16, padding: 14, borderRadius: 14, gap: 10 },
  ctaEmoji: { fontSize: 22 },
  ctaText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
