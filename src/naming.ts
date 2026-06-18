import type { ResourceNames } from './models.js';

// Common irregular singular -> plural pairs the algorithmic rules can't derive.
// Applied to every resource (including relation targets) before the regex rules.
const IRREGULAR_PLURALS = new Map<string, string>([
  ['person', 'people'],
  ['child', 'children'],
  ['man', 'men'],
  ['woman', 'women'],
  ['tooth', 'teeth'],
  ['foot', 'feet'],
  ['goose', 'geese'],
  ['mouse', 'mice'],
  ['datum', 'data'],
  ['index', 'indices'],
  ['matrix', 'matrices'],
  ['vertex', 'vertices'],
]);

// Words whose singular and plural forms are identical.
const UNCOUNTABLE = new Set([
  'sheep',
  'series',
  'species',
  'fish',
  'deer',
  'aircraft',
  'information',
  'equipment',
]);

interface InflectionRules {
  toPlural: Map<string, string>;
  toSingular: Map<string, string>;
  uncountable: Set<string>;
}

// Merges the built-in irregulars with optional user overrides (singular -> plural,
// e.g. from the `inflections` config key) and derives the reverse lookup.
function resolveInflections(overrides: Record<string, string> = {}): InflectionRules {
  const toPlural = new Map(IRREGULAR_PLURALS);
  for (const [singular, plural] of Object.entries(overrides)) {
    toPlural.set(singular.toLowerCase(), plural.toLowerCase());
  }

  const toSingular = new Map<string, string>();
  for (const [singular, plural] of toPlural) {
    toSingular.set(plural, singular);
  }

  return { toPlural, toSingular, uncountable: UNCOUNTABLE };
}

export function buildNames(
  resource: string,
  inflections: Record<string, string> = {},
): ResourceNames {
  const normalized = resource.trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(normalized)) {
    throw new Error(
      'Resource name must start with a letter and contain only letters, numbers, hyphens, or underscores.',
    );
  }

  const rules = resolveInflections(inflections);
  const words = splitWords(normalized);
  const singularWords = singularizeLast(words, rules);
  const pluralWords = pluralizeLast(singularWords, rules);
  const classBase = singularWords.map(capitalize).join('');
  const pluralClassBase = pluralWords.map(capitalize).join('');

  return {
    original: normalized,
    camel: toCamel(singularWords),
    className: classBase,
    pluralClassName: pluralClassBase,
    kebab: singularWords.join('-'),
    kebabPlural: pluralWords.join('-'),
    tableName: pluralWords.join('_'),
    route: pluralWords.join('-'),
  };
}

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function toCamel(words: string[]): string {
  return words.map((word, index) => (index === 0 ? word : capitalize(word))).join('');
}

function capitalize(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function singularizeLast(words: string[], rules: InflectionRules): string[] {
  const copy = [...words];
  const last = copy.at(-1);
  if (!last) return copy;
  copy[copy.length - 1] = singularize(last, rules);
  return copy;
}

function pluralizeLast(words: string[], rules: InflectionRules): string[] {
  const copy = [...words];
  const last = copy.at(-1);
  if (!last) return copy;
  copy[copy.length - 1] = pluralize(last, rules);
  return copy;
}

function singularize(word: string, rules: InflectionRules): string {
  if (rules.uncountable.has(word)) return word;

  const irregular = rules.toSingular.get(word);
  if (irregular) return irregular;

  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (
    word.endsWith('ses') ||
    word.endsWith('xes') ||
    word.endsWith('zes') ||
    word.endsWith('ches') ||
    word.endsWith('shes')
  ) {
    return word.replace(/es$/, '');
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    const stem = word.slice(0, -1);
    if (stem.length > 1 && !stem.endsWith('u') && pluralize(stem, rules) === word) {
      return stem;
    }
  }
  return word;
}

function pluralize(word: string, rules: InflectionRules): string {
  if (rules.uncountable.has(word)) return word;

  const irregular = rules.toPlural.get(word);
  if (irregular) return irregular;

  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
