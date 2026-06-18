import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { destroyResource } from '../src/destroy.js';
import { generateResource } from '../src/generator.js';
import { buildNames } from '../src/naming.js';
import { renderEntity, renderMigration, renderModule, renderService } from '../src/templates.js';
import { makeDestroyCommand, makeField, makeGenerateCommand } from './helpers.js';

test('entity supports unique columns and belongsTo relations', () => {
  const names = buildNames('post');
  const fields = [
    makeField({ name: 'slug', type: 'string', unique: true }),
    makeField({ name: 'userId', type: 'uuid', relation: { kind: 'belongsTo', target: 'User' } }),
  ];
  const entity = renderEntity(names, fields, { resourceDir: 'resources' });

  assert.match(entity, /unique: true/);
  assert.match(entity, /@ManyToOne\(\(\) => User/);
  assert.match(entity, /user: User;/);
  assert.match(entity, /from '\.\.\/\.\.\/users\/entities\/user'/);
});

test('module registers related entities in TypeOrmModule.forFeature', () => {
  const names = buildNames('post');
  const fields = [
    makeField({ name: 'userId', type: 'uuid', relation: { kind: 'belongsTo', target: 'User' } }),
  ];
  const moduleSource = renderModule(names, fields, { resourceDir: 'resources' });

  assert.match(moduleSource, /TypeOrmModule\.forFeature\(\[Post, User\]\)/);
  assert.match(moduleSource, /import { User } from '\.\.\/\.\.\/users\/entities\/user';/);
});

test('serial id strategy renders integer primary key and ParseIntPipe service types', () => {
  const names = buildNames('item');
  const entity = renderEntity(names, [], { idStrategy: 'serial' });
  const service = renderService(names, { idStrategy: 'serial' });
  const migration = renderMigration(names, [], '20260514123456', { idStrategy: 'serial' });

  assert.match(entity, /@PrimaryGeneratedColumn\(\)\n {2}id: number;/);
  assert.match(service, /async findOne\(id: number\)/);
  assert.match(migration, /generationStrategy: 'increment'/);
});

test('soft delete adds deletedAt and uses softRemove', () => {
  const names = buildNames('post');
  const entity = renderEntity(names, [], { softDelete: true });
  const service = renderService(names, { softDelete: true });
  const migration = renderMigration(names, [], '20260514123456', { softDelete: true });

  assert.match(entity, /@DeleteDateColumn\(\)/);
  assert.match(service, /softRemove/);
  assert.match(migration, /name: 'deletedAt'/);
});

test('destroy removes resource directory and matching migration', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-destroy-'));

  try {
    await generateResource(
      makeGenerateCommand({
        cwd,
        resource: 'post',
        timestamp: '20260514123456',
        dryRun: false,
      }),
    );

    const result = await destroyResource(
      makeDestroyCommand({
        cwd,
        resource: 'post',
        dryRun: false,
      }),
    );

    assert.equal(result.removed.length, 2);
    assert.equal(existsSync(path.join(cwd, 'src/resources/posts')), false);
    assert.equal(existsSync(path.join(cwd, 'src/migrations/20260514123456-CreatePosts.ts')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('destroy dry run reports paths without deleting files', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-destroy-'));

  try {
    await mkdir(path.join(cwd, 'src/resources/posts'), { recursive: true });
    await writeFile(path.join(cwd, 'src/resources/posts/posts.module.ts'), 'keep', 'utf8');
    await mkdir(path.join(cwd, 'src/migrations'), { recursive: true });
    await writeFile(path.join(cwd, 'src/migrations/20260514123456-CreatePosts.ts'), 'keep', 'utf8');

    const result = await destroyResource(
      makeDestroyCommand({
        cwd,
        resource: 'post',
        dryRun: true,
      }),
    );

    assert.equal(result.removed.length, 2);
    assert.equal(existsSync(path.join(cwd, 'src/resources/posts/posts.module.ts')), true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
