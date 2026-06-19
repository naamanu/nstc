import {
  FIELD_TYPE_DEFS,
  collectRelatedEntities,
  formatMigrationColumn,
  formatMigrationForeignKeys,
  formatMigrationIdColumn,
  formatMigrationIndexes,
  formatMigrationTimestampColumn,
  isRelationOnly,
  migrationColumnSpec,
  entityColumnOptions,
  relationEntityImport,
  relationPropertyName,
  resolveRelationTarget,
  validatorsFor,
} from './types.js';
import type { FieldDefinition, RenderOptions, ResourceNames } from './models.js';

function renderOptions(options: Partial<RenderOptions> = {}): RenderOptions {
  return {
    db: options.db ?? 'postgres',
    stringLength: options.stringLength ?? 255,
    swagger: options.swagger ?? false,
    pagination: options.pagination ?? false,
    idStrategy: options.idStrategy ?? 'uuid',
    softDelete: options.softDelete ?? false,
    resourceDir: options.resourceDir ?? 'resources',
    entityDir: options.entityDir ?? 'entities',
    dtoDir: options.dtoDir ?? 'dto',
  };
}

function idPipe(config: RenderOptions): string {
  return config.idStrategy === 'serial' ? 'ParseIntPipe' : 'ParseUUIDPipe';
}

function idType(config: RenderOptions): string {
  return config.idStrategy === 'serial' ? 'number' : 'string';
}

export function renderModule(
  names: ResourceNames,
  fields: FieldDefinition[] = [],
  options: Partial<RenderOptions> = {},
): string {
  const config = renderOptions(options);
  const related = collectRelatedEntities(fields);
  const entities = [names.className, ...related.map((target) => target.className)];
  const relatedImports = related
    .map(
      (target) =>
        `import { ${target.className} } from '${relationEntityImport(names, target, config.resourceDir, config.entityDir)}';`,
    )
    .join('\n');

  return `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${names.className} } from './${config.entityDir}/${names.kebab}.entity';
${relatedImports ? `${relatedImports}\n` : ''}import { ${names.className}Controller } from './${names.kebabPlural}.controller';
import { ${names.className}Service } from './${names.kebabPlural}.service';

@Module({
  imports: [TypeOrmModule.forFeature([${entities.join(', ')}])],
  controllers: [${names.className}Controller],
  providers: [${names.className}Service],
  exports: [${names.className}Service],
})
export class ${names.className}Module {}
`;
}

export function renderController(
  names: ResourceNames,
  options: Partial<RenderOptions> = {},
): string {
  const config = renderOptions(options);
  const parsePipe = idPipe(config);
  const paramType = idType(config);
  const commonImports = [
    'Body',
    'Controller',
    'Delete',
    'Get',
    'Param',
    'Patch',
    'Post',
    parsePipe,
  ];
  const queryImport = config.pagination ? ', Query' : '';
  const swaggerImports = config.swagger ? "\nimport { ApiTags } from '@nestjs/swagger';" : '';
  const swaggerDecorator = config.swagger ? `\n@ApiTags('${names.route}')` : '';
  const findAllParams = config.pagination
    ? "@Query('skip') skip?: string, @Query('take') take?: string"
    : '';
  const findAllBody = config.pagination
    ? `    return this.${names.camel}Service.findAll(toPaginationInt(skip, 0), toPaginationInt(take, 25));`
    : `    return this.${names.camel}Service.findAll();`;
  const findAllSignature = config.pagination ? `findAll(${findAllParams})` : 'findAll()';
  // Query params are user-controlled strings; guard against NaN/negatives before
  // they reach the repository (a bare Number.parseInt('abc') would yield NaN).
  const paginationHelper = config.pagination
    ? `\nfunction toPaginationInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}\n`
    : '';

  return `import { ${commonImports.join(', ')}${queryImport} } from '@nestjs/common';${swaggerImports}
import { Create${names.className}Dto } from './${config.dtoDir}/create-${names.kebab}.dto';
import { Update${names.className}Dto } from './${config.dtoDir}/update-${names.kebab}.dto';
import { ${names.className}Service } from './${names.kebabPlural}.service';
${paginationHelper}${swaggerDecorator}
@Controller('${names.route}')
export class ${names.className}Controller {
  constructor(private readonly ${names.camel}Service: ${names.className}Service) {}

  @Post()
  create(@Body() create${names.className}Dto: Create${names.className}Dto) {
    return this.${names.camel}Service.create(create${names.className}Dto);
  }

  @Get()
  ${findAllSignature} {
${findAllBody}
  }

  @Get(':id')
  findOne(@Param('id', ${parsePipe}) id: ${paramType}) {
    return this.${names.camel}Service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ${parsePipe}) id: ${paramType}, @Body() update${names.className}Dto: Update${names.className}Dto) {
    return this.${names.camel}Service.update(id, update${names.className}Dto);
  }

  @Delete(':id')
  remove(@Param('id', ${parsePipe}) id: ${paramType}) {
    return this.${names.camel}Service.remove(id);
  }
}
`;
}

