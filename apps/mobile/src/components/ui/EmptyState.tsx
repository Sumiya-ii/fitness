import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { Button } from './Button';

type EmptyStateIcon = 'nutrition' | 'search' | 'camera' | 'mic' | 'barcode' | 'heart' | 'list';

const iconMap: Record<EmptyStateIcon, keyof typeof Ionicons.glyphMap> = {
  nutrition: 'nutrition-outline',
  search: 'search-outline',
  camera: 'camera-outline',
  mic: 'mic-outline',
  barcode: 'barcode-outline',
  heart: 'heart-outline',
  list: 'list-outline',
};

export interface EmptyStateProps {
  icon?: EmptyStateIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = 'nutrition',
  title,
  subtitle,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  const iconName = iconMap[icon];

  return (
    <View
      className={`
        flex-1 items-center justify-center px-8 py-12
        ${className}
      `}
    >
      <View className="mb-4 h-20 w-20 rounded-full bg-slate-900 border border-slate-800 items-center justify-center">
        <Ionicons
          name={iconName}
          size={36}
          color="#475569"
        />
      </View>
      <Text className="mb-2 text-center text-lg font-sans-semibold text-white">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mb-6 text-center text-base text-slate-400">
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="primary" size="md" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
