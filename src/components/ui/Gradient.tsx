import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export type GradientVariant = 'primary' | 'accent' | 'dark';

interface GradientProps {
  variant?: GradientVariant;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Theme gradient surface — the web app's `.gradient-primary` / `.gradient-accent`
 * / `.gradient-dark` utilities (135° linear), used for the dashboard hero,
 * primary CTAs, the checkout bar and the login hero.
 */
export function Gradient({ variant = 'primary', style, children }: GradientProps) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={theme.gradients[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}
