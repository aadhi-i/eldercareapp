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

        {/* Tab layout screen with ElderCare header */}
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: true,
            title: 'ElderCare',
            headerTitleAlign: 'center',
          }}
        />

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
