# nest-scaffolder

Rails-like resource scaffolding for NestJS APIs that use TypeORM.

```bash
nest-scaffold generate resource post title:string body:text published?:boolean
```

The command creates a NestJS module, controller, service, DTOs, TypeORM entity, and a timestamped migration. It creates files only and prints the module wiring steps after generation.

## Local use

From this package directory:

```bash
npm link
```

From a NestJS app:

```bash
nest-scaffold generate resource post title:string body:text published?:boolean
```

## Generated layout

By default, a `post` resource is generated as:

```text
src/resources/posts/posts.module.ts
src/resources/posts/posts.controller.ts
src/resources/posts/posts.service.ts
src/resources/posts/entities/post.entity.ts
src/resources/posts/dto/create-post.dto.ts
src/resources/posts/dto/update-post.dto.ts
src/migrations/<timestamp>-CreatePosts.ts
```

## Field syntax

Use `name:type` for required fields and `name?:type` for optional fields.

Supported types:

```text
string text number int integer float boolean bool date datetime uuid json
```

## Options

```text
--src <dir>             Source directory. Default: src
--resource-dir <dir>    Resource directory under --src. Default: resources
--migration-dir <dir>   Migration directory under --src. Default: migrations
--dry-run               Print planned files without writing them
--force                 Overwrite generated files if they already exist
--help                  Show help
```

## Examples

Preview generated files:

```bash
nest-scaffold generate resource post title:string body:text published?:boolean --dry-run
```

Generate into a custom feature directory:

```bash
nest-scaffold g scaffold user email:string admin?:boolean --resource-dir features
```

## Host app requirements

The generated files expect a NestJS app with these packages installed:

```bash
npm install @nestjs/typeorm typeorm class-validator @nestjs/mapped-types
```

If your app does not use TypeORM `autoLoadEntities`, add the generated entity to your TypeORM entity registration.
