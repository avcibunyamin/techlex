import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from '@/constants/theme';
import { useAppStore } from './store';

export type ThemeMode = 'system' | 'light' | 'dark';

export function useTheme() {
  const systemScheme = useColorScheme();
  const themeMode = useAppStore((s) => s.themeMode);

  const isDark =
    themeMode === 'system'
      ? systemScheme !== 'light'
      : themeMode === 'dark';

  const t: ThemeColors = isDark ? colors.dark : colors.light;
  return { colors: t, isDark, accent: colors.accent, themeMode } as const;
}
