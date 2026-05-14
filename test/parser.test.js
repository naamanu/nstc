import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseField } from '../src/parser.js';

test('parses a resource generation command', () => {
  const command = parseArgs(['generate', 'resource', 'post', 'title:string', 'published?:boolean', '--dry-run']);

  assert.equal(command.resource, 'post');
  assert.equal(command.dryRun, true);
  assert.deepEqual(command.fields, [
    { name: 'title', type: 'string', optional: false },
    { name: 'published', type: 'boolean', optional: true }
  ]);
});

test('supports short command aliases and path options', () => {
  const command = parseArgs([
    'g',
    'scaffold',
    'user',
    'email:string',
    '--src',
    'server',
    '--resource-dir',
    'features',
    '--migration-dir',
    'db/migrations'
  ]);

  assert.equal(command.src, 'server');
  assert.equal(command.resourceDir, 'features');
  assert.equal(command.migrationDir, 'db/migrations');
});

test('rejects invalid field syntax', () => {
  assert.throws(() => parseField('title'), /Invalid field/);
});

test('rejects unknown field types', () => {
  assert.throws(() => parseField('payload:xml'), /Unknown type/);
});
