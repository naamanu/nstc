export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'int'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'json'
  | 'hasMany'
  | 'hasOne';

export type DbDialect = 'postgres' | 'mysql' | 'sqlite';
export type IdStrategy = 'uuid' | 'serial';

// The kinds of files a resource scaffold produces; used by --only/--skip selection.
export const FILE_KINDS = [
  'module',
  'controller',
  'service',
  'entity',
  'dto',
  'migration',
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export interface FieldRelation {
  kind: 'belongsTo' | 'hasMany' | 'hasOne';
  target: string;
}

export interface FieldDefinition {
  name: string;
  type: FieldType;
  optional: boolean;
  unique: boolean;
  relation: FieldRelation | null;
}

export interface ResourceNames {
  original: string;
  camel: string;
  className: string;
  pluralClassName: string;
  kebab: string;
  kebabPlural: string;
  tableName: string;
  route: string;
}

export interface ScaffoldConfig {
  cwd: string;
  src: string;
  resourceDir: string;
  migrationDir: string;
  entityDir: string;
  dtoDir: string;
  db: DbDialect;
  stringLength: number;
  idStrategy: IdStrategy;
  swagger: boolean;
  pagination: boolean;
  softDelete: boolean;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
  wire: string | null;
  // Singular -> plural overrides for resource-name inflection (config-file only).
  inflections: Record<string, string>;
  // File-kind selection: when `only` is non-empty, generate/destroy is limited to
  // those kinds; otherwise any kind in `skip` is excluded.
  only: FileKind[];
  skip: FileKind[];
}

export interface GenerateCommand extends ScaffoldConfig {
  command: 'generate';
  resource: string;
  fields: FieldDefinition[];
  timestamp?: string;
}

export interface DestroyCommand extends ScaffoldConfig {
  command: 'destroy';
  resource: string;
}

export type ParsedCommand =
  | { help: true }
  | { version: true }
  | { listTypes: true }
  | GenerateCommand
  | DestroyCommand;

export interface RenderOptions {
  db: DbDialect;
  stringLength: number;
  swagger: boolean;
  pagination: boolean;
  idStrategy: IdStrategy;
  softDelete: boolean;
  resourceDir: string;
  entityDir: string;
  dtoDir: string;
}

export interface PlannedFile {
  relativePath: string;
  absolutePath: string;
  content: string;
}

export interface GenerateResult {
  names: ResourceNames;
  dryRun: boolean;
  files: string[];
  plannedFiles: PlannedFile[];
}

export interface DestroyResult {
  names: ResourceNames;
  dryRun: boolean;
  removed: string[];
}

export interface MigrationColumnSpec {
  name: string;
  type: string;
  length?: number;
  isNullable?: boolean;
  isUnique?: boolean;
}

export interface CliIo {
  stdout: {
    write(chunk: string): boolean;
  };
}
