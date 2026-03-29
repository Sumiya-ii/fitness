import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BackButton, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import { useColors } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import type { WorkoutTypeInfo } from '../../api/workouts';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_ORDER = ['cardio', 'strength', 'hiit', 'sports', 'flexibility'];

export function WorkoutTypePickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkoutTypePicker'>>();
  const initialCategory = (route.params as { category?: string } | undefined)?.category;
  const { t, locale } = useLocale();
  const c = useColors();
  const { catalog, catalogFlat, catalogLoading, fetchCatalog } = useWorkoutStore();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory ?? null);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const label = (l: { en: string; mn: string }) => (locale === 'mn' ? l.mn : l.en);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q && !activeCategory) return null; // show grouped view
    let items = catalogFlat;
    if (activeCategory) {
      items = items.filter((i) => i.category === activeCategory);
    }
    if (q) {
      items = items.filter(
        (i) =>
          i.label.en.toLowerCase().includes(q) ||
          i.label.mn.toLowerCase().includes(q) ||
          i.key.includes(q),
      );
    }
    return items;
  }, [query, activeCategory, catalogFlat]);

  const selectType = (type: WorkoutTypeInfo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WorkoutActive', { workoutType: type.key });
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 pt-3 pb-2">
          <BackButton />
          <Text className="ml-3 text-xl font-sans-bold text-text-DEFAULT">
            {t('workout.chooseType')}
          </Text>
        </View>

        {/* Search */}
        <View className="mx-5 mt-2 mb-3">
          <View className="bg-surface-default rounded-2xl flex-row items-center px-4 h-12 border border-surface-border">
            <Ionicons name="search" size={20} color={c.textTertiary} />
            <TextInput
              className="flex-1 ml-3 text-base font-sans text-text-DEFAULT"
              placeholder={t('workout.searchTypes')}
              placeholderTextColor={c.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel={t('workout.searchTypes')}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('workout.clearSearch')}
                className="h-8 w-8 items-center justify-center"
              >
                <Ionicons name="close-circle" size={20} color={c.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-12 mx-5 mb-3"
          contentContainerStyle={{ gap: 8 }}
        >
          <CategoryChip
            label={t('workout.allTypes')}
            active={!activeCategory}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveCategory(null);
            }}
          />
          {CATEGORY_ORDER.map((cat) => (
            <CategoryChip
              key={cat}
              label={t(`workout.cat.${cat}`)}
              active={activeCategory === cat}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveCategory(activeCategory === cat ? null : cat);
              }}
            />
          ))}
        </ScrollView>

        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {catalogLoading ? (
            <View className="mx-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <View
                  key={`sk-${i}`}
                  className="bg-surface-default rounded-2xl p-4 flex-row items-center gap-3 border border-surface-border"
                >
                  <SkeletonLoader variant="rect" width={44} height={44} borderRadius={12} />
                  <View className="flex-1 gap-2">
                    <SkeletonLoader width="50%" height={14} borderRadius={7} />
                    <SkeletonLoader width="30%" height={11} borderRadius={5} />
                  </View>
                </View>
              ))}
            </View>
          ) : filtered ? (
            /* Flat filtered results */
            <View className="mx-5 gap-2">
              {filtered.length === 0 ? (
                <View className="bg-surface-default rounded-3xl p-8 items-center border border-surface-border mt-4">
                  <Ionicons name="search-outline" size={32} color={c.textTertiary} />
                  <Text className="text-sm font-sans-medium text-text-tertiary mt-3 text-center leading-5">
                    {t('workout.noResults')}
                  </Text>
                </View>
              ) : (
                filtered.map((type, i) => (
                  <TypeRow
                    key={type.key}
                    type={type}
                    index={i}
                    onPress={selectType}
                    label={label}
                  />
                ))
              )}
            </View>
          ) : (
            /* Grouped by category */
            <View className="mx-5">
              {CATEGORY_ORDER.filter((cat) => catalog[cat]?.length).map((cat, catIdx) => (
                <Animated.View
                  key={cat}
                  entering={FadeInDown.delay(catIdx * 40).duration(250)}
                  className="mb-6"
                >
                  <Text className="text-xs font-sans-bold uppercase tracking-wider mb-2.5 text-text-tertiary">
                    {t(`workout.cat.${cat}`)}
                  </Text>
                  <View className="gap-2">
                    {catalog[cat]!.map((type, i) => (
                      <TypeRow
                        key={type.key}
                        type={type}
                        index={i}
                        onPress={selectType}
                        label={label}
                      />
                    ))}
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Category Chip ─────────────────────────────────────────────────────────── */

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      className={`rounded-full px-4 min-h-[36px] items-center justify-center ${
        active ? 'bg-primary-500' : 'bg-surface-default border border-surface-border'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${active ? 'text-on-primary' : 'text-text-secondary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Type Row ──────────────────────────────────────────────────────────────── */

function TypeRow({
  type,
  index: _index,
  onPress,
  label,
}: {
  type: WorkoutTypeInfo;
  index: number;
  onPress: (t: WorkoutTypeInfo) => void;
  label: (l: { en: string; mn: string }) => string;
}) {
  const c = useColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onPress(type)}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={label(type.label)}
      className="bg-surface-default rounded-2xl flex-row items-center px-4 py-3 border border-surface-border min-h-[56px]"
    >
      <View className="h-11 w-11 rounded-xl bg-surface-secondary items-center justify-center mr-3">
        <Text className="text-lg">{type.icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-sans-semibold text-text-DEFAULT leading-5">
          {label(type.label)}
        </Text>
        <Text className="text-xs text-text-tertiary font-sans mt-0.5 leading-4">
          {type.met} MET · {type.category}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </AnimatedPressable>
  );
}
