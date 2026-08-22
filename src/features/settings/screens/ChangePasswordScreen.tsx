import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { ShieldCheck } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { ApiError } from '@/api/client';
import { authApi } from '@/api/services';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PasswordField } from '@/components/ui/PasswordField';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/theme/ThemeProvider';

import { ChangePasswordForm, changePasswordSchema } from '../changePasswordSchema';

/**
 * Change Password.
 *
 * Backed by POST /auth/change-password, an endpoint added as part of this work
 * — the API previously exposed only login, register and me, and neither client
 * had any way to change a password.
 *
 * The session is deliberately NOT cleared afterwards: JWTs carry no `jti` or
 * password version, so the existing token stays valid and forcing a re-login
 * would be theatre rather than security.
 */
export function ChangePasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const toast = useToast();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordForm) => {
    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      toast.success('Password updated successfully');
      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Could not update your password.';

      // The backend's "Current password is incorrect" belongs on that field,
      // not in a toast the user has to map back to an input.
      if (/current password/i.test(message)) {
        setError('currentPassword', { message });
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <Screen scrollable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card padding="xl" style={{ gap: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <ShieldCheck size={20} color={theme.colors.primary} />
            <Text variant="small" color="mutedForeground" style={{ flex: 1 }}>
              Choose a password of at least 6 characters. You will stay signed in on
              this device.
            </Text>
          </View>

          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordField
                label="Current Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Enter current password"
                error={errors.currentPassword?.message}
                textContentType="password"
              />
            )}
          />

          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordField
                label="New Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="At least 6 characters"
                error={errors.newPassword?.message}
                textContentType="newPassword"
              />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordField
                label="Confirm New Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Re-enter new password"
                error={errors.confirmPassword?.message}
                textContentType="newPassword"
                onSubmitEditing={handleSubmit(onSubmit)}
                returnKeyType="go"
              />
            )}
          />

          <Button
            label={isSubmitting ? 'Updating…' : 'Update Password'}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            size="lg"
            fullWidth
          />
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
