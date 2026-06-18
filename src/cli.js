import { generateResource } from './generator.js';
import { destroyResource } from './destroy.js';
import { parseCommand, usage } from './parser.js';
import { formatTypeList } from './types.js';
import { VERSION } from './version.js';
import { wireAppModule } from './wire.js';

export async function runCli(argv, io = process) {
  const command = await parseCommand(argv);

  if (command.help) {
    io.stdout.write(`${usage()}\n`);
    return;
  }

  if (command.version) {
    io.stdout.write(`${VERSION}\n`);
    return;
  }

  if (command.listTypes) {
    io.stdout.write(formatTypeList());
    return;
  }

  if (command.command === 'destroy') {
    const result = await destroyResource(command);
    io.stdout.write(formatDestroyResult(result));
    return;
  }

  const result = await generateResource(command);
  let output = formatGenerateResult(result, command);

  if (command.verbose) {
    output += formatVerbose(result.plannedFiles);
  }

  if (command.wire) {
    const wireResult = await wireAppModule(command, result.names);
    output += formatWireResult(wireResult);
  }

  io.stdout.write(output);
}

function formatGenerateResult(result, command) {
  const modulePath = [
    command.src,
    command.resourceDir,
    result.names.kebabPlural,
    `${result.names.kebabPlural}.module`
  ].join('/');
  const verb = result.dryRun ? 'Would create' : 'Created';
  const lines = [
    `${verb} ${result.files.length} files for ${result.names.className}:`,
    ...result.files.map((file) => `  - ${file}`),
    '',
    'Next steps:',
    `  1. Import ${result.names.className}Module from './${modulePath}'.`,
    `  2. Add ${result.names.className}Module to your root or feature module imports array.`,
    `  3. Ensure ${result.names.className} is included in your TypeORM entity registration if your app does not auto-load entities.`,
    ''
  ];

  return `${lines.join('\n')}\n`;
}

function formatDestroyResult(result) {
  const verb = result.dryRun ? 'Would remove' : 'Removed';
  return [
    `${verb} ${result.removed.length} paths for ${result.names.className}:`,
    ...result.removed.map((file) => `  - ${file}`),
    ''
  ].join('\n');
}

function formatVerbose(plannedFiles) {
  const sections = plannedFiles.map((file) => [
    `--- ${file.relativePath} ---`,
    file.content.trimEnd(),
    ''
  ].join('\n'));

  return `${sections.join('\n')}\n`;
}

function formatWireResult(result) {
  if (!result.wired) {
    return `Module wiring skipped for ${result.modulePath}: ${result.reason}.\n`;
  }

  const verb = result.dryRun ? 'Would wire' : 'Wired';
  return [
    `${verb} ${result.moduleName} into ${result.modulePath}:`,
    `  import from '${result.importPath}'`,
    ''
  ].join('\n');
}
