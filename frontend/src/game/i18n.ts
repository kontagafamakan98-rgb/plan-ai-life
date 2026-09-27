/**
 * UI dictionary and provider.
 *
 * Two kinds of text exist in the app:
 *   * narrative text, which the backend sends already localised as {fr, en} and
 *     is rendered through `lt` (localised text);
 *   * interface chrome, which lives in the dictionary below.
 *
 * The previous version of this project had a language switch that changed
 * nothing at all. Here the choice is persisted and actually drives the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Lang, Localized } from './types';

const STORAGE_KEY = 'arcadia9.language';

type Dict = Record<string, string>;

const fr: Dict = {
  'app.tagline': 'Le monde est un programme.',
  'app.role': 'Veilleur',
  'nav.play': 'Itération',
  'nav.codex': 'Codex',
  'nav.settings': 'Réglages',
  'nav.support': 'Soutenir',

  'common.close': 'Fermer',
  'common.cancel': 'Annuler',
  'common.confirm': 'Confirmer',
  'common.retry': 'Réessayer',
  'common.loading': "Chargement de l'itération…",
  'common.empty': 'Rien pour le moment.',
  'common.locked': 'Verrouillé',
  'common.unlocked': 'Disponible',
  'common.cost': 'Coût',
  'common.cycle': 'Cycle',
  'common.chapter': 'Chapitre',
  'common.of': 'sur',
  'common.score': 'Score',
  'common.yes': 'Oui',
  'common.no': 'Non',
  'common.copy': 'Copier',
  'common.copied': 'Copié',
  'common.selected': 'Sélectionné',
  'common.tapToSelect': 'Touchez pour sélectionner',
  'common.requires': 'Demande',
  'common.chapterLock': 'Chapitre {n} requis',

  'stat.flux': 'Flux',
  'stat.flux.hint': "Ressource d'intervention. Se recharge à chaque cycle.",
  'stat.stability': 'Stabilité',
  'stat.stability.hint': "Santé du monde simulé. À zéro, l'itération s'effondre.",
  'stat.lucidity': 'Lucidité',
  'stat.lucidity.hint': 'Ce que les habitants savent. Elle monte avec chaque geste.',
  'stat.signatures': 'Signatures',
  'stat.signatures.hint': 'Exploits reconnus par le système.',

  'cycle.advance': "Avancer d'un cycle",
  'cycle.advancing': 'Résolution…',
  'cycle.paused': 'Le monde est en pause.',
  'cycle.resume': 'Reprendre',
  'cycle.pause': 'Mettre en pause',
  'cycle.untilEnd': 'cycles avant la fin',
  'cycle.finalCycle': 'Dernier cycle',

  'roster.title': 'Habitants',
  'roster.subtitle': '{n} vies simulées',
  'roster.where': 'Lieu',
  'roster.doing': 'Occupé à',
  'roster.needs': 'Besoins',
  'roster.goals': 'Objectifs',
  'roster.memory': 'Mémoire récente',
  'roster.relations': 'Relations',
  'roster.attributes': 'Attributs',
  'roster.personality': 'Personnalité',
  'roster.thought': 'Pensée du cycle',
  'roster.lucidity': 'Lucidité individuelle',
  'roster.noRelations': 'Aucune relation tissée pour le moment.',
  'roster.needsAverage': 'Besoins moyens',
  'roster.position': 'Position',
  'roster.money': 'Argent',
  'roster.milestones': 'Étapes',
  'roster.complete': 'Accompli',
  'roster.hobbies': 'Loisirs',
  'roster.target': "Cibler avec une intervention",
  'attribute.intelligence': 'Intelligence',
  'attribute.strength': 'Force',
  'attribute.charisma': 'Charisme',
  'attribute.beauty': 'Beauté',
  'attribute.creativity': 'Créativité',
  'attribute.luck': 'Chance',

  'stage.nobody': 'Personne ici pour ce cycle',
  'stage.nobodyHint': "Choisissez un autre lieu ou lancez un cycle pour voir ce monde bouger.",
  'stage.hereNow': 'Présents',
  'stage.anomaly': 'Anomalie',
  'stage.anomalyTitle': 'RÉSIDU-08 affleure',
  'stage.weather': 'Météo',
  'stage.place': 'Lieu observé',
  'places.title': 'Lieux observés',
  'places.subtitle': 'Choisissez la pièce que vous regardez.',
  'places.search': 'Rechercher un lieu…',
  'places.none': 'Aucun lieu ne correspond.',
  'places.present': '{n} présent(s)',
  'places.empty': 'Personne ici pour le moment.',
  'app.iteration': 'Itération {n}',

  'deck.title': 'Interventions',
  'deck.subtitle': 'Dépensez du Flux pour infléchir une vie',
  'deck.pickTarget': 'Désignez un habitant',
  'deck.pickSecond': 'Désignez un second habitant',
  'deck.noFlux': 'Flux insuffisant',
  'deck.apply': 'Appliquer',
  'deck.applied': 'Intervention appliquée',
  'deck.resisted': 'Elle a senti la main',
  'deck.lockedHint': 'Disponible au chapitre {n}',
  'deck.pickWorld': 'Portée mondiale',

  'dilemma.title': 'Situation',
  'dilemma.subtitle': 'Une décision par cycle',
  'dilemma.choose': 'Trancher',
  'dilemma.none': 'Aucune décision en attente.',
  'dilemma.resolved': 'Décision prise',

  'report.title': 'Bilan du cycle {n}',
  'report.world': 'Monde',
  'report.lives': 'Vies',
  'report.network': 'Relations',
  'report.highlights': 'À retenir',
  'report.continue': 'Continuer',
  'report.noHighlights': 'Rien de marquant cette fois-ci.',
  'report.reason': 'Raison',
  'report.thought': 'Pensée',
  'report.moved': 'A changé de lieu',

  'chronicle.title': 'Chronique',
  'chronicle.subtitle': "Tout ce qui s'est réellement produit",
  'chronicle.filter.all': 'Tout',
  'chronicle.filter.lives': 'Vies',
  'chronicle.filter.world': 'Monde',
  'chronicle.filter.player': 'Vous',
  'chronicle.empty': 'La chronique est vide : lancez un cycle.',

  'signatures.title': 'Signatures',
  'signatures.subtitle': '{got} sur {total} obtenues',
  'signatures.empty': 'Aucune signature pour le moment.',

  'ending.title': 'Fin de l\'itération',
  'ending.replay': 'Relancer une itération',
  'ending.score': 'Score final',
  'ending.goals': 'Objectifs accomplis',
  'ending.signatures': 'Signatures',
  'ending.lucidity': 'Lucidité finale',
  'ending.stability': 'Stabilité finale',
  'ending.export': 'Exporter la sauvegarde',

  'codex.title': 'Codex',
  'codex.premise': 'Prémisse',
  'codex.goals': 'Objectifs de vie',
  'codex.interventions': 'Interventions',
  'codex.endings': 'Fins possibles',
  'codex.originality': 'Origine',
  'codex.anomaly': 'Anomalie',
  'codex.credits': 'Aide',
  'codex.help':
    "Avancez d'un cycle pour laisser le monde vivre. Dépensez du Flux pour infléchir une vie, tranchez la situation du cycle, et surveillez la Lucidité : plus vous aidez, plus ils doutent. La Stabilité, elle, paie vos erreurs.",

  'settings.title': 'Réglages',
  'settings.language': 'Langue',
  'settings.reduceMotion': 'Réduire les animations',
  'settings.reduceMotionHint': 'Supprime les mouvements non essentiels.',
  'settings.contrast': 'Contraste renforcé',
  'settings.contrastHint': 'Éclaircit les fonds et les bordures.',
  'settings.sound': 'Retours haptiques',
  'settings.soundHint': 'Vibre légèrement sur les actions (mobile).',
  'settings.reset': "Réinitialiser l'itération",
  'settings.resetHint': 'Efface la progression serveur et repart au cycle 1.',
  'settings.resetConfirm': 'Tout effacer et relancer au cycle 1 ?',
  'settings.export': 'Exporter la sauvegarde',
  'settings.exportHint': 'Copie le JSON complet de votre itération.',
  'settings.import': 'Importer une sauvegarde',
  'settings.importHint': 'Collez un JSON exporté pour reprendre une partie.',
  'settings.importPlaceholder': '{"format":"arcadia-9/save", …}',
  'settings.importApply': 'Importer',
  'settings.backend': 'Backend',
  'settings.backendHint': "Adresse utilisée par l'application.",
  'settings.about': 'À propos',
  'settings.aboutText':
    "ARCADIA-9 est une œuvre originale. L'inspiration citée par le projet est de haut niveau uniquement : aucun personnage, texte ou asset n'en est repris.",

  'support.title': 'Soutenir ARCADIA-9',
  'support.subtitle': 'Aucun paiement réel dans cette version',
  'support.principles': 'Nos règles',
  'support.grants': 'Ce que ça donne',
  'support.never': "Ce que ça ne donne jamais",
  'support.disabled': 'Achats désactivés dans cette démo',
  'support.why': 'Pourquoi ces offres existent',

  'toast.cycle': 'Cycle {n} résolu',
  'toast.intervention': 'Intervention appliquée',
  'toast.decision': 'Décision enregistrée',
  'toast.reset': 'Nouvelle itération lancée',
  'toast.saved': 'Sauvegarde exportée',
  'toast.loaded': 'Sauvegarde importée',
  'toast.ending': "L'itération est terminée",
  'toast.error': 'Une erreur est survenue',
  'toast.paused': 'Itération en pause : le monde ne bouge plus.',
  'toast.resumed': 'Itération reprise.',

  'offline.title': 'Backend injoignable',
  'offline.body':
    "L'application n'arrive pas à joindre {url}. Lancez le serveur puis réessayez : les commandes exactes sont dans le bilan de session et dans README.",
  'offline.hint': 'Commande attendue : cd backend && python -m uvicorn server:app --port 8000',
}

const en: Dict = {
  'app.tagline': 'The world is a program.',
  'app.role': 'Watcher',
  'nav.play': 'Iteration',
  'nav.codex': 'Codex',
  'nav.settings': 'Settings',
  'nav.support': 'Support',

  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.retry': 'Retry',
  'common.loading': 'Loading the iteration…',
  'common.empty': 'Nothing yet.',
  'common.locked': 'Locked',
  'common.unlocked': 'Available',
  'common.cost': 'Cost',
  'common.cycle': 'Cycle',
  'common.chapter': 'Chapter',
  'common.of': 'of',
  'common.score': 'Score',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.selected': 'Selected',
  'common.tapToSelect': 'Tap to select',
  'common.requires': 'Requires',
  'common.chapterLock': 'Chapter {n} required',

  'stat.flux': 'Flux',
  'stat.flux.hint': 'Intervention resource. Refills every cycle.',
  'stat.stability': 'Stability',
  'stat.stability.hint': 'Health of the simulated world. At zero the iteration collapses.',
  'stat.lucidity': 'Lucidity',
  'stat.lucidity.hint': 'What the residents know. Every gesture raises it.',
  'stat.signatures': 'Signatures',
  'stat.signatures.hint': 'Achievements the system has acknowledged.',

  'cycle.advance': 'Advance one cycle',
  'cycle.advancing': 'Resolving…',
  'cycle.paused': 'The world is paused.',
  'cycle.resume': 'Resume',
  'cycle.pause': 'Pause',
  'cycle.untilEnd': 'cycles before the end',
  'cycle.finalCycle': 'Final cycle',

  'roster.title': 'Residents',
  'roster.subtitle': '{n} simulated lives',
  'roster.where': 'Place',
  'roster.doing': 'Doing',
  'roster.needs': 'Needs',
  'roster.goals': 'Goals',
  'roster.memory': 'Recent memory',
  'roster.relations': 'Relationships',
  'roster.attributes': 'Attributes',
  'roster.personality': 'Personality',
  'roster.thought': 'Thought this cycle',
  'roster.lucidity': 'Individual lucidity',
  'roster.noRelations': 'No bond formed yet.',
  'roster.needsAverage': 'Average needs',
  'roster.position': 'Position',
  'roster.money': 'Money',
  'roster.milestones': 'Milestones',
  'roster.complete': 'Complete',
  'roster.hobbies': 'Hobbies',
  'roster.target': 'Target with an intervention',
  'attribute.intelligence': 'Intelligence',
  'attribute.strength': 'Strength',
  'attribute.charisma': 'Charisma',
  'attribute.beauty': 'Beauty',
  'attribute.creativity': 'Creativity',
  'attribute.luck': 'Luck',

  'stage.nobody': 'Nobody here this cycle',
  'stage.nobodyHint': 'Pick another place, or run a cycle to watch this world move.',
  'stage.hereNow': 'Present',
  'stage.anomaly': 'Anomaly',
  'stage.anomalyTitle': 'RÉSIDU-08 surfaces',
  'stage.weather': 'Weather',
  'stage.place': 'Observed place',
  'places.title': 'Observed places',
  'places.subtitle': 'Choose the room you are watching.',
  'places.search': 'Search a place…',
  'places.none': 'No place matches.',
  'places.present': '{n} present',
  'places.empty': 'Nobody here right now.',
  'app.iteration': 'Iteration {n}',

  'deck.title': 'Interventions',
  'deck.subtitle': 'Spend Flux to bend a life',
  'deck.pickTarget': 'Choose a resident',
  'deck.pickSecond': 'Choose a second resident',
  'deck.noFlux': 'Not enough Flux',
  'deck.apply': 'Apply',
  'deck.applied': 'Intervention applied',
  'deck.resisted': 'They felt the hand',
  'deck.lockedHint': 'Available in chapter {n}',
  'deck.pickWorld': 'World-wide',

  'dilemma.title': 'Situation',
  'dilemma.subtitle': 'One decision per cycle',
  'dilemma.choose': 'Decide',
  'dilemma.none': 'No decision pending.',
  'dilemma.resolved': 'Decision made',

  'report.title': 'Cycle {n} report',
  'report.world': 'World',
  'report.lives': 'Lives',
  'report.network': 'Relationships',
  'report.highlights': 'Worth noting',
  'report.continue': 'Continue',
  'report.noHighlights': 'Nothing notable this time.',
  'report.reason': 'Reason',
  'report.thought': 'Thought',
  'report.moved': 'Changed place',

  'chronicle.title': 'Chronicle',
  'chronicle.subtitle': 'Everything that actually happened',
  'chronicle.filter.all': 'All',
  'chronicle.filter.lives': 'Lives',
  'chronicle.filter.world': 'World',
  'chronicle.filter.player': 'You',
  'chronicle.empty': 'The chronicle is empty: run a cycle.',

  'signatures.title': 'Signatures',
  'signatures.subtitle': '{got} of {total} earned',
  'signatures.empty': 'No signature yet.',

  'ending.title': 'End of the iteration',
  'ending.replay': 'Start a new iteration',
  'ending.score': 'Final score',
  'ending.goals': 'Goals accomplished',
  'ending.signatures': 'Signatures',
  'ending.lucidity': 'Final lucidity',
  'ending.stability': 'Final stability',
  'ending.export': 'Export the save',

  'codex.title': 'Codex',
  'codex.premise': 'Premise',
  'codex.goals': 'Life goals',
  'codex.interventions': 'Interventions',
  'codex.endings': 'Possible endings',
  'codex.originality': 'Origin',
  'codex.anomaly': 'Anomaly',
  'codex.credits': 'Help',
  'codex.help':
    'Advance a cycle to let the world live. Spend Flux to bend a life, settle the cycle\'s situation, and watch Lucidity: the more you help, the more they doubt. Stability pays for your mistakes.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.reduceMotion': 'Reduce motion',
  'settings.reduceMotionHint': 'Removes all non-essential movement.',
  'settings.contrast': 'Higher contrast',
  'settings.contrastHint': 'Brightens backgrounds and borders.',
  'settings.sound': 'Haptics',
  'settings.soundHint': 'A light buzz on actions (mobile only).',
  'settings.reset': 'Reset the iteration',
  'settings.resetHint': 'Erases server-side progress and restarts at cycle 1.',
  'settings.resetConfirm': 'Erase everything and restart at cycle 1?',
  'settings.export': 'Export the save',
  'settings.exportHint': 'Copies the full JSON of your iteration.',
  'settings.import': 'Import a save',
  'settings.importHint': 'Paste an exported JSON to resume a run.',
  'settings.importPlaceholder': '{"format":"arcadia-9/save", …}',
  'settings.importApply': 'Import',
  'settings.backend': 'Backend',
  'settings.backendHint': 'Address the app is using.',
  'settings.about': 'About',
  'settings.aboutText':
    'ARCADIA-9 is an original work. The inspiration cited by the project is high-level only: no character, text or asset is taken from it.',

  'support.title': 'Support ARCADIA-9',
  'support.subtitle': 'No real payment in this build',
  'support.principles': 'Our rules',
  'support.grants': 'What it gives',
  'support.never': 'What it never gives',
  'support.disabled': 'Purchases disabled in this demo',
  'support.why': 'Why these offers exist',

  'toast.cycle': 'Cycle {n} resolved',
  'toast.intervention': 'Intervention applied',
  'toast.decision': 'Decision recorded',
  'toast.reset': 'New iteration started',
  'toast.saved': 'Save exported',
  'toast.loaded': 'Save imported',
  'toast.ending': 'The iteration has ended',
  'toast.error': 'Something went wrong',
  'toast.paused': 'Iteration paused: the world is frozen.',
  'toast.resumed': 'Iteration resumed.',

  'offline.title': 'Backend unreachable',
  'offline.body':
    'The app cannot reach {url}. Start the server and try again: the exact commands are in the session report and in the README.',
  'offline.hint': 'Expected command: cd backend && python -m uvicorn server:app --port 8000',
}

const DICTIONARIES: Record<Lang, Dict> = { fr, en };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key;
  if (!vars) return template;
  return Object.keys(vars).reduce(
    (acc, name) => acc.split(`{${name}}`).join(String(vars[name])),
    template,
  );
}

interface I18nValue {
  lang: Lang;
  ready: boolean;
  setLang: (next: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Render backend-provided localised text in the active language. */
  lt: (text: Localized | undefined | null, fallback?: string) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: 'fr',
  ready: true,
  setLang: () => undefined,
  t: (key) => translate('fr', key),
  lt: (text, fallback = '') => (text ? text.fr || text.en || fallback : fallback),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && (stored === 'fr' || stored === 'en')) setLangState(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      ready,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      lt: (text, fallback = '') => {
        if (!text) return fallback;
        return (lang === 'fr' ? text.fr : text.en) || text.fr || text.en || fallback;
      },
    }),
    [lang, ready, setLang],
  );

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
