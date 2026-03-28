import { useState, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, Modal } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import type { MainTabParamList, LogStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { LogStack } from './LogStack';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  Home: { active: 'grid', inactive: 'grid-outline' },
  Log: { active: 'add', inactive: 'add' },
  Progress: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  Settings: { active: 'person', inactive: 'person-outline' },
};

const TAB_LABEL_KEYS: Record<string, string> = {
  Home: 'tabs.home',
  Log: 'tabs.log',
  Progress: 'tabs.progress',
  Settings: 'tabs.settings',
};

type QuickAction = {
  key: string;
  icon: IconName;
  labelKey: string;
  color: string;
  screen: keyof LogStackParamList;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'photo', icon: 'camera', labelKey: 'logging.photo', color: '#ffffff', screen: 'PhotoLog' },
  { key: 'voice', icon: 'mic', labelKey: 'logging.voice', color: '#f97316', screen: 'VoiceLog' },
  {
    key: 'scan',
    icon: 'barcode-outline',
    labelKey: 'logging.scan',
    color: '#22c55e',
    screen: 'BarcodeScan',
  },
  { key: 'quick', icon: 'flash', labelKey: 'logging.quick', color: '#a78bfa', screen: 'QuickAdd' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const c = useColors();
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  const handleQuickAction = useCallback(
    (screen: keyof LogStackParamList) => {
      setShowQuickMenu(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Log', { screen });
    },
    [navigation],
  );

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: c.tabBarBg,
            borderTopColor: c.tabBarBorder,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const isLog = route.name === 'Log';
          const icons = TAB_ICONS[route.name] ?? {
            active: 'ellipse',
            inactive: 'ellipse-outline',
          };
          const label = t(TAB_LABEL_KEYS[route.name] ?? route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (isLog) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  setShowQuickMenu(true);
                }}
                style={styles.tabItem}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <View style={[styles.logButton, { backgroundColor: c.primary }]}>
                  <Ionicons name="add" size={24} color={c.onPrimary} />
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
            >
              <Ionicons
                name={isFocused ? icons.active : icons.inactive}
                size={22}
                color={isFocused ? c.primary : c.tabInactive}
              />
              <Text style={[styles.label, { color: isFocused ? c.primary : c.tabInactive }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick-action popup on long-press */}
      <Modal
        visible={showQuickMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowQuickMenu(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowQuickMenu(false)}>
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
        <Animated.View
          entering={ZoomIn.duration(200).springify().damping(15)}
          exiting={ZoomOut.duration(150)}
          style={[
            styles.quickMenu,
            {
              bottom: 60 + Math.max(insets.bottom, 8),
              backgroundColor: c.tabBarBg,
              borderColor: c.tabBarBorder,
            },
          ]}
        >
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => handleQuickAction(action.screen)}
              style={styles.quickItem}
            >
              <View style={[styles.quickIcon, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={[styles.quickLabel, { color: c.textSecondary ?? '#a1a1aa' }]}>
                {t(action.labelKey)}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  logButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  quickMenu: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  quickItem: {
    alignItems: 'center',
    width: 64,
    gap: 6,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Log" component={LogStack} />
    </Tab.Navigator>
  );
}
