import { useQueryClient } from '@tanstack/react-query';
import { ReactNode, useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { isOwner } from '@/lib/access';
import { useApiBase } from '@/lib/apiBase';
import {
  connectToStoreServer,
  DiscoveredStoreServer,
  discoverStoreServer,
  useConnectionStore,
} from '@/lib/connection/connectionStore';
import { serverLabel } from '@/lib/connection/qr';
import { useConnectionLifecycle } from '@/lib/connection/useConnection';

import { useAuth } from './AuthProvider';

/**
 * Keeps the app on the right server: the shop's store server when it can be
 * reached, the cloud otherwise (see lib/connection/policy.ts).
 *
 * Sits inside AuthProvider because the owner offer below needs the signed-in
 * user; the start-up decision itself doesn't wait for this to mount —
 * AuthProvider asks for it directly.
 */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  useConnectionLifecycle();

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const mode = useConnectionStore((s) => s.mode);

  // Cached lists came from the previous server; the one now in charge may be
  // ahead of it (the store server is, whenever the internet was down).
  useEffect(
    () =>
      useApiBase.subscribe((state, previous) => {
        if (state.baseUrl !== previous.baseUrl) void queryClient.invalidateQueries();
      }),
    [queryClient],
  );

  const [offer, setOffer] = useState<DiscoveredStoreServer | null>(null);
  const discoveredFor = useRef<string | null>(null);

  const userId = user?.id;
  const storeId = user?.storeId;
  const owner = isOwner(user);

  /**
   * An owner signed in on the cloud, once per sign-in: does this store run on
   * a store server, and is it on this Wi-Fi? Staff never get here — the cloud
   * doesn't let them sign in once the store is in server mode, and the
   * Login screen sends them to the connect screen instead.
   */
  useEffect(() => {
    if (!userId) {
      discoveredFor.current = null;
      return;
    }
    if (mode !== 'cloud' || !owner || !storeId || discoveredFor.current === userId) return;
    discoveredFor.current = userId;

    void discoverStoreServer(storeId).then((found) => {
      // Offer only if nothing moved the app meanwhile.
      if (found && useConnectionStore.getState().mode === 'cloud') setOffer(found);
    });
  }, [userId, storeId, owner, mode]);

  return (
    <>
      {children}
      <ConfirmDialog
        open={!!offer}
        variant="default"
        title="Store server found"
        description={
          offer
            ? `Your shop's store server is on this Wi-Fi (${serverLabel(offer.server.baseUrl)}). ` +
              'Use it, so the shop keeps working without internet? You may need to sign in once.'
            : undefined
        }
        confirmLabel="Use it"
        declineLabel="Not now"
        onConfirm={async () => {
          const chosen = offer;
          setOffer(null);
          if (chosen) await connectToStoreServer(chosen.server, chosen.health);
        }}
        onDecline={() => setOffer(null)}
      />
    </>
  );
}
