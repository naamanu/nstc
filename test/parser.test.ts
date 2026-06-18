import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseField } from '../src/parser.js';
import { asGenerateCommand } from './helpers.js';

test('parses a resource generation command', () => {
  const command = asGenerateCommand(parseArgs(['generate', 'resource', 'post', 'title:string', 'published?:boolean', '--dry-run']));

  assert.equal(command.resource, 'post');
  assert.equal(command.dryRun, true);
  assert.deepEqual(command.fields, [
    { name: 'title', type: 'string', optional: false, unique: false, relation: null },
    { name: 'published', type: 'boolean', optional: true, unique: false, relation: null }
  ]);
});

test('supports short command aliases and path options', () => {
  const command = asGenerateCommand(parseArgs([
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
  ]));

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

test('parses repeated --field options', () => {
  const command = asGenerateCommand(parseArgs([
    'generate',
    'resource',
    'post',
    '--field',
    'title:string',
    '--field=published?:boolean'
  ]));

  assert.deepEqual(command.fields, [
    { name: 'title', type: 'string', optional: false, unique: false, relation: null },
    { name: 'published', type: 'boolean', optional: true, unique: false, relation: null }
  ]);
});

test('rejects reserved field names', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'id:string']),
    /Field "id" is reserved/
  );
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'createdAt:datetime']),
    /Field "createdAt" is reserved/
  );
});

test('rejects duplicate field names', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', 'title:text']),
    /Duplicate field "title"/
  );
});

test('parses database and generation options', () => {
  const command = asGenerateCommand(parseArgs([
    'generate',
    'resource',
    'post',
    'title:string',
    '--db',
    'mysql',
    '--string-length',
    '120',
    '--swagger',
    '--pagination'
  ]));

  assert.equal(command.db, 'mysql');
  assert.equal(command.stringLength, 120);
  assert.equal(command.swagger, true);
  assert.equal(command.pagination, true);
});

test('rejects unsupported database dialects', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', '--db', 'oracle']),
    /Unsupported database "oracle"/
  );
});

test('rejects invalid string length values', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', '--string-length', '0']),
    /positive integer/
  );
});

test('returns version command', () => {
  assert.deepEqual(parseArgs(['--version']), { version: true });
});

test('returns list-types command', () => {
  assert.deepEqual(parseArgs(['list-types']), { listTypes: true });
});

test('parses verbose and wire options', () => {
  const command = asGenerateCommand(parseArgs([
    'generate',
    'resource',
    'post',
    'title:string',
    '--verbose',
    '--wire',
    'src/app.module.ts'
  ]));

  assert.equal(command.command, 'generate');
  assert.equal(command.verbose, true);
  assert.equal(command.wire, 'src/app.module.ts');
});

test('parses field modifiers and generation flags', () => {
  const command = asGenerateCommand(parseArgs([
    'generate',
    'resource',
    'user',
    'email:string:unique',
    'profileId:uuid:belongsTo:Profile',
    '--id',
    'serial',
    '--soft-delete'
  ]));

  assert.equal(command.idStrategy, 'serial');
  assert.equal(command.softDelete, true);
  assert.equal(command.fields[0].unique, true);
  assert.deepEqual(command.fields[1].relation, { kind: 'belongsTo', target: 'Profile' });
});

test('parses destroy command', () => {
  const command = parseArgs(['destroy', 'resource', 'post', '--dry-run']);

  if (!('command' in command) || command.command !== 'destroy') {
    throw new Error('Expected destroy command');
  }

  assert.equal(command.resource, 'post');
  assert.equal(command.dryRun, true);
});
