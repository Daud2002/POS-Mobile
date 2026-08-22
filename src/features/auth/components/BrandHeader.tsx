import { BarChart3, Package, Receipt, Store } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gradient } from '@/components/ui/Gradient';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

const FEATURES = [
  { icon: Store, label: 'Multi-Store' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Package, label: 'Inventory' },
  { icon: Receipt, label: 'Receipts' },
] as const;

/**
 * Full-bleed dark hero for the login screen — the mobile version of the web
 * app's `gradient-dark` branding panel, complete with its blurred gradient
 * blobs and four feature pills.
 */
export function BrandHeader() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Gradient
      variant="dark"
      style={[
        styles.hero,
        {
          paddingTop: insets.top + theme.spacing['4xl'],
          paddingBottom: theme.spacing['4xl'],
          paddingHorizontal: theme.spacing['2xl'],
          borderBottomLeftRadius: theme.radius['2xl'] + 8,
          borderBottomRightRadius: theme.radius['2xl'] + 8,
        },
      ]}
    >
      {/* Gradient blobs echoing the web hero's blurred accents. */}
      <View style={[styles.blob, styles.blobPrimary]} />
      <View style={[styles.blob, styles.blobAccent]} />

      <View style={[{ borderRadius: theme.radius.xl }, theme.shadows.glow]}>
        <Gradient
          variant="primary"
          style={[styles.logo, { borderRadius: theme.radius.xl }]}
        >
          <Receipt size={32} color="#FFFFFF" />
        </Gradient>
      </View>

      <Text
        style={{
          color: '#FFFFFF',
          fontFamily: theme.fontFamily.headingBold,
          fontSize: 30,
          lineHeight: 38,
          marginTop: theme.spacing.lg,
        }}
      >
        TapnTrade
      </Text>
      <Text variant="small" style={{ color: '#FFFFFF99' }} align="center">
        Cloud point of sale for every counter
      </Text>

      <View style={[styles.features, { gap: theme.spacing.sm, marginTop: theme.spacing.xl }]}>
        {FEATURES.map(({ icon: Icon, label }) => (
          <View
            key={label}
            style={[
              styles.pill,
              { backgroundColor: '#FFFFFF14', borderRadius: theme.radius.full },
            ]}
          >
            <Icon size={13} color={theme.colors.primary} />
            <Text variant="caption" style={{ color: '#FFFFFFCC' }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobPrimary: {
    width: 240,
    height: 240,
    top: -90,
    left: -80,
    backgroundColor: '#10B77F1F',
  },
  blobAccent: {
    width: 200,
    height: 200,
    bottom: -100,
    right: -60,
    backgroundColor: '#6D54D426',
  },
  logo: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
