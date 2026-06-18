# AGENTS.md

Guidance for AI coding agents working in **nest-scaffolder**.

## What this project is

A zero-dependency Node.js CLI (`nest-scaffold`) that scaffolds Rails-style NestJS + TypeORM CRUD resources into a host app. It writes files only — it does not modify the host app's runtime or run migrations.

```bash
npm test          # node --test (45 tests)
npm run smoke     # dry-run generate smoke check
```

Node **>= 20**, ESM (`"type": "module"`), no build step.

## Architecture (the spine)

```
bin/nest-scaffold.js
  └─ src/cli.js              # I/O, format output, route commands
       └─ src/parser.js      # argv → command object (+ config merge)
            └─ src/config.js  # .nest-scaffoldrc.json / package.json nestScaffold
       ├─ src/generator.js   # plan files → write (generate)
       ├─ src/destroy.js     # remove resource dir + matching migration
       └─ src/wire.js        # optional app.module.ts import wiring

Shared by generator/templates:
  src/naming.js   # singular/plural/class/table/route names
  src/types.js    # field types, DB dialects, id strategies, migration helpers
  src/templates.js # string templates for generated NestJS/TypeORM files
  src/version.js  # reads version from package.json
```

**Data flow (generate):** parse → `buildNames` → `planFiles` (render templates) → collision check → write → print next steps.

## Commands

| Command | Entry |
|---------|-------|
| `generate resource <name> <fields...>` | default |
| `destroy resource <name>` | removes resource dir + `*-Create{Plural}.ts` migration |
| `list-types` | prints supported field types and modifiers |
| `--version` / `-v` | prints package version |

Short aliases: `g` / `d`, `resource` / `scaffold`.

## Field syntax

```
name:type
name?:type
name:type:unique
name:type:belongsTo:Model
```

Examples: `title:string`, `published?:boolean`, `email:string:unique`, `userId:uuid:belongsTo:User`

Reserved field names (rejected): `id`, `createdAt`, `updatedAt`, `deletedAt`.

## Key options

| Flag | Default | Notes |
|------|---------|-------|
| `--src` | `src` | Host app source root |
| `--resource-dir` | `resources` | Feature folder under `--src` |
| `--migration-dir` | `migrations` | Migrations under `--src` |
| `--db` | `postgres` | `postgres`, `mysql`, `sqlite` — affects migrations + JSON columns |
| `--id` | `uuid` | `uuid` or `serial` — affects entity, controller pipes, migration |
| `--string-length` | `255` | Default varchar length for `string` fields |
| `--soft-delete` | off | Adds `deletedAt`, uses `softRemove` |
| `--swagger` | off | Uses `@nestjs/swagger` decorators |
| `--pagination` | off | Adds `skip`/`take` to `findAll` |
| `--wire <file>` | — | Inserts module import into a NestJS module file |
| `--dry-run` | off | Plan only, no writes |
| `--verbose` | off | Print generated file contents |
| `--force` | off | Overwrite existing files |

Config file: `.nest-scaffoldrc.json` or `package.json` → `"nestScaffold"`. CLI flags override config.

## Conventions when changing code

### Single source of truth

- **Field types and DB mappings** live in `src/types.js`. When adding a type, update `TYPE_ALIASES`, `FIELD_TYPE_DEFS`, and any migration/entity helpers there.
- **Parser aliases** import from `types.js` — do not duplicate type maps in `parser.js` or `templates.js`.
- **Name inflection** is in `src/naming.js`. Only strip trailing `s` when the stem round-trips through `pluralize` and does not end in `u` (fixes `status` → `Statu`).

### Templates

- All generated NestJS/TypeORM output is inline template literals in `src/templates.js`.
- Template functions accept `(names, fields?, options)` where `options` comes from `resolveRenderOptions(command)`.
- New generation flags: add to `DEFAULT_OPTIONS` in `parser.js`, `CONFIG_KEYS` in `config.js`, `resolveRenderOptions` in `types.js`, then wire through `generator.js` → template renderers.

### Parser

- Top-level routing in `parseArgs`: meta commands (`--help`, `--version`, `list-types`) → `generate` → `destroy`.
- Shared flags parsed in `parseSharedOptions`. Generate requires at least one field; destroy does not.
- Field modifiers parsed in `parseField` after splitting on `:`.

### Wire

- `src/wire.js` uses conservative string insertion, not AST parsing.
- Bracket counting in `findBracketedSection` handles nested `TypeOrmModule.forRoot({...})` in imports arrays.
- Import paths are relative from the wired module file to the generated resource module.

### Tests

- `node --test` — no test framework beyond Node built-ins.
- Test files in `test/` mirror src modules: `parser.test.js`, `templates.test.js`, `tier6.test.js`, etc.
- Generator tests use temp dirs via `mkdtemp`. Always `rm` in `finally`.
- When adding a flag or field modifier: add parser test + template or integration test.
- CI runs on Node 20 and 22 (`.github/workflows/ci.yml`).

## Generated output layout

For resource `post` (defaults):

```
src/resources/posts/posts.module.ts
src/resources/posts/posts.controller.ts
src/resources/posts/posts.service.ts
src/resources/posts/entities/post.entity.ts
src/resources/posts/dto/create-post.dto.ts
src/resources/posts/dto/update-post.dto.ts
src/migrations/<timestamp>-CreatePosts.ts
```

## Common pitfalls

- **Shell globbing:** `published?:boolean` breaks in zsh without quotes. Document `--field` alternative.
- **Next-steps path:** `formatGenerateResult` in `cli.js` must use `command.src` and `command.resourceDir`, not hardcoded `resources`.
- **Migration UUID default:** PostgreSQL `uuid_generate_v4()` is not portable; use `--db mysql` or `--db sqlite` for other dialects.
- **Relation import paths:** differ between entity (`../..`) and module (`../..`) vs flat assumptions — use `relationEntityImport` in `types.js`.
- **Do not commit** changes to generated files in host apps — this repo only contains the CLI tool itself.

## Scope boundaries

Stay focused when making changes:

- This tool generates code; it is not a NestJS app.
- Avoid adding runtime dependencies unless there is a strong reason (keep the CLI install lightweight).
- Prefer extending `types.js` + `templates.js` over new abstraction layers.
- Module auto-wiring (`--wire`) is best-effort string editing — test edge cases with nested imports.

## Files to read first

For most tasks, read these in order:

1. `src/parser.js` — CLI surface area
2. `src/types.js` — type registry and render options
3. `src/templates.js` — generated output shape
4. `src/generator.js` — file planning and writes
5. `README.md` — user-facing docs (keep in sync when adding flags)
