import { Platform, Share } from 'react-native';

export type ShareTextResult = 'copied' | 'shared' | 'dismissed' | 'failed';

// Legacy fallback for browsers without the async clipboard API (e.g. non-HTTPS pages).
function copyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

/**
 * No clipboard dependency in the project: web copies with navigator.clipboard,
 * iOS/Android open the system share sheet (which also offers "Copy").
 */
export async function shareText(text: string): Promise<ShareTextResult> {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return 'copied';
      }
    } catch {
      // Permission denied or insecure context: try the fallback below.
    }
    return copyWithTextarea(text) ? 'copied' : 'failed';
  }

  try {
    const result = await Share.share({ message: text });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
