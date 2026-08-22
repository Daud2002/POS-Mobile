import { Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export type SwitchProps = Omit<RNSwitchProps, 'trackColor' | 'thumbColor'>;

/** Themed switch — used for product/employee active toggles. */
export function Switch(props: SwitchProps) {
  const theme = useTheme();

  return (
    <RNSwitch
      trackColor={{
        false: theme.colors.muted,
        true: theme.tint(theme.colors.primary, 0.5),
      }}
      thumbColor={props.value ? theme.colors.primary : theme.colors.card}
      ios_backgroundColor={theme.colors.muted}
      {...props}
    />
  );
}
