import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, PanResponder } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { MainTabParamList, LogStackParamList } from './types';
import { features } from '../config/features';
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

// Bottom-to-top: index 0 = closest to + button
// Voice is excluded in MVP v1 (voice logging happens via Telegram bot instead)
// Quick-action accent colors — iOS-system inspired, distinct but not loud.
const MENU_ITEMS: QuickAction[] = [
  { key: 'quick', icon: 'flash', labelKey: 'logging.quick', color: '#FF9500', screen: 'QuickAdd' },
  {
    key: 'scan',
    icon: 'barcode-outline',
    labelKey: 'logging.scan',
    color: '#16A34A',
    screen: 'BarcodeScan',
  },
  ...(features.voiceLoggingInApp
    ? [
        {
          key: 'voice',
          icon: 'mic' as const,
          labelKey: 'logging.voice',
          color: '#FF3B30',
          screen: 'VoiceLog' as const,
        },
      ]
    : []),
  {
    key: 'photo',
    icon: 'camera',
    labelKey: 'logging.photo',
    color: '#0A84FF',
    screen: 'PhotoLog',
  },
] satisfies QuickAction[];

const CIRCLE_SIZE = 48;
const MENU_STEP = 66; // vertical distance between item centers
const MENU_ACTIVATE_OFFSET = 56; // upward distance before first item activates

/* ------------------------------------------------------------------ */
/*  MenuItem — animated circle + label                                 */
/* ------------------------------------------------------------------ */
function MenuItem({
  action,
  isHovered,
  index,
  t,
  c,
}: {
  action: QuickAction;
  isHovered: boolean;
  index: number;
  t: (key: string) => string;
  c: ReturnType<typeof useColors>;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(isHovered ? 1.12 : 1, {
      duration: 100,
      easing: Easing.out(Easing.cubic),
    });
  }, [isHovered, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(150).delay(index * 35)}
      style={[styles.menuItem, animStyle]}
    >
      <View
        style={[
          styles.menuCircle,
          {
            backgroundColor: isHovered ? c.primary : 'rgba(30,30,35,0.94)',
            borderColor: isHovered ? 'transparent' : 'rgba(255,255,255,0.1)',
          },
        ]}
      >
        <Ionicons name={action.icon} size={20} color={isHovered ? '#fff' : action.color} />
      </View>
      <Text
        style={[styles.menuLabel, { color: isHovered ? '#fff' : 'rgba(255,255,255,0.5)' }]}
        numberOfLines={1}
      >
        {t(action.labelKey)}
      </Text>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/*  TabBar                                                             */
/* ------------------------------------------------------------------ */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const c = useColors();

  const [menuVisible, setMenuVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  // Refs for PanResponder (avoids stale closures)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const touchOriginYRef = useRef(0);
  const hoveredIndexRef = useRef(-1);
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const stateRef = useRef(state);
  stateRef.current = state;

  const logRouteIndex = state.routes.findIndex((r) => r.name === 'Log');
  const logRoute = state.routes[logRouteIndex];

  const handleLogTap = useCallback(() => {
    if (!logRoute) return;
    const event = navigationRef.current.emit({
      type: 'tabPress',
      target: logRoute.key,
      canPreventDefault: true,
    });
    if (stateRef.current.index !== logRouteIndex && !event.defaultPrevented) {
      navigationRef.current.navigate('Log');
    }
  }, [logRoute, logRouteIndex]);
  const handleLogTapRef = useRef(handleLogTap);
  handleLogTapRef.current = handleLogTap;

  const getHoveredIndex = useCallback((pageY: number): number => {
    const dy = touchOriginYRef.current - pageY;
    if (dy < MENU_ACTIVATE_OFFSET - MENU_STEP / 2) return -1;
    const idx = Math.round((dy - MENU_ACTIVATE_OFFSET) / MENU_STEP);
    if (idx < 0) return -1;
    return Math.min(idx, MENU_ITEMS.length - 1);
  }, []);

  const cleanup = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isLongPressRef.current = false;
    hoveredIndexRef.current = -1;
    setMenuVisible(false);
    setHoveredIndex(-1);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (evt) => {
          isLongPressRef.current = false;
          touchOriginYRef.current = evt.nativeEvent.pageY;
          hoveredIndexRef.current = -1;

          longPressTimerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMenuVisible(true);
          }, 250);
        },

        onPanResponderMove: (evt) => {
          if (!isLongPressRef.current) {
            const dy = Math.abs(evt.nativeEvent.pageY - touchOriginYRef.current);
            if (dy > 10 && longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            return;
          }

          const idx = getHoveredIndex(evt.nativeEvent.pageY);
          if (idx !== hoveredIndexRef.current) {
            hoveredIndexRef.current = idx;
            setHoveredIndex(idx);
            if (idx >= 0) Haptics.selectionAsync();
          }
        },

        onPanResponderRelease: () => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          if (!isLongPressRef.current) {
            handleLogTapRef.current();
            return;
          }

          const idx = hoveredIndexRef.current;
          const nav = navigationRef.current;
          cleanup();

          if (idx >= 0 && idx < MENU_ITEMS.length) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nav.navigate('Log', { screen: MENU_ITEMS[idx].screen });
          }
        },

        onPanResponderTerminate: () => cleanup(),
      }),
    [getHoveredIndex, cleanup],
  );

  return (
    <View>
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

          if (isLog) {
            return (
              <View
                key={route.key}
                style={[styles.tabItem, styles.logTabItem]}
                {...panResponder.panHandlers}
              >
                {/* Vertical quick-action menu */}
                {menuVisible && (
                  <View style={styles.menuContainer} pointerEvents="none">
                    {MENU_ITEMS.map((action, i) => (
                      <MenuItem
                        key={action.key}
                        action={action}
                        isHovered={hoveredIndex === i}
                        index={i}
                        t={t}
                        c={c}
                      />
                    ))}
                  </View>
                )}
                <View style={[styles.logButton, { backgroundColor: c.primary }]}>
                  <Ionicons name="add" size={24} color={c.onPrimary} />
                </View>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
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
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
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
  logTabItem: {
    overflow: 'visible',
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
  menuContainer: {
    position: 'absolute',
    bottom: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'column-reverse', // index 0 at bottom (closest to button)
    gap: 6,
    paddingBottom: 16,
  },
  menuItem: {
    alignItems: 'center',
    gap: 3,
  },
  menuCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  menuLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

/* ------------------------------------------------------------------ */
/*  MainTabs                                                           */
/* ------------------------------------------------------------------ */
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
