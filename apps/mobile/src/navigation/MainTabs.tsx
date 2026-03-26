import { View, Pressable, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { LogStack } from './LogStack';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useLocale } from '../i18n';

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

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  return (
    <View
      style={[styles.outerContainer, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}
      pointerEvents="box-none"
    >
      <View style={styles.pillClip}>
        {/* Native UIVisualEffectView — systemUltraThinMaterial is what iOS 26 uses for glass */}
        <BlurView tint="systemUltraThinMaterial" intensity={85} style={StyleSheet.absoluteFill} />

        {/* Specular highlight ring — matches iOS 26 glass border */}
        <View style={styles.glassRing} />

        {/* Tab items */}
        <View style={styles.tabRow}>
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
                  style={styles.tabItem}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={label}
                >
                  {/* Log FAB — also uses glass/vibrancy fill */}
                  <View style={styles.logFab}>
                    <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />
                    <View style={styles.logFabHighlight} />
                    <Ionicons name="add" size={24} color="rgba(255,255,255,0.95)" />
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
                {/* Active pill indicator */}
                {isFocused && <View style={styles.activePill} />}

                <Ionicons
                  name={isFocused ? icons.active : icons.inactive}
                  size={22}
                  color={isFocused ? 'rgba(0, 0, 0, 0.85)' : 'rgba(60, 60, 67, 0.45)'}
                />
                <Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? 'rgba(0,0,0,0.85)' : 'rgba(60,60,67,0.45)',
                      fontWeight: isFocused ? '600' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    // no background — fully transparent so screen bleeds through glass
  },
  pillClip: {
    borderRadius: 50,
    overflow: 'hidden',
    // iOS 26-style floating shadow
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
  },
  glassRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.55)',
    // top-edge specular highlight
    borderTopColor: 'rgba(255,255,255,0.75)',
  },
  tabRow: {
    flexDirection: 'row',
    height: 66,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  logFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  logFabHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderTopColor: 'rgba(255,255,255,0.45)',
  },
});

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Let content render beneath the glass tab bar
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Log" component={LogStack} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
