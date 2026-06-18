import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { ScaffoldConfig } from './models.js';

const CONFIG_FILE = '.nstcrc.json';

type ConfigKey = keyof Pick<
  ScaffoldConfig,
  | 'src'
  | 'resourceDir'
  | 'migrationDir'
  | 'db'
  | 'stringLength'
  | 'idStrategy'
  | 'swagger'
  | 'pagination'
  | 'softDelete'
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
  'softDelete',
];

export function loadConfig(cwd = process.cwd()): Partial<ScaffoldConfig> {
  const fromFile = readJsonConfig(path.join(cwd, CONFIG_FILE));
  const fromPackage = readPackageConfig(path.join(cwd, 'package.json'));
  return pickConfig({ ...fromPackage, ...fromFile });
}

// Reads and JSON-parses a file. Returns undefined when the file is absent,
// {} when it parses to a non-object, and throws on malformed JSON. Both config
// readers share this so their read/parse behavior cannot drift.
function readJsonFile(filePath: string): Record<string, unknown> | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function readJsonConfig(filePath: string): Record<string, unknown> {
  try {
    return readJsonFile(filePath) ?? {};
  } catch {
    // .nstcrc.json is nstc's own file — a malformed one is a user error worth surfacing.
    throw new Error(`Invalid JSON in ${path.basename(filePath)}.`);
  }
}

function readPackageConfig(filePath: string): Record<string, unknown> {
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = readJsonFile(filePath);
  } catch {
    // package.json is a shared, third-party-owned file; don't abort scaffolding
    // over it, but warn instead of silently dropping the user's nstc defaults.
    console.warn(`nstc: could not parse ${path.basename(filePath)}; ignoring its "nstc" config.`);
    return {};
  }

  const config = parsed?.nstc;
  return typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {};
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
