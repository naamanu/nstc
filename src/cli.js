import { generateResource } from './generator.js';
import { parseArgs, usage } from './parser.js';

export async function runCli(argv, io = process) {
  const command = parseArgs(argv);

  if (command.help) {
    io.stdout.write(`${usage()}\n`);
    return;
  }

  const result = await generateResource(command);
  io.stdout.write(formatResult(result));
}

function formatResult(result) {
  const verb = result.dryRun ? 'Would create' : 'Created';
  const lines = [
    `${verb} ${result.files.length} files for ${result.names.className}:`,
    ...result.files.map((file) => `  - ${file}`),
    '',
    'Next steps:',
    `  1. Import ${result.names.className}Module from './resources/${result.names.kebabPlural}/${result.names.kebabPlural}.module'.`,
    `  2. Add ${result.names.className}Module to your root or feature module imports array.`,
    `  3. Ensure ${result.names.className} is included in your TypeORM entity registration if your app does not auto-load entities.`,
    ''
  ];

  return `${lines.join('\n')}\n`;
}
