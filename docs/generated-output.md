# Generated output

What `nstc generate resource` creates and how generation flags affect the output.

## File layout

For `nstc generate resource post title:string body:text` with defaults:

```text
src/
  resources/
    posts/
      posts.module.ts
      posts.controller.ts
      posts.service.ts
      entities/
        post.entity.ts
      dto/
        create-post.dto.ts
        update-post.dto.ts
  migrations/
    <timestamp>-CreatePosts.ts
```

Paths change with `--src`, `--resource-dir`, and `--migration-dir`. The migration timestamp is generated at run time (format: `YYYYMMDDHHmmss`).

## REST API

The controller registers routes at the pluralized kebab-case path (e.g. `/posts`).

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| `POST` | `/posts` | `create` | Create a record from `CreatePostDto` |
| `GET` | `/posts` | `findAll` | List all records |
| `GET` | `/posts/:id` | `findOne` | Find by ID |
| `PATCH` | `/posts/:id` | `update` | Partial update via `UpdatePostDto` |
| `DELETE` | `/posts/:id` | `remove` | Delete (or soft-delete) by ID |

### Route parameter validation

| `--id` | Pipe | Param type |
|--------|------|------------|
| `uuid` (default) | `ParseUUIDPipe` | `string` |
| `serial` | `ParseIntPipe` | `number` |

### With `--pagination`

`GET /posts` accepts optional query parameters:

- `skip` — offset (default `0`)
- `take` — limit (default `25`)

Service calls `repository.find({ skip, take })`.

## Module (`*.module.ts`)

- Imports `TypeOrmModule.forFeature([Post, ...relatedEntities])`
- Declares controller and service
- Exports the service for use in other modules

When fields include `:belongsTo:Model` relations, related entities are automatically registered in `forFeature` and imported.

## Controller (`*.controller.ts`)

Standard NestJS CRUD controller with `@Controller('<route>')`.

**With `--swagger`:**

- `@ApiTags('<route>')` on the controller
- `@ApiProperty` / `@ApiPropertyOptional` on DTO fields

## Service (`*.service.ts`)

Uses `@InjectRepository` with TypeORM's `Repository<T>`.

| Method | Behavior |
|--------|----------|
| `create(dto)` | `repository.create` + `save` |
| `findAll()` | `repository.find()` |
| `findOne(id)` | `findOneBy({ id })`, throws `NotFoundException` if missing |
| `update(id, dto)` | Loads entity, `Object.assign`, `save` |
| `remove(id)` | Loads entity, `remove` or `softRemove` |

**With `--soft-delete`:** `remove` calls `repository.softRemove()` instead of `remove()`.

**With `--pagination`:** `findAll(skip, take)` passes pagination to `repository.find`.

## Entity (`entities/*.entity.ts`)

Every entity includes:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` or `number` | `@PrimaryGeneratedColumn` — UUID or serial per `--id` |
| `<fields...>` | per field type | `@Column` with dialect-appropriate options |
| `createdAt` | `Date` | `@CreateDateColumn` |
| `updatedAt` | `Date` | `@UpdateDateColumn` |
| `deletedAt` | `Date?` | `@DeleteDateColumn` — only with `--soft-delete` |

**Relation fields** (`:belongsTo:Model`) generate both:

- A `@Column` for the foreign key (e.g. `postId`)
- A `@ManyToOne` + `@JoinColumn` relation property (e.g. `post`)

Table name uses snake_case plural (e.g. `posts`, `blog_posts`).

## DTOs

### Create DTO (`dto/create-*.dto.ts`)

One property per scaffolded field with:

- `class-validator` decorators (see [Fields & types](fields-and-types.md))
- Optional `@ApiProperty` decorators when `--swagger` is set

### Update DTO (`dto/update-*.dto.ts`)

```typescript
export class UpdatePostDto extends PartialType(CreatePostDto) {}
```

Uses `@nestjs/swagger`'s `PartialType` when `--swagger` is set, otherwise `@nestjs/mapped-types`.

## Migration (`migrations/*-Create*.ts`)

TypeORM migration class implementing `MigrationInterface`:

- **`up`:** `createTable` with all columns, optional foreign keys
- **`down`:** `dropTable`

Includes columns for `id`, all fields, `createdAt`, `updatedAt`, and optionally `deletedAt`.

Foreign keys from `:belongsTo` modifiers use `onDelete: 'CASCADE'`.

### Dialect-specific ID columns

| Dialect | UUID default | Serial |
|---------|--------------|--------|
| PostgreSQL | `uuid_generate_v4()` | auto-increment integer |
| MySQL | `(UUID())` | auto-increment int |
| SQLite | varchar(36), no default | auto-increment integer |

## Flag effects summary

| Flag | Affects |
|------|---------|
| `--db` | Migration column types, JSON storage, timestamp defaults |
| `--id` | Entity primary key, controller pipes, service ID types, migration ID column |
| `--string-length` | `varchar` length for `string` fields (not `text`) |
| `--soft-delete` | Entity `deletedAt`, service `softRemove` |
| `--swagger` | Controller `@ApiTags`, DTO decorators, `PartialType` import source |
| `--pagination` | Controller query params, service `findAll` signature |
| `:unique` | Entity + migration unique constraint |
| `:belongsTo` | Entity relation, module imports, migration foreign key |

## destroy cleanup

`nstc destroy resource post` removes:

1. `src/resources/posts/` (entire directory)
2. `src/migrations/*-CreatePosts.ts` (matching migration file)

Custom paths follow `--src`, `--resource-dir`, and `--migration-dir`.

## See also

- [Fields & types](fields-and-types.md) — field syntax and type mapping
- [Commands](commands.md) — all generation flags
- [Getting started](getting-started.md) — wiring and running migrations
