/**
 * Game panels.
 *
 * Each panel answers a question the player actually has: what is the world's
 * state, what is each resident doing and why, what can I change, and what
 * changed because of me.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  elevation,
  layout,
  lucidityColor,
  meterColor,
  palette,
  radius,
  space,
  stabilityColor,
  type as typeTokens,
} from '../theme';
import { useI18n } from '../game/i18n';
import type {
  ChronicleEntry,
  CycleReport,
  Dilemma,
  GameState,
  Intervention,
  LocationView,
  Resident,
  Signature,
} from '../game/types';
import { glyph } from '../game/icons';
import { Icon } from './Icon';
import { ResidentPortrait, ResidentSprite } from './ResidentSprite';
import {
  ActionButton,
  BodyText,
  DeltaChip,
  DotRing,
  IconButton,
  Meter,
  Panel,
  Tag,
  Row,
  SectionTitle,
  StatBlock,
  usePrefs,
} from './ui';

const NEED_ORDER = ['hunger', 'energy', 'social', 'fun', 'hygiene', 'comfort', 'bladder'];

/**
 * Read one need from the payload.
 *
 * The interface iterates over ordered string keys while the API types the map
 * as a union, so the narrowing lives here instead of being cast at each call.
 */
function needValue(
  needs: Resident['needs'] | undefined,
  key: string,
  fallback = 100,
): number {
  if (!needs) return fallback;
  return needs[key as keyof Resident['needs']] ?? fallback;
}

const NEED_LABELS: Record<string, { fr: string; en: string }> = {
  hunger: { fr: 'Faim', en: 'Hunger' },
  energy: { fr: 'Énergie', en: 'Energy' },
  social: { fr: 'Social', en: 'Social' },
  hygiene: { fr: 'Hygiène', en: 'Hygiene' },
  fun: { fr: 'Divertissement', en: 'Fun' },
  bladder: { fr: 'Vessie', en: 'Bladder' },
  comfort: { fr: 'Confort', en: 'Comfort' },
};

const PERSONALITY_LABELS: Record<string, { fr: string; en: string }> = {
  extroversion: { fr: 'Extraversion', en: 'Extroversion' },
  kindness: { fr: 'Bienveillance', en: 'Kindness' },
  humor: { fr: 'Humour', en: 'Humour' },
  ambition: { fr: 'Ambition', en: 'Ambition' },
  curiosity: { fr: 'Curiosité', en: 'Curiosity' },
};

/* ------------------------------------------------------------------ *
 * Resources
 * ------------------------------------------------------------------ */