export function renderService(names: ResourceNames, options: Partial<RenderOptions> = {}): string {
  const config = renderOptions(options);
  const paramType = idType(config);
  const removeMethod = config.softDelete
    ? `    await this.${names.camel}Repository.softRemove(${names.camel});`
    : `    await this.${names.camel}Repository.remove(${names.camel});`;
  const findAllMethod = config.pagination
    ? `  findAll(skip = 0, take = 25) {
    const safeSkip = Number.isFinite(skip) && skip >= 0 ? skip : 0;
    const safeTake = Number.isFinite(take) && take > 0 ? Math.min(take, 100) : 25;
    return this.${names.camel}Repository.find({ skip: safeSkip, take: safeTake });
  }`
    : `  findAll() {
    return this.${names.camel}Repository.find();
  }`;

  return `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Create${names.className}Dto } from './${config.dtoDir}/create-${names.kebab}.dto';
import { Update${names.className}Dto } from './${config.dtoDir}/update-${names.kebab}.dto';
import { ${names.className} } from './${config.entityDir}/${names.kebab}.entity';

@Injectable()
export class ${names.className}Service {
  constructor(
    @InjectRepository(${names.className})
    private readonly ${names.camel}Repository: Repository<${names.className}>,
  ) {}

  create(create${names.className}Dto: Create${names.className}Dto) {
    const ${names.camel} = this.${names.camel}Repository.create(create${names.className}Dto);
    return this.${names.camel}Repository.save(${names.camel});
  }

${findAllMethod}

  async findOne(id: ${paramType}) {
    const ${names.camel} = await this.${names.camel}Repository.findOneBy({ id });
    if (!${names.camel}) {
      throw new NotFoundException('${names.className} not found');
    }
    return ${names.camel};
  }

  async update(id: ${paramType}, update${names.className}Dto: Update${names.className}Dto) {
    const ${names.camel} = await this.findOne(id);
    Object.assign(${names.camel}, update${names.className}Dto);
    return this.${names.camel}Repository.save(${names.camel});
  }

  async remove(id: ${paramType}) {
    const ${names.camel} = await this.findOne(id);
${removeMethod}
    return ${names.camel};
  }
}
`;
}

