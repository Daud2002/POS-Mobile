import { ArrowRight, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PasswordField } from '@/components/ui/PasswordField';
import { Text } from '@/components/ui/Text';
import { openWhatsApp } from '@/lib/contact';
import { useTheme } from '@/theme/ThemeProvider';

import { BrandHeader } from '../components/BrandHeader';

/**
 * Sign-in: full-bleed dark gradient hero over a floating form card — the
 * stacked-for-mobile version of the web login's two-column split. The
 * "Want to test the app? Contact Now" WhatsApp CTA carries over.
 */
export function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const result = await login(email.trim(), password);

    // On success the root navigator swaps to the authenticated stack, so this
    // component unmounts — only the failure path needs to reset state.
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <BrandHeader />

          {/* Form card overlaps the hero's bottom edge slightly, which is what
              makes the layout read as layered rather than stacked blocks. */}
          <Card
            padding="2xl"
            shadow="lg"
            style={{
              marginHorizontal: theme.spacing.lg,
              marginTop: -theme.spacing['2xl'],
            }}
          >
            <View style={{ gap: theme.spacing.lg }}>
              <View>
                <Text variant="display">Welcome back</Text>
                <Text
                  variant="small"
                  color="mutedForeground"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  Sign in to your TapnTrade account
                </Text>
              </View>

              <Input
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError(null);
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                textContentType="emailAddress"
                returnKeyType="next"
              />

              <PasswordField
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                placeholder="••••••••"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />

              {error ? (
                <Text variant="small" color="destructive">
                  {error}
                </Text>
              ) : null}

              <Button
                label={submitting ? 'Please wait…' : 'Sign In'}
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={submitting}
                size="lg"
                fullWidth
                icon={
                  submitting ? undefined : <ArrowRight size={18} color="#FFFFFF" />
                }
              />
            </View>
          </Card>

          <View style={[styles.footer, { paddingVertical: theme.spacing['2xl'] }]}>
            <Text variant="small" color="mutedForeground" align="center">
              Want to test the app?
            </Text>
            <Button
              label="Contact Now"
              variant="ghost"
              size="sm"
              icon={<MessageCircle size={16} color={theme.colors.primary} />}
              onPress={() =>
                openWhatsApp('Hello! I would like to test the TapNtrade POSCloud app.')
              }
              style={{ alignSelf: 'center' }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  footer: { alignItems: 'center' },
});
