import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { I18nProvider } from "@/src/game/i18n";
import { applyWebHead } from "@/src/game/webHead";
import { PreferencesProvider } from "@/src/components/ui";


// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered: which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  // The web tab title, description and icon: the single-page build does not use
  // app/+html.tsx, so they are applied here (no-op on iOS and Android).
  useEffect(() => {
    applyWebHead({
      title: 'ARCADIA-9 : simulateur de vies, 18 cycles, six habitants',
      description:
        "Observez six habitants d'une ville simulée, faites avancer les cycles et dépensez du Flux pour intervenir.",
      lang: 'fr',
      themeColor: '#0B0D10',
    });
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app: icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  // Language and accessibility preferences wrap every route: the whole app is
  // translated and the reduce-motion/contrast choices must reach every screen.
  return (
    <I18nProvider>
      <PreferencesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PreferencesProvider>
    </I18nProvider>
  );
}
