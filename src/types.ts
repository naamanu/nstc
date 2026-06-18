import { buildNames } from './naming.js';
import type {
  DbDialect,
  FieldDefinition,
  FieldType,
  GenerateCommand,
  IdStrategy,
  MigrationColumnSpec,
  RenderOptions,
  ResourceNames,
  ScaffoldConfig
} from './models.js';

export const SUPPORTED_ID_STRATEGIES: IdStrategy[] = ['uuid', 'serial'];

export const TYPE_ALIASES = new Map<string, FieldType>([
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

export const SUPPORTED_DBS: DbDialect[] = ['postgres', 'mysql', 'sqlite'];

interface FieldTypeDef {
  ts: string;
  validators: string[];
  requiredExtra?: string[];
  columnType: Record<DbDialect, string>;
  hasLength?: boolean;
  lengthWhenSized?: number;
}

export const FIELD_TYPE_DEFS: Record<FieldType, FieldTypeDef> = {
  string: {
    ts: 'string',
    validators: ['IsString'],
    requiredExtra: ['IsNotEmpty'],
    columnType: { postgres: 'varchar', mysql: 'varchar', sqlite: 'varchar' },
    hasLength: true
  },
  text: {
    ts: 'string',
    validators: ['IsString'],
    requiredExtra: ['IsNotEmpty'],
    columnType: { postgres: 'text', mysql: 'text', sqlite: 'text' }
  },
  number: {
    ts: 'number',
    validators: ['IsNumber'],
    columnType: { postgres: 'float', mysql: 'float', sqlite: 'real' }
  },
  int: {
    ts: 'number',
    validators: ['IsInt'],
    columnType: { postgres: 'int', mysql: 'int', sqlite: 'integer' }
  },
  float: {
    ts: 'number',
    validators: ['IsNumber'],
    columnType: { postgres: 'float', mysql: 'float', sqlite: 'real' }
  },
  boolean: {
    ts: 'boolean',
    validators: ['IsBoolean'],
    columnType: { postgres: 'boolean', mysql: 'tinyint', sqlite: 'boolean' }
  },
  date: {
    ts: 'Date',
    validators: ['IsDateString'],
    columnType: { postgres: 'date', mysql: 'date', sqlite: 'date' }
  },
  datetime: {
    ts: 'Date',
    validators: ['IsDateString'],
    columnType: { postgres: 'timestamp', mysql: 'timestamp', sqlite: 'datetime' }
  },
  uuid: {
    ts: 'string',
    validators: ['IsUUID'],
    columnType: { postgres: 'uuid', mysql: 'varchar', sqlite: 'varchar' },
    hasLength: true,
    lengthWhenSized: 36
  },
  json: {
    ts: 'Record<string, unknown>',
    validators: ['IsObject'],
    columnType: { postgres: 'jsonb', mysql: 'json', sqlite: 'text' }
  }
};

interface IdColumnSpec {
  type: string;
  isPrimary: boolean;
  length?: number;
  isGenerated?: boolean;
  generationStrategy?: string;
  default?: string;
}

interface DbConfigEntry {
  idColumn: IdColumnSpec;
  serialIdColumn: IdColumnSpec;
  timestampType: string;
  timestampDefault: string;
}

export const DB_CONFIG: Record<DbDialect, DbConfigEntry> = {
  postgres: {
    idColumn: {
      type: 'uuid',
      isPrimary: true,
      generationStrategy: 'uuid',
      default: 'uuid_generate_v4()'
    },
    serialIdColumn: {
      type: 'integer',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'increment'
    },
    timestampType: 'timestamp',
    timestampDefault: 'now()'
  },
  mysql: {
    idColumn: {
      type: 'varchar',
      length: 36,
      isPrimary: true,
      default: '(UUID())'
    },
    serialIdColumn: {
      type: 'int',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'increment'
    },
    timestampType: 'timestamp',
    timestampDefault: 'CURRENT_TIMESTAMP'
  },
  sqlite: {
    idColumn: {
      type: 'varchar',
      length: 36,
      isPrimary: true
    },
    serialIdColumn: {
      type: 'integer',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'increment'
    },
    timestampType: 'datetime',
    timestampDefault: "datetime('now')"
  }
};

export function resolveRenderOptions(command: ScaffoldConfig | GenerateCommand): RenderOptions {
  return {
    db: command.db ?? 'postgres',
    stringLength: command.stringLength ?? 255,
    swagger: command.swagger ?? false,
    pagination: command.pagination ?? false,
    idStrategy: command.idStrategy ?? 'uuid',
    softDelete: command.softDelete ?? false,
    resourceDir: command.resourceDir ?? 'resources'
  };
}

export function resolveRelationTarget(className: string): ResourceNames {
  return buildNames(className);
}

export function relationEntityImport(currentNames: ResourceNames, targetNames: ResourceNames, resourceDir: string): string {
  const from = `${resourceDir}/${currentNames.kebabPlural}/entities`;
  const to = `${resourceDir}/${targetNames.kebabPlural}/entities/${targetNames.kebab}.entity`;
  const segments = to.split('/').filter(Boolean);
  const fromSegments = from.split('/').filter(Boolean);
  let shared = 0;

  while (shared < fromSegments.length && shared < segments.length && fromSegments[shared] === segments[shared]) {
    shared += 1;
  }

  const up = fromSegments.length - shared;
  const down = segments.slice(shared).join('/');
  let relative = `${up === 0 ? '.' : Array(up).fill('..').join('/')}/${down}`.replace(/\/+/g, '/');
  relative = relative.replace(/\.entity$/, '').replace(/\/$/, '');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

export function relationPropertyName(field: FieldDefinition, targetNames: ResourceNames): string {
  if (field.name.endsWith('Id') && field.name.length > 2) {
    return field.name.slice(0, -2);
  }
  return targetNames.camel;
}

export function columnTypeFor(field: FieldDefinition, db: DbDialect): string {
  return FIELD_TYPE_DEFS[field.type].columnType[db];
}

export function validatorsFor(field: FieldDefinition): string[] {
  const def = FIELD_TYPE_DEFS[field.type];
  const names = field.optional ? [...def.validators] : [...(def.requiredExtra ?? []), ...def.validators];
  if (field.optional) names.unshift('IsOptional');
  return names;
}

export function entityColumnOptions(field: FieldDefinition, options: RenderOptions): string {
  const def = FIELD_TYPE_DEFS[field.type];
  const type = columnTypeFor(field, options.db);
  const parts = [`type: '${type}'`];

  if (def.hasLength) {
    const length = def.lengthWhenSized ?? options.stringLength;
    parts.push(`length: ${length}`);
  }

  if (field.optional) {
    parts.push('nullable: true');
  }

  if (field.unique) {
    parts.push('unique: true');
  }

  return `{ ${parts.join(', ')} }`;
}

export function migrationColumnSpec(field: FieldDefinition, options: RenderOptions): MigrationColumnSpec {
  const def = FIELD_TYPE_DEFS[field.type];
  const spec: MigrationColumnSpec = {
    name: field.name,
    type: columnTypeFor(field, options.db)
  };

  if (def.hasLength) {
    spec.length = def.lengthWhenSized ?? options.stringLength;
  }

  if (field.optional) {
    spec.isNullable = true;
  }

  if (field.unique) {
    spec.isUnique = true;
  }

  return spec;
}

export function formatMigrationColumn(spec: MigrationColumnSpec): string {
  const lines = [`            name: '${spec.name}'`, `            type: '${spec.type}'`];

  if (spec.length !== undefined) {
    lines.push(`            length: ${spec.length}`);
  }

  if (spec.isNullable) {
    lines.push('            isNullable: true');
  }

  if (spec.isUnique) {
    lines.push('            isUnique: true');
  }

  return `          {\n${lines.join(',\n')},\n          }`;
}

export function formatMigrationIdColumn(db: DbDialect, idStrategy: IdStrategy = 'uuid'): string {
  const spec = idStrategy === 'serial' ? DB_CONFIG[db].serialIdColumn : DB_CONFIG[db].idColumn;
  const lines = [
    "            name: 'id'",
    `            type: '${spec.type}'`,
    '            isPrimary: true'
  ];

  if (spec.length !== undefined) {
    lines.push(`            length: ${spec.length}`);
  }

  if (spec.isGenerated) {
    lines.push('            isGenerated: true');
  }

  if (spec.generationStrategy) {
    lines.push(`            generationStrategy: '${spec.generationStrategy}'`);
  }

  if (spec.default) {
    lines.push(`            default: '${spec.default}'`);
  }

  return `          {\n${lines.join(',\n')},\n          }`;
}

export function formatMigrationTimestampColumn(
  name: string,
  db: DbDialect,
  { nullable = false }: { nullable?: boolean } = {}
): string {
  const config = DB_CONFIG[db];
  const lines = [
    `            name: '${name}'`,
    `            type: '${config.timestampType}'`
  ];

  if (!nullable) {
    lines.push(`            default: '${config.timestampDefault}'`);
  } else {
    lines.push('            isNullable: true');
  }

  return `          {\n${lines.join(',\n')},\n          }`;
}

export function formatMigrationForeignKeys(fields: FieldDefinition[], _options: RenderOptions): string {
  const keys = fields
    .filter((field) => field.relation?.kind === 'belongsTo')
    .map((field) => {
      const targetNames = resolveRelationTarget(field.relation!.target);
      return `          new TableForeignKey({
            columnNames: ['${field.name}'],
            referencedTableName: '${targetNames.tableName}',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          })`;
    });

  if (keys.length === 0) {
    return '';
  }

  return `,
        foreignKeys: [
${keys.join(',\n')},
        ]`;
}

export function collectRelatedEntities(fields: FieldDefinition[]): ResourceNames[] {
  const related = new Map<string, ResourceNames>();
  for (const field of fields) {
    if (field.relation?.kind === 'belongsTo') {
      const targetNames = resolveRelationTarget(field.relation.target);
      related.set(targetNames.className, targetNames);
    }
  }
  return [...related.values()];
}

export function formatTypeList(): string {
  const aliases = [...TYPE_ALIASES.keys()].sort();
  return [
    'Supported field types:',
    `  ${aliases.join(', ')}`,
    '',
    'Field modifiers:',
    '  unique              Append :unique (e.g. email:string:unique)',
    '  belongsTo           Append :belongsTo:Model (e.g. userId:uuid:belongsTo:User)',
    '',
    'Supported database dialects:',
    `  ${SUPPORTED_DBS.join(', ')}`,
    '',
    'Supported id strategies:',
    `  ${SUPPORTED_ID_STRATEGIES.join(', ')}`,
    ''
  ].join('\n');
}
