import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNames } from '../src/naming.js';
import {
  renderController,
  renderCreateDto,
  renderEntity,
  renderMigration,
  renderService,
  renderUpdateDto,
} from '../src/templates.js';
import { makeField } from './helpers.js';

const names = buildNames('post');
const fields = [
  makeField({ name: 'title', type: 'string' }),
  makeField({ name: 'published', type: 'boolean', optional: true }),
];

test('entity columns include default string length', () => {
  const entity = renderEntity(names, fields);
  assert.match(entity, /@Column\(\{ type: 'varchar', length: 255 \}\)/);
});

test('create dto adds IsNotEmpty for required strings', () => {
  const dto = renderCreateDto(names, fields);
  assert.match(dto, /@IsNotEmpty\(\)/);
  assert.match(dto, /@IsOptional\(\)/);
});

test('controller validates uuid route params', () => {
  const controller = renderController(names);
  assert.match(controller, /@Param\('id', ParseUUIDPipe\) id: string/);
});

test('mysql migration uses dialect-specific column types', () => {
  const migration = renderMigration(
    names,
    [makeField({ name: 'meta', type: 'json' })],
    '20260514123456',
    {
      db: 'mysql',
    },
  );

  assert.match(migration, /type: 'json'/);
  assert.match(migration, /default: '\(UUID\(\)\)'/);
  assert.doesNotMatch(migration, /uuid_generate_v4/);
});

test('sqlite migration uses text for json columns', () => {
  const migration = renderMigration(
    names,
    [makeField({ name: 'meta', type: 'json' })],
    '20260514123456',
    {
      db: 'sqlite',
    },
  );

  assert.match(migration, /name: 'meta',\n {12}type: 'text'/);
  assert.match(migration, /default: 'datetime\('now'\)'/);
});

test('swagger option decorates controller and DTOs', () => {
  const controller = renderController(names, { swagger: true });
  const dto = renderCreateDto(names, fields, { swagger: true });
  const updateDto = renderUpdateDto(names, { swagger: true });

  assert.match(controller, /@ApiTags\('posts'\)/);
  assert.match(dto, /@ApiProperty\(\)/);
  assert.match(dto, /@ApiPropertyOptional\(\)/);
  assert.match(updateDto, /from '@nestjs\/swagger'/);
});

test('pagination option adds skip and take query params', () => {
  const controller = renderController(names, { pagination: true });
  const service = renderService(names, { pagination: true });

  assert.match(controller, /@Query\('skip'\)/);
  assert.match(controller, /@Query\('take'\)/);
  assert.match(service, /find\(\{ skip: safeSkip, take: safeTake \}\)/);
});

test('pagination guards against NaN and out-of-range query params', () => {
  const controller = renderController(names, { pagination: true });
  const service = renderService(names, { pagination: true });

  // Controller parses via a NaN-safe helper rather than a bare ternary.
  assert.match(controller, /function toPaginationInt\(/);
  assert.match(controller, /findAll\(toPaginationInt\(skip, 0\), toPaginationInt\(take, 25\)\)/);
  assert.doesNotMatch(controller, /skip \? Number\.parseInt/);

  // Service clamps and validates as a second line of defense.
  assert.match(service, /Number\.isFinite\(skip\)/);
  assert.match(service, /Math\.min\(take, 100\)/);
});

test('non-paginated resources keep the simple findAll', () => {
  const controller = renderController(names);
  const service = renderService(names);

  assert.doesNotMatch(controller, /toPaginationInt/);
  assert.match(service, /find\(\)/);
});

test('enum field renders union type and @Column with enum array', () => {
  const entity = renderEntity(names, [
    makeField({ name: 'status', type: 'enum', enumValues: ['draft', 'published', 'archived'] }),
  ]);

  assert.match(entity, /@Column\(\{ type: 'enum', enum: \['draft', 'published', 'archived'\] \}\)/);
  assert.match(entity, /status: 'draft' \| 'published' \| 'archived';/);
});

test('enum field falls back to varchar on sqlite', () => {
  const entity = renderEntity(
    names,
    [makeField({ name: 'status', type: 'enum', enumValues: ['a', 'b'] })],
    { db: 'sqlite' },
  );

  assert.match(entity, /@Column\(\{ type: 'varchar', length: 50 \}\)/);
  assert.doesNotMatch(entity, /type: 'enum'/);
});

test('enum field renders @IsIn with values in DTO', () => {
  const dto = renderCreateDto(names, [
    makeField({ name: 'status', type: 'enum', enumValues: ['draft', 'published'] }),
  ]);

  assert.match(dto, /@IsIn\(\['draft', 'published'\]\)/);
  assert.match(dto, /status: 'draft' \| 'published';/);
  assert.match(dto, /import \{ IsIn \} from 'class-validator'/);
});

test('optional enum field includes @IsOptional in DTO', () => {
  const dto = renderCreateDto(names, [
    makeField({ name: 'status', type: 'enum', optional: true, enumValues: ['a', 'b'] }),
  ]);

  assert.match(dto, /@IsOptional\(\)/);
  assert.match(dto, /@IsIn\(\['a', 'b'\]\)/);
  assert.match(dto, /status\?: 'a' \| 'b';/);
});

test('enum field emits enum array in migration for postgres', () => {
  const migration = renderMigration(
    names,
    [makeField({ name: 'status', type: 'enum', enumValues: ['draft', 'published'] })],
    '20260514123456',
  );

  assert.match(migration, /type: 'enum'/);
  assert.match(migration, /enum: \['draft', 'published'\]/);
});

test('enum field emits varchar in migration for sqlite', () => {
  const migration = renderMigration(
    names,
    [makeField({ name: 'status', type: 'enum', enumValues: ['draft', 'published'] })],
    '20260514123456',
    { db: 'sqlite' },
  );

  assert.match(migration, /type: 'varchar'/);
  assert.doesNotMatch(migration, /type: 'enum'/);
  assert.doesNotMatch(migration, /enum:/);
});

test('minLength and maxLength modifiers render in DTO with correct args', () => {
  const dto = renderCreateDto(names, [
    makeField({ name: 'title', type: 'string', minLength: 3, maxLength: 100 }),
  ]);

  assert.match(dto, /@MinLength\(3\)/);
  assert.match(dto, /@MaxLength\(100\)/);
  assert.match(dto, /import \{ [^}]*MinLength[^}]* \} from 'class-validator'/);
});

