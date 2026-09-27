/**
 * The single hook that drives the game loop.
 *
 * Everything the interface needs comes from here: the iteration state, the
 * identity/codex payload, support offers, the last cycle report, and the
 * actions themselves. Failures never disappear into the console -- they surface
 * as `error`/toasts the player can act on.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { API_BASE, ApiError, api } from './api';
import type {
  CycleReport,
  GameState,
  Identity,
  LocationView,
  SupportInfo,
} from './types';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'good' | 'bad';
}

export interface GameApi {
  state: GameState | null;
  identity: Identity | null;
  support: SupportInfo | null;
  locations: LocationView[];
  report: CycleReport | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  offline: boolean;
  backendUrl: string;
  toasts: Toast[];
  focusedLocationId: string | null;
  selectedResidentId: string | null;
  dismissReport: () => void;
  dismissToast: (id: number) => void;
  focusLocation: (id: string | null) => void;
  selectResident: (id: string | null) => void;
  reload: () => Promise<void>;
  advance: () => Promise<void>;
  intervene: (
    id: string,
    targetId?: string | null,
    secondTargetId?: string | null,
  ) => Promise<boolean>;
  decide: (dilemmaId: string, choiceId: string) => Promise<boolean>;
  restart: () => Promise<void>;
  exportSave: () => Promise<string | null>;
  importSave: (raw: string) => Promise<boolean>;
  setPaused: (paused: boolean) => Promise<void>;
  notify: (message: string, tone?: Toast['tone']) => void;
}

export function useGame(translations: {
  t: (key: string, vars?: Record<string, string | number>) => string;
}): GameApi {
  const { t } = translations;

  const [state, setState] = useState<GameState | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [support, setSupport] = useState<SupportInfo | null>(null);
  const [locations, setLocations] = useState<LocationView[]>([]);
  const [report, setReport] = useState<CycleReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);

  const toastSeq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Auto-dismiss toasts so the interface never accumulates banners.
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => dismissToast(toast.id), 4200),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  const fail = useCallback(
    (exception: unknown, fallbackMessage: string) => {
      const apiError = exception instanceof ApiError ? exception : null;
      const message = apiError?.message || fallbackMessage;
      setError(message);
      setOffline(Boolean(apiError?.offline));
      notify(message, 'bad');
    },
    [notify],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [identityPayload, supportPayload, locationsPayload, statePayload] =
        await Promise.all([
          api.identity(),
          api.support(),
          api.locations(),
          api.state(),
        ]);
      if (!mounted.current) return;
      setIdentity(identityPayload);
      setSupport(supportPayload);
      setLocations(locationsPayload);
      setState(statePayload);
      setOffline(false);
    } catch (exception) {
      if (!mounted.current) return;
      fail(exception, t('toast.error'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [fail, t]);

  useEffect(() => {
    void reload();
    // Intentionally once: reload is stable enough and re-running on every
    // translation change would refetch the world pointlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await api.advanceCycle();
      if (!mounted.current) return;
      setState(payload.state);
      setReport(payload.report);
      notify(
        payload.report.ending
          ? t('toast.ending')
          : t('toast.cycle', { n: payload.report.cycle }),
        payload.report.ending ? 'bad' : 'good',
      );
    } catch (exception) {
      fail(exception, t('toast.error'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, fail, notify, t]);

  const intervene = useCallback<GameApi['intervene']>(
    async (id, targetId, secondTargetId) => {
      if (busy) return false;
      setBusy(true);
      setError(null);
      try {
        const payload = await api.intervene({
          id,
          target_id: targetId ?? null,
          second_target_id: secondTargetId ?? null,
        });
        if (!mounted.current) return false;
        setState(payload.state);
        notify(
          payload.result.resisted
            ? `${t('deck.applied')}: ${t('deck.resisted')}`
            : t('toast.intervention'),
          payload.result.resisted ? 'info' : 'good',
        );
        return true;
      } catch (exception) {
        fail(exception, t('toast.error'));
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [busy, fail, notify, t],
  );

  const decide = useCallback<GameApi['decide']>(
    async (dilemmaId, choiceId) => {
      if (busy) return false;
      setBusy(true);
      setError(null);
      try {
        const payload = await api.resolveDilemma({
          dilemma_id: dilemmaId,
          choice_id: choiceId,
        });
        if (!mounted.current) return false;
        setState(payload.state);
        notify(t('toast.decision'), 'good');
        return true;
      } catch (exception) {
        fail(exception, t('toast.error'));
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [busy, fail, notify, t],
  );

  const restart = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await api.reset();
      if (!mounted.current) return;
      setState(payload.state);
      setReport(null);
      setSelectedResidentId(null);
      setFocusedLocationId(null);
      notify(t('toast.reset'), 'good');
    } catch (exception) {
      fail(exception, t('toast.error'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, fail, notify, t]);

  const exportSave = useCallback(async () => {
    try {
      const envelope = await api.exportSave();
      notify(t('toast.saved'), 'good');
      return JSON.stringify(envelope, null, 2);
    } catch (exception) {
      fail(exception, t('toast.error'));
      return null;
    }
  }, [fail, notify, t]);

  const importSave = useCallback(
    async (raw: string) => {
      setError(null);
      try {
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
        const candidate = parsed?.state ?? (parsed as Record<string, unknown>);
        if (!candidate || typeof candidate !== 'object') {
          throw new Error('Sauvegarde illisible.');
        }
        const payload = await api.importSave(candidate);
        if (!mounted.current) return false;
        setState(payload.state);
        setReport(null);
        notify(t('toast.loaded'), 'good');
        return true;
      } catch (exception) {
        fail(exception instanceof Error && !(exception instanceof ApiError)
          ? exception.message
          : exception, t('toast.error'));
        return false;
      }
    },
    [fail, notify, t],
  );

  const setPaused = useCallback(
    async (paused: boolean) => {
      setBusy(true);
      try {
        const payload = await api.setPaused(paused);
        if (!mounted.current) return;
        setState(payload.state);
        notify(paused ? t('toast.paused') : t('toast.resumed'), 'info');
      } catch (exception) {
        fail(exception, t('toast.error'));
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [fail, notify, t],
  );

  return useMemo<GameApi>(
    () => ({
      state,
      identity,
      support,
      locations,
      report,
      loading,
      busy,
      error,
      offline,
      backendUrl: API_BASE,
      toasts,
      focusedLocationId,
      selectedResidentId,
      dismissReport: () => setReport(null),
      dismissToast,
      focusLocation: setFocusedLocationId,
      selectResident: setSelectedResidentId,
      reload,
      advance,
      intervene,
      decide,
      restart,
      exportSave,
      importSave,
      setPaused,
      notify,
    }),
    [
      state,
      identity,
      support,
      locations,
      report,
      loading,
      busy,
      error,
      offline,
      toasts,
      focusedLocationId,
      selectedResidentId,
      dismissToast,
      reload,
      advance,
      intervene,
      decide,
      restart,
      exportSave,
      importSave,
      setPaused,
      notify,
    ],
  );
}
