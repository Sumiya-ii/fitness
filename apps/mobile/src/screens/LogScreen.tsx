import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SkeletonLoader } from '../components/ui';
import { mealsApi, type RecentItem } from '../api/meals';
import type { LogStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLocale } from '../i18n';

type NavProp = NativeStackNavigationProp<LogStackParamList, 'LogHome'>;

export function LogScreen() {
  const navigation = useNavigation<NavProp>();
  const { t } = useLocale();
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoadingRecents(true);
      mealsApi
        .getRecents(10)
        .then((res) => setRecents(res.data))
        .catch(() => setRecents([]))
        .finally(() => setLoadingRecents(false));
    }, []),
  );

  return (
    <View className="flex-1 bg-[#f4f7fb]">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-5">
            <Text className="text-2xl font-sans-bold text-[#0b1220]">{t('logging.logMeal')}</Text>
            <Text className="text-sm text-[#7687a2] font-sans-medium mt-1">
              {t('logging.chooseHow')}
            </Text>
          </View>

          {/* ── Primary Action: AI Photo ── */}
          <Animated.View entering={FadeInDown.duration(350)} className="mx-4 mb-4">
            <Pressable
              onPress={() => navigation.navigate('PhotoLog')}
              className="bg-[#0f172a] rounded-3xl overflow-hidden"
              style={{
                shadowColor: '#0f172a',
                shadowOpacity: 0.25,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <View className="p-6 flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  {/* AI badge */}
                  <View className="flex-row items-center gap-1.5 mb-3">
                    <View className="h-5 w-5 rounded-full bg-white/15 items-center justify-center">
                      <Ionicons name="sparkles" size={11} color="#ffffff" />
                    </View>
                    <Text className="text-xs font-sans-semibold text-white/60 uppercase tracking-widest">
                      {t('logging.aiPowered')}
                    </Text>
                  </View>
                  <Text className="text-2xl font-sans-bold text-white mb-1.5">
                    {t('logging.snapTrack')}
                  </Text>
                  <Text className="text-sm text-white/60 font-sans-medium leading-5">
                    {t('logging.snapDesc')}
                  </Text>
                </View>

                {/* Camera icon circle */}
                <View
                  className="h-20 w-20 rounded-3xl bg-white/10 items-center justify-center"
                  style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
                >
                  <Ionicons name="camera" size={36} color="#ffffff" />
                </View>
              </View>

              {/* Tap hint bar at bottom */}
              <View
                className="flex-row items-center justify-center gap-1.5 py-3"
                style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}
              >
                <Text className="text-xs text-white/40 font-sans-medium">Tap to open camera</Text>
                <Ionicons name="arrow-forward" size={11} color="rgba(255,255,255,0.4)" />
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Secondary Methods: 2x2 grid ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(350)} className="mx-4 mb-4">
            <View className="flex-row gap-3 mb-3">
              {/* Search */}
              <Pressable
                onPress={() => navigation.navigate('TextSearch')}
                className="flex-1 bg-white rounded-3xl items-center py-5"
                style={{
                  shadowColor: '#0b1220',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View className="h-14 w-14 rounded-2xl bg-[#f0f4ff] items-center justify-center mb-3">
                  <Ionicons name="search" size={26} color="#3b5bdb" />
                </View>
                <Text className="text-sm font-sans-bold text-[#0b1220]">
                  {t('logging.textSearch')}
                </Text>
                <Text className="text-xs text-[#9aabbf] font-sans-medium mt-0.5">
                  {t('logging.findFoods')}
                </Text>
              </Pressable>

              {/* Barcode */}
              <Pressable
                onPress={() => navigation.navigate('BarcodeScan')}
                className="flex-1 bg-white rounded-3xl items-center py-5"
                style={{
                  shadowColor: '#0b1220',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View className="h-14 w-14 rounded-2xl bg-[#f0fdf4] items-center justify-center mb-3">
                  <Ionicons name="barcode-outline" size={26} color="#16a34a" />
                </View>
                <Text className="text-sm font-sans-bold text-[#0b1220]">Barcode</Text>
                <Text className="text-xs text-[#9aabbf] font-sans-medium mt-0.5">
                  {t('logging.scanLabel')}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row gap-3">
              {/* Label Scan */}
              <Pressable
                onPress={() => navigation.navigate('PhotoLog', { mode: 'label' })}
                className="flex-1 bg-white rounded-3xl items-center py-5"
                style={{
                  shadowColor: '#0b1220',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View className="h-14 w-14 rounded-2xl bg-[#ecfdf5] items-center justify-center mb-3">
                  <Ionicons name="document-text" size={26} color="#059669" />
                </View>
                <Text className="text-sm font-sans-bold text-[#0b1220]">Label</Text>
                <Text className="text-xs text-[#9aabbf] font-sans-medium mt-0.5">Scan package</Text>
              </Pressable>

              {/* Voice */}
              <Pressable
                onPress={() => navigation.navigate('VoiceLog')}
                className="flex-1 bg-white rounded-3xl items-center py-5"
                style={{
                  shadowColor: '#0b1220',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <View className="h-14 w-14 rounded-2xl bg-[#fff7ed] items-center justify-center mb-3">
                  <Ionicons name="mic" size={26} color="#ea580c" />
                </View>
                <Text className="text-sm font-sans-bold text-[#0b1220]">{t('logging.voice')}</Text>
                <Text className="text-xs text-[#9aabbf] font-sans-medium mt-0.5">Speak to log</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* ── Quick Add ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(350)} className="mx-4 mb-6">
            <Pressable
              onPress={() => navigation.navigate('QuickAdd')}
              className="bg-white rounded-2xl flex-row items-center px-5 py-4"
              style={{
                shadowColor: '#0b1220',
                shadowOpacity: 0.05,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <View className="h-10 w-10 rounded-xl bg-[#fdf2f8] items-center justify-center mr-4">
                <Ionicons name="flash" size={20} color="#a855f7" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-sans-bold text-[#0b1220]">
                  {t('logging.quickAdd')}
                </Text>
                <Text className="text-xs text-[#9aabbf] font-sans-medium">
                  {t('logging.manualEntry')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#c3cedf" />
            </Pressable>
          </Animated.View>

          {/* ── My Meals (Saved Templates) ── */}
          <Animated.View entering={FadeInDown.delay(280).duration(350)} className="mx-4 mb-6">
            <Pressable
              onPress={() => navigation.navigate('MealTemplates')}
              className="bg-white rounded-2xl flex-row items-center px-5 py-4"
              style={{
                shadowColor: '#0b1220',
                shadowOpacity: 0.05,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <View className="h-10 w-10 rounded-xl bg-[#eff6ff] items-center justify-center mr-4">
                <Ionicons name="bookmark" size={20} color="#3b5bdb" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-sans-bold text-[#0b1220]">My Meals</Text>
                <Text className="text-xs text-[#9aabbf] font-sans-medium">
                  Saved meal templates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#c3cedf" />
            </Pressable>
          </Animated.View>

          {/* ── Recently Logged ── */}
          <View className="px-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-sans-bold text-[#0b1220]">
                {t('logging.recentMeals')}
              </Text>
              <Pressable onPress={() => navigation.navigate('FavoritesRecents')}>
                <Text className="text-sm font-sans-medium text-[#3b5bdb]">
                  {t('common.seeAll')}
                </Text>
              </Pressable>
            </View>

            {loadingRecents ? (
              <View className="gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <View
                    key={`sk-${i}`}
                    className="bg-white rounded-2xl p-4 flex-row items-center gap-3"
                    style={{ elevation: 1 }}
                  >
                    <SkeletonLoader variant="circle" width={40} />
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="70%" height={13} borderRadius={6} />
                      <SkeletonLoader width="40%" height={11} borderRadius={6} />
                    </View>
                    <SkeletonLoader width={32} height={32} borderRadius={16} />
                  </View>
                ))}
              </View>
            ) : recents.length === 0 ? (
              <Animated.View entering={FadeInUp.duration(350)}>
                <Pressable
                  onPress={() => navigation.navigate('TextSearch')}
                  className="bg-white rounded-2xl p-5 items-center"
                  style={{
                    shadowColor: '#0b1220',
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 1,
                  }}
                >
                  <View className="h-12 w-12 rounded-full bg-[#f4f7fb] items-center justify-center mb-3">
                    <Ionicons name="time-outline" size={22} color="#9aabbf" />
                  </View>
                  <Text className="text-sm font-sans-semibold text-[#0b1220] mb-1">
                    {t('logging.noRecents')}
                  </Text>
                  <Text className="text-xs text-[#9aabbf] text-center">
                    {t('logging.noRecentsDesc')}
                  </Text>
                </Pressable>
              </Animated.View>
            ) : (
              <View
                className="bg-white rounded-3xl overflow-hidden"
                style={{
                  shadowColor: '#0b1220',
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                {recents.slice(0, 6).map((item, index) => (
                  <Animated.View
                    key={item.foodId}
                    entering={FadeInDown.delay(200 + index * 40).duration(300)}
                  >
                    <Pressable
                      onPress={() => navigation.navigate('TextSearch')}
                      className="flex-row items-center px-4 py-3.5"
                      style={
                        index > 0 ? { borderTopWidth: 1, borderTopColor: '#f0f4f9' } : undefined
                      }
                    >
                      {/* Food icon */}
                      <View className="h-10 w-10 rounded-xl bg-[#f4f7fb] items-center justify-center mr-3">
                        <Text style={{ fontSize: 20 }}>🍽️</Text>
                      </View>

                      {/* Name + kcal */}
                      <View className="flex-1 mr-3">
                        <Text
                          className="text-sm font-sans-semibold text-[#0b1220]"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text className="text-xs text-[#9aabbf] font-sans-medium mt-0.5">
                          {item.lastCalories} kcal
                        </Text>
                      </View>

                      {/* Add button */}
                      <View className="h-8 w-8 rounded-full bg-[#f4f7fb] items-center justify-center">
                        <Ionicons name="add" size={18} color="#3b5bdb" />
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
