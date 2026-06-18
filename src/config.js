import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const CONFIG_FILE = '.nest-scaffoldrc.json';
const CONFIG_KEYS = [
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

export function loadConfig(cwd = process.cwd()) {
  const fromFile = readJsonConfig(path.join(cwd, CONFIG_FILE));
  const fromPackage = readPackageConfig(path.join(cwd, 'package.json'));
  return pickConfig({ ...fromPackage, ...fromFile });
}

function readJsonConfig(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}.`);
  }
}

function readPackageConfig(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    const config = parsed.nestScaffold ?? parsed['nest-scaffold'];
    return typeof config === 'object' && config !== null ? config : {};
  } catch {
    return {};
  }
}

function pickConfig(source) {
  const config = {};
  for (const key of CONFIG_KEYS) {
    if (source[key] !== undefined) {
      config[key] = source[key];
    }
  }
  return config;
}
