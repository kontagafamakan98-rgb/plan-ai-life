import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SKIN_COLORS = ['#F5D0C5', '#E8B89B', '#D2A07A', '#A07857', '#7C5238', '#4A2E1C'];
const HAIR_COLORS = ['#1A1A1A', '#3D2817', '#6B4226', '#A0522D', '#D4A574', '#E8C547', '#FF6B35', '#9B59B6', '#FFFFFF'];
const EYE_COLORS = ['#3D2817', '#6B4226', '#4A7C59', '#5B9BD5', '#7B68EE', '#808080'];
const OCCUPATIONS = ['Student', 'Artist', 'Engineer', 'Doctor', 'Chef', 'Teacher', 'Musician', 'Athlete', 'Scientist', 'Entrepreneur', 'Writer', 'Designer', 'Pilot', 'Unemployed'];
const BODY_TYPES = ['slim', 'average', 'athletic', 'curvy', 'muscular'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (character: any) => void;
  objectives: string[];
  hobbies: string[];
}

const STAT_BUDGET = 350; // Total points across 6 stats (avg ~58)

export const CharacterCreatorModal: React.FC<Props> = ({ visible, onClose, onCreated, objectives, hobbies }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [skinColor, setSkinColor] = useState(SKIN_COLORS[1]);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[2]);
  const [eyeColor, setEyeColor] = useState(EYE_COLORS[2]);
  const [height, setHeight] = useState(170);
  const [bodyType, setBodyType] = useState('average');
  const [occupation, setOccupation] = useState('Student');
  const [stats, setStats] = useState({
    intelligence: 60, strength: 50, charisma: 60, beauty: 60, creativity: 60, luck: 60,
  });
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const statTotal = Object.values(stats).reduce((a, b) => a + b, 0);
  const remaining = STAT_BUDGET - statTotal;

  const adjustStat = (key: keyof typeof stats, delta: number) => {
    const newVal = Math.max(1, Math.min(100, stats[key] + delta));
    const newTotal = statTotal - stats[key] + newVal;
    if (delta > 0 && newTotal > STAT_BUDGET) return;
    setStats({ ...stats, [key]: newVal });
  };

  const toggleSelect = (arr: string[], setter: (a: string[]) => void, value: string, max: number) => {
    if (arr.includes(value)) setter(arr.filter(v => v !== value));
    else if (arr.length < max) setter([...arr, value]);
  };

  const reset = () => {
    setStep(1); setName(''); setAge(25); setGender('female');
    setSkinColor(SKIN_COLORS[1]); setHairColor(HAIR_COLORS[2]); setEyeColor(EYE_COLORS[2]);
    setHeight(170); setBodyType('average'); setOccupation('Student');
    setStats({ intelligence: 60, strength: 50, charisma: 60, beauty: 60, creativity: 60, luck: 60 });
    setSelectedObjectives([]); setSelectedHobbies([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a name'); return; }
    setCreating(true);
    try {
      const res = await axios.post(`${API_BASE}/api/characters/create`, {
        name: name.trim(), age, gender, occupation,
        skin_color: skinColor, hair_color: hairColor, eye_color: eyeColor,
        height, body_type: bodyType,
        ...stats,
        extroversion: 60, kindness: 60, humor: 50, ambition: 60,
        objectives: selectedObjectives, hobbies: selectedHobbies,
      });
      onCreated(res.data);
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to create character');
    } finally { setCreating(false); }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <>
          <Text style={styles.stepTitle}>👤 Identity</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Luna" placeholderTextColor="#888" />
          <Text style={styles.fieldLabel}>Age: {age}</Text>
          <View style={styles.ageRow}>
            {[3, 8, 16, 22, 30, 45, 65].map(a => (
              <TouchableOpacity key={a} style={[styles.ageBtn, age === a && styles.ageBtnActive]} onPress={() => setAge(a)}>
                <Text style={styles.ageBtnText}>{a < 13 ? '👧' : a < 20 ? '🧒' : a < 60 ? '🧑' : '👵'} {a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.row}>
            {(['female', 'male', 'other'] as const).map(g => (
              <TouchableOpacity key={g} style={[styles.choiceBtn, gender === g && styles.choiceBtnActive]} onPress={() => setGender(g)}>
                <Text style={styles.choiceBtnText}>{g === 'female' ? '♀' : g === 'male' ? '♂' : '⚧'} {g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Occupation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {OCCUPATIONS.map(o => (
              <TouchableOpacity key={o} style={[styles.pillBtn, occupation === o && styles.pillBtnActive]} onPress={() => setOccupation(o)}>
                <Text style={styles.pillBtnText}>{o}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      );
      case 2: return (
        <>
          <Text style={styles.stepTitle}>🎨 Appearance</Text>
          <View style={[styles.previewBox, { backgroundColor: skinColor }]}>
            <View style={[styles.previewHair, { backgroundColor: hairColor }]} />
            <View style={styles.previewEyesRow}>
              <View style={[styles.previewEye, { backgroundColor: eyeColor }]} />
              <View style={[styles.previewEye, { backgroundColor: eyeColor }]} />
            </View>
            <Text style={styles.previewSmile}>‿</Text>
          </View>
          <Text style={styles.fieldLabel}>Skin Color</Text>
          <View style={styles.row}>
            {SKIN_COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.swatch, { backgroundColor: c }, skinColor === c && styles.swatchActive]} onPress={() => setSkinColor(c)} />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Hair Color</Text>
          <View style={styles.row}>
            {HAIR_COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.swatch, { backgroundColor: c }, hairColor === c && styles.swatchActive]} onPress={() => setHairColor(c)} />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Eye Color</Text>
          <View style={styles.row}>
            {EYE_COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.swatch, { backgroundColor: c }, eyeColor === c && styles.swatchActive]} onPress={() => setEyeColor(c)} />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Height: {height} cm</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => setHeight(Math.max(140, height - 5))}><Text style={styles.adjustBtnText}>-5</Text></TouchableOpacity>
            <View style={styles.heightBar}><View style={[styles.heightFill, { width: `${((height - 140) / 60) * 100}%` }]} /></View>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => setHeight(Math.min(200, height + 5))}><Text style={styles.adjustBtnText}>+5</Text></TouchableOpacity>
          </View>
          <Text style={styles.fieldLabel}>Body Type</Text>
          <View style={styles.row}>
            {BODY_TYPES.map(b => (
              <TouchableOpacity key={b} style={[styles.choiceBtn, bodyType === b && styles.choiceBtnActive]} onPress={() => setBodyType(b)}>
                <Text style={styles.choiceBtnText}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      );
      case 3: return (
        <>
          <Text style={styles.stepTitle}>⭐ Attributes</Text>
          <Text style={[styles.budgetText, { color: remaining < 0 ? '#F44' : remaining < 20 ? '#FA0' : '#4C5' }]}>
            Points remaining: {remaining} / {STAT_BUDGET}
          </Text>
          {Object.entries(stats).map(([key, value]) => {
            const icons: any = { intelligence: '🧠', strength: '💪', charisma: '🗣️', beauty: '✨', creativity: '🎨', luck: '🍀' };
            return (
              <View key={key} style={styles.statRow}>
                <Text style={styles.statIcon}>{icons[key]}</Text>
                <Text style={styles.statLabel}>{key}</Text>
                <TouchableOpacity style={styles.statBtn} onPress={() => adjustStat(key as any, -5)}><Text style={styles.statBtnText}>-</Text></TouchableOpacity>
                <View style={styles.statBarBg}><View style={[styles.statBarFill, { width: `${value}%` }]} /></View>
                <TouchableOpacity style={styles.statBtn} onPress={() => adjustStat(key as any, 5)}><Text style={styles.statBtnText}>+</Text></TouchableOpacity>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            );
          })}
        </>
      );
      case 4: return (
        <>
          <Text style={styles.stepTitle}>🎯 Life Goals</Text>
          <Text style={styles.subHint}>Choose up to 3 objectives</Text>
          <View style={styles.tagWrap}>
            {objectives.map(o => (
              <TouchableOpacity key={o} style={[styles.tag, selectedObjectives.includes(o) && styles.tagActive]} onPress={() => toggleSelect(selectedObjectives, setSelectedObjectives, o, 3)}>
                <Text style={styles.tagText}>{o.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.stepTitle, { marginTop: 20 }]}>🎮 Hobbies</Text>
          <Text style={styles.subHint}>Choose up to 4 hobbies</Text>
          <View style={styles.tagWrap}>
            {hobbies.map(h => (
              <TouchableOpacity key={h} style={[styles.tag, selectedHobbies.includes(h) && styles.tagActive]} onPress={() => toggleSelect(selectedHobbies, setSelectedHobbies, h, 4)}>
                <Text style={styles.tagText}>{h}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>✨ Create Character ({step}/4)</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color="#FFF" /></TouchableOpacity>
          </View>
          <View style={styles.stepperBar}>
            {[1, 2, 3, 4].map(s => (
              <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive]} />
            ))}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            {renderStep()}
          </ScrollView>
          <View style={styles.footer}>
            {step > 1 && (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
                <Ionicons name="chevron-back" size={20} color="#FFF" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 4 ? (
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.createBtn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating}>
                <Text style={styles.createBtnText}>{creating ? 'Creating...' : '✨ Create'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  stepperBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  stepDot: { width: 30, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  stepDotActive: { backgroundColor: '#00D4FF' },
  scroll: { flex: 1 },
  stepTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  fieldLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFF', padding: 12, borderRadius: 10, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ageBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
  ageBtnActive: { backgroundColor: '#00D4FF' },
  ageBtnText: { color: '#FFF', fontSize: 12 },
  choiceBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
  choiceBtnActive: { backgroundColor: '#00D4FF' },
  choiceBtnText: { color: '#FFF', fontSize: 12, textTransform: 'capitalize' },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, marginRight: 8 },
  pillBtnActive: { backgroundColor: '#00D4FF' },
  pillBtnText: { color: '#FFF', fontSize: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#00D4FF', transform: [{ scale: 1.1 }] },
  previewBox: { width: 80, height: 80, alignSelf: 'center', borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', marginBottom: 8 },
  previewHair: { position: 'absolute', top: -2, width: 70, height: 30, borderTopLeftRadius: 35, borderTopRightRadius: 35 },
  previewEyesRow: { flexDirection: 'row', gap: 14, marginTop: 18 },
  previewEye: { width: 7, height: 9, borderRadius: 4 },
  previewSmile: { color: '#000', fontSize: 18, marginTop: -2 },
  heightBar: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginHorizontal: 8 },
  heightFill: { height: '100%', backgroundColor: '#00D4FF', borderRadius: 4 },
  adjustBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  adjustBtnText: { color: '#FFF', fontWeight: '700' },
  budgetText: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginBottom: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  statIcon: { fontSize: 20 },
  statLabel: { color: '#FFF', fontSize: 12, width: 84, textTransform: 'capitalize' },
  statBtn: { backgroundColor: 'rgba(255,255,255,0.15)', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  statBtnText: { color: '#FFF', fontWeight: '700' },
  statBarBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4 },
  statBarFill: { height: '100%', backgroundColor: '#00D4FF', borderRadius: 4 },
  statValue: { color: '#FFF', fontSize: 12, width: 28, textAlign: 'right' },
  subHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 10 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 },
  tagActive: { backgroundColor: '#00D4FF' },
  tagText: { color: '#FFF', fontSize: 12, textTransform: 'capitalize' },
  footer: { flexDirection: 'row', padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  backBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, gap: 4 },
  backBtnText: { color: '#FFF', fontWeight: '700' },
  nextBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00D4FF', padding: 12, borderRadius: 12, gap: 4 },
  nextBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  createBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', padding: 14, borderRadius: 12 },
  createBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
