import { TextStyle } from 'react-native';

export const colors = {
  accent: '#6366F1',
  accentMuted: 'rgba(99, 102, 241, 0.15)',
  accentSubtle: 'rgba(99, 102, 241, 0.08)',

  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  warning: '#EAB308',
  warningMuted: 'rgba(234, 179, 8, 0.15)',
  danger: '#EF4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',

  dark: {
    bg: '#09090B',
    bgElevated: '#18181B',
    bgSubtle: '#27272A',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    textMuted: '#52525B',
  },
  light: {
    bg: '#FAFAFA',
    bgElevated: '#FFFFFF',
    bgSubtle: '#F4F4F5',
    border: 'rgba(0, 0, 0, 0.08)',
    borderSubtle: 'rgba(0, 0, 0, 0.04)',
    text: '#09090B',
    textSecondary: '#52525B',
    textTertiary: '#71717A',
    textMuted: '#A1A1AA',
  },
} as const;

export type ThemeColors = typeof colors.dark | typeof colors.light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  largeTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  } as TextStyle,
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
  } as TextStyle,
  headline: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 22,
  } as TextStyle,
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,
  callout: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,
  subhead: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 18,
  } as TextStyle,
  footnote: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,
  caption: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    lineHeight: 14,
  } as TextStyle,
  mono: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
    lineHeight: 20,
  } as TextStyle,
} as const;

export const categoryColors: Record<string, string> = {
  cybersecurity: '#EF4444',
  'software-dev': '#3B82F6',
  'ai-ml': '#8B5CF6',
  networking: '#06B6D4',
  'design-product': '#F59E0B',
  cloud: '#10B981',
  devops: '#EC4899',
  data: '#14B8A6',
};
