import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Home, Compass, BookOpen, Target, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  const { colors: t } = useTheme();
  const { t: tr } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: t.textTertiary,
        tabBarStyle: {
          backgroundColor: t.bgElevated,
          borderTopColor: t.border,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: tr('tabs.home'),
          tabBarIcon: ({ color }) => <Home size={20} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: tr('tabs.explore'),
          tabBarIcon: ({ color }) => <Compass size={20} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: tr('tabs.learn'),
          tabBarIcon: ({ color }) => <BookOpen size={20} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: tr('tabs.quiz'),
          tabBarIcon: ({ color }) => <Target size={20} color={color} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr('tabs.profile'),
          tabBarIcon: ({ color }) => <User size={20} color={color} strokeWidth={1.8} />,
        }}
      />
    </Tabs>
  );
}
