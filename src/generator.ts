import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildNames } from './naming.js';
import type {
  FileKind,
  GenerateCommand,
  GenerateResult,
  PlannedFile,
  RenderOptions,
} from './models.js';
import { includeKind, resolveRenderOptions } from './types.js';
import {
  renderController,
  renderControllerSpec,
  renderCreateDto,
  renderEntity,
  renderMigration,
  renderModule,
  renderService,
  renderServiceSpec,
  renderUpdateDto,
} from './templates.js';
import type { ResourceNames } from './models.js';

export async function generateResource(command: GenerateCommand): Promise<GenerateResult> {
  const names = buildNames(command.resource, command.inflections);
  const options = resolveRenderOptions(command);
  const timestamp = command.timestamp ?? createTimestamp();
  const files = planFiles(command, names, timestamp, options);
  const existing = files.filter((file) => existsSync(file.absolutePath));

  if (existing.length > 0 && !command.force) {
    throw new Error(
      [
        'Refusing to overwrite existing files:',
        ...existing.map((file) => `  - ${file.relativePath}`),
        'Re-run with --force to overwrite them.',
      ].join('\n'),
    );
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
    files: files.map((file) => file.relativePath),
    plannedFiles: files,
  };
}

function planFiles(
  command: GenerateCommand,
  names: ResourceNames,
  timestamp: string,
  options: RenderOptions,
): PlannedFile[] {
  const baseDir = path.join(command.src, command.resourceDir, names.kebabPlural);
  const migrationDir = path.join(command.src, command.migrationDir);
  const migrationFile = `${timestamp}-Create${names.pluralClassName}.ts`;
  const files: Array<[FileKind, string, string]> = [
    [
      'module',
      `${baseDir}/${names.kebabPlural}.module.ts`,
      renderModule(names, command.fields, options),
    ],
    [
      'controller',
      `${baseDir}/${names.kebabPlural}.controller.ts`,
      renderController(names, options),
    ],
    ['service', `${baseDir}/${names.kebabPlural}.service.ts`, renderService(names, options)],
    [
      'entity',
      `${baseDir}/${command.entityDir}/${names.kebab}.entity.ts`,
      renderEntity(names, command.fields, options),
    ],
    [
      'dto',
      `${baseDir}/${command.dtoDir}/create-${names.kebab}.dto.ts`,
      renderCreateDto(names, command.fields, options),
    ],
    [
      'dto',
      `${baseDir}/${command.dtoDir}/update-${names.kebab}.dto.ts`,
      renderUpdateDto(names, options),
    ],
    [
      'migration',
      `${migrationDir}/${migrationFile}`,
      renderMigration(names, command.fields, timestamp, options),
    ],
    ...(command.tests
      ? ([
          ['spec', `${baseDir}/${names.kebabPlural}.service.spec.ts`, renderServiceSpec(names)],
          [
            'spec',
            `${baseDir}/${names.kebabPlural}.controller.spec.ts`,
            renderControllerSpec(names),
          ],
        ] as Array<[FileKind, string, string]>)
      : []),
  ];

  return files
    .filter(([kind]) => includeKind(kind, command.only, command.skip))
    .map(([, relativePath, content]) => ({
      relativePath,
      absolutePath: path.resolve(command.cwd, relativePath),
      content,
    }));
}

function createTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('');
}
