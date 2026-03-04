import { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  type TextInputProps,
} from 'react-native';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      containerClassName = '',
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const hasError = Boolean(error);
    const borderColor = hasError
      ? 'border-danger dark:border-red-500'
      : isFocused
        ? 'border-primary-500 dark:border-primary-400'
        : 'border-slate-200 dark:border-slate-600';

    return (
      <View className={`${containerClassName}`}>
        {label ? (
          <Text className="mb-1.5 text-sm font-sans-medium text-text dark:text-slate-200">
            {label}
          </Text>
        ) : null}
        <View
          className={`
            flex-row items-center rounded-xl border-2 bg-white px-4
            dark:bg-slate-800
            ${borderColor}
          `}
        >
          {leftIcon ? (
            <View className="mr-3">{leftIcon}</View>
          ) : null}
          <TextInput
            ref={ref}
            className={`
              flex-1 py-3 text-base text-text placeholder:text-text-tertiary
              dark:text-slate-100 dark:placeholder:text-slate-500
              ${leftIcon ? '' : ''}
              ${rightIcon ? '' : ''}
              ${className}
            `}
            placeholderTextColor="#94a3b8"
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          {rightIcon ? (
            <View className="ml-3">{rightIcon}</View>
          ) : null}
        </View>
        {error ? (
          <Text className="mt-1.5 text-sm text-danger dark:text-red-400">{error}</Text>
        ) : helperText ? (
          <Text className="mt-1.5 text-sm text-text-secondary dark:text-slate-400">
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';
