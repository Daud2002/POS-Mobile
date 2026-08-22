import { useAuth } from '@/app/providers/AuthProvider';

/**
 * The current user's store id, resolved by /auth/me.
 *
 * `admin` users have none — but the mobile app has no admin screens, so every
 * caller can treat `undefined` as "not ready yet" rather than a role branch.
 */
export function useStoreId(): string | undefined {
  const { user } = useAuth();
  return user?.storeId;
}
