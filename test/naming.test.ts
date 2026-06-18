import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNames } from '../src/naming.js';

test('singularizes plural resource names', () => {
  const names = buildNames('posts');
  assert.equal(names.className, 'Post');
  assert.equal(names.kebabPlural, 'posts');
});

test('preserves singular words ending in s', () => {
  const names = buildNames('status');
  assert.equal(names.className, 'Status');
  assert.equal(names.kebab, 'status');
  assert.equal(names.kebabPlural, 'statuses');
  assert.equal(names.tableName, 'statuses');
});

test('handles compound and inflected names', () => {
  assert.deepEqual(buildNames('blog_post'), {
    original: 'blog_post',
    camel: 'blogPost',
    className: 'BlogPost',
    pluralClassName: 'BlogPosts',
    kebab: 'blog-post',
    kebabPlural: 'blog-posts',
    tableName: 'blog_posts',
    route: 'blog-posts',
  });

  const category = buildNames('category');
  assert.equal(category.className, 'Category');
  assert.equal(category.kebabPlural, 'categories');

  const box = buildNames('box');
  assert.equal(box.className, 'Box');
  assert.equal(box.kebabPlural, 'boxes');
});

test('handles irregular plurals', () => {
  const person = buildNames('person');
  assert.equal(person.className, 'Person');
  assert.equal(person.pluralClassName, 'People');
  assert.equal(person.kebabPlural, 'people');
  assert.equal(person.tableName, 'people');
  assert.equal(person.route, 'people');

  const child = buildNames('child');
  assert.equal(child.kebabPlural, 'children');

  // Round-trips: a plural input still resolves to the correct singular/plural.
  const people = buildNames('people');
  assert.equal(people.className, 'Person');
  assert.equal(people.kebabPlural, 'people');
});

test('leaves uncountable nouns unchanged', () => {
  const sheep = buildNames('sheep');
  assert.equal(sheep.className, 'Sheep');
  assert.equal(sheep.kebab, 'sheep');
  assert.equal(sheep.kebabPlural, 'sheep');
  assert.equal(sheep.tableName, 'sheep');
});

test('applies user inflection overrides', () => {
  const names = buildNames('hero', { hero: 'heroes' });
  assert.equal(names.className, 'Hero');
  assert.equal(names.kebabPlural, 'heroes');
  assert.equal(names.tableName, 'heroes');

  // Without the override the algorithmic rule would produce "heros".
  assert.equal(buildNames('hero').kebabPlural, 'heros');
});
