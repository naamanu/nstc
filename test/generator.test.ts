import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateResource } from '../src/generator.js';
import { makeGenerateCommand } from './helpers.js';

test('generates NestJS CRUD files and a TypeORM migration', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nest-scaffolder-'));

  try {
    const result = await generateResource(makeGenerateCommand({
      cwd,
      resource: 'post',
      timestamp: '20260514123456',
      dryRun: false,
      fields: [
        { name: 'title', type: 'string', optional: false, unique: false, relation: null },
        { name: 'body', type: 'text', optional: false, unique: false, relation: null },
        { name: 'published', type: 'boolean', optional: true, unique: false, relation: null }
      ]
    }));

    assert.equal(result.files.length, 7);
    assert.ok(existsSync(path.join(cwd, 'src/resources/posts/posts.module.ts')));
    assert.ok(existsSync(path.join(cwd, 'src/migrations/20260514123456-CreatePosts.ts')));

    const entity = await readFile(path.join(cwd, 'src/resources/posts/entities/post.entity.ts'), 'utf8');
    assert.match(entity, /@Entity\('posts'\)/);
    assert.match(entity, /length: 255/);
    assert.match(entity, /published\?: boolean;/);

    const createDto = await readFile(path.join(cwd, 'src/resources/posts/dto/create-post.dto.ts'), 'utf8');
    assert.match(createDto, /@IsNotEmpty\(\)/);

    const controller = await readFile(path.join(cwd, 'src/resources/posts/posts.controller.ts'), 'utf8');
    assert.match(controller, /ParseUUIDPipe/);

    const migration = await readFile(path.join(cwd, 'src/migrations/20260514123456-CreatePosts.ts'), 'utf8');
    assert.match(migration, /export class CreatePosts20260514123456/);
    assert.match(migration, /await queryRunner.dropTable\('posts', true\)/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('dry run does not write files', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nest-scaffolder-'));

  try {
    const result = await generateResource(makeGenerateCommand({
      cwd,
      resource: 'user',
      timestamp: '20260514123456',
      dryRun: true,
      fields: [{ name: 'email', type: 'string', optional: false, unique: false, relation: null }]
    }));

    assert.equal(result.files.length, 7);
    assert.equal(existsSync(path.join(cwd, 'src')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('refuses to overwrite existing files without force', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nest-scaffolder-'));

  try {
    const target = path.join(cwd, 'src/resources/posts/posts.module.ts');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'existing', 'utf8');

    await assert.rejects(
      () => generateResource(makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
        fields: [{ name: 'title', type: 'string', optional: false, unique: false, relation: null }]
      })),
      /Refusing to overwrite/
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
