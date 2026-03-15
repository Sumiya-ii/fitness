import { Text, View } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantBgClasses: Record<BadgeVariant, string> = {
  success: 'bg-primary-100',
  warning: 'bg-amber-100',
  danger: 'bg-red-100',
  info: 'bg-blue-100',
  neutral: 'bg-surface-secondary',
};

const variantTextClasses: Record<BadgeVariant, string> = {
  success: 'text-primary-700',
  warning: 'text-amber-800',
  danger: 'text-red-700',
  info: 'text-blue-700',
  neutral: 'text-text-secondary',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'neutral',
  children,
  className = '',
}: BadgeProps) {
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
