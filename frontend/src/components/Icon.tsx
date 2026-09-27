/**
 * The only way this interface draws a symbol.
 *
 * Nothing in the product renders a text emoji: the API ships semantic keys and
 * this module turns them into vector glyphs. An unknown key falls back to a
 * neutral shape instead of leaking raw text into the layout.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { palette } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

const GLYPH_MAP = Ionicons.glyphMap as Record<string, number>;

export const FALLBACK_ICON: IconName = 'ellipse-outline';

export function isIconName(value: string | null | undefined): value is IconName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GLYPH_MAP, value);
}

/** Resolve anything the API sent into a glyph that is guaranteed to exist. */
export function iconName(value: string | null | undefined, fallback: IconName = FALLBACK_ICON): IconName {
  return isIconName(value) ? value : fallback;
}

export function Icon({
  name,
  size = 16,
  color = palette.inkSoft,
  style,
}: {
  name: string | null | undefined;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Ionicons name={iconName(name)} size={size} color={color} style={style} />;
}
