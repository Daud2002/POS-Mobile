import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

/** A titled panel — the web app's chart and list containers. */
export function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  const theme = useTheme();

  return (
    <Card padding="xl">
      <View style={[styles.header, { marginBottom: theme.spacing.lg, gap: theme.spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{title}</Text>
          {subtitle ? (
            <Text
              variant="caption"
              color="mutedForeground"
              style={{ marginTop: theme.spacing.xxs }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
});
