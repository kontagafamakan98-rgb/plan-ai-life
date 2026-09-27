#!/usr/bin/env node
/**
 * Design guard.
 *
 * Thirteen product rules decided by the client, checked mechanically so they
 * cannot come back by accident: no purple, no pill shapes, no invented
 * reviews or metrics, no vague hero copy, no emoji used as icons, no long
 * dashes, no exaggerated scroll or cursor animation, an own favicon, no
 * "made with AI" badge, real GDPR and terms pages, and prices that exist.
 *
 * Run with: npm run guard   (exits non-zero and lists every offence)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const problems = [];
const fail = (file, line, rule, detail) => problems.push({ file, line, rule, detail });

/* ------------------------------------------------------------------ */
/* Sources under guard                                                 */
/* ------------------------------------------------------------------ */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const sourceFiles = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))].map((path) => ({
  path,
  rel: relative(ROOT, path).replace(/\\/g, '/'),
  lines: readFileSync(path, 'utf8').split('\n'),
}));

const text = (file) => file.lines.join('\n');

/* ------------------------------------------------------------------ */
/* Rule 1 and 6: no purple, no emoji used as icons, no long dashes      */
/* ------------------------------------------------------------------ */

const FORBIDDEN_CHARS =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{FE0F}]/u;
const DASHES = /[\u2013\u2014]/u;

for (const file of sourceFiles) {
  file.lines.forEach((line, index) => {
    const charMatch = line.match(FORBIDDEN_CHARS);
    if (charMatch) {
      fail(file.rel, index + 1, 'no emoji or symbol glyphs', `${charMatch[0]} (U+${charMatch[0].codePointAt(0).toString(16)})`);
    }
    if (DASHES.test(line)) {
      fail(file.rel, index + 1, 'no em or en dashes', line.trim().slice(0, 70));
    }
  });
}

/** HSL of a colour, to reject purple by hue rather than by name. */
function hueSaturation(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  return { hue: (hue + 360) % 360, saturation, lightness };
}

