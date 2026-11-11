import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, MessageCircle, Server, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { AuthStackParamList } from '@/app/navigation/types';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PasswordField } from '@/components/ui/PasswordField';
import { Text } from '@/components/ui/Text';
import { serverLabel } from '@/lib/connection/qr';
import { useConnection } from '@/lib/connection/useConnection';
import { openWhatsApp } from '@/lib/contact';
import { useLayout } from '@/hooks/useLayout';
import { CONTENT_WIDTH } from '@/lib/responsive';
import { useTheme } from '@/theme/ThemeProvider';

import { BrandHeader } from '../components/BrandHeader';

/**
 * Sign-in: full-bleed dark gradient hero over a floating form card — the
 * stacked-for-mobile version of the web login's two-column split. The
 * "Want to test the app? Contact Now" WhatsApp CTA carries over.
 *
 * Also the way onto a shop's store server: staff in a shop that runs on one
 * can't sign in on the cloud (it answers 409 STORE_SERVER_MODE), so that error
 * comes with a button to the connect screen, and once connected the card says
 * which server the sign-in goes to.
 */
export function LoginScreen() {
  const theme = useTheme();
  const { isTablet } = useLayout();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { login } = useAuth();
  const { mode, baseUrl, registered } = useConnection();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsStoreServer, setNeedsStoreServer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openConnect = () => navigation.navigate('ConnectStoreServer');
  const clearError = () => {
    setError(null);
    setNeedsStoreServer(false);
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    clearError();

    const result = await login(email.trim(), password);

    // On success the root navigator swaps to the authenticated stack, so this
    // component unmounts — only the failure path needs to reset state.
    if (result.error) {
      setError(result.error);
      setNeedsStoreServer(result.code === 'STORE_SERVER_MODE');
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
              // Two fields do not need a tablet's full width: a centred card.
              ...(isTablet
                ? { width: '100%', maxWidth: CONTENT_WIDTH.form - 80, alignSelf: 'center', marginHorizontal: 0 }
                : null),
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

              {mode === 'store' ? (
                <View style={[styles.note, { gap: theme.spacing.sm }]}>
                  <Server size={16} color={theme.colors.primary} />
                  <Text variant="small" color="mutedForeground" style={{ flex: 1 }}>
                    Signing in on the store server · {serverLabel(baseUrl)}
                  </Text>
                </View>
              ) : mode === 'unreachable' && registered ? (
                <View style={[styles.note, { gap: theme.spacing.sm }]}>
                  <WifiOff size={16} color={theme.colors.destructive} />
                  <Text variant="small" color="destructive" style={{ flex: 1 }}>
                    Can't reach the store server ({serverLabel(registered.baseUrl)}). Check the shop
                    Wi-Fi.
                  </Text>
                </View>
              ) : null}

              <Input
                label="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  clearError();
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
                  clearError();
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

              {needsStoreServer ? (
                <Button
                  label="Connect to store server"
                  variant="outline"
                  fullWidth
                  icon={<Server size={16} color={theme.colors.foreground} />}
                  onPress={openConnect}
                />
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
            <Button
              label={mode === 'cloud' ? 'Connect to store server' : 'Store server settings'}
              variant="ghost"
              size="sm"
              icon={<Server size={16} color={theme.colors.primary} />}
              onPress={openConnect}
              style={{ alignSelf: 'center', marginBottom: theme.spacing.lg }}
            />
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
  note: { flexDirection: 'row', alignItems: 'center' },
});
