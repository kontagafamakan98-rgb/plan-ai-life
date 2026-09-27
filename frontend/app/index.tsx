/**
 * ARCADIA-9: the game screen.
 *
 * One page, one loop: read the world, advance it, spend Flux to bend a life,
 * answer the dilemma the world asks, and see exactly what changed. Every
 * control here is wired to a real endpoint: including pause, export/import and
 * the release of a new iteration.
 *
 * Layout is a single vertical flow so the page always works on a phone, and the
 * two panels that benefit from width (roster / what the world asks) sit side by
 * side on a large screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CodexModal,
  EndingModal,
  SettingsModal,
  SupportModal,
} from '../src/components/modals';
import {
  Chronicle,
  CycleControl,
  CycleReportSheet,
  DilemmaCard,
  InterventionDeck,
  OfflineNotice,
  ResidentCard,
  ResidentSheet,
  ResourceBar,
  SignatureStrip,
  ToastStack,
} from '../src/components/panels';
import { Stage } from '../src/components/Stage';
import {
  ActionButton,
  BodyText,
  IconButton,
  Panel,
  Tag,
  Row,
  SectionTitle,
  usePrefs,
} from '../src/components/ui';
import { glyph } from '../src/game/icons';
import { useI18n } from '../src/game/i18n';
import { Icon } from '../src/components/Icon';
import { useGame } from '../src/game/useGame';
import type { LocationView, Resident } from '../src/game/types';
import { elevation, layout, palette, radius, space, type as typeTokens } from '../src/theme';

export default function ArcadiaScreen() {
  const { t, lt } = useI18n();
  const { contrast } = usePrefs();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  // The breakpoint follows the width the app actually occupies, not the window:
  // inside an embedded view or a resized desktop window the two can disagree, and
  // a container measurement also reacts when the window itself stays put.
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth;
  const twoColumn = width >= layout.twoColumnMinWidth;

  const game = useGame({ t });
  const state = game.state;

  /* ---------------------------------------------------------------- *
   * Local interface state
   * ---------------------------------------------------------------- */

  const [placesOpen, setPlacesOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [codexOpen, setCodexOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [endingDismissed, setEndingDismissed] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const deckOffset = useRef(0);

  /* ---------------------------------------------------------------- *
   * Derived world views
   * ---------------------------------------------------------------- */

  const residentsByLocation = useMemo(() => {
    const map: Record<string, Resident[]> = {};
    for (const resident of state?.residents ?? []) {
      if (!map[resident.location_id]) map[resident.location_id] = [];
      map[resident.location_id].push(resident);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [state]);

  // The camera follows the busiest room until the player chooses one, then it
  // stays where it was put: a stage that jumps around every cycle is unusable.
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (game.focusedLocationId) return;
    const stillBusy = autoFocusId ? residentsByLocation[autoFocusId]?.length : 0;
    if (stillBusy) return;
    const busiest = game.locations
      .map((location) => ({
        location,
        count: (residentsByLocation[location.id] ?? []).length,
      }))
      .sort((a, b) => b.count - a.count)[0];
    if (busiest && busiest.count > 0) setAutoFocusId(busiest.location.id);
  }, [autoFocusId, game.focusedLocationId, game.locations, residentsByLocation]);

  const focusedLocation = useMemo<LocationView | null>(() => {
    const wanted = game.focusedLocationId ?? autoFocusId;
    return (
      game.locations.find((location) => location.id === wanted) ??
      game.locations[0] ??
      null
    );
  }, [autoFocusId, game.focusedLocationId, game.locations]);

  const hereNow = useMemo(
    () => (focusedLocation ? residentsByLocation[focusedLocation.id] ?? [] : []),
    [focusedLocation, residentsByLocation],
  );

  const roster = useMemo(() => {
    const here = focusedLocation?.id;
    return [...(state?.residents ?? [])].sort((a, b) => {
      const aHere = a.location_id === here ? 0 : 1;
      const bHere = b.location_id === here ? 0 : 1;
      if (aHere !== bHere) return aHere - bHere;
      return a.name.localeCompare(b.name);
    });
  }, [state, focusedLocation]);

  // Anyone who changed room since the previous cycle is drawn walking.
  const [walkingIds, setWalkingIds] = useState<string[]>([]);
  const previousLocations = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!state) return;
    const moved: string[] = [];
    const next: Record<string, string> = {};
    for (const resident of state.residents) {
      const before = previousLocations.current[resident.id];
      if (before && before !== resident.location_id) moved.push(resident.id);
      next[resident.id] = resident.location_id;
    }
    previousLocations.current = next;
    setWalkingIds(moved);
  }, [state]);

  const selectedResident = useMemo(
    () => state?.residents.find((resident) => resident.id === game.selectedResidentId) ?? null,
    [state, game.selectedResidentId],
  );

  const groupedLocations = useMemo(() => {
    const query = placeQuery.trim().toLowerCase();
    const groups: { country: string; items: LocationView[] }[] = [];
    for (const location of game.locations) {
      const haystack = `${location.name} ${location.city} ${location.country}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      let group = groups.find((entry) => entry.country === location.country);
      if (!group) {
        group = { country: location.country || t('places.unknown'), items: [] };
        groups.push(group);
      }
      group.items.push(location);
    }
    groups.sort((a, b) => a.country.localeCompare(b.country));
    for (const group of groups) group.items.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [game.locations, placeQuery, t]);

  const endingOpen = Boolean(state?.ending) && !endingDismissed;

  /* ---------------------------------------------------------------- *
   * Actions
   * ---------------------------------------------------------------- */

  const openResident = useCallback(
    (resident: Resident) => {
      game.selectResident(resident.id);
      setSheetOpen(true);
    },
    [game],
  );

  const scrollToDeck = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, deckOffset.current - 12), animated: true });
  }, []);

  const targetFromSheet = useCallback(
    (resident: Resident) => {
      game.selectResident(resident.id);
      game.focusLocation(resident.location_id);
      setSheetOpen(false);
      // Let the sheet close before moving the page, otherwise the scroll fights
      // the modal animation.
      setTimeout(scrollToDeck, 260);
    },
    [game, scrollToDeck],
  );

  const restartIteration = useCallback(async () => {
    await game.restart();
    setEndingDismissed(false);
    setSheetOpen(false);
    setPlacesOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [game]);

  /* ---------------------------------------------------------------- *
   * Boot / offline
   * ---------------------------------------------------------------- */

  if (game.loading && !state) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={[palette.void, palette.deep, palette.horizon]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.bootScreen}>
          <StatusBar style="light" />
          <Text style={styles.bootBrand}>ARCADIA-9</Text>
          <Text style={styles.bootTagline}>{t('app.tagline')}</Text>
          <ActivityIndicator color={palette.accent} style={{ marginTop: space.lg }} />
          <Text style={styles.bootLoading}>{t('common.loading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={
          contrast
            ? ['#05060F', '#0B0E22', '#191B45']
            : [palette.void, palette.deep, palette.horizon]
        }
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style="light" />
      <SafeAreaView
        style={styles.safe}
        onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      >
        {/* ---------------------------------------------------------- *
         * Header
         * ---------------------------------------------------------- */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandBlock}>
              <Text accessibilityRole="header" style={styles.brandName}>
                {game.identity?.brand.name ?? 'ARCADIA-9'}
              </Text>
              <Text style={styles.brandTagline}>
                {game.identity ? lt(game.identity.brand.tagline) : t('app.tagline')}
              </Text>
            </View>
            <Row gap={space.xs} align="center">
              <IconButton
                icon="book-outline"
                onPress={() => setCodexOpen(true)}
                accessibilityLabel={t('nav.codex')}
                active={codexOpen}
              />
              <IconButton
                icon="settings-outline"
                onPress={() => setSettingsOpen(true)}
                accessibilityLabel={t('nav.settings')}
                active={settingsOpen}
              />
              <IconButton
                icon="heart-outline"
                onPress={() => setSupportOpen(true)}
                accessibilityLabel={t('nav.support')}
                active={supportOpen}
              />
            </Row>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipStrip}
          >
            <Tag
              label={`${t('common.chapter')} ${state?.chapter ?? 1}${
                state ? ` · ${lt(state.chapter_label)}` : ''
              }`}
              icon={glyph('codex')}
              color={palette.accent}
            />
            {state ? (
              <Tag
                label={lt(state.weather.label)}
                icon={glyph(state.weather.icon)}
                color={palette.inkSoft}
              />
            ) : null}
            <Tag
              label={`${t('app.role')} · ${t('common.score')} ${state?.score ?? 0}`}
              icon={glyph('vision')}
              color={palette.steel}
            />
            {state?.anomaly_visible ? (
              <Tag label={state.anomaly.name} icon={glyph('anomaly')} color={palette.rose} />
            ) : null}
            {state?.paused ? (
              <Tag label={t('cycle.paused')} icon={glyph('pause')} color={palette.amber} />
            ) : null}
          </ScrollView>
        </View>

        {/* ---------------------------------------------------------- *
         * Body
         * ---------------------------------------------------------- */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {game.offline ? (
            <OfflineNotice
              url={game.backendUrl}
              message={game.error}
              onRetry={() => void game.reload()}
            />
          ) : null}

          {state ? (
            <>
              <ResourceBar state={state} />

              <Stage
                residents={hereNow}
                location={focusedLocation}
                gameHour={state.game_hour}
                weatherIcon={state.weather.icon}
                weatherLabel={lt(state.weather.label)}
                anomalyVisible={state.anomaly_visible}
                anomalyName={state.anomaly.name}
                anomalyText={lt(state.anomaly.description)}
                selectedResidentId={game.selectedResidentId}
                onSelectResident={openResident}
                onOpenLocationPicker={() => setPlacesOpen(true)}
                walkingIds={walkingIds}
              />

              <CycleControl
                state={state}
                busy={game.busy}
                paused={state.paused}
                onAdvance={() => void game.advance()}
                onTogglePause={() => void game.setPaused(!state.paused)}
              />

              {/* Direct child of the scroll content so "target this resident"
                  can scroll the deck into view reliably. */}
              <View
                onLayout={(event) => {
                  deckOffset.current = event.nativeEvent.layout.y;
                }}
              >
                <InterventionDeck
                  state={state}
                  busy={game.busy}
                  preselectedResidentId={game.selectedResidentId}
                  clearPreselection={() => game.selectResident(null)}
                  onApply={(id, targetId, secondId) => {
                    void game.intervene(id, targetId ?? null, secondId ?? null);
                  }}
                />
              </View>

              <View style={[styles.grid, twoColumn ? styles.gridRow : null]}>
                <View style={[styles.column, twoColumn ? styles.columnWide : null]}>
                  <Panel>
                    <SectionTitle
                      title={t('roster.title')}
                      subtitle={t('roster.subtitle', { n: roster.length })}
                      icon="people-outline"
                      right={
                        <Tag
                          label={`${t('stage.hereNow')} · ${hereNow.length}`}
                          color={palette.green}
                          compact
                        />
                      }
                    />
                    <View style={styles.rosterList}>
                      {roster.map((resident) => (
                        <ResidentCard
                          key={resident.id}
                          resident={resident}
                          location={game.locations.find(
                            (location) => location.id === resident.location_id,
                          )}
                          selected={resident.id === game.selectedResidentId}
                          onPress={() => openResident(resident)}
                        />
                      ))}
                    </View>
                  </Panel>
                </View>

                <View style={styles.column}>
                  <DilemmaCard
                    dilemma={state.pending_dilemma}
                    busy={game.busy}
                    onChoose={(dilemmaId, choiceId) => void game.decide(dilemmaId, choiceId)}
                  />
                  <SignatureStrip state={state} />
                </View>
              </View>

              <Chronicle
                entries={state.chronicle}
                onSelectResident={(residentId) => {
                  const resident = state.residents.find((entry) => entry.id === residentId);
                  if (resident) openResident(resident);
                }}
              />

              <Row gap={space.sm} wrap style={styles.footerActions}>
                <ActionButton
                  label={t('settings.export')}
                  icon="download-outline"
                  variant="secondary"
                  onPress={() => void game.exportSave()}
                />
                <ActionButton
                  label={t('nav.codex')}
                  icon="book-outline"
                  variant="ghost"
                  onPress={() => setCodexOpen(true)}
                />
                <ActionButton
                  label={t('stage.place')}
                  icon="map-outline"
                  variant="ghost"
                  onPress={() => setPlacesOpen(true)}
                />
              </Row>

              {/* The footer states what the build does and links the two real pages. */}
              <View style={styles.siteFooter}>
                <Text style={styles.footerNotice}>{t('footer.notice')}</Text>
                <Row gap={space.sm} wrap>
                  <ActionButton
                    label={t('legal.openGdpr')}
                    icon="document-text-outline"
                    variant="ghost"
                    compact
                    onPress={() => router.push('/legal/rgpd')}
                  />
                  <ActionButton
                    label={t('legal.openTerms')}
                    icon="document-text-outline"
                    variant="ghost"
                    compact
                    onPress={() => router.push('/legal/cgu')}
                  />
                </Row>
              </View>
            </>
          ) : (
            <Panel>
              <SectionTitle title={t('offline.title')} icon="cloud-offline-outline" />
              <BodyText muted>{game.error ?? t('offline.hint')}</BodyText>
              <Row gap={space.sm} style={{ marginTop: space.md }}>
                <ActionButton label={t('common.retry')} icon="refresh" onPress={() => void game.reload()} />
              </Row>
            </Panel>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ------------------------------------------------------------ *
       * Overlays
       * ------------------------------------------------------------ */}

      <ResidentSheet
        resident={selectedResident}
        state={state}
        locations={game.locations}
        visible={sheetOpen && Boolean(selectedResident)}
        onClose={() => setSheetOpen(false)}
        onInterveneOption={targetFromSheet}
      />

      <CycleReportSheet report={endingOpen ? null : game.report} onClose={game.dismissReport} />

      <CodexModal
        visible={codexOpen}
        onClose={() => setCodexOpen(false)}
        identity={game.identity}
        state={state}
      />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReset={() => void restartIteration()}
        onExport={game.exportSave}
        onImport={game.importSave}
        busy={game.busy}
        state={state}
      />

      <SupportModal
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        support={game.support}
      />

      <EndingModal
        ending={endingOpen ? state?.ending ?? null : null}
        onClose={() => setEndingDismissed(true)}
        onRestart={() => void restartIteration()}
        onExport={game.exportSave}
        busy={game.busy}
      />

      <PlacePicker
        visible={placesOpen}
        onClose={() => setPlacesOpen(false)}
        query={placeQuery}
        onQueryChange={setPlaceQuery}
        groups={groupedLocations}
        residentsByLocation={residentsByLocation}
        selectedId={focusedLocation?.id ?? null}
        onPick={(location) => {
          game.focusLocation(location.id);
          setPlacesOpen(false);
        }}
      />

      <ToastStack toasts={game.toasts} onDismiss={game.dismissToast} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Place picker
 * ------------------------------------------------------------------ */

function PlacePicker({
  visible,
  onClose,
  query,
  onQueryChange,
  groups,
  residentsByLocation,
  selectedId,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  groups: { country: string; items: LocationView[] }[];
  residentsByLocation: Record<string, Resident[]>;
  selectedId: string | null;
  onPick: (location: LocationView) => void;
}) {
  const { t } = useI18n();
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={styles.picker}>
          <View style={styles.pickerHeader}>
            <View style={styles.grow}>
              <Text accessibilityRole="header" style={styles.pickerTitle}>
                {t('places.title')}
              </Text>
              <Text style={styles.pickerSubtitle}>{t('places.subtitle')}</Text>
            </View>
            <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={palette.inkMuted} />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder={t('places.search')}
              placeholderTextColor={palette.inkMuted}
              accessibilityLabel={t('places.search')}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                onPress={() => onQueryChange('')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={16} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={styles.grow} showsVerticalScrollIndicator={false}>
            {total === 0 ? <BodyText muted>{t('places.none')}</BodyText> : null}
            {groups.map((group) => (
              <View key={group.country} style={styles.countryBlock}>
                <Text style={styles.countryHeader}>{group.country}</Text>
                {group.items.map((location) => {
                  const present = residentsByLocation[location.id] ?? [];
                  const isSelected = location.id === selectedId;
                  return (
                    <Pressable
                      key={location.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${location.name}, ${location.city}. ${
                        present.length
                          ? t('places.present', { n: present.length })
                          : t('places.empty')
                      }`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => onPick(location)}
                      style={({ pressed }) => [
                        styles.placeRow,
                        isSelected && styles.placeRowActive,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <Icon name={glyph(location.icon ?? location.type)} size={17} color={palette.inkSoft} />
                      <View style={styles.grow}>
                        <Text style={styles.placeName} numberOfLines={1}>
                          {location.name}
                        </Text>
                        <Text style={styles.placeMeta} numberOfLines={1}>
                          {location.city} · {location.type}
                        </Text>
                      </View>
                      <Tag
                        label={
                          present.length
                            ? `${present.length}`
                            : t('places.empty')
                        }
                        color={present.length ? palette.green : palette.inkMuted}
                        compact
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Styles
 * ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.void },
  grow: { flex: 1 },
  safe: { flex: 1 },

  bootScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  bootBrand: { ...typeTokens.brand, color: palette.ink },
  bootTagline: { ...typeTokens.caption, color: palette.inkMuted, marginTop: space.xs },
  bootLoading: { ...typeTokens.caption, color: palette.inkSoft, marginTop: space.sm },

  header: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandBlock: { flex: 1 },
  brandName: { ...typeTokens.brand, color: palette.ink },
  brandTagline: { ...typeTokens.caption, color: palette.inkMuted, marginTop: 2 },
  chipStrip: { flexDirection: 'row', gap: space.xs, paddingBottom: space.xs },

  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },

  grid: { gap: space.lg },
  gridRow: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, gap: space.lg },
  columnWide: { flex: 1.25 },

  rosterList: { gap: space.sm },
  footerActions: { justifyContent: 'center' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(4,6,16,0.72)', justifyContent: 'flex-end' },
  picker: {
    backgroundColor: palette.deep2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderColor: palette.border,
    borderWidth: 1,
    padding: space.lg,
    maxHeight: '86%',
    ...elevation.float,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  pickerTitle: { ...typeTokens.display, color: palette.ink },
  pickerSubtitle: { ...typeTokens.caption, color: palette.inkMuted, marginTop: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingHorizontal: space.md,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  searchInput: { flex: 1, color: palette.ink, ...typeTokens.body, paddingVertical: space.xs },
  countryBlock: { marginTop: space.md },
  countryHeader: {
    ...typeTokens.micro,
    color: palette.accent,
    textTransform: 'uppercase',
    marginBottom: space.xs,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: palette.surface,
    marginBottom: space.xs,
  },
  placeRowActive: { borderColor: `${palette.accent}88`, backgroundColor: `${palette.accent}1F` },
  siteFooter: { marginTop: space.md, gap: space.sm },
  footerNotice: { ...typeTokens.caption, color: palette.inkMuted, lineHeight: 17 },
  placeName: { ...typeTokens.label, color: palette.ink },
  placeMeta: { ...typeTokens.caption, color: palette.inkMuted, marginTop: 1 },
});
