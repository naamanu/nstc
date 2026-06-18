import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateResource } from '../src/generator.js';
import { makeGenerateCommand } from './helpers.js';

test('generates NestJS CRUD files and a TypeORM migration', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    const result = await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
        fields: [
          { name: 'title', type: 'string', optional: false, unique: false, relation: null },
          { name: 'body', type: 'text', optional: false, unique: false, relation: null },
          { name: 'published', type: 'boolean', optional: true, unique: false, relation: null },
        ],
      }),
    );

    assert.equal(result.files.length, 7);
    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/posts.module.ts')));
    assert.ok(existsSync(path.join(cwd, 'src/migrations/20260514123456-CreatePosts.ts')));

    const entity = await readFile(
      path.join(cwd, 'src/resources/posts/entities/post.entity.ts'),
      'utf8',
    );
    assert.match(entity, /@Entity\('posts'\)/);
    assert.match(entity, /length: 255/);
    assert.match(entity, /published\?: boolean;/);

    const createDto = await readFile(
      path.join(cwd, 'src/resources/posts/dto/create-post.dto.ts'),
      'utf8',
    );
    assert.match(createDto, /@IsNotEmpty\(\)/);

    const controller = await readFile(
      path.join(cwd, 'src/resources/posts/posts.controller.ts'),
      'utf8',
    );
    assert.match(controller, /ParseUUIDPipe/);

    const migration = await readFile(
      path.join(cwd, 'src/migrations/20260514123456-CreatePosts.ts'),
      'utf8',
    );
    assert.match(migration, /export class CreatePosts20260514123456/);
    assert.match(migration, /await queryRunner.dropTable\('posts', true\)/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('dry run does not write files', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    const result = await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'user',
        timestamp: '20260514123456',
        dryRun: true,
        fields: [{ name: 'email', type: 'string', optional: false, unique: false, relation: null }],
      }),
    );

    assert.equal(result.files.length, 7);
    assert.equal(existsSync(path.join(cwd, 'src')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('honors custom entityDir and dtoDir in paths and imports', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
        entityDir: 'models',
        dtoDir: 'dtos',
        fields: [{ name: 'title', type: 'string', optional: false, unique: false, relation: null }],
      }),
    );

    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/models/post.entity.ts')));
    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/dtos/create-post.dto.ts')));
    assert.equal(existsSync(path.join(cwd, 'src/resources/posts/entities')), false);

    const service = await readFile(path.join(cwd, 'src/resources/posts/posts.service.ts'), 'utf8');
    assert.match(service, /from '\.\/models\/post\.entity'/);
    assert.match(service, /from '\.\/dtos\/create-post\.dto'/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('--only limits generation to the requested kinds', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    const result = await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
        only: ['module', 'service'],
        fields: [{ name: 'title', type: 'string', optional: false, unique: false, relation: null }],
      }),
    );

    assert.equal(result.files.length, 2);
    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/posts.module.ts')));
    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/posts.service.ts')));
    assert.equal(existsSync(path.join(cwd, 'src/resources/posts/posts.controller.ts')), false);
    assert.equal(existsSync(path.join(cwd, 'src/migrations')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('--skip excludes the given kinds', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    const result = await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
        skip: ['migration', 'dto'],
        fields: [{ name: 'title', type: 'string', optional: false, unique: false, relation: null }],
      }),
    );

    // 7 total - 2 dto files - 1 migration = 4
    assert.equal(result.files.length, 4);
    assert.equal(existsSync(path.join(cwd, 'src/migrations')), false);
    assert.equal(existsSync(path.join(cwd, 'src/resources/posts/dto')), false);
    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/entities/post.entity.ts')));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('refuses to overwrite existing files without force', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    const target = path.join(cwd, 'src/resources/posts/posts.module.ts');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'existing', 'utf8');

    await assert.rejects(
      () =>
        generateResource(
          makeGenerateCommand({
            cwd,
            resource: 'post',
            timestamp: '20260514123456',
            dryRun: false,
            fields: [
              { name: 'title', type: 'string', optional: false, unique: false, relation: null },
            ],
          }),
        ),
      /Refusing to overwrite/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('--force overwrites existing files', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-'));

  try {
    const target = path.join(cwd, 'src/resources/posts/posts.module.ts');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'existing content', 'utf8');

    const result = await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
        force: true,
        fields: [{ name: 'title', type: 'string', optional: false, unique: false, relation: null }],
      }),
    );

    assert.equal(result.files.length, 7);
    const content = await readFile(target, 'utf8');
    assert.doesNotMatch(content, /existing content/);
    assert.match(content, /PostModule/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
