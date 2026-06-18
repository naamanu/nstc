# Getting started

This guide walks through installing `nstc`, scaffolding your first resource in a NestJS app, wiring it up, and running the generated migration.

## Prerequisites

### Node.js

`nstc` requires **Node.js 20 or later**.

### Host NestJS app

Your app should already have NestJS and TypeORM configured. At minimum, install:

```bash
npm install @nestjs/typeorm typeorm class-validator @nestjs/mapped-types
```

If you plan to use `--swagger`:

```bash
npm install @nestjs/swagger
```

Your `app.module.ts` should import `TypeOrmModule.forRoot(...)` with a working database connection. `nstc` does not set up TypeORM for you — it only generates resource files that assume TypeORM is already in place.

## Install nstc

### From npm (when published)

```bash
npm install -g nstc
```

### From source (development)

```bash
git clone https://github.com/naamanu/nstc.git
cd nstc
npm install
npm run build
npm link
```

Verify the install:

```bash
nstc --version
nstc --help
```

## Scaffold your first resource

From your NestJS app root, preview what will be generated:

```bash
nstc generate resource post title:string body:text published?:boolean --dry-run
```

When you're ready, generate the files:

```bash
nstc generate resource post title:string body:text published?:boolean
```

You'll see output listing created files and next steps:

```text
Created 7 files for Post:
  - src/resources/posts/posts.module.ts
  - src/resources/posts/posts.controller.ts
  ...
Next steps:
  1. Import PostModule from './src/resources/posts/posts.module'.
  2. Add PostModule to your root or feature module imports array.
  3. Ensure Post is included in your TypeORM entity registration if your app does not auto-load entities.
```

## Wire the module

### Manual wiring

Open `src/app.module.ts` (or your feature module) and add the generated module:

```typescript
import { PostModule } from './resources/posts/posts.module';

@Module({
  imports: [
    // ...existing imports
    PostModule,
  ],
})
export class AppModule {}
```

Adjust the import path if you used `--src` or `--resource-dir`.

### Automatic wiring with `--wire`

`nstc` can insert the import and module entry for you:

```bash
nstc generate resource post title:string body:text \
  --wire src/app.module.ts
```

This is a best-effort string edit, not an AST transform. Review the diff before committing. See [Troubleshooting](troubleshooting.md#module-wiring-with---wire) for known limitations.

## Run the migration

`nstc` generates a TypeORM migration but does **not** run it. Use your app's migration workflow:

```bash
# Example — adjust to match your project's scripts
npm run typeorm migration:run
```

The migration file is named `<timestamp>-CreatePosts.ts` and lives under `src/migrations/` by default.

### PostgreSQL UUID note

UUID primary keys default to `uuid_generate_v4()` in PostgreSQL migrations. Ensure the `uuid-ossp` extension is enabled, or switch to `--id serial` for auto-increment integer IDs. See [Troubleshooting](troubleshooting.md#postgresql-uuid-primary-keys).

## Entity registration

If your TypeORM config uses `autoLoadEntities: true`, generated entities are picked up automatically via `TypeOrmModule.forFeature` in the resource module.

If not, add the entity class to your TypeORM entity list manually.

## Project defaults with config

If you always generate into a custom directory or use MySQL, create `.nstcrc.json` in your app root:

```json
{
  "resourceDir": "features",
  "db": "mysql",
  "swagger": true
}
```

CLI flags override config file values. See [Configuration](configuration.md) for all keys.

## Next steps

- [Commands](commands.md) — full flag reference and `destroy`
- [Fields & types](fields-and-types.md) — relations, unique columns, optional fields
- [Generated output](generated-output.md) — what each file contains
