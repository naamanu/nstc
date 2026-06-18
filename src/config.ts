import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { ScaffoldConfig } from './models.js';

const CONFIG_FILE = '.nest-scaffoldrc.json';

type ConfigKey = keyof Pick<
  ScaffoldConfig,
  'src' | 'resourceDir' | 'migrationDir' | 'db' | 'stringLength' | 'idStrategy' | 'swagger' | 'pagination' | 'softDelete'
>;

const CONFIG_KEYS: ConfigKey[] = [
  'src',
  'resourceDir',
  'migrationDir',
  'db',
  'stringLength',
  'idStrategy',
  'swagger',
  'pagination',
  'softDelete'
];

export function loadConfig(cwd = process.cwd()): Partial<ScaffoldConfig> {
  const fromFile = readJsonConfig(path.join(cwd, CONFIG_FILE));
  const fromPackage = readPackageConfig(path.join(cwd, 'package.json'));
  return pickConfig({ ...fromPackage, ...fromFile });
}

function readJsonConfig(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}.`);
  }
}

function readPackageConfig(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const config = parsed.nestScaffold ?? parsed['nest-scaffold'];
    return typeof config === 'object' && config !== null ? config as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function pickConfig(source: Record<string, unknown>): Partial<ScaffoldConfig> {
  const config: Partial<ScaffoldConfig> = {};
  for (const key of CONFIG_KEYS) {
    if (source[key] !== undefined) {
      (config as Record<string, unknown>)[key] = source[key];
    }
  }
  return config;
}
