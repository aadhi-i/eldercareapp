import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) return null;

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack initialRouteName="login">
        {/* Login screen without header */}
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
          }}
        />

        {/* Signup screen without header/back button */}
        <Stack.Screen
          name="signup"
          options={{
            headerShown: false,
          }}
        />

        {/* Auth/Onboarding screens without headers/back buttons */}
        <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
        <Stack.Screen name="setupProfile" options={{ headerShown: false }} />

        {/* App screens without headers (custom in-screen headers/drawers) */}
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="medication" options={{ headerShown: false }} />
        <Stack.Screen name="dailyRoutines" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="userProfile" options={{ headerShown: false }} />

        {/* Not found fallback screen */}
        <Stack.Screen
          name="+not-found"
          options={{
            title: 'ElderCare – Not Found',
            headerTitleAlign: 'center',
          }}
        />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
