import { readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildNames } from './naming.js';
import { includeKind } from './types.js';
import type { DestroyCommand, FileKind } from './models.js';
import type { DestroyResult } from './models.js';

export async function destroyResource(command: DestroyCommand): Promise<DestroyResult> {
  const names = buildNames(command.resource, command.inflections);
  const targets = await collectDestroyTargets(command, names);

  if (targets.length === 0) {
    throw new Error(`No scaffolded files found for ${names.className}.`);
  }

  if (!command.dryRun) {
    for (const target of targets) {
      await rm(target.absolutePath, { recursive: true, force: true });
    }
  }

  return {
    names,
    dryRun: command.dryRun,
    removed: targets.map((target) => target.relativePath),
  };
}

async function collectDestroyTargets(
  command: DestroyCommand,
  names: ReturnType<typeof buildNames>,
) {
  const targets: Array<{ relativePath: string; absolutePath: string }> = [];
  const resourceDir = path.join(command.cwd, command.src, command.resourceDir, names.kebabPlural);

  // The resource folder holds every non-migration kind, so remove it when any of
  // those is in scope; the migration file is matched separately by suffix.
  const resourceKinds: FileKind[] = ['module', 'controller', 'service', 'entity', 'dto'];
  const wantsResourceFiles = resourceKinds.some((kind) =>
    includeKind(kind, command.only, command.skip),
  );
  const wantsMigration = includeKind('migration', command.only, command.skip);

  if (wantsResourceFiles && existsSync(resourceDir)) {
    targets.push({
      relativePath: path.join(command.src, command.resourceDir, names.kebabPlural),
      absolutePath: resourceDir,
    });
  }

  const migrationDir = path.join(command.cwd, command.src, command.migrationDir);
  if (wantsMigration && existsSync(migrationDir)) {
    const suffix = `-Create${names.pluralClassName}.ts`;
    const entries = await readdir(migrationDir);

    for (const entry of entries) {
      if (entry.endsWith(suffix)) {
        targets.push({
          relativePath: path.join(command.src, command.migrationDir, entry),
          absolutePath: path.join(migrationDir, entry),
        });
      }
    }
  }

  return targets;
}
