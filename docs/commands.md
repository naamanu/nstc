# Commands

Complete reference for `nstc` CLI commands, aliases, and flags.

## Synopsis

```text
nstc generate resource <name> <field:type...> [options]
nstc destroy resource <name> [options]
nstc list-types
nstc --version
nstc --help
```

## Aliases

| Long form | Short form |
|-----------|------------|
| `generate` | `g` |
| `destroy` | `d` |
| `resource` | `scaffold` |

Examples:

```bash
nstc g scaffold post title:string
nstc d resource post --dry-run
```

## generate

Creates a full CRUD resource in your host app.

```bash
nstc generate resource <name> <field:type...> [options]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `<name>` | Yes | Resource name (e.g. `post`, `blog-post`, `BlogPost`). Used for class names, routes, and table names. |
| `<field:type...>` | Yes | One or more field definitions. At least one field is required. |

**Examples:**

```bash
nstc generate resource post title:string body:text published?:boolean
nstc generate resource user email:string:unique profileId:uuid:belongsTo:Profile
nstc generate resource order total:float --db mysql --id serial
```

### generate flags

| Flag | Default | Description |
|------|---------|-------------|
| `--field <name:type>` | — | Field definition (repeatable). Use instead of positional fields when shell globbing is an issue. |
| `--src <dir>` | `src` | Source root directory relative to `--cwd`. |
| `--resource-dir <dir>` | `resources` | Feature folder under `--src` where modules are generated. |
| `--migration-dir <dir>` | `migrations` | Migration folder under `--src`. |
| `--cwd <dir>` | current directory | Working directory for path resolution and config loading. |
| `--db <dialect>` | `postgres` | Database dialect for migrations: `postgres`, `mysql`, `sqlite`. |
| `--id <strategy>` | `uuid` | Primary key strategy: `uuid` or `serial`. |
| `--string-length <n>` | `255` | Default `varchar` length for `string` and `uuid` columns. |
| `--soft-delete` | off | Add `deletedAt` column; service uses `softRemove`. |
| `--swagger` | off | Add `@nestjs/swagger` decorators to controller and DTOs. |
| `--pagination` | off | Add `skip` and `take` query params to `findAll`. |
| `--wire <module.ts>` | — | Import generated module into the given NestJS module file. |
| `--dry-run` | off | Print planned files without writing. |
| `--verbose` | off | Print full contents of generated files (often combined with `--dry-run`). |
| `--force` | off | Overwrite existing generated files. Without this, collisions raise an error. |

## destroy

Removes a previously scaffolded resource.

```bash
nstc destroy resource <name> [options]
```

**What gets removed:**

1. The entire resource directory: `<src>/<resource-dir>/<plural-name>/`
2. Any migration matching `*-Create<PluralClassName>.ts` in `<src>/<migration-dir>/`

**Examples:**

```bash
nstc destroy resource post --dry-run   # preview
nstc destroy resource post             # delete files
```

`destroy` accepts the same path and `--cwd` flags as `generate`, plus `--dry-run`. It does not accept field or generation flags.

If no matching files exist, `destroy` exits with an error.

## list-types

Prints supported field type aliases, modifiers, database dialects, and ID strategies.

```bash
nstc list-types
```

## Meta commands

| Command | Alias | Description |
|---------|-------|-------------|
| `--help` | `-h` | Print usage and exit. |
| `--version` | `-v` | Print package version and exit. |

## Flag combinations

Common useful combinations:

```bash
# Preview everything including file contents
nstc generate resource post title:string --dry-run --verbose

# Generate and wire in one step
nstc generate resource post title:string --wire src/app.module.ts

# Full-featured resource
nstc generate resource article title:string body:text authorId:uuid:belongsTo:User \
  --db postgres --swagger --pagination --soft-delete --dry-run --verbose
```

## Exit behavior

- **Success:** writes planned output to stdout, exit code 0.
- **Parse/validation errors:** message on stderr, non-zero exit code.
- **File collision (without `--force`):** error listing conflicting paths.
- **`destroy` with no matches:** error indicating no scaffolded files found.

## See also

- [Fields & types](fields-and-types.md) — field syntax and modifiers
- [Configuration](configuration.md) — persistent defaults via config file
- [Generated output](generated-output.md) — what `generate` produces
