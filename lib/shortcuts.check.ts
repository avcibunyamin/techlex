// Run: npx tsx lib/shortcuts.check.ts
import { mapDeckKey, mapQuizKey, isTypingTarget, isInteractiveTarget } from './shortcuts';

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

check('focused interactive targets block Space and Enter shortcuts', () => {
  eq(isInteractiveTarget({ targetTag: 'BUTTON' }), true, 'button tag');
  eq(isInteractiveTarget({ targetTag: 'DIV', targetRole: 'button' }), true, 'role=button');
  eq(isInteractiveTarget({ targetTag: 'DIV', targetRole: 'radio' }), true, 'role=radio');
  eq(isInteractiveTarget({ targetTag: 'A', targetHasHref: true }), true, 'a[href]');
  eq(isInteractiveTarget({ targetTag: 'A', targetHasHref: false }), false, 'a without href');
  eq(isInteractiveTarget({ targetTag: 'SUMMARY' }), true, 'summary tag');
  eq(isInteractiveTarget({ targetTag: 'DIV' }), false, 'plain div');

  eq(mapDeckKey({ key: ' ', targetTag: 'BUTTON' }), null, 'deck Space on button');
  eq(mapDeckKey({ key: ' ', targetTag: 'DIV', targetRole: 'button' }), null, 'deck Space on role=button');
  eq(mapDeckKey({ key: ' ', targetTag: 'DIV', targetRole: 'radio' }), null, 'deck Space on role=radio');
  eq(mapDeckKey({ key: ' ', targetTag: 'A', targetHasHref: true }), null, 'deck Space on a[href]');
  eq(mapDeckKey({ key: ' ', targetTag: 'SUMMARY' }), null, 'deck Space on summary');
  eq(mapDeckKey({ key: ' ', targetTag: 'A', targetHasHref: false }), 'flip', 'deck Space on a without href');
  eq(mapDeckKey({ key: '1', targetTag: 'BUTTON' }), 'known', 'deck digit still works on button');

  eq(mapQuizKey({ key: 'Enter', targetTag: 'BUTTON' }, 4), null, 'quiz Enter on button');
  eq(mapQuizKey({ key: 'Enter', targetTag: 'DIV', targetRole: 'button' }, 4), null, 'quiz Enter on role=button');
  eq(mapQuizKey({ key: 'Enter', targetTag: 'DIV', targetRole: 'radio' }, 4), null, 'quiz Enter on role=radio');
  eq(mapQuizKey({ key: 'Enter', targetTag: 'A', targetHasHref: true }, 4), null, 'quiz Enter on a[href]');
  eq(mapQuizKey({ key: 'Enter', targetTag: 'SUMMARY' }, 4), null, 'quiz Enter on summary');
  eq(mapQuizKey({ key: 'Enter', targetTag: 'A', targetHasHref: false }, 4), { type: 'next' }, 'quiz Enter on a without href');
  eq(mapQuizKey({ key: '2', targetTag: 'DIV', targetRole: 'button' }, 4), { type: 'option', index: 1 }, 'quiz digit still works on role=button');
});

console.log(`shortcuts: ${passed} checks passed`);