export function renderEntity(
  names: ResourceNames,
  fields: FieldDefinition[],
  options: Partial<RenderOptions> = {},
): string {
  const config = renderOptions(options);
  const typeormImports = new Set([
    'Column',
    'CreateDateColumn',
    'Entity',
    'PrimaryGeneratedColumn',
    'UpdateDateColumn',
  ]);
  const entityImports = new Map<string, { className: string; importPath: string }>();

  if (config.softDelete) {
    typeormImports.add('DeleteDateColumn');
  }

  if (fields.some((field) => field.relation?.kind === 'belongsTo')) {
    typeormImports.add('ManyToOne');
    typeormImports.add('JoinColumn');
  }
  if (fields.some((field) => field.relation?.kind === 'hasMany')) {
    typeormImports.add('OneToMany');
  }
  if (fields.some((field) => field.relation?.kind === 'hasOne')) {
    typeormImports.add('OneToOne');
  }

  const fieldLines = fields
    .flatMap((field) => renderEntityField(names, field, config, entityImports))
    .join('\n\n');
  const primaryKey =
    config.idStrategy === 'serial'
      ? '@PrimaryGeneratedColumn()\n  id: number;'
      : "@PrimaryGeneratedColumn('uuid')\n  id: string;";
  const softDeleteLine = config.softDelete ? '\n\n  @DeleteDateColumn()\n  deletedAt?: Date;' : '';
  const relationImports = [...entityImports.values()]
    .sort((left, right) => left.className.localeCompare(right.className))
    .map((target) => `import { ${target.className} } from '${target.importPath}';`)
    .join('\n');

  return `import { ${[...typeormImports].sort().join(', ')} } from 'typeorm';
${relationImports ? `${relationImports}\n` : ''}
@Entity('${names.tableName}')
export class ${names.className} {
  ${primaryKey}

${fieldLines}

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;${softDeleteLine}
}
`;
}

