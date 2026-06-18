# Troubleshooting

Common issues when using `nstc` and how to resolve them.

## Shell globbing with optional fields

### Problem

In zsh, optional field syntax like `published?:boolean` fails because `?` is treated as a glob:

```bash
nstc generate resource post title:string published?:boolean
# zsh: no matches found: published?:boolean
```

### Solutions

**Quote the field:**

```bash
nstc generate resource post title:string 'published?:boolean'
```

**Use `--field` flags:**

```bash
nstc generate resource post --field title:string --field published?:boolean
```

**Disable zsh globbing for that command:**

```bash
noglob nstc generate resource post title:string published?:boolean
```

The `--field` flag exists specifically to avoid shell interpretation issues.

## File already exists

### Problem

```
Error: Refusing to overwrite existing files without --force.
```

### Solution

Preview with `--dry-run` first. If you intentionally want to replace files:

```bash
nstc generate resource post title:string --force
```

Review the diff carefully — `--force` overwrites all generated files for that resource.

## PostgreSQL UUID primary keys

### Problem

Migration fails on PostgreSQL with an error about `uuid_generate_v4()`.

### Solution

The default UUID strategy uses PostgreSQL's `uuid_generate_v4()`, which requires the `uuid-ossp` extension:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Alternatives:**

- Use serial integer IDs: `--id serial`
- Use MySQL's `UUID()` default: `--db mysql`
- Edit the generated migration to use `gen_random_uuid()` (PostgreSQL 13+ with `pgcrypto`)

## Entity not found / TypeORM errors

### Problem

App starts but queries fail, or TypeORM can't find the entity.

### Solution

Ensure entities are registered. Two common setups:

**1. `autoLoadEntities: true` in TypeORM config (recommended):**

```typescript
TypeOrmModule.forRoot({
  // ...
  autoLoadEntities: true,
}),
```

The generated module's `TypeOrmModule.forFeature([Post])` handles registration.

**2. Manual entity list:**

Add the entity class to your TypeORM `entities` array if you don't use `autoLoadEntities`.

Also verify the generated module is imported in `app.module.ts` or a feature module.

## Module wiring with `--wire`

### Problem

`--wire` didn't modify the file, modified the wrong place, or broke syntax.

### Solution

`--wire` performs conservative string insertion — it is **not** an AST parser. It:

- Adds an import statement near the top of the file
- Inserts the module into the `imports` array of `@Module({...})`
- Skips if the module is already imported

**Best practices:**

- Always review the diff after wiring
- Use `--dry-run --wire src/app.module.ts` to preview
- For complex module files (dynamic imports, nested configs), wire manually

Known edge cases: deeply nested brackets in `imports`, non-standard module file layouts.

## destroy finds no files

### Problem

```
Error: No scaffolded files found for Post.
```

### Solution

Check that:

- You're running from the correct directory (or pass `--cwd`)
- `--src` and `--resource-dir` match what was used during `generate`
- The resource name matches (e.g. `post` not `posts` — naming is inflected automatically)
- Files weren't moved or renamed manually after generation

Preview with `--dry-run`:

```bash
nstc destroy resource post --dry-run
```

## Wrong database dialect in migration

### Problem

Migration uses PostgreSQL types but your app uses MySQL.

### Solution

Set the dialect explicitly:

```bash
nstc generate resource post title:string --db mysql
```

Or add to `.nstcrc.json`:

```json
{ "db": "mysql" }
```

See [Fields & types](fields-and-types.md#database-column-mapping) for per-dialect column types.

## Relation target not found

### Problem

Generated imports reference a related entity that doesn't exist yet.

### Solution

Generate the parent resource first:

```bash
nstc generate resource post title:string body:text
nstc generate resource comment body:text postId:uuid:belongsTo:Post
```

The `:belongsTo:Model` argument must match the **class name** of the related resource (`Post`, not `posts`).

## Invalid resource name

### Problem

```
Error: Resource name must start with a letter and contain only letters, numbers, hyphens, or underscores.
```

### Solution

Use alphanumeric names with hyphens or underscores: `blog-post`, `BlogPost`, `user_profile`. Avoid spaces and special characters.

## Config not applied

### Problem

`.nstcrc.json` settings seem ignored.

### Solution

- Config loads from `--cwd` (default: current directory). Run `nstc` from your app root.
- CLI flags override config — check if you're passing conflicting flags.
- `.nstcrc.json` overrides `package.json`'s `"nstc"` key, not the other way around.

## CI / test glob issues

If you're developing `nstc` itself: the test script uses `dist/test/*.test.js` (single-level glob) because POSIX `sh` does not expand `**`. This is a contributor concern, not an end-user issue.

## Getting help

```bash
nstc --help
nstc list-types
```

For bugs or feature requests, open an issue on the project repository.

## See also

- [Getting started](getting-started.md)
- [Configuration](configuration.md)
- [Commands](commands.md)
