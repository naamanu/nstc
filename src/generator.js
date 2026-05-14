import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildNames } from './naming.js';
import {
  renderController,
  renderCreateDto,
  renderEntity,
  renderMigration,
  renderModule,
  renderService,
  renderUpdateDto
} from './templates.js';

export async function generateResource(command) {
  const names = buildNames(command.resource);
  const timestamp = command.timestamp ?? createTimestamp();
  const files = planFiles(command, names, timestamp);
  const existing = files.filter((file) => existsSync(file.absolutePath));

  if (existing.length > 0 && !command.force) {
    throw new Error([
      'Refusing to overwrite existing files:',
      ...existing.map((file) => `  - ${file.relativePath}`),
      'Re-run with --force to overwrite them.'
    ].join('\n'));
  }

  if (!command.dryRun) {
    for (const file of files) {
      await mkdir(path.dirname(file.absolutePath), { recursive: true });
      await writeFile(file.absolutePath, file.content, 'utf8');
    }
  }

  return {
    names,
    dryRun: command.dryRun,
    files: files.map((file) => file.relativePath)
  };
}

function planFiles(command, names, timestamp) {
  const baseDir = path.join(command.src, command.resourceDir, names.kebabPlural);
  const migrationDir = path.join(command.src, command.migrationDir);
  const migrationFile = `${timestamp}-Create${names.pluralClassName}.ts`;
  const files = [
    [`${baseDir}/${names.kebabPlural}.module.ts`, renderModule(names)],
    [`${baseDir}/${names.kebabPlural}.controller.ts`, renderController(names)],
    [`${baseDir}/${names.kebabPlural}.service.ts`, renderService(names)],
    [`${baseDir}/entities/${names.kebab}.entity.ts`, renderEntity(names, command.fields)],
    [`${baseDir}/dto/create-${names.kebab}.dto.ts`, renderCreateDto(names, command.fields)],
    [`${baseDir}/dto/update-${names.kebab}.dto.ts`, renderUpdateDto(names)],
    [`${migrationDir}/${migrationFile}`, renderMigration(names, command.fields, timestamp)]
  ];

  return files.map(([relativePath, content]) => ({
    relativePath,
    absolutePath: path.resolve(command.cwd, relativePath),
    content
  }));
}

function createTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds())
  ].join('');
}
