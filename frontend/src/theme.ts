/**
 * ARCADIA-9 design tokens.
 *
 * Direction: an instrument panel, not a poster. Flat graphite surfaces, one
 * pixel hairlines, square corners, a single cool accent and functional colours
 * for state. No purple, no decorative gradients, no glow. Text tiers are
 * checked against the `void` background: ink ~14:1, inkSoft ~9:1, inkMuted
 * ~5:1, so every tier stays readable.
 */

export const palette = {
  // Base
  void: '#0B0D10',
  deep: '#12151A',
  deep2: '#191D23',
  horizon: '#242A32',
  surface: 'rgba(255,255,255,0.045)',
  surfaceStrong: 'rgba(255,255,255,0.085)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.20)',

  // Ink
  ink: '#EEF1F4',
  inkSoft: '#C0C7CE',
  inkMuted: '#8A929B',

  // One cool accent, then functional colours. Deliberately desaturated.
  accent: '#4E9DB4',
  accentDeep: '#2A6478',
  steel: '#7C93A8',
  steelDeep: '#3E5062',
  amber: '#C99A45',
  rose: '#C8605A',
  green: '#5FA37A',
  lime: '#96B96A',

  // Semantic
  flux: '#C99A45',
  stability: '#5FA37A',
  lucidity: '#7C93A8',
  danger: '#C8605A',
  warning: '#B9803A',
  good: '#5FA37A',
  over: '#C8605A',
}

/**
 * The world inside the glass.
 *
 * The interface around it is cold on purpose (graphite, one cool accent: the
 * Watcher's instruments). Everything the residents touch is warm instead:
 * plaster, oak, brass, linen, terracotta, lamplight. These are the only colours
 * the stage, the scenery and the characters are allowed to draw from.
 */
export const world = {
  // Materials
  plaster: '#E4D3BC',
  plasterLow: '#C9B49A',
  wainscot: '#8C6A4A',
  oak: '#A8743F',
  oakDark: '#7A5230',
  walnut: '#5C3B22',
  brass: '#C9A24A',
  brassDark: '#8E6F2C',
  linen: '#EFE3CF',
  terracotta: '#B4623C',
  sage: '#7C8A5A',
  sageDark: '#55603C',
  sand: '#D9BF92',
  // Light and shade inside the frame
  glow: '#FFC978',
  glowSoft: '#FFD9A0',
  shadow: '#2A1408',
  rim: '#FFE0B0',
  haze: '#C98B4B',
};

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
}

/** Square geometry throughout: nothing interactive is pill shaped. */
export const radius = {
  none: 0,
  xs: 3,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
}

export const type = {
  brand: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 1.2 },
  display: { fontSize: 20, fontWeight: '700' as const },
  title: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
  micro: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.8 },
  /** Figures line up in columns, like a readout. */
  numeric: { fontSize: 14, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as const },
}

export const layout = {
  /** Below this width the panels stack vertically. */
  twoColumnMinWidth: 940,
  maxContentWidth: 1180,
  minTouchTarget: 44,
}

/** Depth, in the one form every platform still reads: a single box shadow. */
export const elevation = {
  card: { boxShadow: '0 4px 10px rgba(0, 0, 0, 0.28)', elevation: 4 },
  float: { boxShadow: '0 8px 18px rgba(0, 0, 0, 0.4)', elevation: 10 },
} as const;

/** Colour ramp for a 0..100 meter, tuned so low values read as urgent. */
export function meterColor(value: number): string {
  if (value < 25) return palette.over
  if (value < 45) return palette.warning
  if (value < 70) return palette.amber
  if (value < 88) return palette.green
  return palette.lime
}

export function lucidityColor(value: number): string {
  if (value < 30) return palette.accent
  if (value < 55) return palette.steel
  if (value < 75) return palette.amber
  return palette.rose
}

export function stabilityColor(value: number): string {
  if (value < 30) return palette.rose
  if (value < 55) return palette.warning
  if (value < 75) return palette.green
  return palette.lime
}

