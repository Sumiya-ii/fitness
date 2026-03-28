import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Ring icon used in the legend rows */
function RingIcon({ color, dashed }: { color: string; dashed?: boolean }) {
  const size = 44;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

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

  // Sample data matching the screenshot: Sun=red, Mon=dashed, Tue=green, Wed=today(selected), Thu-Sat=future
  const days = [
    { label: 'Sun', num: 10, ring: '#ef4444' as string | null },
    { label: 'Mon', num: 11, ring: null }, // dashed — no meals
    { label: 'Tue', num: 12, ring: '#22c55e' },
    { label: 'Wed', num: 13, ring: null, isToday: true },
    { label: 'Thu', num: 14, ring: null, isFuture: true },
    { label: 'Fri', num: 15, ring: null, isFuture: true },
    { label: 'Sat', num: 16, ring: null, isFuture: true },
  ];

  return (
    <View className="mx-6 rounded-3xl px-4 pt-4 pb-5" style={{ backgroundColor: c.card }}>
      {/* App header row */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 16 }}>🍏</Text>
          <Text style={{ fontFamily: 'Inter-Bold', fontSize: 18, color: c.text }}>Cal AI</Text>
        </View>
        <View
          className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ backgroundColor: c.cardAlt }}
        >
          <Text style={{ fontSize: 13 }}>🔥</Text>
          <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: c.text }}>15</Text>
        </View>
      </View>

      {/* Week strip */}
      <View style={{ flexDirection: 'row' }}>
        {days.map((day) => {
          const circleSize = 38;
          const isToday = day.isToday;
          const isFuture = day.isFuture;
          const hasRing = !!day.ring;

          return (
            <View key={day.label} style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Inter-Medium',
                  color: isToday ? c.text : c.textTertiary,
                  marginBottom: 6,
                }}
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
                  style={{
                    fontSize: 14,
                    fontFamily: isToday ? 'Inter-Bold' : 'Inter-Medium',
                    color: isToday ? c.bg : hasRing ? c.text : c.textTertiary,
                  }}
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
  const c = useColors();

  return (
    <View className="flex-row items-center px-6 mb-5">
      <RingIcon color={color} dashed={dashed} />
      <View className="ml-4 flex-1">
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 16, color: c.text }}>{title}</Text>
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 14,
            color: c.textTertiary,
            marginTop: 2,
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

export function RingColorsExplainedScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const { t } = useLocale();

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Back button */}
        <View className="px-4 pt-2 pb-2">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full items-center justify-center"
            style={{ backgroundColor: c.card }}
          >
            <Ionicons name="arrow-back" size={20} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          {/* Title */}
          <Text
            style={{
              fontFamily: 'Inter-Bold',
              fontSize: 28,
              color: c.text,
              paddingHorizontal: 24,
              marginBottom: 24,
            }}
          >
            {t('ringColors.title')}
          </Text>

          {/* Calendar preview card */}
          <CalendarPreview />

          {/* Description */}
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 15,
              color: c.textSecondary,
              lineHeight: 22,
              paddingHorizontal: 24,
              marginTop: 24,
              marginBottom: 28,
            }}
          >
            {t('ringColors.description')}
          </Text>

          {/* Legend */}
          <LegendRow
            color="#22c55e"
            title={t('ringColors.greenTitle')}
            description={t('ringColors.greenDesc')}
          />
          <LegendRow
            color="#eab308"
            title={t('ringColors.yellowTitle')}
            description={t('ringColors.yellowDesc')}
          />
          <LegendRow
            color="#ef4444"
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
