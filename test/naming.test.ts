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
