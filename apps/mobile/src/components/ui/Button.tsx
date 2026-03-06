import * as Haptics from 'expo-haptics';
import {
  type ComponentProps,
  forwardRef,
  useCallback,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';
import { themeColors } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 active:bg-primary-600 shadow-md shadow-primary-500/25 dark:bg-primary-600 dark:active:bg-primary-700',
  secondary:
    'bg-surface-secondary active:bg-surface-tertiary dark:bg-slate-700 dark:active:bg-slate-600',
  outline:
    'bg-transparent border-2 border-primary-500 active:bg-primary-50 dark:border-primary-400 dark:active:bg-primary-900/30',
  ghost:
    'bg-transparent active:bg-surface-secondary dark:active:bg-slate-700',
  danger:
    'bg-danger active:bg-red-600 shadow-md shadow-red-500/25 dark:bg-red-600 dark:active:bg-red-700',
};

const variantTextClasses: Record<ButtonVariant, string> = {
  primary: 'text-white dark:text-white',
  secondary: 'text-text dark:text-slate-100',
  outline: 'text-primary-600 dark:text-primary-400',
  ghost: 'text-text dark:text-slate-100',
  danger: 'text-white dark:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 min-h-[36px]',
  md: 'px-6 py-3 min-h-[44px]',
  lg: 'px-8 py-4 min-h-[52px]',
};

const sizeTextClasses: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      children,
      className = '',
      onPress,
      ...props
    },
    ref
  ) => {
    const handlePress = useCallback(
      (e: Parameters<NonNullable<ComponentProps<typeof Pressable>['onPress']>>[0]) => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      },
      [disabled, loading, onPress]
    );

    const isDisabled = disabled || loading;

    return (
      <Pressable
        ref={ref}
        onPress={handlePress}
        disabled={isDisabled}
        className={`
          rounded-2xl flex-row items-center justify-center
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${isDisabled ? 'opacity-50' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'danger'
                ? themeColors.text.inverse
                : themeColors.primary['500']
            }
          />
        ) : (
          <Text
            className={`font-sans-semibold ${variantTextClasses[variant]} ${sizeTextClasses[size]}`}
          >
            {children}
          </Text>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
