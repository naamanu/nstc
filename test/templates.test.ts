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
