import { Text, View } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantBgClasses: Record<BadgeVariant, string> = {
  success: 'bg-primary-100 dark:bg-primary-900/40',
  warning: 'bg-amber-100 dark:bg-amber-900/40',
  danger: 'bg-red-100 dark:bg-red-900/40',
  info: 'bg-blue-100 dark:bg-blue-900/40',
  neutral: 'bg-slate-100 dark:bg-slate-700',
};

const variantTextClasses: Record<BadgeVariant, string> = {
  success: 'text-primary-700 dark:text-primary-300',
  warning: 'text-amber-800 dark:text-amber-300',
  danger: 'text-red-700 dark:text-red-300',
  info: 'text-blue-700 dark:text-blue-300',
  neutral: 'text-slate-700 dark:text-slate-300',
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
      <Text className={`text-xs font-sans-medium ${variantTextClasses[variant]}`}>
        {children}
      </Text>
    </View>
  );
}
