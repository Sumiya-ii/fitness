import { View, Pressable, Text, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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

function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 8) + 4,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#ffffff',
          borderRadius: 28,
          height: 68,
          shadowColor: '#0b1220',
          shadowOpacity: 0.14,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: 14,
          alignItems: 'center',
          paddingHorizontal: 4,
          ...Platform.select({
            ios: {},
            android: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
          }),
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const isLog = route.name === 'Log';
          const icons = TAB_ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
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
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: '#0f172a',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#0f172a',
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                  }}
                >
                  <Ionicons name="add" size={26} color="#ffffff" />
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isFocused ? '#f0f4f9' : 'transparent',
                }}
              >
                <Ionicons
                  name={isFocused ? icons.active : icons.inactive}
                  size={20}
                  color={isFocused ? '#0f172a' : '#a8b8cc'}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: isFocused ? 'Inter-SemiBold' : 'Inter-Regular',
                  color: isFocused ? '#0f172a' : '#a8b8cc',
                  letterSpacing: 0.2,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Log" component={LogStack} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
