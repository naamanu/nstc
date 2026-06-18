import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ResourceNames, ScaffoldConfig } from './models.js';

interface WireModuleInput {
  moduleName: string;
  importPath: string;
}

interface BracketSection {
  start: number;
  end: number;
  inner: string;
}

export function buildModuleImportPath({
  cwd,
  wire,
  src,
  resourceDir,
  names,
}: {
  cwd: string;
  wire: string;
  src: string;
  resourceDir: string;
  names: ResourceNames;
}): string {
  const moduleFile = path.join(cwd, wire);
  const resourceModule = path.join(
    cwd,
    src,
    resourceDir,
    names.kebabPlural,
    `${names.kebabPlural}.module.ts`,
  );
  let relative = path.relative(path.dirname(moduleFile), resourceModule);
  relative = relative.replace(/\.ts$/, '').split(path.sep).join('/');

  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }

  return relative;
}

export function wireModuleSource(source: string, { moduleName, importPath }: WireModuleInput) {
  if (source.includes(moduleName)) {
    return { source, wired: false as const, reason: 'already-present' as const };
  }

  const importLine = `import { ${moduleName} } from '${importPath}';`;
  let next = insertImport(source, importLine);
  next = insertIntoImportsArray(next, moduleName);
  return { source: next, wired: true as const };
}

export async function wireAppModule(command: ScaffoldConfig, names: ResourceNames) {
  if (!command.wire) {
    throw new Error('Missing --wire module path.');
  }

  const modulePath = path.resolve(command.cwd, command.wire);

  if (!existsSync(modulePath)) {
    throw new Error(`Module file not found: ${command.wire}`);
  }

  const importPath = buildModuleImportPath({
    cwd: command.cwd,
    wire: command.wire,
    src: command.src,
    resourceDir: command.resourceDir,
    names,
  });
  const moduleName = `${names.className}Module`;
  const source = await readFile(modulePath, 'utf8');
  const result = wireModuleSource(source, { moduleName, importPath });

  if (!result.wired) {
    return {
      modulePath: command.wire,
      wired: false as const,
      reason: result.reason,
      dryRun: command.dryRun,
    };
  }

  if (!command.dryRun) {
    await writeFile(modulePath, result.source, 'utf8');
  }

  return {
    modulePath: command.wire,
    wired: true as const,
    importPath,
    moduleName,
    dryRun: command.dryRun,
  };
}

function insertImport(source: string, importLine: string): string {
  const importRegex = /^import .+;$/gm;
  let lastMatch: RegExpMatchArray | null = null;

  for (const match of source.matchAll(importRegex)) {
    lastMatch = match;
  }

  if (lastMatch && lastMatch.index !== undefined) {
    const insertAt = lastMatch.index + lastMatch[0].length;
    return `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
  }

  return `${importLine}\n${source}`;
}

function insertIntoImportsArray(source: string, moduleName: string): string {
  const array = findBracketedSection(source, 'imports:');
  if (!array) {
    return source.replace(/@Module\(\{\n/, `@Module({\n  imports: [${moduleName}],\n`);
  }

  const inner = array.inner.trim();
  const replacement = inner.length === 0 ? `[${moduleName}]` : `[${moduleName}, ${inner}]`;

  return `${source.slice(0, array.start)}${replacement}${source.slice(array.end + 1)}`;
}

function findBracketedSection(source: string, marker: string): BracketSection | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const bracketStart = source.indexOf('[', markerIndex);
  if (bracketStart === -1) {
    return null;
  }

  let depth = 0;
  for (let index = bracketStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return {
          start: bracketStart,
          end: index,
          inner: source.slice(bracketStart + 1, index),
        };
      }
    }
  }

  return null;
}
