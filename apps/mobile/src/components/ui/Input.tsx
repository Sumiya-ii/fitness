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
      ? 'border-red-500'
      : isFocused
        ? 'border-primary-500'
        : 'border-slate-700';

    return (
      <View className={`${containerClassName}`}>
        {label ? (
          <Text className="mb-1.5 text-sm font-sans-medium text-slate-300">
            {label}
          </Text>
        ) : null}
        <View
          className={`
            flex-row items-center rounded-xl border-2 bg-slate-800/50 px-4
            ${borderColor}
          `}
        >
          {leftIcon ? (
            <View className="mr-3">{leftIcon}</View>
          ) : null}
          <TextInput
            ref={ref}
            className={`
              flex-1 py-3 text-base text-white
              ${className}
            `}
            placeholderTextColor="#475569"
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
          <Text className="mt-1.5 text-sm text-red-400">{error}</Text>
        ) : helperText ? (
          <Text className="mt-1.5 text-sm text-slate-400">
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = 'Input';
