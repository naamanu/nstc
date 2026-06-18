# Configuration

Set persistent defaults so you don't repeat the same flags on every command.

## Config sources

`nstc` loads defaults from two sources, merged in this order (later wins):

1. **`package.json`** → `"nstc"` key
2. **`.nstcrc.json`** in the project root (overrides `package.json`)

**CLI flags always override config file values.**

Config is loaded from `--cwd` (defaults to the current working directory). Use `--cwd` to point at a different project root.

## .nstcrc.json

Create this file in your NestJS app root:

```json
{
  "src": "src",
  "resourceDir": "features",
  "migrationDir": "migrations",
  "db": "mysql",
  "stringLength": 120,
  "idStrategy": "uuid",
  "swagger": true,
  "pagination": false,
  "softDelete": false
}
```

Only include keys you want to override. Omitted keys use CLI defaults.

## package.json

Alternatively, nest config under the `"nstc"` key:

```json
{
  "name": "my-api",
  "nstc": {
    "resourceDir": "modules",
    "db": "postgres",
    "swagger": true
  }
}
```

If both exist, `.nstcrc.json` takes precedence over `package.json`.

## Config keys

| Key | Type | Default | CLI flag | Description |
|-----|------|---------|----------|-------------|
| `src` | string | `src` | `--src` | Source root directory |
| `resourceDir` | string | `resources` | `--resource-dir` | Feature folder under `src` |
| `migrationDir` | string | `migrations` | `--migration-dir` | Migration folder under `src` |
| `db` | string | `postgres` | `--db` | Database dialect: `postgres`, `mysql`, `sqlite` |
| `stringLength` | number | `255` | `--string-length` | Default varchar length for `string` fields |
| `idStrategy` | string | `uuid` | `--id` | Primary key: `uuid` or `serial` |
| `swagger` | boolean | `false` | `--swagger` | Add Swagger decorators |
| `pagination` | boolean | `false` | `--pagination` | Add skip/take to findAll |
| `softDelete` | boolean | `false` | `--soft-delete` | Add soft delete support |

### Keys not in config

These flags are **CLI-only** and cannot be set via config file:

| Flag | Reason |
|------|--------|
| `--dry-run` | Per-invocation preview |
| `--verbose` | Per-invocation output |
| `--force` | Per-invocation overwrite |
| `--wire` | Per-invocation target module |
| `--field` | Per-resource field list |
| `--cwd` | Determines where config is loaded from |

## Examples

### Monorepo with custom paths

```json
{
  "src": "apps/api/src",
  "resourceDir": "domains",
  "migrationDir": "database/migrations",
  "db": "postgres"
}
```

```bash
cd apps/api
nstc generate resource invoice total:float customerId:uuid:belongsTo:Customer
```

### MySQL project with Swagger by default

```json
{
  "db": "mysql",
  "swagger": true,
  "stringLength": 191
}
```

```bash
nstc generate resource product name:string sku:string:unique
# Uses mysql + swagger without repeating flags
```

### Override config for one command

```bash
# Config says mysql, but this resource targets sqlite
nstc generate resource cache-entry key:string value:text --db sqlite
```

## Invalid config

- **Malformed JSON** in `.nstcrc.json` → error with filename.
- **Invalid values** (unsupported `db`, non-integer `stringLength`) → error at parse time, same as invalid CLI flags.

## See also

- [Commands](commands.md) — all CLI flags
- [Getting started](getting-started.md) — first-time setup