export function renderCreateDto(
  names: ResourceNames,
  fields: FieldDefinition[],
  options: Partial<RenderOptions> = {},
): string {
  const config = renderOptions(options);
  const dtoFields = fields.filter((f) => !isRelationOnly(f));
  const validatorNames = collectValidatorImports(dtoFields);
  const swaggerNames = config.swagger ? ['ApiProperty', 'ApiPropertyOptional'] : [];
  const imports = [
    config.swagger ? `import { ${swaggerNames.join(', ')} } from '@nestjs/swagger';` : null,
    validatorNames.length > 0
      ? `import { ${validatorNames.join(', ')} } from 'class-validator';`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
  const fieldLines = dtoFields.map((field) => renderDtoField(field, config)).join('\n\n');

  return `${imports ? `${imports}\n\n` : ''}export class Create${names.className}Dto {
${fieldLines}
}
`;
}

export function renderUpdateDto(
  names: ResourceNames,
  options: Partial<RenderOptions> = {},
): string {
  const config = renderOptions(options);
  const partialSource = config.swagger ? '@nestjs/swagger' : '@nestjs/mapped-types';

  return `import { PartialType } from '${partialSource}';
import { Create${names.className}Dto } from './create-${names.kebab}.dto';

export class Update${names.className}Dto extends PartialType(Create${names.className}Dto) {}
`;
}

export function renderMigration(
  names: ResourceNames,
  fields: FieldDefinition[],
  timestamp: string,
  options: Partial<RenderOptions> = {},
): string {
  const config = renderOptions(options);
  const className = `Create${names.pluralClassName}${timestamp}`;
  const columnFields = fields.filter((f) => !isRelationOnly(f));
  const columnLines = columnFields
    .map((field) => formatMigrationColumn(migrationColumnSpec(field, config)))
    .join(',\n');
  const idColumn = formatMigrationIdColumn(config.db, config.idStrategy);
  const createdAtColumn = formatMigrationTimestampColumn('createdAt', config.db);
  const updatedAtColumn = formatMigrationTimestampColumn('updatedAt', config.db);
  const deletedAtColumn = config.softDelete
    ? `,\n${formatMigrationTimestampColumn('deletedAt', config.db, { nullable: true })}`
    : '';
  const foreignKeys = formatMigrationForeignKeys(columnFields, config);
  const { createIndexes, dropIndexes } = formatMigrationIndexes(names.tableName, columnFields);
  const tableForeignKeyImport = foreignKeys ? ', TableForeignKey' : '';
  const tableIndexImport = createIndexes ? ', TableIndex' : '';
  const upIndexBlock = createIndexes ? `\n${createIndexes}` : '';
  const dropTableLine = `    await queryRunner.dropTable('${names.tableName}', true);`;
  const downBody = dropIndexes ? `${dropIndexes}\n${dropTableLine}` : dropTableLine;

  return `import { MigrationInterface, QueryRunner, Table${tableForeignKeyImport}${tableIndexImport} } from 'typeorm';

export class ${className} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: '${names.tableName}',
        columns: [
${idColumn},
${columnLines},
${createdAtColumn},
${updatedAtColumn}${deletedAtColumn},
        ]${foreignKeys},
      }),
      true,
    );${upIndexBlock}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${downBody}
  }
}
`;
}

function renderEntityField(
  names: ResourceNames,
  field: FieldDefinition,
  config: RenderOptions,
  entityImports: Map<string, { className: string; importPath: string }>,
): string[] {
  if (field.relation?.kind === 'hasMany' || field.relation?.kind === 'hasOne') {
    const targetNames = resolveRelationTarget(field.relation.target);
    entityImports.set(targetNames.className, {
      className: targetNames.className,
      importPath: relationEntityImport(names, targetNames, config.resourceDir, config.entityDir),
    });
    const inverseProp = names.camel;
    if (field.relation.kind === 'hasMany') {
      return [
        `  @OneToMany(() => ${targetNames.className}, (${targetNames.camel}) => ${targetNames.camel}.${inverseProp})
  ${field.name}: ${targetNames.className}[];`,
      ];
    }
    return [
      `  @OneToOne(() => ${targetNames.className}, (${targetNames.camel}) => ${targetNames.camel}.${inverseProp})
  ${field.name}: ${targetNames.className};`,
    ];
  }

  const meta = FIELD_TYPE_DEFS[field.type];
  const optional = field.optional ? '?' : '';
  const tsType =
    field.type === 'enum' ? (field.enumValues ?? []).map((v) => `'${v}'`).join(' | ') : meta.ts;
  const lines = [
    `  @Column(${entityColumnOptions(field, config)})
  ${field.name}${optional}: ${tsType};`,
  ];

  if (field.relation?.kind === 'belongsTo') {
    const targetNames = resolveRelationTarget(field.relation.target);
    const propertyName = relationPropertyName(field, targetNames);
    entityImports.set(targetNames.className, {
      className: targetNames.className,
      importPath: relationEntityImport(names, targetNames, config.resourceDir, config.entityDir),
    });
    lines.push(`  @ManyToOne(() => ${targetNames.className}, { onDelete: 'CASCADE' })
  @JoinColumn({ name: '${field.name}' })
  ${propertyName}: ${targetNames.className};`);
  }

  return lines;
}

function collectValidatorImports(fields: FieldDefinition[]): string[] {
  const names = new Set<string>();
  for (const field of fields) {
    for (const validator of validatorsFor(field)) names.add(validator);
  }
  return [...names].sort();
}

function renderDtoField(field: FieldDefinition, config: RenderOptions): string {
  if (field.type === 'enum') {
    return renderEnumDtoField(field, config);
  }
  const decorators: string[] = [];
  if (config.swagger) {
    decorators.push(field.optional ? 'ApiPropertyOptional' : 'ApiProperty');
  }
  for (const validator of validatorsFor(field)) {
    decorators.push(validator);
  }
  const type = FIELD_TYPE_DEFS[field.type].ts;
  const optional = field.optional ? '?' : '';

  return `${decorators.map((name) => `  @${name}()`).join('\n')}
  ${field.name}${optional}: ${type};`;
}

function renderEnumDtoField(field: FieldDefinition, config: RenderOptions): string {
  const values = field.enumValues ?? [];
  const valuesLiteral = `[${values.map((v) => `'${v}'`).join(', ')}]`;
  const unionType = values.map((v) => `'${v}'`).join(' | ');
  const optional = field.optional ? '?' : '';
  const lines: string[] = [];

  if (config.swagger) lines.push(`  @${field.optional ? 'ApiPropertyOptional' : 'ApiProperty'}()`);
  if (field.optional) lines.push('  @IsOptional()');
  lines.push(`  @IsIn(${valuesLiteral})`);
  lines.push(`  ${field.name}${optional}: ${unionType};`);

  return lines.join('\n');
}
