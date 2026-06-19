# Architecture

A deep-dive into how `nstc` is built, how a command flows through the code, and how the tool is designed to be driven by an AI agent.

## What nstc is

`nstc` is a command-line scaffolder. You give it a resource name and a field list; it writes the NestJS module, controller, service, entity, DTOs, and TypeORM migration that together constitute one CRUD feature. It does not touch the host application's runtime, run migrations, or require any framework integration — it generates files and exits.

The scope is deliberately tight. `nstc` knows how to turn a specification (`post title:string body:text`) into idiomatic NestJS + TypeORM source code. Everything outside that — running the app, running migrations, wiring business logic — stays in the host project.

## Design principles

**Zero runtime dependencies.** `package.json` lists no `dependencies`, only `devDependencies`. Every installed copy of `nstc` is exactly what you see in the repo: TypeScript source compiled to JavaScript, no transitive packages pulled in at runtime. This keeps the supply-chain surface minimal and the install trustworthy.

**Deterministic.** The same arguments always produce the same files. There is no global state, no database reads, no network calls. The only non-deterministic output is the migration timestamp, which is driven by the system clock and can be overridden with `--timestamp` for testing.

**No interactive prompts.** Every configuration choice is expressible as a CLI flag or a config file key. There is no readline, no inquirer, no wizard. This makes the tool safe to drive from a script, a CI pipeline, or an AI agent without worrying about terminal input handling.

**Loud failures, no silent corruption.** When something cannot be done safely — overwriting a file, wiring into a module whose imports array cannot be parsed — `nstc` throws an error and exits with code 1 rather than writing partial output. The file system is either fully updated or untouched.

**Config layering, CLI wins.** Project-wide defaults live in `.nstcrc.json` or the `"nstc"` key in `package.json`. CLI flags always override them. This lets a project encode its conventions once and have every invocation (human or automated) respect them without repeating the same flags.

## Technology stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js ≥ 20, ESM (`"type": "module"`) |
| Language | TypeScript 5, strict mode, `NodeNext` module resolution |
| Tests | Node native test runner (`node --test`) |
| Lint | ESLint flat config with `typescript-eslint` `recommendedTypeChecked` |
| Format | Prettier (singleQuote, trailingComma all, printWidth 100) |
| Build | `tsc` → `dist/`, `declarationMap: true` |
| CI | GitHub Actions, Node 20 + 22 matrix |
| Runtime deps | **None** |

Node 20's native TypeScript type-stripping (via `--experimental-strip-types` or the `node --test` runner's built-in loader) means tests run directly on `.ts` source files without a separate compilation step. The `dist/` build is only needed for the published package.

## Source map

```
bin/
  nstc.ts          Entry point. Calls runCli, catches errors, sets exit code.

src/
  cli.ts           I/O layer. Routes parsed command to generator/destroyer/wire.
                   Formats all output (file lists, next steps, dry-run previews).
  parser.ts        argv → GenerateCommand | DestroyCommand | { version } | ...
                   Merges config-file defaults with CLI flags. Validates all inputs.
  config.ts        Reads .nstcrc.json and package.json "nstc" key.
                   Config-file values are the floor; CLI flags override them.
  models.ts        Shared TypeScript interfaces and types. No logic.
  naming.ts        resource string → ResourceNames (class, plural, kebab, table, route).
                   Contains the irregular-plural map and uncountable-word set.
  types.ts         Field type definitions, DB dialect configs, column option builders,
                   migration column formatters, and relation helpers. Also resolveRenderOptions
                   and the includeKind predicate used by --only/--skip.
  templates.ts     String-template functions that render each generated file.
                   Pure functions: (names, fields, options) → string.
  generator.ts     Calls buildNames, resolveRenderOptions, planFiles, then writes.
                   planFiles returns a [FileKind, relativePath, content] tuple array
                   filtered by includeKind before writing.
  destroy.ts       Locates the resource folder and matching migration file,
                   then removes them (or reports them in dry-run).
  wire.ts          Best-effort AST-free module wiring. Inserts an import statement
                   and adds the module to the @Module imports array via regex.
  version.ts       Reads version from package.json at startup.
```

## Data pipeline

This is the full journey of `nstc generate resource post title:string published?:boolean`.

### 1. Parse

`bin/nstc.ts` calls `runCli(process.argv.slice(2))`. `cli.ts` calls `parseCommand(argv)`.

Inside `parser.ts`:

- `extractCwd` scans argv for `--cwd` and calls `loadConfig(cwd)`.
- `loadConfig` (`config.ts`) reads `.nstcrc.json` and the `"nstc"` key from `package.json`, merges them (file wins over package.json), and returns a `Partial<ScaffoldConfig>`.
- `parseCommand` walks `argv` token by token, building a command object. Config-file defaults fill in anything not specified on the command line.
- Each flag value is validated by a shared validator (`validateDb`, `validateIdStrategy`, `validateStringLength`) so that both CLI flags and config-file values are checked against the same rules.
- Field tokens (`title:string`, `published?:boolean`) are parsed by `parseField`, which splits on `:`, resolves type aliases, and checks for reserved names and duplicates.
- The function returns a fully typed `GenerateCommand` (or `DestroyCommand`, or a short-circuit like `{ version: true }`).

