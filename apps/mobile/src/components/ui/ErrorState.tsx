import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { Button } from './Button';
import { themeColors } from '../../theme';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <View
      className={`
        flex-1 items-center justify-center px-8 py-12
        ${className}
      `}
    >
      <View className="mb-4 rounded-full bg-danger/10 p-6 dark:bg-red-500/20">
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={themeColors.status.danger}
          style={{ opacity: 0.9 }}
        />
      </View>
      <Text className="mb-2 text-center text-lg font-sans-semibold text-text dark:text-slate-100">
        {message}
      </Text>
      {onRetry ? (
        <Button variant="primary" size="md" onPress={onRetry}>
          Retry
        </Button>
      ) : null}
    </View>
  );
}
