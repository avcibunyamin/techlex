// Pure keyboard shortcut mapping for the web build. No React, no DOM access:
// callers pass a plain description of the keydown event.

export type DeckShortcut = 'flip' | 'known' | 'unknown';

export type QuizShortcut =
  | { type: 'option'; index: number }
  | { type: 'next' };

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  /** tagName of the event target (e.g. 'INPUT', 'BUTTON', 'A', 'SUMMARY'), if any. */
  targetTag?: string | null;
  /** ARIA role of the event target (e.g. 'button', 'radio'), if any. */
  targetRole?: string | null;
  /** True when an anchor target has an href attribute. */
  targetHasHref?: boolean;
  /** True when the event target is contentEditable. */
  targetEditable?: boolean;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const INTERACTIVE_TAGS = new Set(['BUTTON', 'SUMMARY']);
const INTERACTIVE_ROLES = new Set(['button', 'radio']);

export function isTypingTarget(e: Pick<ShortcutKeyEvent, 'targetTag' | 'targetEditable'>): boolean {
  if (e.targetEditable) return true;
  return !!e.targetTag && TYPING_TAGS.has(e.targetTag.toUpperCase());
}

/**
 * True when focus is on a control that handles Space or Enter activation itself
 * (button, [role=button], [role=radio], a[href], summary).
 */
export function isInteractiveTarget(
  e: Pick<ShortcutKeyEvent, 'targetTag' | 'targetRole' | 'targetHasHref'>
): boolean {
  const tag = e.targetTag?.toUpperCase() ?? '';
  if (INTERACTIVE_TAGS.has(tag)) return true;
  if (tag === 'A' && e.targetHasHref !== false) return true;
  const role = e.targetRole?.toLowerCase() ?? '';
  if (INTERACTIVE_ROLES.has(role)) return true;
  return false;
}

function isActivationKey(key: string): boolean {
  return key === ' ' || key === 'Spacebar' || key === 'Enter';
}

// Shortcuts never fire while typing, with modifier keys (browser/OS shortcuts),
// on auto-repeat (holding Space would flip the card back and forth), or when
// Space/Enter is pressed on a focused interactive control.
function isIgnored(e: ShortcutKeyEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return true;
  if (isTypingTarget(e)) return true;
  if (isActivationKey(e.key) && isInteractiveTarget(e)) return true;
  return false;
}

export function mapDeckKey(e: ShortcutKeyEvent): DeckShortcut | null {
  if (isIgnored(e)) return null;
  switch (e.key) {
    case ' ':
    case 'Spacebar':
      return 'flip';
    case 'ArrowRight':
    case '1':
      return 'known';
    case 'ArrowLeft':
    case '2':
      return 'unknown';
    default:
      return null;
  }
}

/** Digits 1..optionCount pick an option (0-based index); Enter goes to the next question. */
export function mapQuizKey(e: ShortcutKeyEvent, optionCount: number): QuizShortcut | null {
  if (isIgnored(e)) return null;
  if (e.key === 'Enter') return { type: 'next' };
  if (/^[1-9]$/.test(e.key)) {
    const n = Number(e.key);
    const max = Math.min(4, Math.max(0, Math.floor(optionCount)));
    if (n <= max) return { type: 'option', index: n - 1 };
  }
  return null;
}
