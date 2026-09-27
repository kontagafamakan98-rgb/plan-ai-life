/**
 * Document head for the single-page web build.
 *
 * `app/+html.tsx` only applies to static rendering, and this project ships the
 * single-page flavour, so the browser tab needs its title, description, theme
 * colour and icon applied from the app itself. Native platforms are untouched.
 */

import { Platform } from 'react-native';

const ICON = '/favicon.png';
const APPLE_ICON = '/icon-192.png';
const MANIFEST = '/manifest.webmanifest';

export interface WebHeadOptions {
  title: string;
  description: string;
  lang: string;
  themeColor: string;
}

function upsertMeta(selector: string, create: () => HTMLElement, apply: (element: HTMLElement) => void) {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  apply(element);
}

function ensureLink(rel: string, href: string, type?: string) {
  upsertMeta(
    `link[rel="${rel}"]`,
    () => {
      const link = document.createElement('link');
      link.setAttribute('rel', rel);
      return link;
    },
    (element) => {
      element.setAttribute('href', href);
      if (type) element.setAttribute('type', type);
    },
  );
}

/** Apply the head on web. Safe to call more than once. */
export function applyWebHead({ title, description, lang, themeColor }: WebHeadOptions) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  document.documentElement.lang = lang;
  document.title = title;

  upsertMeta(
    'meta[name="description"]',
    () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      return meta;
    },
    (element) => element.setAttribute('content', description),
  );

  upsertMeta(
    'meta[name="theme-color"]',
    () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      return meta;
    },
    (element) => element.setAttribute('content', themeColor),
  );

  upsertMeta(
    'meta[name="color-scheme"]',
    () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      return meta;
    },
    (element) => element.setAttribute('content', 'dark'),
  );

  upsertMeta(
    'meta[property="og:title"]',
    () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      return meta;
    },
    (element) => element.setAttribute('content', title),
  );

  ensureLink('icon', ICON, 'image/png');
  ensureLink('apple-touch-icon', APPLE_ICON);
  ensureLink('manifest', MANIFEST);
}
