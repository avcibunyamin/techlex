import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { ShortcutKeyEvent } from './shortcuts';

/** Return true when the key was handled; the event is then stopped and its default prevented. */
export type WebKeyHandler = (e: ShortcutKeyEvent) => boolean;

/**
 * Window keydown listener on web only, attached while the screen is focused.
 * Native platforms are untouched. The handler is read from a ref, so callers can pass
 * a fresh closure on every render without re-subscribing.
 */
export function useWebKeyboard(handler: WebKeyHandler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;

      const onKeyDown = (event: KeyboardEvent) => {
        const rawTarget = event.target as HTMLElement | null;
        const interactiveTarget =
          typeof rawTarget?.closest === 'function'
            ? (rawTarget.closest(
                'input, textarea, select, button, summary, a[href], [role="button"], [role="radio"], [contenteditable="true"]'
              ) as HTMLElement | null)
            : null;
        const target = interactiveTarget ?? rawTarget;
        const targetRole =
          typeof target?.getAttribute === 'function' ? target.getAttribute('role') : null;
        const targetHasHref =
          typeof target?.hasAttribute === 'function'
            ? target.hasAttribute('href')
            : !!(target as HTMLAnchorElement | null)?.href;

        const handled = handlerRef.current({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          repeat: event.repeat,
          targetTag: target?.tagName ?? null,
          targetRole,
          targetHasHref,
          targetEditable: !!(target?.isContentEditable || rawTarget?.isContentEditable),
        });
        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      };

      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [enabled])
  );
}