### 2. Name resolution

`generator.ts` calls `buildNames(command.resource, command.inflections)` from `naming.ts`.

`buildNames` takes the raw resource string (`"post"`, `"blog-post"`, `"BlogPost"`) and produces every derived name the templates need:

```
input:          "blog-post"
→ splitWords:   ["blog", "post"]
→ singularLast: ["blog", "post"]   (already singular)
→ pluralLast:   ["blog", "posts"]

ResourceNames {
  original:         "blog-post"
  camel:            "blogPost"
  className:        "BlogPost"
  pluralClassName:  "BlogPosts"
  kebab:            "blog-post"
  kebabPlural:      "blog-posts"
  tableName:        "blog_posts"
  route:            "blog-posts"
}
```

Plural resolution consults an `IRREGULAR_PLURALS` map (`person→people`, `child→children`, etc.) and an `UNCOUNTABLE` set (`sheep`, `series`, etc.) before falling back to suffix rules (`-y→-ies`, `-(s|x|z|ch|sh)→+es`, else `+s`). User overrides from the `inflections` config key are merged on top of the built-in map.

All downstream code — folder names, class names, route paths, table names, migration class names — derives from this single `ResourceNames` object. Getting inflection right here is critical because a wrong plural propagates into all seven generated files simultaneously.

### 3. Render

`generator.ts` calls `resolveRenderOptions(command)` and then `planFiles`, which builds a `[FileKind, relativePath, content]` tuple for each file:

```typescript
const files: Array<[FileKind, string, string]> = [
  ['module',     `${baseDir}/${names.kebabPlural}.module.ts`,       renderModule(...)],
  ['controller', `${baseDir}/${names.kebabPlural}.controller.ts`,   renderController(...)],
  ['service',    `${baseDir}/${names.kebabPlural}.service.ts`,       renderService(...)],
  ['entity',     `${baseDir}/${entityDir}/${names.kebab}.entity.ts`, renderEntity(...)],
  ['dto',        `${baseDir}/${dtoDir}/create-${names.kebab}.dto.ts`, renderCreateDto(...)],
  ['dto',        `${baseDir}/${dtoDir}/update-${names.kebab}.dto.ts`, renderUpdateDto(...)],
  ['migration',  `${migrationDir}/${timestamp}-Create${names.pluralClassName}.ts`, renderMigration(...)],
];
```

The list is then filtered by `includeKind(kind, command.only, command.skip)` before any rendering cost is paid for excluded files.

Each `render*` function in `templates.ts` is a pure function that returns a string. They take `ResourceNames`, `FieldDefinition[]`, and `RenderOptions` — no side effects, no filesystem access. This is what makes `--dry-run` and `--verbose` trivial: in dry-run mode, `generator.ts` skips the write loop but still returns all the rendered content.

The `RenderOptions` object carries all generation flags (`db`, `swagger`, `pagination`, `softDelete`, `idStrategy`, `entityDir`, `dtoDir`) so templates can branch on them without touching the command object directly.

### 4. Collision check

Before writing, `generator.ts` checks every planned `absolutePath` against `existsSync`. If any file already exists and `--force` is not set, the function throws a human-readable error listing every conflict. No files are written.

### 5. Write

Each file gets `mkdir -p` on its parent directory followed by `writeFile`. The writes are sequential, not parallel, so a partial failure is easier to reason about and recover from manually.

### 6. Output

`cli.ts` formats the result into a human-readable (and agent-readable) stdout string:

```
Created 7 files for Post:
  - src/resources/posts/posts.module.ts
  - src/resources/posts/posts.controller.ts
  ...

Next steps:
  1. Import PostModule from './src/resources/posts/posts.module'.
  2. Add PostModule to your root or feature module imports array.
  3. Ensure Post is included in your TypeORM entity registration if your app does not auto-load entities.
```

In dry-run mode a `Resolved names:` block is prepended so wrong pluralizations are visible before any files are written.

## The template system

`templates.ts` is a set of pure render functions. Each function receives structured data and returns a source string. There are no template files on disk, no handlebars, no EJS — the templates are TypeScript string interpolation.

This makes the template system:
- **Fast** — no filesystem reads at render time
- **Typed** — a missing field in `RenderOptions` is a compile error, not a runtime blank
- **Testable** — tests call `renderEntity(names, fields, options)` directly and assert on the string

`types.ts` provides the vocabulary the templates draw on:

- `FIELD_TYPE_DEFS` — maps each `FieldType` to its TypeScript type, class-validator decorators, and per-dialect column type
- `DB_CONFIG` — per-dialect ID column specs, timestamp types, and default expressions
- `entityColumnOptions`, `migrationColumnSpec`, `formatMigrationColumn` — build the column decorator arguments from a field definition

The separation lets `templates.ts` stay focused on code structure and let `types.ts` own all the knowledge about what specific types and decorators look like.

## Config layering

