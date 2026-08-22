import { forwardRef, ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Shown in destructive red beneath the field. */
  error?: string;
  /** Shown in muted text beneath the field when there is no error. */
  hint?: string;
  /** Rendered inside the field, before the text. */
  leading?: ReactNode;
  /** Rendered inside the field, after the text — e.g. a show/hide toggle. */
  trailing?: ReactNode;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, leading, trailing, containerStyle, editable = true, ...rest },
  ref,
) {
  const theme = useTheme();

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="smallMedium" style={{ marginBottom: theme.spacing.sm }}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderRadius: theme.radius.md,
            borderColor: error ? theme.colors.destructive : theme.colors.input,
            backgroundColor: editable ? theme.colors.card : theme.colors.muted,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        {leading ? <View style={styles.adornment}>{leading}</View> : null}

        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={theme.colors.mutedForeground}
          style={[
            styles.input,
            {
              color: editable ? theme.colors.foreground : theme.colors.mutedForeground,
              fontFamily: theme.fontFamily.body,
              fontSize: theme.fontSize.base,
            },
          ]}
          {...rest}
        />

        {trailing ? <View style={styles.adornment}>{trailing}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" color="destructive" style={{ marginTop: theme.spacing.xs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text
          variant="caption"
          color="mutedForeground"
          style={{ marginTop: theme.spacing.xs }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  adornment: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
