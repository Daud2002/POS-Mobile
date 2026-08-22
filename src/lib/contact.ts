import { Linking } from 'react-native';

/** Ported from Frontend/src/lib/contact.ts. */
export const WHATSAPP_NUMBER = '923097119974';
export const WHATSAPP_DISPLAY = '+92 309 7119974';

/** Opens WhatsApp with an optional prefilled message. */
export async function openWhatsApp(message?: string): Promise<void> {
  const suffix = message ? `?text=${encodeURIComponent(message)}` : '';
  const url = `https://wa.me/${WHATSAPP_NUMBER}${suffix}`;
  try {
    await Linking.openURL(url);
  } catch {
    // WhatsApp not installed and no browser handler — nothing useful to do.
  }
}
