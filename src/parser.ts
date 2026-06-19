import { loadConfig } from './config.js';
import type {
  DbDialect,
  DestroyCommand,
  FieldDefinition,
  FileKind,
  GenerateCommand,
  IdStrategy,
  ParsedCommand,
  ScaffoldConfig,
} from './models.js';
import { FILE_KINDS } from './models.js';
import { TYPE_ALIASES, SUPPORTED_DBS, SUPPORTED_ID_STRATEGIES } from './types.js';

const RESERVED_FIELD_NAMES = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);

const DEFAULT_OPTIONS: ScaffoldConfig = {
  cwd: process.cwd(),
  src: 'src',
  resourceDir: 'resources',
  migrationDir: 'migrations',
  entityDir: 'entities',
  dtoDir: 'dto',
  db: 'postgres',
  stringLength: 255,
  idStrategy: 'uuid',
  swagger: false,
  pagination: false,
  softDelete: false,
  dryRun: false,
  force: false,
  tests: false,
  verbose: false,
  wire: null,
  parent: null,
  inflections: {},
  only: [],
  skip: [],
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
    } else if (token === '--tests') {
      options.tests = true;
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
    } else if (token === '--entity-dir') {
      options.entityDir = readOptionValue(tokens, ++index, '--entity-dir');
    } else if (token === '--dto-dir') {
      options.dtoDir = readOptionValue(tokens, ++index, '--dto-dir');
    } else if (token === '--only') {
      options.only = readKindList(tokens, ++index, '--only');
    } else if (token === '--skip') {
      options.skip = readKindList(tokens, ++index, '--skip');
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
    } else if (token === '--parent') {
      options.parent = readOptionValue(tokens, ++index, '--parent');
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
  const rawKind = segments[1].toLowerCase();

  if (rawKind === 'enum') {
    const rawValues = segments[2];
    if (!rawValues) {
      throw new Error(`Missing enum values for field "${name}". Use name:enum:val1,val2,...`);
    }
    const enumValues = rawValues
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (enumValues.length === 0) {
      throw new Error(`Enum field "${name}" must have at least one value.`);
    }
    return {
      name,
      type: 'enum' as const,
      optional: Boolean(optionalMark),
      unique: false,
      relation: null,
      enumValues,
    };
  }

  if (rawKind === 'hasmany' || rawKind === 'hasone') {
    if (optionalMark) {
      throw new Error(
        `Field "${name}" cannot be optional: hasMany/hasOne are relation-only and have no column.`,
      );
    }
    const relKind = rawKind === 'hasmany' ? 'hasMany' : ('hasOne' as const);
    const target = segments[2];
    if (!target) {
      throw new Error(`Missing relation target for field "${name}". Use name:${relKind}:Model.`);
    }
    return {
      name,
      type: relKind,
      optional: false,
      unique: false,
      relation: { kind: relKind, target },
    };
  }

  const type = TYPE_ALIASES.get(rawKind);
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

    if (
      modifier === 'minLength' ||
      modifier === 'maxLength' ||
      modifier === 'min' ||
      modifier === 'max'
    ) {
      const rawVal = segments[++index];
      const numVal = Number(rawVal);
      if (rawVal === undefined || !Number.isFinite(numVal)) {
        throw new Error(
          `Field modifier "${modifier}" requires a numeric value for field "${name}".`,
        );
      }
      if (modifier === 'minLength') field.minLength = numVal;
      else if (modifier === 'maxLength') field.maxLength = numVal;
      else if (modifier === 'min') field.min = numVal;
      else field.max = numVal;
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
    '  --entity-dir <dir>      Entity subdirectory in the resource folder. Default: entities',
    '  --dto-dir <dir>         DTO subdirectory in the resource folder. Default: dto',
    '  --only <kinds>          Generate only these comma-separated file kinds',
    '  --skip <kinds>          Skip these comma-separated file kinds',
    '  --db <dialect>          Database dialect: postgres, mysql, sqlite. Default: postgres',
    '  --id <strategy>         Primary key strategy: uuid, serial. Default: uuid',
    '  --string-length <n>     Default varchar length for string fields. Default: 255',
    '  --soft-delete           Add deletedAt and use softRemove in the service',
    '  --swagger               Add @nestjs/swagger decorators to controller and DTOs',
    '  --pagination            Add skip/take query params to findAll',
    '  --wire <module.ts>      Import the generated module into a NestJS module file',
    '  --parent <resource>     Generate a nested route under the parent resource',
    '  --tests                 Generate *.spec.ts stubs for controller and service',
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

// Single source of truth for each rule + message. Both the CLI option readers
// (which validate flag values) and validateConfigOptions (which validates the
// merged config-file values that bypass the readers) delegate here, so the
// rules cannot drift apart.
function validateDb(value: string): DbDialect {
  if (!SUPPORTED_DBS.includes(value as DbDialect)) {
    throw new Error(`Unsupported database "${value}". Use one of: ${SUPPORTED_DBS.join(', ')}.`);
  }
  return value as DbDialect;
}

function validateIdStrategy(value: string): IdStrategy {
  if (!SUPPORTED_ID_STRATEGIES.includes(value as IdStrategy)) {
    throw new Error(
      `Unsupported id strategy "${value}". Use one of: ${SUPPORTED_ID_STRATEGIES.join(', ')}.`,
    );
  }
  return value as IdStrategy;
}

function validateStringLength(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('--string-length must be a positive integer.');
  }
  return value;
}

function validateConfigOptions(options: ScaffoldConfig): void {
  validateDb(options.db);
  validateIdStrategy(options.idStrategy);
  validateStringLength(options.stringLength);
}

function readOptionValue(tokens: string[], index: number, optionName: string): string {
  const value = tokens[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return value;
}

function readDbOption(tokens: string[], index: number): DbDialect {
  return validateDb(readOptionValue(tokens, index, '--db').toLowerCase());
}

function readIdStrategyOption(tokens: string[], index: number): IdStrategy {
  return validateIdStrategy(readOptionValue(tokens, index, '--id').toLowerCase());
}

function readStringLengthOption(tokens: string[], index: number): number {
  const value = readOptionValue(tokens, index, '--string-length');
  return validateStringLength(Number.parseInt(value, 10));
}

function readKindList(tokens: string[], index: number, optionName: string): FileKind[] {
  const value = readOptionValue(tokens, index, optionName);
  const kinds = value
    .split(',')
    .map((kind) => kind.trim())
    .filter(Boolean);

  for (const kind of kinds) {
    if (!FILE_KINDS.includes(kind as FileKind)) {
      throw new Error(
        `Unknown file kind "${kind}" for ${optionName}. Use one of: ${FILE_KINDS.join(', ')}.`,
      );
    }
  }

  return kinds as FileKind[];
}
