import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../src/cli.js';
import { VERSION } from '../src/version.js';

function captureIo() {
  let output = '';
  return {
    stdout: {
      write(chunk: string) {
        output += chunk;
        return true;
      },
    },
    getOutput() {
      return output;
    },
  };
}

test('next steps reflect custom src and resource directories', async () => {
  const io = captureIo();

  await runCli(
    [
      'generate',
      'resource',
      'user',
      'email:string',
      '--src',
      'server',
      '--resource-dir',
      'features',
      '--dry-run',
    ],
    io,
  );

  const output = io.getOutput();
  assert.match(output, /from '\.\/server\/features\/users\/users\.module'/);
  assert.doesNotMatch(output, /from '\.\/resources\//);
});

test('prints version', async () => {
  const io = captureIo();
  await runCli(['--version'], io);
  assert.equal(io.getOutput().trim(), VERSION);
});

test('prints supported field types', async () => {
  const io = captureIo();
  await runCli(['list-types'], io);
  assert.match(io.getOutput(), /Supported field types:/);
  assert.match(io.getOutput(), /string, text/);
});

test('verbose dry-run prints generated file contents', async () => {
  const io = captureIo();

  await runCli(['generate', 'resource', 'post', 'title:string', '--dry-run', '--verbose'], io);

  const output = io.getOutput();
  assert.match(output, /--- src\/resources\/posts\/posts\.controller\.ts ---/);
  assert.match(output, /ParseUUIDPipe/);
});

test('dry-run previews resolved names so wrong plurals are caught early', async () => {
  const io = captureIo();

  await runCli(['generate', 'resource', 'person', 'name:string', '--dry-run'], io);

  const output = io.getOutput();
  assert.match(output, /Resolved names:/);
  assert.match(output, /class:\s+Person \/ People/);
  assert.match(output, /table:\s+people/);
  assert.match(output, /route:\s+\/people/);
});

test('wires generated module into app.module.ts', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'nstc-wire-'));

  try {
    const appModulePath = path.join(cwd, 'src', 'app.module.ts');
    await mkdir(path.dirname(appModulePath), { recursive: true });
    await writeFile(
      appModulePath,
      `import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
`,
      'utf8',
    );

    await runCli(
      ['generate', 'resource', 'post', 'title:string', '--cwd', cwd, '--wire', 'src/app.module.ts'],
      captureIo(),
    );

    const updated = await readFile(appModulePath, 'utf8');
    assert.match(updated, /import { PostModule } from '\.\/resources\/posts\/posts\.module';/);
    assert.match(updated, /imports: \[PostModule\]/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