```
CLI flags          (highest priority)
  ↓ override
.nstcrc.json       (project-level config file)
  ↓ override
package.json "nstc" (project-level, shared file)
  ↓ override
DEFAULT_OPTIONS    (built-in defaults in parser.ts)
```

`config.ts` reads both config sources via a shared `readJsonFile` helper so their read/parse behavior cannot drift. `.nstcrc.json` is nstc's own file — a parse error throws. `package.json` is a third-party file — a parse error warns to stderr and falls back to defaults rather than aborting scaffolding.

`pickConfig` filters the merged source through a `CONFIG_KEYS` allowlist before returning it. Only keys that exist in `ScaffoldConfig` can flow in from config files; arbitrary JSON keys are silently ignored.

## nstc as an AI agent primitive

One of nstc's explicit design goals is to be safely and reliably invoked by an AI coding agent as a code-generation step inside a larger workflow.

### Why CLIs are good primitives for agents

An AI agent orchestrating code generation needs tools that are:
- **Unambiguous to invoke** — a single shell command with typed arguments, no dialog
- **Safe to run without side effects** before committing — `--dry-run`
- **Self-describing** — `--help`, `list-types`, and `AGENTS.md` give the agent a full picture
- **Deterministic** — same args → same output, no hidden state that varies between calls
- **Loudly failing** — exit code 1 with a message on stderr lets the agent detect and handle errors

`nstc` satisfies all of these.

### The agent workflow

A typical AI agent scaffolding a new resource follows this pattern:

**Step 1: Preview**
```bash
nstc generate resource order lineId:uuid:belongsTo:OrderLine total:number --dry-run
```
The dry-run output lists the files that *would* be created and shows the resolved names:
```
Would create 7 files for Order:
  ...
Resolved names:
  class:  Order / Orders
  table:  orders
  route:  /orders
```
The agent reads this to verify the names are correct before committing to any writes. If the plural looks wrong (e.g. a domain-specific compound word), the agent can override it via the `inflections` config key without retrying the full command.

**Step 2: Generate**
```bash
nstc generate resource order lineId:uuid:belongsTo:OrderLine total:number \
  --wire src/app.module.ts
```
Writes the 7 files and — because `--wire` is set — inserts the import into `app.module.ts`. The agent reads the stdout to extract the file paths for any follow-up steps (e.g. opening each file for further editing).

**Step 3: Fix up (if needed)**
If `--wire` reports it could not update the module file (`Module wiring skipped: could not find an @Module imports array`), the agent knows to patch `app.module.ts` manually. The error is structured enough to parse and act on without human intervention.

**Step 4: Scaffold related resources**
Because `nstc` is stateless, the agent can invoke it multiple times in sequence — one resource per call — without any coordination overhead.

### Flags that exist specifically for agent use

| Flag | Why it helps agents |
|------|---------------------|
| `--dry-run` | Preview output without writing; safe to call before any file-system decision |
| `--verbose` | Print full generated file content so the agent can inspect or post-process without reading files separately |
| `--only module,service` | Generate a subset of files when the agent is regenerating one piece of a resource that already exists |
| `--skip migration` | Skip migration generation when the agent knows the schema is being managed separately |
| `--force` | Overwrite without prompting; the agent can decide when this is safe |
| `--wire <file>` | Wire the module in one step so the agent doesn't need to parse and edit the module file itself |
| `--entity-dir` / `--dto-dir` | Honor the host project's directory conventions without the agent having to calculate paths |

### Config files as convention codifiers

When an agent is working in a project that has established conventions, the operator sets those conventions once in `.nstcrc.json`:

```json
{
  "db": "mysql",
  "swagger": true,
  "pagination": true,
  "entityDir": "models",
  "inflections": {
    "staff": "staff",
    "datum": "data"
  }
}
```

Every subsequent invocation — human or agent — inherits these conventions automatically. The agent does not need to know the project's conventions; it just calls `nstc generate resource <name> <fields>` and the config file does the rest. This is the primary mechanism for keeping agent-generated code consistent with the rest of the codebase.

### Exit codes and error handling

`nstc` exits 0 on success and 1 on any error. Error messages go to stderr; generated file paths and next steps go to stdout. This separation lets an agent pipeline `stdout` for path extraction while independently monitoring `stderr` for failures, without parsing interleaved output.

When `--wire` cannot parse the target module file, it does not exit 1 — wiring failure is non-fatal, because the agent or developer can add the import manually. The wire result is reported in stdout with a `Module wiring skipped:` prefix that is easy to detect and act on.

### The AGENTS.md contract

`AGENTS.md` at the repo root is the machine-readable briefing for any AI agent that opens this repository. It describes the architecture, commands, field syntax, and key options in a compact, structured format designed to be consumed as context before the agent begins work. It is kept up to date alongside the code so agents reading it can trust it reflects current behavior.

## See also

- [Commands](commands.md) — full flag reference
- [Generated output](generated-output.md) — what each file contains and how flags affect it
- [Configuration](configuration.md) — config file keys and layering
- [AGENTS.md](../AGENTS.md) — concise machine-readable briefing