export function ResourceBar({ state }: { state: GameState }) {
  const { t } = useI18n();
  const { contrast } = usePrefs();
  const stability = Math.round(state.stability);
  const lucidity = Math.round(state.lucidity);
  return (
    <Panel style={styles.resourcePanel} tone={palette.accent}>
      <Row style={styles.resourceRow} gap={space.md}>
        <StatBlock
          label={t('stat.flux')}
          hint={t('stat.flux.hint')}
          icon={glyph('flux')}
          value={`${Math.round(state.flux)}`}
          color={palette.flux}
          progress={(state.flux / state.flux_cap) * 100}
        />
        <StatBlock
          label={t('stat.stability')}
          hint={t('stat.stability.hint')}
          icon={glyph('stability')}
          value={`${stability}`}
          color={stabilityColor(state.stability)}
          progress={state.stability}
        />
        <StatBlock
          label={t('stat.lucidity')}
          hint={t('stat.lucidity.hint')}
          icon={glyph('lucidity')}
          value={`${lucidity}`}
          color={lucidityColor(state.lucidity)}
          progress={state.lucidity}
        />
        <StatBlock
          label={t('stat.signatures')}
          hint={t('stat.signatures.hint')}
          icon={glyph('signature')}
          value={`${state.signatures.length}/${state.signature_catalog.length}`}
          color={palette.accent}
          progress={(state.signatures.length / Math.max(1, state.signature_catalog.length)) * 100}
        />
      </Row>
      {contrast ? null : (
        <Text style={styles.resourceFoot}>
          {t('common.chapter')} {state.chapter} ·{' '}
          {Math.max(0, state.max_cycles - state.cycle + 1)} {t('cycle.untilEnd')}
        </Text>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Cycle control
 * ------------------------------------------------------------------ */

export function CycleControl({
  state,
  busy,
  onAdvance,
  onTogglePause,
  paused,
}: {
  state: GameState;
  busy: boolean;
  onAdvance: () => void;
  onTogglePause: () => void;
  /** Optional override; the backend flag on `state.paused` is the source of truth. */
  paused?: boolean;
}) {
  const { t } = useI18n();
  const remaining = Math.max(0, state.max_cycles - state.cycle + 1);
  const finished = Boolean(state.ending);
  // A paused iteration genuinely refuses cycles (HTTP 409), so the button that
  // would trigger one is disabled instead of failing after the click.
  const frozen = Boolean(state.paused) || Boolean(paused);
  return (
    <Panel style={styles.cyclePanel}>
      <Row justify="space-between" align="center" style={styles.cycleTop}>
        <View>
          <Text style={styles.cycleLabel}>
            {t('common.cycle')} {state.cycle} / {state.max_cycles}
          </Text>
          <Text style={styles.cycleChapter}>
            {t('common.chapter')} {state.chapter}
          </Text>
        </View>
        <Tag
          label={finished ? t('toast.ending') : `${remaining} ${t('cycle.untilEnd')}`}
          color={finished ? palette.rose : palette.inkSoft}
          icon={finished ? 'flag-outline' : 'hourglass-outline'}
        />
      </Row>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(100, ((state.cycle - 1) / Math.max(1, state.max_cycles)) * 100)}%`,
            },
          ]}
        />
      </View>

      <Row gap={space.sm} style={styles.cycleActions}>
        <ActionButton
          label={busy ? t('cycle.advancing') : t('cycle.advance')}
          icon="play-forward"
          onPress={onAdvance}
          busy={busy}
          disabled={finished || frozen}
          style={styles.grow}
          accessibilityHint={t('deck.subtitle')}
        />
        <ActionButton
          label={frozen ? t('cycle.resume') : t('cycle.pause')}
          icon={frozen ? 'play' : 'pause'}
          variant="secondary"
          onPress={onTogglePause}
        />
      </Row>
      {frozen ? <Text style={styles.pausedNote}>{t('cycle.paused')}</Text> : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Resident card & sheet
 * ------------------------------------------------------------------ */

export function ResidentCard({
  resident,
  location,
  selected,
  onPress,
}: {
  resident: Resident;
  location?: LocationView;
  selected?: boolean;
  onPress: () => void;
}) {
  const { lt, lang } = useI18n();
  const lowest = useMemo(() => {
    return NEED_ORDER.map((key) => ({ key, value: needValue(resident.needs, key) })).sort(
      (a, b) => a.value - b.value,
    )[0];
  }, [resident.needs]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${resident.name}, ${lt(resident.occupation)}, ${lt(resident.current_action?.label)}. ${
        (NEED_LABELS[lowest?.key ?? '']?.[lang] ?? '') + ' ' + Math.round(lowest?.value ?? 0)
      }`}
      accessibilityHint={lt(resident.thought)}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.residentCard,
        selected && styles.residentCardSelected,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.residentCardAvatar}>
        <ResidentPortrait resident={resident} size={74} />
      </View>
      <View style={styles.residentCardBody}>
        <Row justify="space-between" align="center">
          <Text style={styles.residentName} numberOfLines={1}>
            {resident.name}
          </Text>
          <Tag label={lt(resident.mood_label)} icon={glyph(resident.mood_icon)} color={resident.mood_color} compact />
        </Row>
        <Text style={styles.residentMeta} numberOfLines={1}>
          {lt(resident.occupation)} · {resident.age} · {resident.city}
        </Text>
        <Row gap={6} align="center" style={styles.residentActionRow}>
          <Icon name={glyph(resident.current_action?.icon)} size={13} color={palette.accent} />
          <Text style={styles.residentAction} numberOfLines={1}>
            {lt(resident.current_action?.label)}
          </Text>
        </Row>
        <Row gap={6} align="center" style={styles.residentFooter}>
          <Ionicons name="location-outline" size={12} color={palette.inkMuted} />
          <Text style={styles.residentLocation} numberOfLines={1}>
            {location ? location.name : resident.location_id}
          </Text>
          <View style={styles.spacer} />
          <Icon name={glyph(lowest?.key)} size={12} color={palette.inkMuted} />
          <Text style={styles.residentNeeds}>{Math.round(lowest?.value ?? 0)}</Text>
        </Row>
      </View>
    </Pressable>
  );
}

export function ResidentSheet({
  resident,
  state,
  locations,
  visible,
  onClose,
  onInterveneOption,
}: {
  resident: Resident | null;
  state: GameState | null;
  locations: LocationView[];
  visible: boolean;
  onClose: () => void;
  onInterveneOption?: (resident: Resident) => void;
}) {
  const { t, lt, lang } = useI18n();
  if (!resident) return null;
  const location = locations.find((entry) => entry.id === resident.location_id);
  const relations = (state?.relationships ?? [])
    .filter((relation) => relation.a === resident.id || relation.b === resident.id)
    .map((relation) => {
      const otherId = relation.a === resident.id ? relation.b : relation.a;
      const other = state?.residents.find((entry) => entry.id === otherId);
      return { ...relation, name: other?.name ?? otherId };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Row gap={space.md} align="center" style={styles.grow}>
              <ResidentPortrait resident={resident} size={132} />
              <View style={styles.sheetHeaderText}>
                <Text style={styles.sheetName}>{resident.name}</Text>
                <Text style={styles.sheetMeta}>
                  {lt(resident.occupation)} · {resident.age}
                </Text>
                <Row gap={6} style={{ marginTop: 4 }}>
                  <Tag label={lt(resident.mood_label)} icon={glyph(resident.mood_icon)} color={resident.mood_color} compact />
                  <Tag
                    label={`${t('roster.lucidity')} ${Math.round(resident.lucidity)}`}
                    color={lucidityColor(resident.lucidity)}
                    compact
                  />
                </Row>
              </View>
            </Row>
            <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <BodyText style={styles.sheetBio}>{lt(resident.bio)}</BodyText>
            {resident.quote?.fr ? (
              <Text style={styles.sheetQuote}>« {lt(resident.quote)} »</Text>
            ) : null}

            <View style={styles.sheetChips}>
              <Tag label={location ? location.name : resident.location_id} color={palette.accent} icon={glyph('location')} />
              <Tag
                label={lt(resident.current_action?.label)}
                color={palette.amber}
                icon={glyph(resident.current_action?.icon)}
              />
              <Tag label={`${t('roster.money')} ${Math.round(resident.money)}`} color={palette.lime} icon={glyph('money')} />
            </View>

            <View style={styles.thoughtBlock}>
              <Text style={styles.thoughtLabel}>{t('roster.thought')}</Text>
              <Text style={styles.thoughtText}>“{lt(resident.thought)}”</Text>
            </View>

            <SectionTitle title={t('roster.needs')} subtitle={`${t('roster.needsAverage')} ${Math.round(resident.needs_average)}`} />
            <View style={styles.needsGrid}>
              {NEED_ORDER.map((key) => (
                <View key={key} style={styles.needCell}>
                  <Meter
                    label={NEED_LABELS[key]?.[lang] ?? key}
                    icon={glyph(key)}
                    value={needValue(resident.needs, key, 0)}
                    color={meterColor(needValue(resident.needs, key, 0))}
                  />
                </View>
              ))}
            </View>

            <SectionTitle title={t('roster.goals')} />
            {(resident.goals ?? []).map((goal) => (
              <View key={goal.id} style={styles.goalRow}>
                <DotRing
                  progress={goal.progress}
                  color={goal.complete ? palette.lime : palette.accent}
                  label={lt(goal.label)}
                  complete={goal.complete}
                />
                <View style={styles.goalBody}>
                  <Row justify="space-between" align="center">
                    <Text style={styles.goalLabel}>{lt(goal.label)}</Text>
                    {goal.complete ? <Tag label={t('roster.complete')} color={palette.lime} compact /> : null}
                  </Row>
                  {goal.milestones.map((milestone, index) => (
                    <Row key={index} gap={6} align="center" style={styles.milestoneRow}>
                      <Ionicons
                        name={goal.milestone_state?.[index] ? 'checkmark-circle' : 'ellipse-outline'}
                        size={13}
                        color={goal.milestone_state?.[index] ? palette.green : palette.inkMuted}
                      />
                      <Text
                        style={[
                          styles.milestoneText,
                          goal.milestone_state?.[index] && { color: palette.inkSoft },
                        ]}
                        numberOfLines={1}
                      >
                        {lt(milestone)}
                      </Text>
                    </Row>
                  ))}
                </View>
              </View>
            ))}

            <SectionTitle title={t('roster.relations')} />
            {relations.length === 0 ? (
              <BodyText muted>{t('roster.noRelations')}</BodyText>
            ) : (
              relations.map((relation) => (
                <View key={relation.key} style={styles.relationRow}>
                  <Text style={styles.relationName} numberOfLines={1}>
                    {relation.name}
                  </Text>
                  <View style={styles.relationTrack}>
                    <View style={[styles.relationFill, { width: `${relation.value}%` }]} />
                  </View>
                  <Text style={styles.relationLabel}>{lt(relation.label)}</Text>
                </View>
              ))
            )}

            <SectionTitle title={t('roster.memory')} />
            {(resident.memory ?? [])
              .slice(-5)
              .reverse()
              .map((entry, index) => (
                <Row key={index} gap={space.sm} align="flex-start" style={styles.memoryRow}>
                  <Icon name={glyph(entry.icon)} size={13} color={palette.inkMuted} />
                  <View style={styles.grow}>
                    <Text style={styles.memoryText}>{lt(entry.text)}</Text>
                    <Text style={styles.memoryCycle}>
                      {t('common.cycle')} {entry.cycle}
                    </Text>
                  </View>
                </Row>
              ))}

            <SectionTitle title={t('roster.attributes')} />
            <Row wrap gap={space.sm}>
              {Object.entries(resident.attributes ?? {}).map(([key, value]) => (
                <View key={key} style={styles.attributeChip}>
                  <Icon name={glyph(key)} size={14} color={palette.inkSoft} />
                  <Text style={styles.attributeValue}>{Math.round(value)}</Text>
                  <Text style={styles.attributeLabel}>{t(`attribute.${key}`)}</Text>
                </View>
              ))}
            </Row>

            <SectionTitle title={t('roster.personality')} />
            {Object.entries(resident.personality ?? {}).map(([key, value]) => (
              <Meter
                key={key}
                label={PERSONALITY_LABELS[key]?.[lang] ?? key}
                value={value}
                color={palette.steel}
              />
            ))}

            {resident.hobbies?.length ? (
              <>
                <SectionTitle title={t('roster.hobbies')} />
                <Row wrap gap={6}>
                  {resident.hobbies.map((hobby) => (
                    <Tag key={hobby} label={hobby} color={palette.steel} compact />
                  ))}
                </Row>
              </>
            ) : null}

            <View style={{ height: space.xl }} />
          </ScrollView>

          {onInterveneOption ? (
            <View style={styles.sheetFooter}>
              <ActionButton
                label={t('roster.target')}
                icon="locate-outline"
                variant="secondary"
                onPress={() => onInterveneOption(resident)}
              />
              <ActionButton label={t('common.close')} variant="ghost" onPress={onClose} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Intervention deck
 * ------------------------------------------------------------------ */

export function InterventionDeck({
  state,
  busy,
  onApply,
  preselectedResidentId,
  clearPreselection,
}: {
  state: GameState;
  busy: boolean;
  onApply: (id: string, targetId?: string | null, secondId?: string | null) => void;
  preselectedResidentId?: string | null;
  clearPreselection?: () => void;
}) {
  const { t, lt } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const [first, setFirst] = useState<string | null>(preselectedResidentId ?? null);
  const [second, setSecond] = useState<string | null>(null);

  React.useEffect(() => {
    if (preselectedResidentId) {
      setFirst(preselectedResidentId);
      setOpenId(null);
    }
  }, [preselectedResidentId]);

  const open = state.interventions.find((item) => item.id === openId) ?? null;
  const residents = state.residents;

  const apply = (item: Intervention) => {
    if (item.target === 'world') {
      onApply(item.id, null, null);
      setOpenId(null);
      clearPreselection?.();
      return;
    }
    if (!first) return;
    onApply(item.id, first, item.target === 'pair' ? second : null);
    setOpenId(null);
    setSecond(null);
    clearPreselection?.();
  };

  return (
    <Panel>
      <SectionTitle
        title={t('deck.title')}
        subtitle={t('deck.subtitle')}
        icon="flash-outline"
        right={<Tag label={`${Math.round(state.flux)}`} icon={glyph('flux')} color={palette.flux} compact />}
      />

      {preselectedResidentId ? (
        <View style={styles.targetBanner}>
          <Ionicons name="person" size={13} color={palette.accent} />
          <Text style={styles.targetBannerText}>
            {residents.find((resident) => resident.id === preselectedResidentId)?.name ?? ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={() => {
              setFirst(null);
              clearPreselection?.();
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={palette.inkMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.deckGrid}>
        {state.interventions.map((item) => {
          const reason = !item.unlocked
            ? t('deck.lockedHint', { n: item.chapter_min })
            : !item.affordable
              ? t('deck.noFlux')
              : item.description
                ? lt(item.description)
                : '';
          const disabled = !item.unlocked || !item.affordable || busy;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${lt(item.label)}. ${reason}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => {
                setOpenId(item.id);
                if (item.target === 'world') apply(item);
              }}
              style={({ pressed }) => [
                styles.deckCard,
                disabled && styles.deckCardDisabled,
                openId === item.id && styles.deckCardOpen,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Row justify="space-between" align="center">
                <Icon name={glyph(item.icon)} size={18} color={palette.ink} />
                <Tag
                  label={`${item.cost}`}
                  icon={glyph('flux')}
                  color={item.affordable ? palette.flux : palette.inkMuted}
                  compact
                />
              </Row>
              <Text style={styles.deckLabel} numberOfLines={2}>
                {lt(item.label)}
              </Text>
              {!item.unlocked ? (
                <Row gap={4} align="center">
                  <Ionicons name="lock-closed" size={10} color={palette.inkMuted} />
                  <Text style={styles.deckLock}>{t('deck.lockedHint', { n: item.chapter_min })}</Text>
                </Row>
              ) : (
                <Text style={styles.deckDescription} numberOfLines={3}>
                  {lt(item.description)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {open && open.target !== 'world' ? (
        <View style={styles.targetPicker}>
          <Text style={styles.targetPickerTitle}>
            {open.target === 'pair' ? t('deck.pickSecond') : t('deck.pickTarget')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetRow}>
            {residents.map((resident) => {
              const active = open.target === 'pair' ? second === resident.id : first === resident.id;
              return (
                <Pressable
                  key={resident.id}
                  accessibilityRole="button"
                  accessibilityLabel={resident.name}
                  accessibilityState={{ selected: active }}
                  onPress={() => (open.target === 'pair' ? setSecond(resident.id) : setFirst(resident.id))}
                  style={[styles.targetChip, active && styles.targetChipActive]}
                >
                  <ResidentSprite resident={resident} scale={0.36} showName={false} />
                  <Text style={styles.targetChipText} numberOfLines={1}>
                    {resident.name.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <ActionButton
              label={t('deck.apply')}
              icon="checkmark"
              variant="success"
              onPress={() => apply(open)}
              disabled={open.target === 'pair' ? !first || !second || first === second : !first}
              busy={busy}
              style={styles.grow}
            />
            <ActionButton label={t('common.cancel')} variant="ghost" onPress={() => setOpenId(null)} />
          </Row>
        </View>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Dilemma
 * ------------------------------------------------------------------ */

export function DilemmaCard({
  dilemma,
  busy,
  onChoose,
}: {
  dilemma: Dilemma | null;
  busy: boolean;
  onChoose: (dilemmaId: string, choiceId: string) => void;
}) {
  const { t, lt } = useI18n();
  if (!dilemma) {
    return (
      <Panel>
        <SectionTitle title={t('dilemma.title')} icon="git-branch" />
        <BodyText muted>{t('dilemma.none')}</BodyText>
      </Panel>
    );
  }
  return (
    <Panel tone={palette.amber}>
      <SectionTitle
        title={t('dilemma.title')}
        subtitle={t('dilemma.subtitle')}
        icon="git-branch"
        right={<Tag label={`${t('common.cycle')} ${dilemma.cycle ?? 1}`} color={palette.amber} compact />}
      />
      <Text style={styles.dilemmaPrompt}>{lt(dilemma.prompt)}</Text>
      <View style={styles.choiceList}>
        {dilemma.choices.map((choice) => (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            accessibilityLabel={`${lt(choice.label)}. ${lt(choice.hint)}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => onChoose(dilemma.id, choice.id)}
            style={({ pressed }) => [styles.choiceCard, pressed && { opacity: 0.88 }]}
          >
            <View style={styles.choiceHead}>
              <Ionicons name="chevron-forward" size={14} color={palette.amber} />
              <Text style={styles.choiceLabel}>{lt(choice.label)}</Text>
            </View>
            <Text style={styles.choiceHint}>{lt(choice.hint)}</Text>
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Chronicle
 * ------------------------------------------------------------------ */

const CHRONICLE_FILTERS: Record<string, string[]> = {
  lives: ['action', 'milestone', 'goal', 'newcomer'],
  world: ['event', 'anomaly', 'ending'],
  player: ['intervention', 'decision', 'signature'],
};

export function Chronicle({
  entries,
  onSelectResident,
}: {
  entries: ChronicleEntry[];
  onSelectResident?: (residentId: string) => void;
}) {
  const { t, lt } = useI18n();
  const [filter, setFilter] = useState<'all' | 'lives' | 'world' | 'player'>('all');

  const visible = useMemo(
    () =>
      filter === 'all'
        ? entries
        : entries.filter((entry) => (CHRONICLE_FILTERS[filter] ?? []).includes(entry.kind)),
    [entries, filter],
  );

  return (
    <Panel>
      <SectionTitle title={t('chronicle.title')} subtitle={t('chronicle.subtitle')} icon="time-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
        <Row gap={6}>
          {(['all', 'lives', 'world', 'player'] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t(`chronicle.filter.${key}`)}
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filter === key && styles.filterChipTextActive]}>
                {t(`chronicle.filter.${key}`)}
              </Text>
            </Pressable>
          ))}
        </Row>
      </ScrollView>

      {visible.length === 0 ? (
        <BodyText muted>{t('chronicle.empty')}</BodyText>
      ) : (
        visible.slice(0, 26).map((entry, index) => {
          const pressable = Boolean(onSelectResident && entry.residents?.length);
          return (
            <Pressable
              key={entry.id ?? index}
              accessibilityRole={pressable ? 'button' : 'text'}
              accessibilityLabel={lt(entry.text)}
              disabled={!pressable}
              onPress={() => entry.residents?.[0] && onSelectResident?.(entry.residents[0])}
              style={styles.chronicleRow}
            >
              <Icon name={glyph(entry.icon)} size={13} color={palette.inkMuted} />
              <View style={styles.grow}>
                <Text style={styles.chronicleText}>{lt(entry.text)}</Text>
                <Text style={styles.chronicleMeta}>
                  {t('common.cycle')} {entry.cycle}
                  {entry.resident_name ? ` · ${entry.resident_name}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Signatures
 * ------------------------------------------------------------------ */

export function SignatureStrip({ state }: { state: GameState }) {
  const { t, lt } = useI18n();
  const earned = new Set(state.signatures.map((entry) => entry.id));
  return (
    <Panel>
      <SectionTitle
        title={t('signatures.title')}
        subtitle={t('signatures.subtitle', {
          got: state.signatures.length,
          total: state.signature_catalog.length,
        })}
        icon="ribbon-outline"
      />
      <Row wrap gap={space.sm}>
        {state.signature_catalog.map((signature: Signature) => {
          const unlocked = earned.has(signature.id);
          return (
            <View
              key={signature.id}
              accessible
              accessibilityLabel={`${lt(signature.label)}. ${unlocked ? lt(signature.hint) : t('common.locked')}`}
              style={[styles.signatureChip, unlocked && styles.signatureChipUnlocked]}
            >
              <Icon
                name={unlocked ? glyph(signature.icon) : 'lock-closed-outline'}
                size={17}
                color={unlocked ? palette.lime : palette.inkMuted}
                style={!unlocked && styles.lockedGlyph}
              />
              <View style={styles.grow}>
                <Text style={[styles.signatureLabel, !unlocked && { color: palette.inkMuted }]}>
                  {lt(signature.label)}
                </Text>
                <Text style={styles.signatureHint} numberOfLines={2}>
                  {lt(signature.hint)}
                </Text>
              </View>
            </View>
          );
        })}
      </Row>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Cycle report
 * ------------------------------------------------------------------ */

export function CycleReportSheet({
  report,
  onClose,
}: {
  report: CycleReport | null;
  onClose: () => void;
}) {
  const { t, lt } = useI18n();
  if (!report) return null;

  return (
    <Modal visible animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.grow}>
              <Text style={styles.sheetName} accessibilityRole="header" accessibilityLiveRegion="polite">
                {t('report.title', { n: report.cycle })}
              </Text>
              <Text style={styles.sheetMeta}>{lt(report.chapter_label)}</Text>
            </View>
            <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <SectionTitle title={t('report.world')} />
            <Row wrap gap={space.sm} style={{ marginBottom: space.md }}>
              <CompactDelta
                label={t('stat.flux')}
                color={palette.flux}
                delta={report.world.flux_after - report.world.flux_before}
                value={Math.round(report.world.flux_after)}
              />
              <CompactDelta
                label={t('stat.stability')}
                color={palette.green}
                delta={report.world.stability_delta}
                value={Math.round(report.world.stability_after)}
              />
              <CompactDelta
                label={t('stat.lucidity')}
                color={palette.steel}
                delta={report.world.lucidity_delta}
                value={Math.round(report.world.lucidity_after)}
              />
            </Row>

            {report.highlights.length ? (
              <>
                <SectionTitle title={t('report.highlights')} />
                {report.highlights.map((highlight, index) => (
                  <Row key={index} gap={space.sm} align="flex-start" style={styles.highlightRow}>
                    <Icon
                      name={glyph(
                        highlight.kind === 'event'
                          ? 'world'
                          : highlight.kind === 'bond'
                            ? 'bond'
                            : highlight.kind === 'anomaly'
                              ? 'anomaly'
                              : 'goal',
                      )}
                      size={13}
                      color={palette.inkMuted}
                    />
                    <Text style={styles.highlightText}>{lt(highlight.text)}</Text>
                  </Row>
                ))}
              </>
            ) : (
              <BodyText muted>{t('report.noHighlights')}</BodyText>
            )}

            <SectionTitle title={t('report.lives')} />
            {report.residents.map((entry) => (
              <View key={entry.id} style={styles.reportRow}>
                <Row justify="space-between" align="center">
                  <Text style={styles.reportName}>{entry.name}</Text>
                  <Tag label={lt(entry.mood_label)} color={palette.inkSoft} compact />
                </Row>
                <Row gap={6} align="center" style={{ marginTop: 3 }}>
                  <Icon name={glyph(entry.action.icon)} size={13} color={palette.accent} />
                  <Text style={styles.reportAction}>{lt(entry.action.label)}</Text>
                </Row>
                <Text style={styles.reportThought}>“{lt(entry.thought)}”</Text>
                <Text style={styles.reportReason}>
                  {t('report.reason')}: {lt(entry.reason)}
                </Text>
                <Row wrap gap={4} style={{ marginTop: 5 }}>
                  {Object.entries(entry.needs_delta)
                    .filter(([, value]) => Math.abs(value) >= 1)
                    .slice(0, 5)
                    .map(([need, value]) => (
                      <View key={need} style={styles.needDeltaChip}>
                        <Icon name={glyph(need)} size={11} color={palette.inkMuted} />
                        <Text
                          style={[
                            styles.needDeltaText,
                            { color: value > 0 ? palette.good : palette.over },
                          ]}
                        >
                          {value > 0 ? '+' : ''}
                          {Math.round(value)}
                        </Text>
                      </View>
                    ))}
                  {entry.money_delta ? (
                    <View style={styles.needDeltaChip}>
                      <Icon name={glyph('money')} size={11} color={palette.inkMuted} />
                      <Text
                        style={[
                          styles.needDeltaText,
                          { color: entry.money_delta > 0 ? palette.good : palette.over },
                        ]}
                      >
                        {entry.money_delta > 0 ? '+' : ''}
                        {Math.round(entry.money_delta)}
                      </Text>
                    </View>
                  ) : null}
                </Row>
              </View>
            ))}

            {report.relationships.length ? (
              <>
                <SectionTitle title={t('report.network')} />
                {report.relationships.map((relation) => (
                  <Row key={relation.key} gap={space.sm} align="center" style={styles.relationRow}>
                    <Row gap={5} align="center">
                      <Text style={styles.relationLabel2}>{relation.a.replace('res_', '')}</Text>
                      <Ionicons name="swap-horizontal" size={12} color={palette.inkMuted} />
                      <Text style={styles.relationLabel2}>{relation.b.replace('res_', '')}</Text>
                    </Row>
                    <View style={styles.grow} />
                    <DeltaChip delta={relation.delta} />
                  </Row>
                ))}
              </>
            ) : null}

            <View style={{ height: space.lg }} />
          </ScrollView>

          <View style={styles.sheetFooter}>
            <ActionButton label={t('report.continue')} icon="arrow-forward" onPress={onClose} style={styles.grow} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CompactDelta({
  label,
  color,
  delta,
  value,
}: {
  label: string;
  color: string;
  delta: number;
  value: number;
}) {
  return (
    <View style={[styles.compactDelta, { borderColor: `${color}44` }]}>
      <Text style={styles.compactDeltaLabel}>{label}</Text>
      <Text style={[styles.compactDeltaValue, { color }]}>{value}</Text>
      <DeltaChip delta={delta} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Toasts
 * ------------------------------------------------------------------ */

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: number; message: string; tone: 'info' | 'good' | 'bad' }[];
  onDismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;
  return (
    <View style={[styles.toastWrap, { pointerEvents: 'box-none' }]}>
      {toasts.map((toast) => {
        const color =
          toast.tone === 'good' ? palette.green : toast.tone === 'bad' ? palette.rose : palette.accent;
        return (
          <Pressable
            key={toast.id}
            accessibilityRole="button"
            accessibilityLabel={toast.message}
            accessibilityLiveRegion="polite"
            onPress={() => onDismiss(toast.id)}
            style={[styles.toast, { borderColor: `${color}66`, backgroundColor: `${color}1F` }]}
          >
            <Ionicons
              name={toast.tone === 'good' ? 'checkmark-circle' : toast.tone === 'bad' ? 'alert-circle' : 'information-circle'}
              size={15}
              color={color}
            />
            <Text style={styles.toastText} numberOfLines={2}>
              {toast.message}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Offline state
 * ------------------------------------------------------------------ */

export function OfflineNotice({
  url,
  message,
  onRetry,
}: {
  url: string;
  message?: string | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <Panel tone={palette.danger}>
      <SectionTitle title={t('offline.title')} icon="cloud-offline-outline" />
      <BodyText>
        {message ? `${message}\n\n` : ''}
        {t('offline.body', { url })}
      </BodyText>
      <Text style={styles.offlineHint}>{t('offline.hint')}</Text>
      <Row gap={space.sm} style={{ marginTop: space.md }}>
        <ActionButton label={t('common.retry')} icon="refresh" onPress={onRetry} />
      </Row>
    </Panel>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  spacer: { flex: 1 },
  lockedGlyph: { opacity: 0.32 },

  resourcePanel: { marginBottom: space.md },
  resourceRow: { justifyContent: 'space-between' },
  resourceFoot: { ...typeTokens.micro, color: palette.inkMuted, marginTop: space.sm },

  cyclePanel: { marginBottom: space.md },
  cycleTop: { marginBottom: space.sm },
  cycleLabel: { ...typeTokens.display, color: palette.ink },
  cycleChapter: { ...typeTokens.caption, color: palette.inkMuted },
  progressTrack: {
    height: 6,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: palette.accent, borderRadius: radius.xs },
  cycleActions: { marginTop: space.md },
  pausedNote: { ...typeTokens.caption, color: palette.amber, marginTop: space.sm },

  residentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    marginBottom: space.sm,
  },
  residentCardSelected: { borderColor: palette.accent, backgroundColor: 'rgba(78,157,180,0.10)' },
  residentCardAvatar: { width: 66, height: 76, justifyContent: 'flex-start', alignItems: 'center' },
  residentCardBody: { flex: 1, minWidth: 0 },
  residentName: { ...typeTokens.title, color: palette.ink, flexShrink: 1 },
  residentMeta: { ...typeTokens.caption, color: palette.inkMuted, marginTop: 1 },
  residentActionRow: { marginTop: 3 },
  residentActionIcon: { fontSize: 12 },
  residentAction: { ...typeTokens.caption, color: palette.accent, fontWeight: '600', flexShrink: 1 },
  residentFooter: { marginTop: 4 },
  residentLocation: { ...typeTokens.caption, color: palette.inkMuted, flexShrink: 1 },
  residentNeeds: { ...typeTokens.micro, color: palette.inkSoft, letterSpacing: 0.4 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(8,10,13,0.86)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0C1029',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderBottomWidth: 1, borderBottomColor: palette.border },
  sheetHeaderText: { flex: 1, minWidth: 0 },
  sheetName: { ...typeTokens.display, color: palette.ink },
  sheetMeta: { ...typeTokens.caption, color: palette.inkMuted },
  sheetBody: { paddingHorizontal: space.md, paddingTop: space.md },
  sheetBio: { marginBottom: space.sm },
  sheetQuote: { ...typeTokens.body, color: palette.steel, fontStyle: 'italic', marginBottom: space.sm },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md },
  thoughtBlock: {
    backgroundColor: 'rgba(78,157,180,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(78,157,180,0.28)',
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
  },
  thoughtLabel: { ...typeTokens.micro, color: palette.accent, textTransform: 'uppercase' },
  thoughtText: { ...typeTokens.body, color: palette.ink, fontStyle: 'italic', marginTop: 4 },
  needsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  needCell: { width: '47%', minWidth: 140 },
  goalRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', marginBottom: space.md },
  goalBody: { flex: 1, minWidth: 0 },
  goalLabel: { ...typeTokens.label, color: palette.ink },
  milestoneRow: { marginTop: 3 },
  milestoneText: { ...typeTokens.caption, color: palette.inkMuted, flexShrink: 1 },
  relationRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 6 },
  relationName: { ...typeTokens.caption, color: palette.inkSoft, width: 96 },
  relationTrack: { flex: 1, height: 5, borderRadius: radius.xs, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  relationFill: { height: '100%', backgroundColor: palette.steel, borderRadius: radius.xs },
  relationLabel: { ...typeTokens.micro, color: palette.inkMuted, width: 76, textAlign: 'right' },
  relationLabel2: { ...typeTokens.caption, color: palette.inkSoft },
  memoryRow: { marginBottom: space.sm },
  memoryIcon: { fontSize: 13 },
  memoryText: { ...typeTokens.caption, color: palette.inkSoft },
  memoryCycle: { ...typeTokens.micro, color: palette.inkMuted, marginTop: 1 },
  attributeChip: {
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  attributeIcon: { fontSize: 13 },
  attributeValue: { ...typeTokens.title, color: palette.ink },
  attributeLabel: { ...typeTokens.micro, color: palette.inkMuted, textTransform: 'uppercase' },
  sheetFooter: { flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: palette.border },
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(78,157,180,0.12)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(78,157,180,0.35)',
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    marginBottom: space.sm,
  },
  targetBannerText: { ...typeTokens.caption, color: palette.ink, flex: 1 },

  deckGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  deckCard: {
    width: '47%',
    minWidth: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: space.sm,
    gap: 3,
  },
  deckCardDisabled: { opacity: 0.45 },
  deckCardOpen: { borderColor: palette.accent },
  deckIcon: { fontSize: 17 },
  deckLabel: { ...typeTokens.label, color: palette.ink },
  deckDescription: { ...typeTokens.caption, color: palette.inkMuted },
  deckLock: { ...typeTokens.micro, color: palette.inkMuted, letterSpacing: 0.3 },
  targetPicker: { marginTop: space.md, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: space.md },
  targetPickerTitle: { ...typeTokens.label, color: palette.ink, marginBottom: space.sm },
  targetRow: { gap: space.sm, paddingRight: space.md },
  targetChip: {
    alignItems: 'center',
    width: 64,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  targetChipActive: { borderColor: palette.accent, backgroundColor: 'rgba(78,157,180,0.14)' },
  targetChipText: { ...typeTokens.micro, color: palette.inkSoft, marginTop: 2 },

  dilemmaPrompt: { ...typeTokens.body, color: palette.ink, marginBottom: space.sm },
  choiceList: { gap: space.sm },
  choiceCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: space.sm,
  },
  choiceHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  choiceLabel: { ...typeTokens.label, color: palette.ink, flexShrink: 1 },
  choiceHint: { ...typeTokens.caption, color: palette.inkMuted, marginTop: 2, marginLeft: 19 },

  filterChip: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterChipActive: { backgroundColor: `${palette.accent}26`, borderColor: `${palette.accent}77` },
  filterChipText: { ...typeTokens.micro, color: palette.inkMuted },
  filterChipTextActive: { color: palette.accent },
  chronicleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  chronicleIcon: { fontSize: 14 },
  chronicleText: { ...typeTokens.caption, color: palette.inkSoft },
  chronicleMeta: { ...typeTokens.micro, color: palette.inkMuted, marginTop: 2 },

  signatureChip: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    width: '47%',
    minWidth: 150,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  signatureChipUnlocked: { borderColor: `${palette.lime}66`, backgroundColor: `${palette.lime}14` },
  signatureIcon: { fontSize: 17 },
  signatureLabel: { ...typeTokens.label, color: palette.ink },
  signatureHint: { ...typeTokens.micro, color: palette.inkMuted, fontWeight: '500', letterSpacing: 0 },

  compactDelta: {
    minWidth: 96,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 2,
  },
  compactDeltaLabel: { ...typeTokens.micro, color: palette.inkMuted, textTransform: 'uppercase' },
  compactDeltaValue: { ...typeTokens.display },

  highlightRow: { marginBottom: 6 },
  highlightDot: { fontSize: 13 },
  highlightText: { ...typeTokens.caption, color: palette.ink, flex: 1 },
  reportRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: space.sm,
    marginBottom: space.sm,
  },
  reportName: { ...typeTokens.label, color: palette.ink },
  reportActionIcon: { fontSize: 12 },
  reportAction: { ...typeTokens.caption, color: palette.accent, fontWeight: '600' },
  reportThought: { ...typeTokens.caption, color: palette.inkSoft, fontStyle: 'italic', marginTop: 4 },
  reportReason: { ...typeTokens.micro, color: palette.inkMuted, marginTop: 3, fontWeight: '500', letterSpacing: 0 },
  needDeltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  needDeltaIcon: { fontSize: 10 },
  needDeltaText: { ...typeTokens.micro },

  toastWrap: { position: 'absolute', left: space.md, right: space.md, bottom: space.md, gap: 6, zIndex: 999 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    ...elevation.float,
  },
  toastText: { ...typeTokens.caption, color: palette.ink, flex: 1 },

  offlineHint: { ...typeTokens.micro, color: palette.inkMuted, marginTop: space.sm, fontWeight: '500', letterSpacing: 0 },
});
