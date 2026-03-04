/**
 * Korean postposition (조사) helper.
 * Selects the correct particle based on whether the preceding syllable has 받침.
 *
 * Usage: after parameter interpolation, call applyPostpositions() on the string.
 *   "서울을(를) 클릭하세요" → "서울을 클릭하세요"  (ㄹ 받침 → 을)
 *   "경기을(를) 클릭하세요" → "경기를 클릭하세요"  (no 받침 → 를)
 */

// Korean syllable Unicode range: U+AC00 ~ U+D7A3
// (code - 0xAC00) % 28 === 0 means no 받침
function hasBatchim(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

// Pairs: pattern → [withBatchim, withoutBatchim]
const PAIRS: Array<[string, string, string]> = [
  ['을(를)', '을', '를'],
  ['이(가)', '이', '가'],
  ['은(는)', '은', '는'],
  ['과(와)', '과', '와'],
  ['아(야)', '아', '야'],
];

// Build a single regex that matches any of the patterns
const PATTERN = new RegExp(
  '(.)(' + PAIRS.map(([p]) => p.replace(/[()]/g, '\\$&')).join('|') + ')',
  'g',
);

const LOOKUP = new Map(PAIRS.map(([p, withB, withoutB]) => [p, [withB, withoutB]]));

export function applyPostpositions(str: string): string {
  return str.replace(PATTERN, (_match, prevChar: string, particle: string) => {
    const pair = LOOKUP.get(particle);
    if (!pair) return prevChar + particle;
    return prevChar + (hasBatchim(prevChar) ? pair[0] : pair[1]);
  });
}
