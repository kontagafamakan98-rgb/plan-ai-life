/** Types mirroring the ARCADIA-9 backend payloads. */

export type Localized = { fr: string; en: string };
export type Lang = 'fr' | 'en';

export interface Look {
  skin: string;
  hair: string;
  hairstyle: string;
  eyes: string;
  outfit: { top: string; bottom: string; accent: string };
  accessory: string;
}

export interface GoalView {
  id: string;
  label: Localized;
  milestones: Localized[];
  progress: number;
  milestone_state: boolean[];
  complete: boolean;
}

export type NeedKey =
  | 'hunger'
  | 'energy'
  | 'social'
  | 'hygiene'
  | 'fun'
  | 'bladder'
  | 'comfort';

export type NeedMap = Record<NeedKey, number>;

export interface Resident {
  id: string;
  name: string;
  age: number;
  gender: string;
  occupation: Localized;
  home: string;
  city: string;
  bio: Localized;
  quote: Localized;
  look: Look;
  attributes: Record<string, number>;
  personality: Record<string, number>;
  goals: GoalView[];
  hobbies: string[];
  needs: NeedMap;
  needs_average: number;
  location_id: string;
  position: { x: number; y: number };
  money: number;
  mood: string;
  mood_label: Localized;
  mood_color: string;
  mood_icon: string;
  lucidity: number;
  current_action: { id: string; raw: string; label: Localized; icon?: string };
  thought: Localized;
  memory: {
    cycle: number;
    kind: string;
    text: Localized;
    icon: string;
    other?: string | null;
  }[];
  is_npc?: boolean;
  children?: string[];
}

export interface Intervention {
  id: string;
  label: Localized;
  description: Localized;
  icon: string;
  cost: number;
  target: 'resident' | 'pair' | 'world';
  chapter_min: number;
  unlocked: boolean;
  affordable: boolean;
}

export interface DilemmaChoice {
  id: string;
  label: Localized;
  hint: Localized;
}

export interface Dilemma {
  id: string;
  chapter_min: number;
  prompt: Localized;
  cycle: number | null;
  choices: DilemmaChoice[];
}

export interface ChronicleEntry {
  id: string;
  cycle: number;
  kind:
    | 'action'
    | 'event'
    | 'milestone'
    | 'goal'
    | 'signature'
    | 'intervention'
    | 'decision'
    | 'anomaly'
    | 'ending'
    | 'newcomer';
  icon: string;
  text: Localized;
  residents: string[];
  resident_name?: string | null;
  location_id?: string | null;
}

export interface Signature {
  id: string;
  label: Localized;
  hint: Localized;
  icon: string;
}

export interface Relationship {
  key: string;
  a: string;
  b: string;
  value: number;
  label: Localized;
}

export interface Ending {
  id: 'control' | 'awakening' | 'drift' | 'silence';
  title: Localized;
  body: Localized;
  score: number;
  goals_completed: number;
  goals_total: number;
  lucidity: number;
  stability: number;
  signatures: string[];
  note: Localized;
}

export interface GameState {
  id: string;
  cycle: number;
  chapter: number;
  chapter_label: Localized;
  max_cycles: number;
  flux: number;
  flux_cap: number;
  stability: number;
  lucidity: number;
  weather: { id: string; label: Localized; icon: string; stability: number };
  game_hour: number;
  /** Frozen world: advancing a cycle is refused until the player resumes. */
  paused: boolean;
  residents: Resident[];
  relationships: Relationship[];
  chronicle: ChronicleEntry[];
  signatures: Signature[];
  signature_catalog: Signature[];
  pending_dilemma: Dilemma | null;
  anomaly_visible: boolean;
  anomaly: { id: string; name: string; label: Localized; description: Localized };
  ending: Ending | null;
  score: number;
  goals_completed: number;
  goals_total: number;
  history: {
    cycle: number;
    stability: number;
    lucidity: number;
    flux: number;
    goals_completed: number;
  }[];
  interventions: Intervention[];
  updated_at?: string;
  created_at?: string;
}

export interface ResidentReport {
  id: string;
  name: string;
  action: { id: string; raw: string; label: Localized; icon?: string };
  thought: Localized;
  mood: string;
  mood_label: Localized;
  location_id: string;
  reason: Localized;
  needs_delta: Partial<Record<NeedKey, number>>;
  goal_progress: Record<string, number>;
  money_delta: number;
  lucidity_delta: number;
  position: { x: number; y: number };
}

export interface CycleReport {
  status: 'ok' | 'ended';
  cycle: number;
  next_cycle: number;
  chapter: number;
  chapter_label: Localized;
  weather: { id: string; label: Localized; icon: string; stability: number };
  world: {
    flux_before: number;
    flux_after: number;
    stability_before: number;
    stability_after: number;
    stability_delta: number;
    lucidity_before: number;
    lucidity_after: number;
    lucidity_delta: number;
  };
  residents: ResidentReport[];
  relationships: {
    key: string;
    a: string;
    b: string;
    delta: number;
    value: number;
    label: Localized;
    location_id: string;
  }[];
  chronicle: ChronicleEntry[];
  highlights: {
    kind: string;
    resident_id?: string;
    other_id?: string;
    text: Localized;
    id?: string;
  }[];
  signatures: string[];
  ending: Ending | null;
}

export interface SupportOffer {
  id: string;
  kind: 'cosmetic' | 'content' | 'tip';
  name: Localized;
  description: Localized;
  /** Nothing is purchasable yet, so no price is announced anywhere. */
  availability: 'not_for_sale';
  one_time: boolean;
  grants: Localized;
  never_grants: Localized;
  payments_enabled: boolean;
}

export interface SupportInfo {
  principles: Localized;
  offers: SupportOffer[];
  payments_enabled: boolean;
  note?: Localized;
}

export interface Identity {
  brand: {
    slug: string;
    name: string;
    tagline: Localized;
    premise: Localized;
    role: Localized;
    license_note: Localized;
  };
  goals: { id: string; label: Localized; milestones: Localized[]; tags: string[] }[];
  interventions: {
    id: string;
    label: Localized;
    description: Localized;
    icon: string;
    cost: number;
    target: string;
    chapter_min: number;
  }[];
  signatures: Signature[];
  endings: { id: string; title: Localized }[];
  anomaly: { id: string; name: string; label: Localized; description: Localized };
  moods: { id: string; label: Localized; color: string; icon: string }[];
  monetization: SupportInfo;
}

export interface LocationView {
  id: string;
  name: string;
  description: string;
  type: string;
  city: string;
  country: string;
  /** Semantic key resolved to a vector glyph by src/game/icons.ts. */
  icon: string;
  available_actions: string[];
  objects: string[];
  is_premium?: boolean;
}

export interface SaveEnvelope {
  format: string;
  version: number;
  state: Record<string, unknown>;
}
