/**
 * ARCADIA-9 design tokens.
 *
 * One place for colour, spacing, radii and type so every surface stays
 * coherent. Colours are chosen for contrast against the deep indigo base:
 * body text sits at ~13:1 and the muted text tier still clears 4.5:1.
 */

export const palette = {
  // Base
  void: '#070A18',
  deep: '#0D1130',
  deep2: '#171A45',
  horizon: '#2A2560',
  surface: 'rgba(255,255,255,0.055)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.22)',

  // Ink
  ink: '#F4F6FF',
  inkSoft: '#C7CDE6',
  inkMuted: '#9AA3C4',

  // Accents
  cyan: '#6EE7F9',
  cyanDeep: '#1E93B0',
  violet: '#A78BFA',
  violetDeep: '#5B3FBF',
  amber: '#FBBF24',
  rose: '#FB7185',
  green: '#4ADE80',
  lime: '#BEF264',

  // Semantic
  flux: '#FBBF24',
  stability: '#4ADE80',
  lucidity: '#A78BFA',
  danger: '#FB7185',
  warning: '#F59E0B',
  good: '#34D399',
  over: '#FB7185',
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

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
}

export const type = {
  brand: { fontSize: 24, fontWeight: '800' as const, letterSpacing: 2.5 },
  display: { fontSize: 20, fontWeight: '700' as const },
  title: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
  micro: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.8 },
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
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
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
  if (value < 30) return palette.cyan
  if (value < 55) return palette.violet
  if (value < 75) return palette.amber
  return palette.rose
}

export function stabilityColor(value: number): string {
  if (value < 30) return palette.rose
  if (value < 55) return palette.warning
  if (value < 75) return palette.green
  return palette.lime
}

/** Background gradient stops for the sky, chosen from the in-game hour. */
export function skyGradient(hour: number): [string, string, ...string[]] {
  if (hour < 5) return ['#080B22', '#131A44', '#1E2350']
  if (hour < 8) return ['#2B2A5E', '#6B5AA6', '#D9A6A0']
  if (hour < 12) return ['#3E7FC1', '#7FB6E8', '#CFE7FA']
  if (hour < 16) return ['#3B86CE', '#83BCEE', '#DCEEFB']
  if (hour < 19) return ['#2E4E93', '#B06A94', '#F0A868']
  if (hour < 22) return ['#141A44', '#2C2A62', '#5A3F7A']
  return ['#070A1E', '#101538', '#1A1F45']
}

/** Wall/floor colours per location type — the room the residents live in. */
export const roomPalette: Record<
  string,
  { wall: [string, string]; floor: string; floorAlt: string; accent: string }
> = {
  cafe: { wall: ['#4A3527', '#2E2118'], floor: '#8B6A45', floorAlt: '#7A5C3B', accent: '#E8B96A' },
  apartment: { wall: ['#3B3153', '#241E36'], floor: '#6E5C7C', floorAlt: '#5F4F6C', accent: '#C79BD8' },
  office: { wall: ['#2C3A4A', '#1A242F'], floor: '#546176', floorAlt: '#4A5668', accent: '#7FD1E8' },
  park: { wall: ['#2E5C46', '#1B3A2C'], floor: '#4E8B5C', floorAlt: '#447A52', accent: '#BEF264' },
  gym: { wall: ['#4A2E33', '#2C1B1F'], floor: '#5B4148', floorAlt: '#513A41', accent: '#FB7185' },
  restaurant: { wall: ['#4E3324', '#2F1E15'], floor: '#7A5136', floorAlt: '#6A4630', accent: '#FBBF24' },
  club: { wall: ['#2A1B4A', '#170F2C'], floor: '#3B2A63', floorAlt: '#332456', accent: '#F472B6' },
  beach: { wall: ['#2E7BA6', '#1D5A7C'], floor: '#D9BE7A', floorAlt: '#CBAC68', accent: '#6EE7F9' },
  school: { wall: ['#3A4A63', '#232D3E'], floor: '#5E6B84', floorAlt: '#546078', accent: '#93C5FD' },
  hospital: { wall: ['#3C4A57', '#222C36'], floor: '#66757F', floorAlt: '#5C6A74', accent: '#A5F3FC' },
  market: { wall: ['#5A3A2A', '#37231A'], floor: '#8A6242', floorAlt: '#7A563A', accent: '#FDBA74' },
  museum: { wall: ['#3A2F5E', '#221B3A'], floor: '#584C7E', floorAlt: '#4F4472', accent: '#C4B5FD' },
  cinema: { wall: ['#241E3A', '#141024'], floor: '#3B3454', floorAlt: '#332D4A', accent: '#F9A8D4' },
  temple: { wall: ['#5C4A1F', '#382C11'], floor: '#8A7434', floorAlt: '#7A662D', accent: '#FDE68A' },
  mountain: { wall: ['#3E5A74', '#24374A'], floor: '#8798A8', floorAlt: '#78899A', accent: '#E0F2FE' },
}

export const defaultRoom = roomPalette.apartment
