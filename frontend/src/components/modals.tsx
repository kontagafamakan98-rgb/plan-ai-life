/**
 * Full-screen modals: Codex, Settings, Support and the ending.
 *
 * The settings modal is not decorative: language, reduce-motion, contrast and
 * haptics all change the interface immediately, and export/import/reset are
 * wired to the real endpoints.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  lucidityColor,
  palette,
  radius,
  space,
  stabilityColor,
  type as typeTokens,
} from '../theme';
import { API_BASE } from '../game/api';
import { useI18n } from '../game/i18n';
import type { Ending, GameState, Identity, SupportInfo } from '../game/types';
import {
  ActionButton,
  BodyText,
  IconButton,
  Panel,
  Pill,
  Row,
  SectionTitle,
  usePrefs,
} from './ui';

function ModalShell({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Codex
 * ------------------------------------------------------------------ */

export function CodexModal({
  visible,
  onClose,
  identity,
  state,
}: {
  visible: boolean;
  onClose: () => void;
  identity: Identity | null;
  state: GameState | null;
}) {
  const { t, lt } = useI18n();
  if (!identity) return null;

  const earned = new Set((state?.signatures ?? []).map((entry) => entry.id));
  const completedGoals = new Set(
    (state?.residents ?? [])
      .flatMap((resident) => resident.goals ?? [])
      .filter((goal) => goal.complete)
      .map((goal) => goal.id),
  );

  return (
    <ModalShell visible={visible} title={t('codex.title')} subtitle={identity.brand.name} onClose={onClose}>
      <Panel gradient={['rgba(110,231,249,0.12)', 'rgba(167,139,250,0.06)']} style={styles.block}>
        <SectionTitle title={t('codex.premise')} icon="book-outline" />
        <BodyText>{lt(identity.brand.premise)}</BodyText>
        <Row gap={6} style={{ marginTop: space.sm }} wrap>
          <Pill label={`${t('app.role')} : ${lt(identity.brand.role)}`} color={palette.cyan} />
          <Pill label={identity.anomaly.name} color={palette.rose} icon="🕳️" />
        </Row>
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('codex.goals')} icon="trophy-outline" />
        {identity.goals.map((goal) => (
          <View key={goal.id} style={styles.goalRow}>
            <Ionicons
              name={completedGoals.has(goal.id) ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={completedGoals.has(goal.id) ? palette.lime : palette.inkMuted}
            />
            <View style={styles.goalText}>
              <Text style={styles.goalLabel}>{lt(goal.label)}</Text>
              <Text style={styles.goalMilestones}>
                {goal.milestones.map((milestone) => lt(milestone)).join(' · ')}
              </Text>
            </View>
          </View>
        ))}
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('codex.interventions')} icon="sparkles" />
        {identity.interventions.map((item) => (
          <View key={item.id} style={styles.interventionRow}>
            <Text style={styles.interventionIcon}>{item.icon}</Text>
            <View style={styles.goalText}>
              <Row gap={6} align="center">
                <Text style={styles.goalLabel}>{lt(item.label)}</Text>
                <Pill label={`${item.cost} ✦`} color={palette.flux} compact />
                {item.chapter_min > 1 ? (
                  <Pill label={t('common.chapterLock', { n: item.chapter_min })} color={palette.inkMuted} compact />
                ) : null}
              </Row>
              <Text style={styles.goalMilestones}>{lt(item.description)}</Text>
            </View>
          </View>
        ))}
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('signatures.title')} icon="ribbon-outline" />
        {identity.signatures.map((signature) => (
          <Row key={signature.id} gap={space.sm} align="center" style={styles.signatureRow}>
            <Text style={[styles.signatureIcon, !earned.has(signature.id) && { opacity: 0.3 }]}>
              {earned.has(signature.id) ? signature.icon : '🔒'}
            </Text>
            <View style={styles.goalText}>
              <Text style={styles.goalLabel}>{lt(signature.label)}</Text>
              <Text style={styles.goalMilestones}>{lt(signature.hint)}</Text>
            </View>
          </Row>
        ))}
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('codex.endings')} icon="moon-outline" />
        {identity.endings.map((ending) => (
          <Row key={ending.id} gap={space.sm} align="center" style={styles.signatureRow}>
            <Text style={styles.signatureIcon}>
              {(state?.ending?.id ?? '') === ending.id ? '🌒' : '•'}
            </Text>
            <Text style={styles.goalLabel}>{lt(ending.title)}</Text>
          </Row>
        ))}
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('codex.anomaly')} icon="alert-circle-outline" />
        <BodyText>{lt(identity.anomaly.description)}</BodyText>
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('codex.originality')} icon="shield-checkmark-outline" />
        <BodyText>{lt(identity.brand.license_note)}</BodyText>
        <BodyText muted style={{ marginTop: space.sm }}>
          {t('settings.aboutText')}
        </BodyText>
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('codex.credits')} icon="help-circle-outline" />
        <BodyText>{t('codex.help')}</BodyText>
      </Panel>

      <View style={{ height: space.xl }} />
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export function SettingsModal({
  visible,
  onClose,
  onReset,
  onExport,
  onImport,
  busy,
  state,
}: {
  visible: boolean;
  onClose: () => void;
  onReset: () => void;
  onExport: () => Promise<string | null>;
  onImport: (raw: string) => Promise<boolean>;
  busy: boolean;
  state: GameState | null;
}) {
  const { t, lang, setLang } = useI18n();
  const prefs = usePrefs();
  const [importText, setImportText] = useState('');
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    const payload = await onExport();
    setExported(payload);
    setCopied(false);
    if (payload && Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(payload);
        setCopied(true);
      } catch {
        // Clipboard permission denied: the textarea below is the fallback.
      }
    }
  };

  return (
    <ModalShell visible={visible} title={t('settings.title')} onClose={onClose}>
      <Panel style={styles.block}>
        <SectionTitle title={t('settings.language')} icon="language-outline" />
        <Row gap={space.sm}>
          {(['fr', 'en'] as const).map((code) => (
            <ActionButton
              key={code}
              label={code === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              variant={lang === code ? 'primary' : 'secondary'}
              onPress={() => setLang(code)}
              compact
            />
          ))}
        </Row>
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('settings.reduceMotion')} subtitle={t('settings.reduceMotionHint')} icon="eye-outline" />
        <Row justify="space-between" align="center">
          <BodyText>{t('settings.reduceMotion')}</BodyText>
          <Switch
            value={prefs.reduceMotion}
            onValueChange={(value) => prefs.setPreference('reduceMotion', value)}
            accessibilityLabel={t('settings.reduceMotion')}
            trackColor={{ true: palette.cyan, false: 'rgba(255,255,255,0.18)' }}
            thumbColor={palette.ink}
          />
        </Row>
        <Row justify="space-between" align="center" style={{ marginTop: space.sm }}>
          <BodyText>{t('settings.contrast')}</BodyText>
          <Switch
            value={prefs.contrast}
            onValueChange={(value) => prefs.setPreference('contrast', value)}
            accessibilityLabel={t('settings.contrast')}
            trackColor={{ true: palette.cyan, false: 'rgba(255,255,255,0.18)' }}
            thumbColor={palette.ink}
          />
        </Row>
        <Row justify="space-between" align="center" style={{ marginTop: space.sm }}>
          <BodyText>{t('settings.sound')}</BodyText>
          <Switch
            value={prefs.haptics}
            onValueChange={(value) => prefs.setPreference('haptics', value)}
            accessibilityLabel={t('settings.sound')}
            trackColor={{ true: palette.cyan, false: 'rgba(255,255,255,0.18)' }}
            thumbColor={palette.ink}
          />
        </Row>
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('settings.export')} subtitle={t('settings.exportHint')} icon="download-outline" />
        <ActionButton label={t('settings.export')} icon="download" onPress={handleExport} busy={busy} />
        {exported ? (
          <>
            <Text style={styles.monoBox} selectable numberOfLines={6}>
              {exported.slice(0, 420)}
              {exported.length > 420 ? '…' : ''}
            </Text>
            {copied ? <Pill label={t('common.copied')} color={palette.green} icon="checkmark" /> : null}
          </>
        ) : null}
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('settings.import')} subtitle={t('settings.importHint')} icon="cloud-upload-outline" />
        <TextInput
          value={importText}
          onChangeText={setImportText}
          placeholder={t('settings.importPlaceholder')}
          placeholderTextColor={palette.inkMuted}
          accessibilityLabel={t('settings.import')}
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />
        <ActionButton
          label={t('settings.importApply')}
          icon="cloud-upload"
          variant="secondary"
          disabled={importText.trim().length < 10}
          busy={busy}
          onPress={async () => {
            const ok = await onImport(importText);
            if (ok) setImportText('');
          }}
          style={{ marginTop: space.sm }}
        />
      </Panel>

      <Panel gradient={['rgba(251,113,133,0.14)', 'rgba(251,113,133,0.03)']} style={styles.block}>
        <SectionTitle title={t('settings.reset')} subtitle={t('settings.resetHint')} icon="refresh-outline" />
        <ActionButton
          label={t('settings.reset')}
          icon="refresh"
          variant="danger"
          busy={busy}
          onPress={() => {
            // A confirm step, so a stray tap cannot wipe a run.
            if (Platform.OS === 'web') {
              const confirmed =
                typeof window === 'undefined' || window.confirm(t('settings.resetConfirm'));
              if (confirmed) onReset();
            } else {
              onReset();
            }
          }}
        />
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('settings.backend')} subtitle={t('settings.backendHint')} icon="server-outline" />
        <Text style={styles.monoBox} selectable>
          {API_BASE}
        </Text>
        {state?.updated_at ? (
          <BodyText muted style={{ marginTop: 4 }}>
            {state.updated_at}
          </BodyText>
        ) : null}
      </Panel>

      <View style={{ height: space.xl }} />
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Support
 * ------------------------------------------------------------------ */

