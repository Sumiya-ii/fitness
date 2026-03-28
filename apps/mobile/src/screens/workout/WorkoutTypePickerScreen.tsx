import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BackButton, SkeletonLoader } from '../../components/ui';
import { useWorkoutStore } from '../../stores/workout.store';
import { useLocale } from '../../i18n';
import type { MainStackParamList } from '../../navigation/types';
import type { WorkoutTypeInfo } from '../../api/workouts';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const CATEGORY_ORDER = ['cardio', 'strength', 'hiit', 'sports', 'flexibility'];

const CATEGORY_COLORS: Record<string, string> = {
  cardio: '#2563eb',
  strength: '#d97706',
  hiit: '#dc2626',
  sports: '#16a34a',
  flexibility: '#7c3aed',
};

export function WorkoutTypePickerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkoutTypePicker'>>();
  const initialCategory = (route.params as { category?: string } | undefined)?.category;
  const { t, locale } = useLocale();
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
    (navigation as any).navigate('WorkoutActive', { workoutType: type.key });
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
          <View className="bg-surface-card rounded-2xl flex-row items-center px-4 py-3 border border-surface-border">
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              className="flex-1 ml-3 text-base font-sans text-text-DEFAULT"
              placeholder={t('workout.searchTypes')}
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
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
          <Pressable
            onPress={() => setActiveCategory(null)}
            className={`rounded-full px-4 py-2 ${!activeCategory ? 'bg-primary-500' : 'bg-surface-card border border-surface-border'}`}
          >
            <Text
              className={`text-sm font-sans-medium ${!activeCategory ? 'text-on-primary' : 'text-text-secondary'}`}
            >
              {t('workout.allTypes')}
            </Text>
          </Pressable>
          {CATEGORY_ORDER.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`rounded-full px-4 py-2 ${activeCategory === cat ? 'bg-primary-500' : 'bg-surface-card border border-surface-border'}`}
            >
              <Text
                className={`text-sm font-sans-medium capitalize ${activeCategory === cat ? 'text-on-primary' : 'text-text-secondary'}`}
              >
                {t(`workout.cat.${cat}`)}
              </Text>
            </Pressable>
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
                  className="bg-surface-card rounded-2xl p-3.5 flex-row items-center gap-3 border border-surface-border"
                >
                  <SkeletonLoader variant="rect" width={44} height={44} borderRadius={12} />
                  <View className="flex-1 gap-2">
                    <SkeletonLoader width="50%" height={13} borderRadius={6} />
                    <SkeletonLoader width="30%" height={11} borderRadius={6} />
                  </View>
                </View>
              ))}
            </View>
          ) : filtered ? (
            // Flat filtered results
            <View className="mx-5 gap-2">
              {filtered.length === 0 ? (
                <View className="bg-surface-card rounded-2xl p-6 items-center border border-surface-border mt-4">
                  <Ionicons name="search-outline" size={28} color="#3a3a3c" />
                  <Text className="text-sm font-sans-medium text-text-tertiary mt-2">
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
            // Grouped by category
            <View className="mx-5">
              {CATEGORY_ORDER.filter((cat) => catalog[cat]?.length).map((cat, catIdx) => (
                <Animated.View
                  key={cat}
                  entering={FadeInDown.delay(catIdx * 40).duration(250)}
                  className="mb-5"
                >
                  <Text
                    className="text-sm font-sans-bold uppercase tracking-wider mb-2"
                    style={{ color: CATEGORY_COLORS[cat] ?? '#64748b' }}
                  >
                    {t(`workout.cat.${cat}`)}
                  </Text>
                  <View className="gap-1.5">
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

function TypeRow({
  type,
  onPress,
  label,
}: {
  type: WorkoutTypeInfo;
  index: number;
  onPress: (t: WorkoutTypeInfo) => void;
  label: (l: { en: string; mn: string }) => string;
}) {
  return (
    <Pressable
      onPress={() => onPress(type)}
      className="bg-surface-card rounded-xl flex-row items-center px-3.5 py-3 border border-surface-border"
    >
      <View className="h-10 w-10 rounded-lg bg-surface-secondary items-center justify-center mr-3">
        <Text className="text-lg">{type.icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-sans-semibold text-text-DEFAULT">{label(type.label)}</Text>
        <Text className="text-xs text-text-tertiary font-sans mt-0.5">
          {type.met} MET · {type.category}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#3a3a3c" />
    </Pressable>
  );
}
