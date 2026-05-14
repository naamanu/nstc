const TYPE_ALIASES = new Map([
  ['string', 'string'],
  ['text', 'text'],
  ['number', 'number'],
  ['int', 'int'],
  ['integer', 'int'],
  ['float', 'float'],
  ['boolean', 'boolean'],
  ['bool', 'boolean'],
  ['date', 'date'],
  ['datetime', 'datetime'],
  ['uuid', 'uuid'],
  ['json', 'json']
]);

export function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  const tokens = [...argv];
  const action = tokens.shift();
  const subject = tokens.shift();

  if (!['generate', 'g'].includes(action) || !['resource', 'scaffold'].includes(subject)) {
    throw new Error(`Unsupported command.\n\n${usage()}`);
  }

  const resource = tokens.shift();
  if (!resource) {
    throw new Error(`Missing resource name.\n\n${usage()}`);
  }

  const options = {
    cwd: process.cwd(),
    src: 'src',
    resourceDir: 'resources',
    migrationDir: 'migrations',
    dryRun: false,
    force: false
  };
  const fieldTokens = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--dry-run') {
      options.dryRun = true;
    } else if (token === '--force') {
      options.force = true;
    } else if (token === '--src') {
      options.src = readOptionValue(tokens, ++index, '--src');
    } else if (token === '--resource-dir') {
      options.resourceDir = readOptionValue(tokens, ++index, '--resource-dir');
    } else if (token === '--migration-dir') {
      options.migrationDir = readOptionValue(tokens, ++index, '--migration-dir');
    } else if (token === '--cwd') {
      options.cwd = readOptionValue(tokens, ++index, '--cwd');
    } else if (token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    } else {
      fieldTokens.push(token);
    }
  }

  if (fieldTokens.length === 0) {
    throw new Error('At least one field is required.');
  }

  return {
    resource,
    fields: fieldTokens.map(parseField),
    ...options
  };
}

export function parseField(token) {
  const match = token.match(/^([A-Za-z][A-Za-z0-9_]*)(\?)?:([A-Za-z][A-Za-z0-9_]*)$/);
  if (!match) {
    throw new Error(`Invalid field "${token}". Use name:type or name?:type.`);
  }

  const [, name, optionalMark, rawType] = match;
  const type = TYPE_ALIASES.get(rawType.toLowerCase());
  if (!type) {
    throw new Error(`Unknown type "${rawType}" for field "${name}".`);
  }

  return {
    name,
    type,
    optional: Boolean(optionalMark)
  };
}

export function usage() {
  return [
    'Usage:',
    '  nest-scaffold generate resource <name> <field:type...> [options]',
    '',
    'Examples:',
    '  nest-scaffold generate resource post title:string body:text published:boolean',
    '  nest-scaffold g resource user email:string admin?:boolean --dry-run',
    '',
    'Options:',
    '  --src <dir>             Source directory. Default: src',
    '  --resource-dir <dir>    Resource directory under --src. Default: resources',
    '  --migration-dir <dir>   Migration directory under --src. Default: migrations',
    '  --dry-run               Print planned files without writing them',
    '  --force                 Overwrite generated files if they already exist',
    '  --help                  Show this help'
  ].join('\n');
}

function readOptionValue(tokens, index, optionName) {
  const value = tokens[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return value;
}
