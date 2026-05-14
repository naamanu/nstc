export function buildNames(resource) {
  const normalized = resource.trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(normalized)) {
    throw new Error('Resource name must start with a letter and contain only letters, numbers, hyphens, or underscores.');
  }

  const words = splitWords(normalized);
  const singularWords = singularizeLast(words);
  const pluralWords = pluralizeLast(singularWords);
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
    route: pluralWords.join('-')
  };
}

function splitWords(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

function toCamel(words) {
  return words.map((word, index) => (index === 0 ? word : capitalize(word))).join('');
}

function capitalize(word) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function singularizeLast(words) {
  const copy = [...words];
  const last = copy.at(-1);
  copy[copy.length - 1] = singularize(last);
  return copy;
}

function pluralizeLast(words) {
  const copy = [...words];
  const last = copy.at(-1);
  copy[copy.length - 1] = pluralize(last);
  return copy;
}

function singularize(word) {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.replace(/es$/, '');
  }
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function pluralize(word) {
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