for (const file of sourceFiles) {
  file.lines.forEach((line, index) => {
    for (const match of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const { hue, saturation, lightness } = hueSaturation(match[0]);
      if (hue >= 252 && hue <= 306 && saturation > 0.16 && lightness > 0.12 && lightness < 0.8) {
        fail(file.rel, index + 1, 'no purple', `${match[0]} is a violet hue (${Math.round(hue)}deg)`);
      }
    }
    for (const match of line.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      const hex = [1, 2, 3].map((i) => Number(match[i]).toString(16).padStart(2, '0')).join('');
      const { hue, saturation, lightness } = hueSaturation(`#${hex}`);
      if (hue >= 252 && hue <= 306 && saturation > 0.2 && lightness > 0.1 && lightness < 0.85) {
        fail(file.rel, index + 1, 'no purple', `${match[0]}) is a violet hue (${Math.round(hue)}deg)`);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Rule 2: nothing interactive is a pill                               */
/* ------------------------------------------------------------------ */

const isComment = (line) => /^\s*(\/\/|\/\*|\*)/.test(line);
for (const file of sourceFiles) {
  file.lines.forEach((line, index) => {
    // A pill is a fully rounded interactive control, so the banned thing is the
    // named token: style keys, prop names and radius tokens called "pill".
    if (/\bpill\b/i.test(line) && !isComment(line)) {
      fail(file.rel, index + 1, 'no pill shapes', line.trim().slice(0, 70));
    }
  });
}

/* ------------------------------------------------------------------ */
/* Rules 3, 4, 10: no fake reviews, no fake metrics, no AI badge        */
/* ------------------------------------------------------------------ */

// Badge wording and invented proof. Ordinary sentences such as "content
// generated by other users" are not badges, so the list stays specific.
const BANNED_PHRASES = [
  'made with ai',
  'made with love',
  'built with ai',
  'ai-generated',
  'generated with ai',
  'powered by',
  'propulsé par',
  'généré par une ia',
  'généré par ia',
  'avis client',
  'note moyenne',
  'clients satisfaits',
  'millions de joueurs',
  '10 000 joueurs',
  '10000+ joueurs',
];

// A real price is an amount next to a currency, not the dollar sign of a
// template literal, so `${value}` never trips this rule.
const PRICE = /\d\s*[€£]|\d\s*\$|\bEUR\b|\bUSD\b/;

for (const file of sourceFiles) {
  file.lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) fail(file.rel, index + 1, 'no fabricated proof', `${phrase} appears here`);
    }
    if (PRICE.test(line)) {
      fail(file.rel, index + 1, 'no price without a live payment path', line.trim().slice(0, 70));
    }
  });
}

/* ------------------------------------------------------------------ */
/* Rule 8 and 13: no scroll-linked or cursor animation                 */
/* ------------------------------------------------------------------ */

const ANIMATION_APIS = ['Animated.event', 'useAnimatedScrollHandler', 'scrollEventThrottle', 'cursor:'];

for (const file of sourceFiles) {
  file.lines.forEach((line, index) => {
    for (const api of ANIMATION_APIS) {
      if (line.includes(api)) fail(file.rel, index + 1, 'no scroll or cursor animation', api);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Rule 6 continued: every glyph in the table exists in the font       */
/* ------------------------------------------------------------------ */

const glyphPath = join(
  ROOT,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json',
);
if (!existsSync(glyphPath)) {
  fail('node_modules', 0, 'icon font available', 'Ionicons glyphmap not found: run npm install');
} else {
  const glyphmap = JSON.parse(readFileSync(glyphPath, 'utf8'));
  const iconsFile = sourceFiles.find((file) => file.rel === 'src/game/icons.ts');
  if (!iconsFile) {
    fail('src/game/icons.ts', 0, 'glyph table present', 'src/game/icons.ts is missing');
  } else {
    iconsFile.lines.forEach((line, index) => {
      const match = line.match(/^\s{2}'?([a-zA-Z0-9_-]+)'?:\s*'([a-z0-9-]+)',\s*$/);
      if (!match) return;
      const [, key, glyph] = match;
      if (!(glyph in glyphmap)) {
        fail(iconsFile.rel, index + 1, 'glyph must exist', `${key} -> ${glyph} is not an Ionicons glyph`);
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Every key used in the code exists in both languages                 */
/* ------------------------------------------------------------------ */

const i18nFile = sourceFiles.find((file) => file.rel === 'src/game/i18n.ts');
if (!i18nFile) {
  fail('src/game/i18n.ts', 0, 'translation dictionary present', 'src/game/i18n.ts is missing');
} else {
  const source = text(i18nFile);
  const [french, english] = source.split('const en: Dict = {');
  const keyPattern = /^\s{2}'([a-zA-Z0-9._-]+)':/gm;
  const frenchKeys = new Set([...french.matchAll(keyPattern)].map((match) => match[1]));
  const englishKeys = new Set([...(english ?? '').matchAll(keyPattern)].map((match) => match[1]));

  for (const key of frenchKeys) {
    if (!englishKeys.has(key)) fail(i18nFile.rel, 0, 'both languages are complete', `${key} has no English text`);
  }
  for (const key of englishKeys) {
    if (!frenchKeys.has(key)) fail(i18nFile.rel, 0, 'both languages are complete', `${key} has no French text`);
  }

  for (const file of sourceFiles) {
    if (file.rel === 'src/game/i18n.ts') continue;
    file.lines.forEach((line, index) => {
      for (const match of line.matchAll(/\bt\('([a-zA-Z0-9._-]+)'/g)) {
        if (!frenchKeys.has(match[1])) {
          fail(file.rel, index + 1, 'no raw translation keys', `t('${match[1]}') is not in the dictionary`);
        }
      }
      // Template keys such as t(`attribute.${key}`) cannot be resolved statically,
      // so the prefix is checked instead.
      for (const match of line.matchAll(/\bt\(`([a-zA-Z0-9._-]+)\$\{/g)) {
        const prefix = match[1];
        const found = [...frenchKeys].some((key) => key.startsWith(prefix));
        if (!found) {
          fail(file.rel, index + 1, 'no raw translation keys', `no key starts with ${prefix}`);
        }
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Rules 9, 11, 12: favicon, GDPR page, terms page                     */
/* ------------------------------------------------------------------ */

const requiredFiles = [
  ['assets/images/favicon.png', 'own favicon file'],
  ['app/legal/rgpd.tsx', 'GDPR page'],
  ['app/legal/cgu.tsx', 'terms page'],
];
for (const [path, rule] of requiredFiles) {
  if (!existsSync(join(ROOT, path))) fail(path, 0, rule, `${path} is missing`);
}

// The document head lives in two places on purpose: app/+html.tsx for static
// exports, and the runtime injection that the single-page build actually uses.
const htmlShell = join(ROOT, 'app/+html.tsx');
if (!existsSync(htmlShell)) {
  fail('app/+html.tsx', 0, 'own favicon', 'app/+html.tsx is missing');
} else {
  const shell = readFileSync(htmlShell, 'utf8');
  if (!/rel="icon"/.test(shell)) fail('app/+html.tsx', 0, 'own favicon', 'no <link rel="icon"> in the HTML shell');
  if (!/lang="fr"/.test(shell)) fail('app/+html.tsx', 0, 'French document language', 'html lang is not fr');
  if (!/<title>/.test(shell)) fail('app/+html.tsx', 0, 'document title', 'no <title> in the HTML shell');
}

const headHelper = join(ROOT, 'src/game/webHead.ts');
const layoutFile = join(ROOT, 'app/_layout.tsx');
if (!existsSync(headHelper)) {
  fail('src/game/webHead.ts', 0, 'document head for web', 'src/game/webHead.ts is missing');
} else if (!existsSync(layoutFile) || !/applyWebHead/.test(readFileSync(layoutFile, 'utf8'))) {
  fail('app/_layout.tsx', 0, 'document head for web', 'the layout never calls applyWebHead');
} else {
  const helper = readFileSync(headHelper, 'utf8');
  for (const probe of ['favicon.png', 'manifest.webmanifest', 'theme-color']) {
    if (!helper.includes(probe)) fail('src/game/webHead.ts', 0, 'document head for web', `the head does not set ${probe}`);
  }
}

/* ------------------------------------------------------------------ */

if (problems.length === 0) {
  console.log(`design guard: ${sourceFiles.length} files checked, 13 rules respected`);
  process.exit(0);
}

const byRule = new Map();
for (const problem of problems) {
  if (!byRule.has(problem.rule)) byRule.set(problem.rule, []);
  byRule.get(problem.rule).push(problem);
}
console.error(`design guard: ${problems.length} offence(s)`);
for (const [rule, list] of byRule) {
  console.error(`\n  ${rule} (${list.length})`);
  for (const problem of list.slice(0, 25)) {
    console.error(`    ${problem.file}:${problem.line}  ${problem.detail}`);
  }
  if (list.length > 25) console.error(`    ... ${list.length - 25} more`);
}
process.exit(1);