/**
 * Background stops for the sky, chosen from the in-game hour. These are the
 * tones of a warm evening over a real city: dust at dawn, sun-baked midday,
 * amber dusk, and a night that glows rather than turns blue.
 */
export function skyGradient(hour: number): [string, string, ...string[]] {
  if (hour < 5) return ['#120E14', '#1E161D', '#2A1E20']
  if (hour < 8) return ['#3A2C36', '#8A5C4A', '#D9A272']
  if (hour < 12) return ['#6C8FA8', '#9FBAC6', '#E2D6BF']
  if (hour < 16) return ['#7FA3B8', '#B4C6C4', '#EDDCC0']
  if (hour < 19) return ['#5A4350', '#9A6A54', '#E0A468']
  if (hour < 22) return ['#2A2028', '#3E2E2E', '#5E4436']
  return ['#140F12', '#1F171A', '#2C1F1D']
}

/**
 * Wall, floor and trim per location type.
 *
 * Each room is built from real materials: painted plaster above a wooden
 * wainscot, boards or tile underfoot, and one accent material that carries the
 * lamps. Warm hues throughout, with the sage and slate rooms kept desaturated so
 * the cast never disappears into the set.
 */
export const roomPalette: Record<
  string,
  { wall: [string, string]; floor: string; floorAlt: string; accent: string; trim: string }
> = {
  cafe: { wall: ['#6E4B33', '#4B3122'], floor: '#A8743F', floorAlt: '#96663A', accent: '#D9A24A', trim: '#3B2417' },
  apartment: { wall: ['#8C6A52', '#65483A'], floor: '#A9743E', floorAlt: '#976539', accent: '#D8A76A', trim: '#4A2F20' },
  office: { wall: ['#7A6A5A', '#57493D'], floor: '#8A7255', floorAlt: '#7B6549', accent: '#C69A5A', trim: '#40352B' },
  park: { wall: ['#6E7A55', '#4A543A'], floor: '#7C8A5A', floorAlt: '#6E7C50', accent: '#B6C17E', trim: '#3E4327' },
  gym: { wall: ['#6B5348', '#4A3830'], floor: '#7B6353', floorAlt: '#6E5849', accent: '#C6865A', trim: '#382A22' },
  restaurant: { wall: ['#77543B', '#513A29'], floor: '#A2713F', floorAlt: '#936538', accent: '#E0B05E', trim: '#3D2718' },
  club: { wall: ['#4A3226', '#2C1C15'], floor: '#5A3E30', floorAlt: '#4E352A', accent: '#D88C4A', trim: '#241610' },
  beach: { wall: ['#7FA6A6', '#5A8286'], floor: '#E0C68C', floorAlt: '#D2B67C', accent: '#F0CE86', trim: '#4E6B6B' },
  school: { wall: ['#7C6F58', '#564C3B'], floor: '#9A8158', floorAlt: '#8A7350', accent: '#C9A45A', trim: '#3F3728' },
  hospital: { wall: ['#8A8578', '#625E51'], floor: '#9C947F', floorAlt: '#8D8672', accent: '#D8C48A', trim: '#494436' },
  market: { wall: ['#8A5F3E', '#5F3F29'], floor: '#B07C46', floorAlt: '#9E6F40', accent: '#D9A24A', trim: '#43291A' },
  museum: { wall: ['#8A7A66', '#5E5445'], floor: '#9A8667', floorAlt: '#8C7A5D', accent: '#CDA968', trim: '#453B2C' },
  cinema: { wall: ['#402C24', '#281A14'], floor: '#563C31', floorAlt: '#4C352B', accent: '#C98A4A', trim: '#221610' },
  temple: { wall: ['#96794A', '#6A5333'], floor: '#B08E56', floorAlt: '#A0804D', accent: '#E2BE72', trim: '#4A3820' },
  mountain: { wall: ['#6E6A62', '#4C4A44'], floor: '#8A8378', floorAlt: '#7C766C', accent: '#D9C9A4', trim: '#3A3833' },
}

export const defaultRoom = roomPalette.apartment
