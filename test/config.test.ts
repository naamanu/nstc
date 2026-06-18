import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { parseCommand } from '../src/parser.js';
import { asGenerateCommand } from './helpers.js';

test('loads defaults from .nstcrc.json', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-config-'));

  try {
    await writeFile(
      path.join(cwd, '.nstcrc.json'),
      JSON.stringify({
        resourceDir: 'features',
        db: 'mysql',
        stringLength: 120,
      }),
      'utf8',
    );

    assert.deepEqual(loadConfig(cwd), {
      resourceDir: 'features',
      db: 'mysql',
      stringLength: 120,
    });

    const command = asGenerateCommand(
      await parseCommand(['generate', 'resource', 'post', 'title:string', '--cwd', cwd]),
    );

    assert.equal(command.resourceDir, 'features');
    assert.equal(command.db, 'mysql');
    assert.equal(command.stringLength, 120);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('cli flags override config file defaults', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-config-'));

  try {
    await writeFile(path.join(cwd, '.nstcrc.json'), JSON.stringify({ db: 'mysql' }), 'utf8');

    const command = asGenerateCommand(
      await parseCommand([
        'generate',
        'resource',
        'post',
        'title:string',
        '--cwd',
        cwd,
        '--db',
        'sqlite',
      ]),
    );

    assert.equal(command.db, 'sqlite');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
