// The web document shell. Expo Router renders the app into this page, so this
// is the only place where the browser title, the language, the description and
// the icon can be set. No generator badge, no third-party script.
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const TITLE = 'ARCADIA-9 : simulateur de vies, 18 cycles, six habitants';
const DESCRIPTION =
  "Observez six habitants d'une ville simulée, faites avancer les cycles et dépensez du Flux pour intervenir. Chaque geste laisse une trace.";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr" style={{ height: '100%' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0B0D10" />

        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.webmanifest" />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content="/icon-512.png" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* React Native Web needs the body locked so ScrollViews keep their behaviour. */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { background-color: #0B0D10; }
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              #root, #root > div { height: 100%; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
              }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0B0D10',
        }}
      >
        {children}
      </body>
    </html>
  );
}