test('min and max modifiers render in DTO with correct args', () => {
  const dto = renderCreateDto(names, [
    makeField({ name: 'price', type: 'float', min: 0, max: 999 }),
  ]);

  assert.match(dto, /@Min\(0\)/);
  assert.match(dto, /@Max\(999\)/);
  assert.match(dto, /import \{ [^}]*Max[^}]* \} from 'class-validator'/);
});

test('validation modifier decorators appear after standard validators', () => {
  const dto = renderCreateDto(names, [makeField({ name: 'title', type: 'string', minLength: 5 })]);

  const isNotEmpty = dto.indexOf('@IsNotEmpty');
  const minLen = dto.indexOf('@MinLength');
  assert.ok(isNotEmpty < minLen, '@IsNotEmpty should appear before @MinLength');
});

test('hasMany field renders @OneToMany decorator and no column', () => {
  const userNames = buildNames('user');
  const entity = renderEntity(userNames, [
    makeField({ name: 'posts', type: 'hasMany', relation: { kind: 'hasMany', target: 'Post' } }),
  ]);

  assert.match(entity, /OneToMany/);
  assert.match(entity, /@OneToMany\(\(\) => Post, \(post\) => post\.user\)/);
  assert.match(entity, /posts: Post\[\]/);
  assert.doesNotMatch(entity, /@Column/);
  assert.match(entity, /import { Post } from/);
});

test('hasOne field renders @OneToOne decorator and no column', () => {
  const userNames = buildNames('user');
  const entity = renderEntity(userNames, [
    makeField({ name: 'profile', type: 'hasOne', relation: { kind: 'hasOne', target: 'Profile' } }),
  ]);

  assert.match(entity, /OneToOne/);
  assert.match(entity, /@OneToOne\(\(\) => Profile, \(profile\) => profile\.user\)/);
  assert.match(entity, /profile: Profile;/);
  assert.doesNotMatch(entity, /@Column/);
});

test('hasMany and hasOne fields are excluded from create DTO', () => {
  const userNames = buildNames('user');
  const dto = renderCreateDto(userNames, [
    makeField({ name: 'name', type: 'string' }),
    makeField({ name: 'posts', type: 'hasMany', relation: { kind: 'hasMany', target: 'Post' } }),
    makeField({ name: 'profile', type: 'hasOne', relation: { kind: 'hasOne', target: 'Profile' } }),
  ]);

  assert.match(dto, /name/);
  assert.doesNotMatch(dto, /posts/);
  assert.doesNotMatch(dto, /profile/);
});

test('migration emits createIndex for belongsTo fields in up', () => {
  const migration = renderMigration(
    names,
    [makeField({ name: 'postId', type: 'uuid', relation: { kind: 'belongsTo', target: 'Post' } })],
    '20260514123456',
  );

  assert.match(migration, /queryRunner\.createIndex/);
  assert.match(migration, /IDX_posts_postId/);
  assert.match(migration, /columnNames: \['postId'\]/);
  assert.match(migration, /TableIndex/);
});

test('migration emits dropIndex for belongsTo fields in down', () => {
  const migration = renderMigration(
    names,
    [makeField({ name: 'postId', type: 'uuid', relation: { kind: 'belongsTo', target: 'Post' } })],
    '20260514123456',
  );

  assert.match(migration, /queryRunner\.dropIndex/);
  assert.match(migration, /IDX_posts_postId/);
});

test('migration skips createIndex when no belongsTo fields', () => {
  const migration = renderMigration(names, fields, '20260514123456');

  assert.doesNotMatch(migration, /createIndex/);
  assert.doesNotMatch(migration, /dropIndex/);
  assert.doesNotMatch(migration, /TableIndex/);
});

test('hasMany and hasOne fields are excluded from migration columns', () => {
  const userNames = buildNames('user');
  const migration = renderMigration(
    userNames,
    [
      makeField({ name: 'name', type: 'string' }),
      makeField({ name: 'posts', type: 'hasMany', relation: { kind: 'hasMany', target: 'Post' } }),
    ],
    '20260514123456',
  );

  assert.match(migration, /name: 'name'/);
  assert.doesNotMatch(migration, /name: 'posts'/);
});
