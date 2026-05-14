const TYPEORM_COLUMN_TYPES = {
  string: { column: "varchar", ts: 'string' },
  text: { column: "text", ts: 'string' },
  number: { column: "float", ts: 'number' },
  int: { column: "int", ts: 'number' },
  float: { column: "float", ts: 'number' },
  boolean: { column: "boolean", ts: 'boolean' },
  date: { column: "date", ts: 'Date' },
  datetime: { column: "timestamp", ts: 'Date' },
  uuid: { column: "uuid", ts: 'string' },
  json: { column: "jsonb", ts: 'Record<string, unknown>' }
};

const VALIDATORS = {
  string: ['IsString'],
  text: ['IsString'],
  number: ['IsNumber'],
  int: ['IsInt'],
  float: ['IsNumber'],
  boolean: ['IsBoolean'],
  date: ['IsDateString'],
  datetime: ['IsDateString'],
  uuid: ['IsUUID'],
  json: ['IsObject']
};

export function renderModule(names) {
  return `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${names.className} } from './entities/${names.kebab}.entity';
import { ${names.className}Controller } from './${names.kebabPlural}.controller';
import { ${names.className}Service } from './${names.kebabPlural}.service';

@Module({
  imports: [TypeOrmModule.forFeature([${names.className}])],
  controllers: [${names.className}Controller],
  providers: [${names.className}Service],
  exports: [${names.className}Service],
})
export class ${names.className}Module {}
`;
}

export function renderController(names) {
  return `import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Create${names.className}Dto } from './dto/create-${names.kebab}.dto';
import { Update${names.className}Dto } from './dto/update-${names.kebab}.dto';
import { ${names.className}Service } from './${names.kebabPlural}.service';

@Controller('${names.route}')
export class ${names.className}Controller {
  constructor(private readonly ${names.camel}Service: ${names.className}Service) {}

  @Post()
  create(@Body() create${names.className}Dto: Create${names.className}Dto) {
    return this.${names.camel}Service.create(create${names.className}Dto);
  }

  @Get()
  findAll() {
    return this.${names.camel}Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.${names.camel}Service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() update${names.className}Dto: Update${names.className}Dto) {
    return this.${names.camel}Service.update(id, update${names.className}Dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.${names.camel}Service.remove(id);
  }
}
`;
}

export function renderService(names) {
  return `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Create${names.className}Dto } from './dto/create-${names.kebab}.dto';
import { Update${names.className}Dto } from './dto/update-${names.kebab}.dto';
import { ${names.className} } from './entities/${names.kebab}.entity';

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

  findAll() {
    return this.${names.camel}Repository.find();
  }

  async findOne(id: string) {
    const ${names.camel} = await this.${names.camel}Repository.findOneBy({ id });
    if (!${names.camel}) {
      throw new NotFoundException('${names.className} not found');
    }
    return ${names.camel};
  }

  async update(id: string, update${names.className}Dto: Update${names.className}Dto) {
    const ${names.camel} = await this.findOne(id);
    Object.assign(${names.camel}, update${names.className}Dto);
    return this.${names.camel}Repository.save(${names.camel});
  }

  async remove(id: string) {
    const ${names.camel} = await this.findOne(id);
    await this.${names.camel}Repository.remove(${names.camel});
    return ${names.camel};
  }
}
`;
}

export function renderEntity(names, fields) {
  const imports = "Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn";
  const fieldLines = fields.map((field) => {
    const meta = TYPEORM_COLUMN_TYPES[field.type];
    const nullable = field.optional ? ', nullable: true' : '';
    const optional = field.optional ? '?' : '';
    return `  @Column({ type: '${meta.column}'${nullable} })
  ${field.name}${optional}: ${meta.ts};`;
  }).join('\n\n');

  return `import { ${imports} } from 'typeorm';

@Entity('${names.tableName}')
export class ${names.className} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

${fieldLines}

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;
}

export function renderCreateDto(names, fields) {
  const validators = collectValidators(fields);
  const imports = validators.length > 0 ? `import { ${validators.join(', ')} } from 'class-validator';\n\n` : '';
  const fieldLines = fields.map((field) => renderDtoField(field)).join('\n\n');

  return `${imports}export class Create${names.className}Dto {
${fieldLines}
}
`;
}

export function renderUpdateDto(names) {
  return `import { PartialType } from '@nestjs/mapped-types';
import { Create${names.className}Dto } from './create-${names.kebab}.dto';

export class Update${names.className}Dto extends PartialType(Create${names.className}Dto) {}
`;
}

export function renderMigration(names, fields, timestamp) {
  const className = `Create${names.pluralClassName}${timestamp}`;
  const columnLines = fields.map((field) => renderMigrationColumn(field)).join(',\n');

  return `import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class ${className} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: '${names.tableName}',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
${columnLines},
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('${names.tableName}', true);
  }
}
`;
}

function collectValidators(fields) {
  const names = new Set();
  for (const field of fields) {
    if (field.optional) names.add('IsOptional');
    for (const validator of VALIDATORS[field.type]) names.add(validator);
  }
  return [...names].sort();
}

function renderDtoField(field) {
  const decorators = [];
  if (field.optional) decorators.push('IsOptional');
  decorators.push(...VALIDATORS[field.type]);
  const type = TYPEORM_COLUMN_TYPES[field.type].ts;
  const optional = field.optional ? '?' : '';

  return `${decorators.map((name) => `  @${name}()`).join('\n')}
  ${field.name}${optional}: ${type};`;
}

function renderMigrationColumn(field) {
  const meta = TYPEORM_COLUMN_TYPES[field.type];
  const nullable = field.optional ? '\n            isNullable: true,' : '';
  return `          {
            name: '${field.name}',
            type: '${meta.column}',${nullable}
          }`;
}
