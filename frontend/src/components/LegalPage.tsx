/**
 * The screen that renders a legal document.
 *
 * A plain reading surface: one column, measure capped for readability, flat
 * graphite background, a square back control, and a footer linking to the other
 * document. Both routes share it so the two texts cannot drift apart visually.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LegalDocument } from '../game/legal';
import { LEGAL_DOCUMENTS } from '../game/legal';
import { useI18n } from '../game/i18n';
import { layout, palette, radius, space, type } from '../theme';
import { ActionButton, BodyText, Panel, SectionTitle } from './ui';

export function LegalPage({ document }: { document: LegalDocument }) {
  const { t, lt } = useI18n();
  const router = useRouter();
  const other = document.id === 'rgpd' ? LEGAL_DOCUMENTS.cgu : LEGAL_DOCUMENTS.rgpd;
  const otherLabel = document.id === 'rgpd' ? t('legal.openTerms') : t('legal.openGdpr');

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={styles.title}>
              {lt(document.title)}
            </Text>
            <Text style={styles.updated}>{lt(document.updated)}</Text>
          </View>
          <ActionButton
            label={t('legal.back')}
            icon="arrow-back"
            variant="secondary"
            compact
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Panel tone={palette.accent}>
            <BodyText>{lt(document.summary)}</BodyText>
          </Panel>

          {document.sections.map((section, index) => (
            <Panel key={index} style={styles.block}>
              <SectionTitle title={lt(section.heading)} />
              {section.body.map((paragraph, paragraphIndex) => (
                <Text key={paragraphIndex} style={styles.paragraph}>
                  {lt(paragraph)}
                </Text>
              ))}
            </Panel>
          ))}

          <Panel style={styles.block}>
            <SectionTitle title={t('legal.title')} />
            <ActionButton
              label={otherLabel}
              icon="document-text-outline"
              variant="secondary"
              onPress={() => router.push(`/legal/${other.id}`)}
            />
          </Panel>

          <View style={{ height: space.xl }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.void },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerText: { flexShrink: 1 },
  title: { ...type.display, color: palette.ink },
  updated: { ...type.caption, color: palette.inkMuted, marginTop: 2 },
  content: {
    padding: space.lg,
    gap: space.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  block: { marginTop: 0 },
  paragraph: {
    ...type.body,
    color: palette.inkSoft,
    lineHeight: 21,
    marginBottom: space.sm,
    borderRadius: radius.xs,
  },
});
