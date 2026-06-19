import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseField } from '../src/parser.js';
import { asGenerateCommand } from './helpers.js';

test('parses a resource generation command', () => {
  const command = asGenerateCommand(
    parseArgs(['generate', 'resource', 'post', 'title:string', 'published?:boolean', '--dry-run']),
  );

  assert.equal(command.resource, 'post');
  assert.equal(command.dryRun, true);
  assert.deepEqual(command.fields, [
    { name: 'title', type: 'string', optional: false, unique: false, relation: null },
    { name: 'published', type: 'boolean', optional: true, unique: false, relation: null },
  ]);
});

test('supports short command aliases and path options', () => {
  const command = asGenerateCommand(
    parseArgs([
      'g',
      'scaffold',
      'user',
      'email:string',
      '--src',
      'server',
      '--resource-dir',
      'features',
      '--migration-dir',
      'db/migrations',
    ]),
  );

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

test('parses --only, --skip, and directory overrides', () => {
  const command = asGenerateCommand(
    parseArgs([
      'generate',
      'resource',
      'post',
      'title:string',
      '--only',
      'module,service',
      '--entity-dir',
      'models',
      '--dto-dir',
      'dtos',
    ]),
  );

  assert.deepEqual(command.only, ['module', 'service']);
  assert.equal(command.entityDir, 'models');
  assert.equal(command.dtoDir, 'dtos');
});

test('rejects unknown file kinds in --skip', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', '--skip', 'bogus']),
    /Unknown file kind "bogus"/,
  );
});

test('parses repeated --field options', () => {
  const command = asGenerateCommand(
    parseArgs([
      'generate',
      'resource',
      'post',
      '--field',
      'title:string',
      '--field=published?:boolean',
    ]),
  );

  assert.deepEqual(command.fields, [
    { name: 'title', type: 'string', optional: false, unique: false, relation: null },
    { name: 'published', type: 'boolean', optional: true, unique: false, relation: null },
  ]);
});

test('rejects reserved field names', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'id:string']),
    /Field "id" is reserved/,
  );
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'createdAt:datetime']),
    /Field "createdAt" is reserved/,
  );
});

test('rejects duplicate field names', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', 'title:text']),
    /Duplicate field "title"/,
  );
});

test('parses database and generation options', () => {
  const command = asGenerateCommand(
    parseArgs([
      'generate',
      'resource',
      'post',
      'title:string',
      '--db',
      'mysql',
      '--string-length',
      '120',
      '--swagger',
      '--pagination',
    ]),
  );

  assert.equal(command.db, 'mysql');
  assert.equal(command.stringLength, 120);
  assert.equal(command.swagger, true);
  assert.equal(command.pagination, true);
});

test('rejects unsupported database dialects', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', '--db', 'oracle']),
    /Unsupported database "oracle"/,
  );
});

test('rejects invalid string length values', () => {
  assert.throws(
    () => parseArgs(['generate', 'resource', 'post', 'title:string', '--string-length', '0']),
    /positive integer/,
  );
});

test('returns version command', () => {
  assert.deepEqual(parseArgs(['--version']), { version: true });
});

test('returns list-types command', () => {
  assert.deepEqual(parseArgs(['list-types']), { listTypes: true });
});

test('parses verbose and wire options', () => {
  const command = asGenerateCommand(
    parseArgs([
      'generate',
      'resource',
      'post',
      'title:string',
      '--verbose',
      '--wire',
      'src/app.module.ts',
    ]),
  );

  assert.equal(command.command, 'generate');
  assert.equal(command.verbose, true);
  assert.equal(command.wire, 'src/app.module.ts');
});

test('parses field modifiers and generation flags', () => {
  const command = asGenerateCommand(
    parseArgs([
      'generate',
      'resource',
      'user',
      'email:string:unique',
      'profileId:uuid:belongsTo:Profile',
      '--id',
      'serial',
      '--soft-delete',
    ]),
  );

  assert.equal(command.idStrategy, 'serial');
  assert.equal(command.softDelete, true);
  assert.equal(command.fields[0].unique, true);
  assert.deepEqual(command.fields[1].relation, { kind: 'belongsTo', target: 'Profile' });
});

test('parses enum field with comma-separated values', () => {
  const field = parseField('status:enum:draft,published,archived');
  assert.equal(field.name, 'status');
  assert.equal(field.type, 'enum');
  assert.deepEqual(field.enumValues, ['draft', 'published', 'archived']);
  assert.equal(field.optional, false);
});

test('parses optional enum field', () => {
  const field = parseField('status?:enum:draft,published');
  assert.equal(field.optional, true);
  assert.deepEqual(field.enumValues, ['draft', 'published']);
});

test('rejects enum field with no values', () => {
  assert.throws(() => parseField('status:enum'), /Missing enum values/);
});

test('parses hasMany relation field', () => {
  const field = parseField('posts:hasMany:Post');
  assert.equal(field.name, 'posts');
  assert.equal(field.type, 'hasMany');
  assert.deepEqual(field.relation, { kind: 'hasMany', target: 'Post' });
  assert.equal(field.optional, false);
});

test('parses hasOne relation field', () => {
  const field = parseField('profile:hasOne:Profile');
  assert.equal(field.name, 'profile');
  assert.equal(field.type, 'hasOne');
  assert.deepEqual(field.relation, { kind: 'hasOne', target: 'Profile' });
});

test('rejects optional modifier on hasMany and hasOne', () => {
  assert.throws(() => parseField('posts?:hasMany:Post'), /cannot be optional/);
  assert.throws(() => parseField('profile?:hasOne:Profile'), /cannot be optional/);
});

test('rejects hasMany without a target model', () => {
  assert.throws(() => parseField('posts:hasMany'), /Missing relation target/);
  assert.throws(() => parseField('avatar:hasOne'), /Missing relation target/);
});

test('parses destroy command', () => {
  const command = parseArgs(['destroy', 'resource', 'post', '--dry-run']);

  if (!('command' in command) || command.command !== 'destroy') {
    throw new Error('Expected destroy command');
  }

  assert.equal(command.resource, 'post');
  assert.equal(command.dryRun, true);
});
