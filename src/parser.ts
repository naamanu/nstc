import { loadConfig } from './config.js';
import type {
  DbDialect,
  DestroyCommand,
  FieldDefinition,
  GenerateCommand,
  IdStrategy,
  ParsedCommand,
  ScaffoldConfig,
} from './models.js';
import { TYPE_ALIASES, SUPPORTED_DBS, SUPPORTED_ID_STRATEGIES } from './types.js';

const RESERVED_FIELD_NAMES = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);

const DEFAULT_OPTIONS: ScaffoldConfig = {
  cwd: process.cwd(),
  src: 'src',
  resourceDir: 'resources',
  migrationDir: 'migrations',
  db: 'postgres',
  stringLength: 255,
  idStrategy: 'uuid',
  swagger: false,
  pagination: false,
  softDelete: false,
  dryRun: false,
  force: false,
  verbose: false,
  wire: null,
};

export function parseArgs(argv: string[], config: Partial<ScaffoldConfig> = {}): ParsedCommand {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  if (argv.includes('--version') || argv.includes('-v')) {
    return { version: true };
  }

  if (argv[0] === 'list-types') {
    return { listTypes: true };
  }

  const tokens = [...argv];
  const action = tokens.shift();

  if (action && ['generate', 'g'].includes(action)) {
    return parseGenerateCommand(tokens, config);
  }

  if (action && ['destroy', 'd'].includes(action)) {
    return parseDestroyCommand(tokens, config);
  }

  throw new Error(`Unsupported command.\n\n${usage()}`);
}

function parseGenerateCommand(tokens: string[], config: Partial<ScaffoldConfig>): GenerateCommand {
  const subject = tokens.shift();

  if (!subject || !['resource', 'scaffold'].includes(subject)) {
    throw new Error(`Unsupported command.\n\n${usage()}`);
  }

  const resource = tokens.shift();
  if (!resource) {
    throw new Error(`Missing resource name.\n\n${usage()}`);
  }

  const { options, fieldTokens } = parseSharedOptions(tokens, config);

  if (fieldTokens.length === 0) {
    throw new Error('At least one field is required.');
  }

  const fields = fieldTokens.map(parseField);
  validateFields(fields);
  validateConfigOptions(options);

  return {
    command: 'generate',
    resource,
    fields,
    ...options,
  };
}

function parseDestroyCommand(tokens: string[], config: Partial<ScaffoldConfig>): DestroyCommand {
  const subject = tokens.shift();

  if (!subject || !['resource', 'scaffold'].includes(subject)) {
    throw new Error(`Unsupported command.\n\n${usage()}`);
  }

  const resource = tokens.shift();
  if (!resource) {
    throw new Error(`Missing resource name.\n\n${usage()}`);
  }

  const { options } = parseSharedOptions(tokens, config);
  validateConfigOptions(options);

  return {
    command: 'destroy',
    resource,
    ...options,
  };
}

function parseSharedOptions(tokens: string[], config: Partial<ScaffoldConfig>) {
  const options: ScaffoldConfig = {
    ...DEFAULT_OPTIONS,
    ...config,
  };
  const fieldTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--dry-run') {
      options.dryRun = true;
    } else if (token === '--force') {
      options.force = true;
    } else if (token === '--verbose') {
      options.verbose = true;
    } else if (token === '--swagger') {
      options.swagger = true;
    } else if (token === '--pagination') {
      options.pagination = true;
    } else if (token === '--soft-delete') {
      options.softDelete = true;
    } else if (token === '--src') {
      options.src = readOptionValue(tokens, ++index, '--src');
    } else if (token === '--resource-dir') {
      options.resourceDir = readOptionValue(tokens, ++index, '--resource-dir');
    } else if (token === '--migration-dir') {
      options.migrationDir = readOptionValue(tokens, ++index, '--migration-dir');
    } else if (token === '--cwd') {
      options.cwd = readOptionValue(tokens, ++index, '--cwd');
    } else if (token === '--db') {
      options.db = readDbOption(tokens, ++index);
    } else if (token === '--id') {
      options.idStrategy = readIdStrategyOption(tokens, ++index);
    } else if (token === '--string-length') {
      options.stringLength = readStringLengthOption(tokens, ++index);
    } else if (token === '--wire') {
      options.wire = readOptionValue(tokens, ++index, '--wire');
    } else if (token === '--field') {
      fieldTokens.push(readOptionValue(tokens, ++index, '--field'));
    } else if (token.startsWith('--field=')) {
      fieldTokens.push(token.slice('--field='.length));
    } else if (token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    } else {
      fieldTokens.push(token);
    }
  }

  return { options, fieldTokens };
}

export function parseCommand(argv: string[]): ParsedCommand {
  const cwd = extractCwd(argv) ?? process.cwd();
  const config = loadConfig(cwd);
  return parseArgs(argv, config);
}

