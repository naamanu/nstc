import type {
  DestroyCommand,
  FieldDefinition,
  GenerateCommand,
  ParsedCommand,
} from '../src/models.js';

export const defaultScaffoldOptions = {
  cwd: process.cwd(),
  src: 'src',
  resourceDir: 'resources',
  migrationDir: 'migrations',
  db: 'postgres' as const,
  stringLength: 255,
  idStrategy: 'uuid' as const,
  swagger: false,
  pagination: false,
  softDelete: false,
  dryRun: false,
  force: false,
  verbose: false,
  wire: null,
};

export function makeField(
  overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'name' | 'type'>,
): FieldDefinition {
  return {
    optional: false,
    unique: false,
    relation: null,
    ...overrides,
  };
}

export function makeGenerateCommand(overrides: Partial<GenerateCommand> = {}): GenerateCommand {
  return {
    command: 'generate',
    resource: 'post',
    fields: [makeField({ name: 'title', type: 'string' })],
    ...defaultScaffoldOptions,
    ...overrides,
  };
}

export function makeDestroyCommand(overrides: Partial<DestroyCommand> = {}): DestroyCommand {
  return {
    command: 'destroy',
    resource: 'post',
    ...defaultScaffoldOptions,
    ...overrides,
  };
}

export function asGenerateCommand(command: ParsedCommand): GenerateCommand {
  if (!('command' in command) || command.command !== 'generate') {
    throw new Error('Expected generate command');
  }
  return command;
}
