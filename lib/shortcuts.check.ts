// Run: npx tsx lib/shortcuts.check.ts
import { mapDeckKey, mapQuizKey, isTypingTarget } from './shortcuts';

let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    throw new Error(`shortcuts check failed: ${name}\n  ${(err as Error).message}`);
  }
}

function eq<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`);
}

check('deck keys map to flip / known / unknown', () => {
  eq(mapDeckKey({ key: ' ' }), 'flip', 'Space');
  eq(mapDeckKey({ key: 'ArrowRight' }), 'known', 'ArrowRight');
  eq(mapDeckKey({ key: '1' }), 'known', '1');
  eq(mapDeckKey({ key: 'ArrowLeft' }), 'unknown', 'ArrowLeft');
  eq(mapDeckKey({ key: '2' }), 'unknown', '2');
  eq(mapDeckKey({ key: '3' }), null, '3');
  eq(mapDeckKey({ key: 'Enter' }), null, 'Enter');
});

check('typing targets disable shortcuts', () => {
  eq(isTypingTarget({ targetTag: 'input' }), true, 'input');
  eq(isTypingTarget({ targetTag: 'TEXTAREA' }), true, 'textarea');
  eq(isTypingTarget({ targetTag: 'DIV', targetEditable: true }), true, 'contentEditable');
  eq(isTypingTarget({ targetTag: 'DIV' }), false, 'div');
  eq(mapDeckKey({ key: ' ', targetTag: 'INPUT' }), null, 'deck Space in input');
  eq(mapQuizKey({ key: '1', targetTag: 'TEXTAREA' }, 4), null, 'quiz 1 in textarea');
  eq(mapQuizKey({ key: 'Enter', targetEditable: true }, 4), null, 'quiz Enter in editable');
});

check('modifiers and auto-repeat are ignored', () => {
  eq(mapDeckKey({ key: '1', ctrlKey: true }), null, 'ctrl+1');
  eq(mapDeckKey({ key: 'ArrowRight', metaKey: true }), null, 'meta+ArrowRight');
  eq(mapQuizKey({ key: '2', altKey: true }, 4), null, 'alt+2');
  eq(mapDeckKey({ key: ' ', repeat: true }), null, 'held Space');
});

check('quiz digits are limited to the visible options', () => {
  eq(mapQuizKey({ key: '1' }, 4), { type: 'option', index: 0 }, '1 of 4');
  eq(mapQuizKey({ key: '4' }, 4), { type: 'option', index: 3 }, '4 of 4');
  eq(mapQuizKey({ key: '4' }, 3), null, '4 of 3');
  eq(mapQuizKey({ key: '5' }, 6), null, '5 is above the 1–4 range');
  eq(mapQuizKey({ key: '0' }, 4), null, '0');
  eq(mapQuizKey({ key: '1' }, 0), null, 'no options');
});

check('Enter means next question', () => {
  eq(mapQuizKey({ key: 'Enter' }, 4), { type: 'next' }, 'Enter');
  eq(mapQuizKey({ key: ' ' }, 4), null, 'Space is not a quiz key');
});

console.log(`shortcuts: ${passed} checks passed`);