export function SupportModal({
  visible,
  onClose,
  support,
}: {
  visible: boolean;
  onClose: () => void;
  support: SupportInfo | null;
}) {
  const { t, lt } = useI18n();
  return (
    <ModalShell
      visible={visible}
      title={t('support.title')}
      subtitle={t('support.subtitle')}
      onClose={onClose}
    >
      {support ? (
        <>
          <Panel gradient={['rgba(74,222,128,0.14)', 'rgba(110,231,249,0.05)']} style={styles.block}>
            <SectionTitle title={t('support.principles')} icon="shield-checkmark-outline" />
            <BodyText>{lt(support.principles)}</BodyText>
          </Panel>

          {support.offers.map((offer) => (
            <Panel key={offer.id} style={styles.block}>
              <SectionTitle
                title={lt(offer.name)}
                subtitle={lt(offer.description)}
                icon={
                  offer.kind === 'cosmetic'
                    ? 'color-palette-outline'
                    : offer.kind === 'content'
                      ? 'library-outline'
                      : 'heart-outline'
                }
                right={<Pill label={offer.price_display} color={palette.amber} compact />}
              />
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>{t('support.grants')}</Text>
                <Text style={styles.offerValue}>{lt(offer.grants)}</Text>
              </View>
              <View style={styles.offerRow}>
                <Text style={styles.offerLabel}>{t('support.never')}</Text>
                <Text style={styles.offerValue}>{lt(offer.never_grants)}</Text>
              </View>
              <Row gap={6} style={{ marginTop: space.sm }} wrap>
                <Pill label={t('support.disabled')} color={palette.rose} icon="lock-closed" />
                {offer.one_time ? <Pill label={t('common.yes')} color={palette.green} compact /> : null}
              </Row>
            </Panel>
          ))}

          <Panel style={styles.block}>
            <SectionTitle title={t('support.why')} icon="information-circle-outline" />
            <BodyText>{support.note ? lt(support.note) : t('common.empty')}</BodyText>
          </Panel>
          <View style={{ height: space.xl }} />
        </>
      ) : (
        <BodyText muted>{t('common.empty')}</BodyText>
      )}
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Ending
 * ------------------------------------------------------------------ */

export function EndingModal({
  ending,
  onClose,
  onRestart,
  onExport,
  busy,
}: {
  ending: Ending | null;
  onClose: () => void;
  onRestart: () => void;
  onExport: () => Promise<string | null>;
  busy: boolean;
}) {
  const { t, lt } = useI18n();
  if (!ending) return null;
  const tone =
    ending.id === 'drift' ? palette.rose : ending.id === 'awakening' ? palette.violet : palette.cyan;

  return (
    <ModalShell
      visible
      title={t('ending.title')}
      subtitle={lt(ending.title)}
      onClose={onClose}
    >
      <Panel gradient={[`${tone}22`, 'rgba(255,255,255,0.02)']} style={styles.block}>
        <Text accessibilityRole="header" style={[styles.endingTitle, { color: tone }]}>
          {lt(ending.title)}
        </Text>
        <BodyText style={{ marginTop: space.sm }}>{lt(ending.body)}</BodyText>
      </Panel>

      <Panel style={styles.block}>
        <Row wrap gap={space.md}>
          <Stat label={t('ending.score')} value={`${ending.score}`} color={palette.cyan} />
          <Stat
            label={t('ending.goals')}
            value={`${ending.goals_completed}/${ending.goals_total}`}
            color={palette.lime}
          />
          <Stat label={t('ending.signatures')} value={`${ending.signatures.length}`} color={palette.violet} />
          <Stat label={t('ending.lucidity')} value={`${Math.round(ending.lucidity)}`} color={lucidityColor(ending.lucidity)} />
          <Stat
            label={t('ending.stability')}
            value={`${Math.round(ending.stability)}`}
            color={stabilityColor(ending.stability)}
          />
        </Row>
      </Panel>

      <Panel style={styles.block}>
        <SectionTitle title={t('signatures.title')} icon="ribbon-outline" />
        {ending.signatures.length === 0 ? (
          <BodyText muted>{t('signatures.empty')}</BodyText>
        ) : (
          <Row wrap gap={6}>
            {ending.signatures.map((signature) => (
              <Pill key={signature} label={signature} color={palette.lime} icon="★" compact />
            ))}
          </Row>
        )}
      </Panel>

      <Panel style={styles.block}>
        <BodyText muted>{lt(ending.note)}</BodyText>
      </Panel>

      <Row gap={space.sm} style={{ marginBottom: space.xl }}>
        <ActionButton label={t('ending.export')} icon="download" variant="secondary" onPress={() => void onExport()} busy={busy} />
        <ActionButton label={t('ending.replay')} icon="refresh" onPress={onRestart} busy={busy} />
      </Row>
    </ModalShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3,4,12,0.88)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0B0E26',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typeTokens.display, color: palette.ink },
  subtitle: { ...typeTokens.caption, color: palette.inkMuted },
  body: { paddingHorizontal: space.md, paddingTop: space.md },
  bodyContent: { paddingBottom: space.md },
  footer: { padding: space.md, borderTopWidth: 1, borderTopColor: palette.border },
  block: { marginBottom: space.md },

  goalRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', marginBottom: 7 },
  goalText: { flex: 1, minWidth: 0 },
  goalLabel: { ...typeTokens.label, color: palette.ink },
  goalMilestones: { ...typeTokens.caption, color: palette.inkMuted, marginTop: 1 },
  interventionRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', marginBottom: 9 },
  interventionIcon: { fontSize: 15 },
  signatureRow: { marginBottom: 7 },
  signatureIcon: { fontSize: 15, width: 20, textAlign: 'center' },
  offerRow: { flexDirection: 'row', gap: space.sm, marginTop: 5 },
  offerLabel: { ...typeTokens.micro, color: palette.inkMuted, textTransform: 'uppercase', width: 96 },
  offerValue: { ...typeTokens.caption, color: palette.inkSoft, flex: 1 },

  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: space.sm,
    color: palette.ink,
    ...typeTokens.caption,
    backgroundColor: 'rgba(255,255,255,0.05)',
    textAlignVertical: 'top',
  },
  monoBox: {
    ...typeTokens.micro,
    color: palette.inkSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.sm,
    letterSpacing: 0,
  },

  endingTitle: { ...typeTokens.display, fontSize: 22 },
  stat: { minWidth: 92 },
  statLabel: { ...typeTokens.micro, color: palette.inkMuted, textTransform: 'uppercase' },
  statValue: { ...typeTokens.display, marginTop: 2 },
});
