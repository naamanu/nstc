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
  | 'json';

export type DbDialect = 'postgres' | 'mysql' | 'sqlite';
export type IdStrategy = 'uuid' | 'serial';

export interface FieldRelation {
  kind: 'belongsTo';
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
