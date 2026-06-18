# nstc

**NestJS TypeORM Scaffolder** — a zero-runtime-dependency CLI that generates Rails-style CRUD resources for NestJS APIs backed by TypeORM.

```bash
nstc generate resource post title:string body:text published?:boolean
```

Given a resource name and field list, `nstc` writes a NestJS module, controller, service, DTOs, TypeORM entity, and a timestamped migration into your host app. It does not run migrations or modify your app's runtime — it only creates files and prints wiring instructions.

## Quick start

**Prerequisites:** Node.js 20+, a NestJS app with TypeORM configured.

```bash
# Install globally (when published) or link locally during development
npm install -g nstc

# From your NestJS app root
nstc generate resource post title:string body:text published?:boolean --dry-run
nstc generate resource post title:string body:text published?:boolean
```

After generation, import the new module into `app.module.ts` and run your TypeORM migration:

```bash
npm run typeorm migration:run
```

See [Getting started](docs/getting-started.md) for host-app setup, module wiring, and a full walkthrough.

## What you get

For `nstc generate resource post title:string body:text`:

```text
src/resources/posts/
  posts.module.ts
  posts.controller.ts
  posts.service.ts
  entities/post.entity.ts
  dto/create-post.dto.ts
  dto/update-post.dto.ts
src/migrations/<timestamp>-CreatePosts.ts
```

The controller exposes standard REST endpoints:

| Method | Path | Action |
|--------|------|--------|
| `POST` | `/posts` | Create |
| `GET` | `/posts` | List all |
| `GET` | `/posts/:id` | Find one |
| `PATCH` | `/posts/:id` | Update |
| `DELETE` | `/posts/:id` | Remove |

Optional flags add Swagger decorators, pagination query params, soft delete, serial integer IDs, and more. See [Generated output](docs/generated-output.md).

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting started](docs/getting-started.md) | Install, prerequisites, first resource, wiring, migrations |
| [Commands](docs/commands.md) | `generate`, `destroy`, `list-types`, flags, and aliases |
| [Fields & types](docs/fields-and-types.md) | Field syntax, supported types, modifiers, reserved names |
| [Configuration](docs/configuration.md) | `.nstcrc.json`, `package.json` defaults, precedence |
| [Generated output](docs/generated-output.md) | File layout, REST API, entity/DTO/migration details |
| [Troubleshooting](docs/troubleshooting.md) | Shell globbing, UUID setup, entity registration, `--wire` |

Run `nstc --help` or `nstc list-types` at any time for a quick reference.

## Common examples

```bash
# Preview without writing files
nstc generate resource post title:string --dry-run

# Avoid zsh glob issues with optional fields
nstc generate resource post --field title:string --field published?:boolean

# MySQL + Swagger + pagination
nstc generate resource post title:string body:text \
  --db mysql --swagger --pagination

# Relations, unique columns, serial IDs, soft delete
nstc generate resource comment body:text \
  userId:uuid:belongsTo:User \
  --id serial --soft-delete

# Auto-import into app.module.ts (best-effort string edit)
nstc generate resource post title:string --wire src/app.module.ts

# Remove a scaffolded resource
nstc destroy resource post --dry-run
nstc destroy resource post
```

## Host app requirements

```bash
npm install @nestjs/typeorm typeorm class-validator @nestjs/mapped-types
```

Add `@nestjs/swagger` when using `--swagger`:

```bash
npm install @nestjs/swagger
```

## Development

From this repository:

```bash
npm install
npm test
npm run build
npm link   # expose `nstc` globally for local testing
```

Contributors and AI agents: see [AGENTS.md](AGENTS.md) for architecture and conventions.

## License

MIT
