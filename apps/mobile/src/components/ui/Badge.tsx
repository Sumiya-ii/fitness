import { Text, View } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantBgClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-900/40',
  warning: 'bg-amber-900/40',
  danger: 'bg-red-900/40',
  info: 'bg-blue-900/40',
  neutral: 'bg-surface-secondary',
};

const variantTextClasses: Record<BadgeVariant, string> = {
  success: 'text-green-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  info: 'text-blue-400',
  neutral: 'text-text-secondary',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <View
      className={`
        self-start rounded-full px-3 py-1
        ${variantBgClasses[variant]}
        ${className}
      `}
    >
      <Text className={`text-xs leading-5 font-sans-medium ${variantTextClasses[variant]}`}>
        {children}
      </Text>
    </View>
  );
}
