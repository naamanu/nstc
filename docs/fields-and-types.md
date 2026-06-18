# Fields & types

How to define fields when running `nstc generate resource`.

## Basic syntax

```text
name:type              Required field
name?:type             Optional field
name:type:modifier     Field with modifier
name?:type:modifier    Optional field with modifier
```

Fields can be passed as positional arguments or via repeatable `--field` flags:

```bash
nstc generate resource post title:string body:text published?:boolean
nstc generate resource post --field title:string --field body:text --field published?:boolean
```

## Field names

- Must start with a letter.
- May contain letters, numbers, and underscores (`A-Za-z`, `0-9`, `_`).
- Case-sensitive in generated TypeScript property names.

## Reserved names

These names cannot be used as scaffolded fields — they are managed by the generator:

| Name | Reason |
|------|--------|
| `id` | Primary key |
| `createdAt` | Auto-managed timestamp |
| `updatedAt` | Auto-managed timestamp |
| `deletedAt` | Used when `--soft-delete` is set |

Duplicate field names in a single command are also rejected.

## Supported types

Type aliases are case-insensitive. Multiple aliases map to the same internal type.

| Alias(es) | TypeScript type | Description |
|-----------|-----------------|-------------|
| `string` | `string` | Short text; stored as `varchar` (length configurable) |
| `text` | `string` | Long text; stored as `text` |
| `number` | `number` | Floating-point number |
| `int`, `integer` | `number` | Integer |
| `float` | `number` | Floating-point number |
| `boolean`, `bool` | `boolean` | True/false |
| `date` | `Date` | Date only |
| `datetime` | `Date` | Date and time |
| `uuid` | `string` | UUID string (36-char varchar on MySQL/SQLite) |
| `json` | `Record<string, unknown>` | JSON object |

Run `nstc list-types` for the canonical list from the CLI.

### Database column mapping

Migration column types vary by `--db` dialect:

| Internal type | PostgreSQL | MySQL | SQLite |
|---------------|------------|-------|--------|
| `string` | `varchar` | `varchar` | `varchar` |
| `text` | `text` | `text` | `text` |
| `number` | `float` | `float` | `real` |
| `int` | `int` | `int` | `integer` |
| `float` | `float` | `float` | `real` |
| `boolean` | `boolean` | `tinyint` | `boolean` |
| `date` | `date` | `date` | `date` |
| `datetime` | `timestamp` | `timestamp` | `datetime` |
| `uuid` | `uuid` | `varchar(36)` | `varchar(36)` |
| `json` | `jsonb` | `json` | `text` |

Set `--db` to match your host app's database. Default is `postgres`.

### Validation decorators

Generated DTOs include `class-validator` decorators based on type and optionality:

| Type | Required validators | Optional validators |
|------|---------------------|---------------------|
| `string`, `text` | `@IsNotEmpty()`, `@IsString()` | `@IsOptional()`, `@IsString()` |
| `number`, `float` | `@IsNumber()` | `@IsOptional()`, `@IsNumber()` |
| `int` | `@IsInt()` | `@IsOptional()`, `@IsInt()` |
| `boolean` | `@IsBoolean()` | `@IsOptional()`, `@IsBoolean()` |
| `date`, `datetime` | `@IsDateString()` | `@IsOptional()`, `@IsDateString()` |
| `uuid` | `@IsUUID()` | `@IsOptional()`, `@IsUUID()` |
| `json` | `@IsObject()` | `@IsOptional()`, `@IsObject()` |

## Modifiers

### `:unique`

Adds a unique constraint on the column.

```bash
nstc generate resource user email:string:unique username:string:unique
```

Generates `@Column({ ..., unique: true })` on the entity and `isUnique: true` in the migration.

### `:belongsTo:Model`

Creates a many-to-one relation to another resource. The field should typically be a foreign-key column (usually `uuid` or `int` matching the related resource's ID type).

```bash
nstc generate resource comment body:text postId:uuid:belongsTo:Post
```

**Generated behavior:**

- Entity: `@ManyToOne` + `@JoinColumn` on the FK column, plus a relation property (e.g. `post` derived from `postId`).
- Module: registers the related entity in `TypeOrmModule.forFeature`.
- Migration: adds a `TableForeignKey` with `onDelete: 'CASCADE'`.

The `Model` argument is the **class name** of the related resource (e.g. `Post`, `UserProfile`), not the table name.

**Relation property naming:**

- If the field ends with `Id` (e.g. `userId`), the relation property drops the suffix → `user`.
- Otherwise, the property uses the target's camelCase name.

## Optional fields and shell globbing

The `?` in `published?:boolean` is a glob character in zsh and some other shells. Quote the field or use `--field`:

```bash
# zsh-safe
nstc generate resource post title:string 'published?:boolean'
nstc generate resource post --field title:string --field published?:boolean
```

## Resource naming

The resource `<name>` drives all generated names:

| Input | Class | Route | Table |
|-------|-------|-------|-------|
| `post` | `Post` | `/posts` | `posts` |
| `blog-post` | `BlogPost` | `/blog-posts` | `blog_posts` |
| `BlogPost` | `BlogPost` | `/blog-posts` | `blog_posts` |
| `status` | `Status` | `/statuses` | `statuses` |

Singular/plural inflection handles common English patterns. Words ending in `s` that are already singular (like `status`) are preserved correctly.

## Examples

```bash
# Blog with optional excerpt
nstc generate resource article title:string body:text excerpt?:text

# E-commerce order with relation
nstc generate resource line-item quantity:int orderId:uuid:belongsTo:Order

# User with unique email, serial ID
nstc generate resource user email:string:unique name:string --id serial

# JSON metadata field
nstc generate resource product name:string metadata:json
```

## See also

- [Commands](commands.md) — `--id`, `--string-length`, `--soft-delete` flags
- [Generated output](generated-output.md) — how fields appear in entities and DTOs
- [Troubleshooting](troubleshooting.md) — shell globbing details
