import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Input, InputProps } from './Input';

export type PasswordFieldProps = Omit<InputProps, 'secureTextEntry' | 'trailing'>;

/**
 * Password input with a show/hide toggle, reproducing the Eye/EyeOff pattern
 * from the web LoginPage. Used on Login and three times on Change Password.
 */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    const Icon = visible ? EyeOff : Eye;

    return (
      <Input
        ref={ref}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Icon size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        }
        {...props}
      />
    );
  },
);
