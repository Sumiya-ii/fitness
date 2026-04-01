import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStore } from '../../stores/sync.store';

const BANNER_HEIGHT = 40;
const ANIM_DURATION = 280;

export function SyncBanner() {
  const { isSyncing, isOnline, pendingCount } = useSyncStore();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-(insets.top + BANNER_HEIGHT))).current;

  const shouldShow = isSyncing || (!isOnline && pendingCount > 0);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: shouldShow ? 0 : -(insets.top + BANNER_HEIGHT),
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, insets.top, translateY]);

  const bgColor = isSyncing ? '#8B2E2E' : '#C8A45B'; // brand-burgundy : brand-gold

  const label = isSyncing
    ? 'Syncing offline data…'
    : `${pendingCount} item${pendingCount !== 1 ? 's' : ''} saved offline`;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: bgColor,
        paddingTop: insets.top + 4,
        paddingBottom: 6,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 9999,
        transform: [{ translateY }],
      }}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
      ) : (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: 'rgba(255,255,255,0.85)',
          }}
        />
      )}
      <Text
        style={{
          color: 'white',
          fontSize: 13,
          fontWeight: '600',
          letterSpacing: 0.1,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
