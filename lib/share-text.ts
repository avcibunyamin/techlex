import { Platform, Share } from 'react-native';

export type ShareTextResult = 'copied' | 'shared' | 'dismissed' | 'failed';

// Legacy fallback for browsers without the async clipboard API (e.g. non-HTTPS pages).
function copyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  const body = document.body;
  const active = document.activeElement as HTMLElement | null;
  const previousFocus = active && typeof active.focus === 'function' ? active : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  let ok = false;
  let appended = false;
  try {
    body.appendChild(area);
    appended = true;
    area.select();
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    if (appended) {
      try {
        if (area.parentNode) {
          area.parentNode.removeChild(area);
        } else {
          body.removeChild(area);
        }
      } catch {
        // Ignore DOM cleanup errors.
      }
    }
    if (previousFocus) {
      try {
        previousFocus.focus();
      } catch {
        // Ignore focus restoration errors.
      }
    }
  }
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
