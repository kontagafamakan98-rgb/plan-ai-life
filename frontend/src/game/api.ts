/**
 * Typed client for the ARCADIA-9 backend.
 *
 * Every call goes through `request`, which converts transport and HTTP failures
 * into a single `ApiError` carrying a message the UI can show. Nothing in the
 * app talks to axios directly, so error handling stays in one place.
 */

import { AxiosError, create } from 'axios';

import type {
  CycleReport,
  GameState,
  Identity,
  LocationView,
  SaveEnvelope,
  SupportInfo,
} from './types';

/**
 * Backend origin.
 *
 * Defaults to the documented local port so `npm run web` works with no `.env`
 * at all. Export `EXPO_PUBLIC_BACKEND_URL` (see `.env.example`) to point at a
 * different host -- for example your machine's LAN address when testing on a
 * phone with Expo Go.
 */
export const API_BASE = (
  process.env.EXPO_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status?: number;
  readonly offline: boolean;

  constructor(message: string, status?: number, offline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.offline = offline;
  }
}

function normalise(error: unknown): ApiError {
  const axiosError = error as AxiosError<{ detail?: string | { msg?: string }[] }>;
  if (axiosError?.isAxiosError) {
    const status = axiosError.response?.status;
    const detail = axiosError.response?.data?.detail;
    let message: string | undefined;
    if (typeof detail === 'string') message = detail;
    else if (Array.isArray(detail)) {
      message = detail.map((entry) => entry?.msg ?? '').filter(Boolean).join(' · ');
    }
    if (message) return new ApiError(message, status);
    if (!axiosError.response) {
      return new ApiError(
        "Le backend ne repond pas. Verifiez qu'il tourne et que l'adresse est correcte.",
        undefined,
        true,
      );
    }
    return new ApiError(axiosError.message || 'Erreur reseau', status);
  }
  if (error instanceof Error) return new ApiError(error.message);
  return new ApiError('Erreur inconnue');
}

async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await fn();
    return response.data;
  } catch (error) {
    throw normalise(error);
  }
}

const http = create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

export const api = {
  health: () => request<{ status: string }>(() => http.get(`${API_BASE}/api/health`)),

  identity: () => request<Identity>(() => http.get(`${API_BASE}/api/identity`)),

  support: () => request<SupportInfo>(() => http.get(`${API_BASE}/api/support/offers`)),

  locations: () => request<LocationView[]>(() => http.get(`${API_BASE}/api/locations`)),

  state: () => request<GameState>(() => http.get(`${API_BASE}/api/game/state`)),

  advanceCycle: () =>
    request<{ report: CycleReport; state: GameState }>(() =>
      http.post(`${API_BASE}/api/game/cycle`),
    ),

  intervene: (payload: {
    id: string;
    target_id?: string | null;
    second_target_id?: string | null;
  }) =>
    request<{ result: InterventionResult; state: GameState }>(() =>
      http.post(`${API_BASE}/api/game/intervention`, payload),
    ),

  resolveDilemma: (payload: { dilemma_id: string; choice_id: string }) =>
    request<{ result: DilemmaResult; state: GameState }>(() =>
      http.post(`${API_BASE}/api/game/dilemma`, payload),
    ),

  reset: () => request<{ status: string; state: GameState }>(() => http.post(`${API_BASE}/api/game/reset`)),

  /** Freeze or resume the iteration. The backend owns the flag. */
  setPaused: (paused: boolean) =>
    request<{ paused: boolean; is_paused: boolean; state: GameState }>(() =>
      http.post(`${API_BASE}/api/game/pause`, { paused }),
    ),

  exportSave: () => request<SaveEnvelope>(() => http.get(`${API_BASE}/api/game/save`)),

  importSave: (state: Record<string, unknown>) =>
    request<{ status: string; state: GameState }>(() =>
      http.post(`${API_BASE}/api/game/load`, { state }),
    ),
};

export interface InterventionResult {
  id: string;
  label: { fr: string; en: string };
  icon: string;
  cost: number;
  target_id?: string | null;
  second_target_id?: string | null;
  needs_delta: Record<string, number>;
  attributes_delta: Record<string, number>;
  goal_progress: Record<string, number>;
  notes: { fr: string; en: string }[];
  resisted: boolean;
  relationship?: { key: string; delta: number; value: number; label: { fr: string; en: string } };
  stability_delta?: number;
  lucidity_delta?: number;
  flux_after: number;
}

export interface DilemmaResult {
  id: string;
  choice: string;
  label: { fr: string; en: string };
  effects: Record<string, number>;
  flux_after: number;
  stability_after: number;
}
