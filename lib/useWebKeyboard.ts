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
        const target = event.target as HTMLElement | null;
        const handled = handlerRef.current({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          repeat: event.repeat,
          targetTag: target?.tagName ?? null,
          targetEditable: !!target?.isContentEditable,
        });
        if (handled) {
          // Capture phase + stopPropagation: a focused button must not also react
          // to the same Space/Enter press (that would answer twice).
          event.preventDefault();
          event.stopPropagation();
        }
      };

      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [enabled])
  );
}
