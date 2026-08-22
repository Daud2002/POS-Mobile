import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

import { ReceiptData, renderReceiptText } from '../templates/receipt.template';
import { PrinterProfile } from '../types';

interface ReceiptPreviewProps {
  data: ReceiptData;
  profile: PrinterProfile;
}

/**
 * Renders the receipt exactly as it will print, in a monospace column.
 *
 * This is the workhorse for developing receipt layout without hardware: it runs
 * the same `buildReceipt` the printer gets, then decodes the ESC/POS back to
 * text, so column alignment shown here is the alignment on paper.
 */
export function ReceiptPreview({ data, profile }: ReceiptPreviewProps) {
  const theme = useTheme();
  const text = renderReceiptText(data, profile);

  return (
    <View
      style={{
        backgroundColor: theme.isDark ? theme.colors.secondary : '#FFFFFF',
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.lg,
      }}
    >
      {/* Horizontal scroll rather than wrapping: wrapped preview lines would
          misrepresent what the printer does with a too-long line. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text
          variant="mono"
          style={{ color: theme.isDark ? theme.colors.foreground : '#111827' }}
        >
          {text}
        </Text>
      </ScrollView>

      <Text
        variant="caption"
        color="mutedForeground"
        style={{ marginTop: theme.spacing.md }}
      >
        {profile.paperWidth}mm paper · {profile.charsPerLine} characters per line
      </Text>
    </View>
  );
}
