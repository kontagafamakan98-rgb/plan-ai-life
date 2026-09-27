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

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
}

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
 * muted greys, dust blues and dust yellows of a filmed city, never saturated.
 */
export function skyGradient(hour: number): [string, string, ...string[]] {
  if (hour < 5) return ['#0A0D12', '#111722', '#171E29']
  if (hour < 8) return ['#26313C', '#4C5866', '#88796B']
  if (hour < 12) return ['#37536A', '#6C8FA4', '#B4C7D3']
  if (hour < 16) return ['#3C5F76', '#7A9EB2', '#C2D5DF']
  if (hour < 19) return ['#2A3E52', '#6B7078', '#A98461']
  if (hour < 22) return ['#131A24', '#212936', '#333C49']
  return ['#0A0D12', '#121822', '#1A212B']
}

/** Wall/floor colours per location type. Muted materials: plaster, wood, stone. */
export const roomPalette: Record<
  string,
  { wall: [string, string]; floor: string; floorAlt: string; accent: string }
> = {
  cafe: { wall: ['#42352A', '#2B231C'], floor: '#6E5942', floorAlt: '#63503B', accent: '#C99A45' },
  apartment: { wall: ['#333840', '#22262C'], floor: '#4E545C', floorAlt: '#464C54', accent: '#7C93A8' },
  office: { wall: ['#2C3540', '#1D242C'], floor: '#454E58', floorAlt: '#3E4650', accent: '#4E9DB4' },
  park: { wall: ['#2C4136', '#1D2C25'], floor: '#4A6549', floorAlt: '#425B42', accent: '#96B96A' },
  gym: { wall: ['#3B3234', '#28211F'], floor: '#4C4444', floorAlt: '#443D3D', accent: '#C8605A' },
  restaurant: { wall: ['#40332A', '#2A211A'], floor: '#63503C', floorAlt: '#594734', accent: '#C99A45' },
  club: { wall: ['#24282F', '#161A20'], floor: '#33383F', floorAlt: '#2C3138', accent: '#C99A45' },
  beach: { wall: ['#2F5F73', '#204653'], floor: '#B49B6B', floorAlt: '#A68F62', accent: '#4E9DB4' },
  school: { wall: ['#343C47', '#232931'], floor: '#4B545F', floorAlt: '#434C57', accent: '#4E9DB4' },
  hospital: { wall: ['#384349', '#242C31'], floor: '#525C62', floorAlt: '#4A545A', accent: '#8FB6BE' },
  market: { wall: ['#463528', '#2E231A'], floor: '#6B5540', floorAlt: '#604C39', accent: '#B9803A' },
  museum: { wall: ['#343540', '#23242C'], floor: '#4E4F5A', floorAlt: '#464752', accent: '#7C93A8' },
  cinema: { wall: ['#26262E', '#18181E'], floor: '#38383F', floorAlt: '#313138', accent: '#8B7A5C' },
  temple: { wall: ['#47402C', '#2F2A1D'], floor: '#6E6244', floorAlt: '#64593D', accent: '#C99A45' },
  mountain: { wall: ['#37474F', '#232F36'], floor: '#6E7A82', floorAlt: '#66727A', accent: '#9FB4BE' },
}

export const defaultRoom = roomPalette.apartment
