import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

/** Ring icon used in the legend rows */
function RingIcon({ color, dashed }: { color: string; dashed?: boolean }) {
  const size = 44;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;

  return (
    <Svg width={size} height={size}>
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        {...(dashed ? { strokeDasharray: `${4} ${4}` } : {})}
      />
    </Svg>
  );
}

/** Mini calendar preview matching the design */
function CalendarPreview() {
  const c = useColors();

  const days = [
    { label: 'Sun', num: 10, ring: c.danger as string | null },
    { label: 'Mon', num: 11, ring: null },
    { label: 'Tue', num: 12, ring: c.success },
    { label: 'Wed', num: 13, ring: null, isToday: true },
    { label: 'Thu', num: 14, ring: null, isFuture: true },
    { label: 'Fri', num: 15, ring: null, isFuture: true },
    { label: 'Sat', num: 16, ring: null, isFuture: true },
  ];

  return (
    <View className="mx-6 rounded-3xl p-4 pb-5 bg-surface-card">
      {/* App header row */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-base">{'🍏'}</Text>
          <Text className="text-lg font-sans-bold text-text">Cal AI</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5 bg-surface-secondary">
          <Text className="text-sm">{'🔥'}</Text>
          <Text className="text-sm font-sans-bold text-text">15</Text>
        </View>
      </View>

      {/* Week strip */}
      <View className="flex-row">
        {days.map((day) => {
          const circleSize = 38;
          const isToday = day.isToday;
          const isFuture = day.isFuture;
          const hasRing = !!day.ring;

          return (
            <View key={day.label} className="flex-1 items-center">
              <Text
                className={`text-xs font-sans-medium mb-1.5 ${isToday ? 'text-text' : 'text-text-tertiary'}`}
              >
                {day.label}
              </Text>
              <View
                style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(isToday
                    ? { backgroundColor: c.text }
                    : {
                        borderWidth: hasRing ? 2 : 1.5,
                        borderColor: hasRing ? day.ring! : isFuture ? c.border : c.textTertiary,
                        borderStyle: hasRing ? 'solid' : 'dashed',
                      }),
                }}
              >
                <Text
                  className={`text-sm ${isToday ? 'font-sans-bold' : 'font-sans-medium'}`}
                  style={{ color: isToday ? c.bg : hasRing ? c.text : c.textTertiary }}
                >
                  {day.num}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Legend row */
function LegendRow({
  color,
  title,
  description,
  dashed,
}: {
  color: string;
  title: string;
  description: string;
  dashed?: boolean;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(dashed ? 300 : 0).duration(350)}
      className="flex-row items-center px-6 mb-5"
    >
      <RingIcon color={color} dashed={dashed} />
      <View className="ml-4 flex-1">
        <Text className="text-base font-sans-semibold text-text leading-6">{title}</Text>
        <Text className="text-sm text-text-tertiary font-sans mt-0.5 leading-5">{description}</Text>
      </View>
    </Animated.View>
  );
}

export function RingColorsExplainedScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const { t } = useLocale();

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Back button */}
        <View className="px-5 pt-2 pb-2">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            className="h-11 w-11 rounded-full items-center justify-center bg-surface-card"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={20} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          {/* Title */}
          <Animated.View entering={FadeInDown.duration(350)}>
            <Text className="text-2xl font-sans-bold text-text px-6 mb-6 leading-8">
              {t('ringColors.title')}
            </Text>
          </Animated.View>

          {/* Calendar preview card */}
          <Animated.View entering={FadeInDown.delay(50).duration(350)}>
            <CalendarPreview />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text className="text-base text-text-secondary font-sans leading-6 px-6 mt-6 mb-7">
              {t('ringColors.description')}
            </Text>
          </Animated.View>

          {/* Legend */}
          <LegendRow
            color={c.success}
            title={t('ringColors.greenTitle')}
            description={t('ringColors.greenDesc')}
          />
          <LegendRow
            color={c.warning}
            title={t('ringColors.yellowTitle')}
            description={t('ringColors.yellowDesc')}
          />
          <LegendRow
            color={c.danger}
            title={t('ringColors.redTitle')}
            description={t('ringColors.redDesc')}
          />
          <LegendRow
            color={c.textTertiary}
            title={t('ringColors.dottedTitle')}
            description={t('ringColors.dottedDesc')}
            dashed
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
