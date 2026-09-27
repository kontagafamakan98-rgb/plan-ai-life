/**
 * Gameplay vocabulary to vector glyphs.
 *
 * The engine sends semantic keys: a mood is `tired`, an intervention is
 * `eclair`, an action family is `cook`. This table decides what each key looks
 * like. Values are typed as IconName, so a typo fails the typecheck instead of
 * rendering an empty box, and `scripts/design-guard.mjs` verifies every glyph
 * against the real Ionicons font map.
 */

import { FALLBACK_ICON, iconName, type IconName } from '../components/Icon';

export const GLYPHS: Record<string, IconName> = {
  // Action families, one per kind of thing a resident can do.
  toilet: 'body-outline',
  sleep: 'moon-outline',
  shower: 'rainy-outline',
  cook: 'flame-outline',
  eat: 'restaurant-outline',
  drink: 'cafe-outline',
  work: 'desktop-outline',
  network: 'people-outline',
  study: 'book-outline',
  create: 'color-palette-outline',
  game: 'game-controller-outline',
  perform: 'musical-notes-outline',
  flirt: 'heart-outline',
  chat: 'chatbubble-outline',
  party: 'sparkles-outline',
  exercise: 'barbell-outline',
  jog: 'walk-outline',
  walk: 'footsteps-outline',
  calm: 'leaf-outline',
  swim: 'water-outline',
  hike: 'trail-sign-outline',
  travel: 'compass-outline',
  shop: 'bag-outline',
  care: 'medical-outline',
  family: 'home-outline',
  watch: 'tv-outline',
  stream: 'mic-outline',
  idle: FALLBACK_ICON,

  // Moods
  radiant: 'sunny-outline',
  content: 'happy-outline',
  focused: 'locate-outline',
  neutral: 'remove-outline',
  tired: 'battery-half-outline',
  anxious: 'pulse-outline',
  upset: 'sad-outline',
  lost: 'cloudy-outline',

  // Weather
  clear: 'sunny-outline',
  veiled: 'partly-sunny-outline',
  rain: 'rainy-outline',
  static: 'cloudy-outline',

  // Signatures (what the iteration noticed about the player)
  first_step: 'flag-outline',
  three_lives: 'medal-outline',
  six_lives: 'trophy-outline',
  hands_off: 'hand-left-outline',
  low_profile: 'glasses-outline',
  rock_solid: 'shield-checkmark-outline',
  witness: 'eye-outline',
  residue: 'aperture-outline',

  // Interventions
  lumiere: 'bulb-outline',
  elan: 'flame-outline',
  cafe: 'cafe-outline',
  faveur: 'ribbon-outline',
  eclair: 'flash-outline',
  rencontre: 'link-outline',
  meteo: 'partly-sunny-outline',
  silence: 'volume-mute-outline',
  bug: 'bug-outline',

  // Chronicle and memory entries
  action: FALLBACK_ICON,
  milestone: 'layers-outline',
  goal: 'checkmark-circle-outline',
  world: 'globe-outline',
  anomaly: 'aperture-outline',
  ending: 'moon-outline',
  bond: 'people-outline',
  relation: 'heart-outline',
  decision: 'git-branch-outline',
  newcomer: 'person-add-outline',
  location: 'location-outline',

  // Location types
  cafe_place: 'cafe-outline',
  apartment: 'home-outline',
  office: 'briefcase-outline',
  park: 'leaf-outline',
  gym: 'barbell-outline',
  restaurant: 'restaurant-outline',
  club: 'musical-notes-outline',
  beach: 'umbrella-outline',
  school: 'school-outline',
  hospital: 'medkit-outline',
  market: 'cart-outline',
  museum: 'library-outline',
  cinema: 'film-outline',
  temple: 'flower-outline',
  mountain: 'triangle-outline',

  // Needs
  hunger: 'restaurant-outline',
  energy: 'battery-half-outline',
  social: 'chatbubbles-outline',
  hygiene: 'water-outline',
  fun: 'game-controller-outline',
  bladder: 'body-outline',
  comfort: 'bed-outline',

  // Attributes
  intelligence: 'school-outline',
  strength: 'barbell-outline',
  charisma: 'mic-outline',
  beauty: 'diamond-outline',
  creativity: 'color-palette-outline',
  luck: 'dice-outline',

  // Instruments and readouts
  flux: 'flash-outline',
  stability: 'shield-outline',
  lucidity: 'eye-outline',
  money: 'cash-outline',
  cycle: 'time-outline',
  resident: 'person-outline',
  signature: 'ribbon-outline',
  target: 'locate-outline',
  pause: 'pause-outline',
  resume: 'play-outline',
  lock: 'lock-closed-outline',
  codex: 'reader-outline',
  vision: 'eye-outline',
  help: 'help-circle-outline',
  language: 'language-outline',
  contrast: 'contrast-outline',
  motion: 'accessibility-outline',
  vibration: 'phone-portrait-outline',
  legal: 'document-text-outline',
  support: 'heart-outline',
  clock: 'time-outline',
  avatar: 'person-outline',
  'avatar-baby': 'happy-outline',
  'avatar-child': 'happy-outline',
  'avatar-teen': 'person-outline',
  'avatar-woman': 'woman-outline',
  'avatar-man': 'man-outline',
  'avatar-adult': 'person-outline',
  'avatar-elder': 'walk-outline',
  'avatar-neutral': 'person-outline',
};

/** Resolve a key from the API to a glyph, with a neutral shape as fallback. */
export function glyph(key: string | null | undefined): IconName {
  if (!key) return FALLBACK_ICON;
  return GLYPHS[key] ?? iconName(key);
}