export function parseField(token: string): FieldDefinition {
  const segments = token.split(':');
  if (segments.length < 2) {
    throw new Error(`Invalid field "${token}". Use name:type[:modifier...].`);
  }

  const nameMatch = segments[0].match(/^([A-Za-z][A-Za-z0-9_]*)(\?)?$/);
  if (!nameMatch) {
    throw new Error(`Invalid field "${token}". Use name:type[:modifier...].`);
  }

  const [, name, optionalMark] = nameMatch;
  const type = TYPE_ALIASES.get(segments[1].toLowerCase());
  if (!type) {
    throw new Error(`Unknown type "${segments[1]}" for field "${name}".`);
  }

  const field: FieldDefinition = {
    name,
    type,
    optional: Boolean(optionalMark),
    unique: false,
    relation: null,
  };

  for (let index = 2; index < segments.length; index += 1) {
    const modifier = segments[index];

    if (modifier === 'unique') {
      field.unique = true;
      continue;
    }

    if (modifier === 'belongsTo') {
      const target = segments[++index];
      if (!target) {
        throw new Error(
          `Missing relation target for field "${name}". Use name:type:belongsTo:Model.`,
        );
      }
      field.relation = { kind: 'belongsTo', target };
      continue;
    }

    throw new Error(`Unknown field modifier "${modifier}" for field "${name}".`);
  }

  return field;
}

export function usage(): string {
  return [
    'Usage:',
    '  nstc generate resource <name> <field:type...> [options]',
    '  nstc destroy resource <name> [options]',
    '  nstc list-types',
    '',
    'Examples:',
    '  nstc generate resource post title:string body:text published:boolean',
    '  nstc generate resource user email:string:unique profileId:uuid:belongsTo:Profile',
    '  nstc destroy resource post --dry-run',
    '',
    'Field modifiers:',
    '  :unique              Unique column constraint',
    '  :belongsTo:Model     Many-to-one relation to another resource',
    '',
    'Options:',
    '  --field <name:type>     Field definition (repeatable; avoids shell glob issues with ?)',
    '  --src <dir>             Source directory. Default: src',
    '  --resource-dir <dir>    Resource directory under --src. Default: resources',
    '  --migration-dir <dir>   Migration directory under --src. Default: migrations',
    '  --db <dialect>          Database dialect: postgres, mysql, sqlite. Default: postgres',
    '  --id <strategy>         Primary key strategy: uuid, serial. Default: uuid',
    '  --string-length <n>     Default varchar length for string fields. Default: 255',
    '  --soft-delete           Add deletedAt and use softRemove in the service',
    '  --swagger               Add @nestjs/swagger decorators to controller and DTOs',
    '  --pagination            Add skip/take query params to findAll',
    '  --wire <module.ts>      Import the generated module into a NestJS module file',
    '  --dry-run               Print planned files without writing them',
    '  --verbose               Print generated file contents',
    '  --force                 Overwrite generated files if they already exist',
    '  --version, -v           Print version',
    '  --help                  Show this help',
    '',
    'Config:',
    '  Reads defaults from .nstcrc.json or package.json "nstc".',
  ].join('\n');
}

function extractCwd(argv: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--cwd') {
      return argv[index + 1] ?? null;
    }
  }
  return null;
}

function validateFields(fields: FieldDefinition[]): void {
  const seen = new Set<string>();

  for (const field of fields) {
    if (RESERVED_FIELD_NAMES.has(field.name)) {
      throw new Error(`Field "${field.name}" is reserved and cannot be scaffolded.`);
    }
    if (seen.has(field.name)) {
      throw new Error(`Duplicate field "${field.name}".`);
    }
    seen.add(field.name);
  }
}

function validateConfigOptions(options: ScaffoldConfig): void {
  if (!SUPPORTED_DBS.includes(options.db)) {
    throw new Error(
      `Unsupported database "${options.db}". Use one of: ${SUPPORTED_DBS.join(', ')}.`,
    );
  }

  if (!SUPPORTED_ID_STRATEGIES.includes(options.idStrategy)) {
    throw new Error(
      `Unsupported id strategy "${options.idStrategy}". Use one of: ${SUPPORTED_ID_STRATEGIES.join(', ')}.`,
    );
  }

  if (!Number.isInteger(options.stringLength) || options.stringLength <= 0) {
    throw new Error('--string-length must be a positive integer.');
  }
}

function readOptionValue(tokens: string[], index: number, optionName: string): string {
  const value = tokens[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return value;
}

function readDbOption(tokens: string[], index: number): DbDialect {
  const value = readOptionValue(tokens, index, '--db').toLowerCase();
  if (!SUPPORTED_DBS.includes(value as DbDialect)) {
    throw new Error(`Unsupported database "${value}". Use one of: ${SUPPORTED_DBS.join(', ')}.`);
  }
  return value as DbDialect;
}

function readIdStrategyOption(tokens: string[], index: number): IdStrategy {
  const value = readOptionValue(tokens, index, '--id').toLowerCase();
  if (!SUPPORTED_ID_STRATEGIES.includes(value as IdStrategy)) {
    throw new Error(
      `Unsupported id strategy "${value}". Use one of: ${SUPPORTED_ID_STRATEGIES.join(', ')}.`,
    );
  }
  return value as IdStrategy;
}

function readStringLengthOption(tokens: string[], index: number): number {
  const value = readOptionValue(tokens, index, '--string-length');
  const length = Number.parseInt(value, 10);
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('--string-length must be a positive integer.');
  }
  return length;
}
