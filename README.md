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

Optional fields contain `?`, which zsh treats as a glob. Quote them or use `--field`:

```bash
nest-scaffold generate resource post title:string 'published?:boolean'
nest-scaffold generate resource post --field title:string --field published?:boolean
```

Supported types:

```text
string text number int integer float boolean bool date datetime uuid json
```

Field modifiers:

```text
:unique                 Unique column (e.g. email:string:unique)
:belongsTo:Model        Many-to-one relation (e.g. userId:uuid:belongsTo:User)
```

## Options

```text
--field <name:type>     Field definition (repeatable)
--src <dir>             Source directory. Default: src
--resource-dir <dir>    Resource directory under --src. Default: resources
--migration-dir <dir>   Migration directory under --src. Default: migrations
--db <dialect>          Database dialect: postgres, mysql, sqlite. Default: postgres
--id <strategy>         Primary key strategy: uuid, serial. Default: uuid
--string-length <n>     Default varchar length for string fields. Default: 255
--soft-delete           Add deletedAt and use softRemove in the service
--swagger               Add @nestjs/swagger decorators to controller and DTOs
--pagination            Add skip/take query params to findAll
--wire <module.ts>      Import the generated module into a NestJS module file
--dry-run               Print planned files without writing them
--verbose               Print generated file contents
--force                 Overwrite generated files if they already exist
--version, -v           Print version
--help                  Show help
```

## Config

Defaults can live in `.nest-scaffoldrc.json` or in `package.json` under `"nestScaffold"`:

```json
{
  "resourceDir": "features",
  "db": "mysql",
  "stringLength": 120
}
```

CLI flags override config file values.

## Utility commands

```bash
nest-scaffold --version
nest-scaffold list-types
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

MySQL migration with Swagger and pagination:

```bash
nest-scaffold generate resource post title:string body:text \
  --db mysql --swagger --pagination --dry-run
```

Preview file contents and wire into `app.module.ts`:

```bash
nest-scaffold generate resource post title:string \
  --dry-run --verbose --wire src/app.module.ts
```

Remove a scaffolded resource:

```bash
nest-scaffold destroy resource post --dry-run
nest-scaffold destroy resource post
```

Generate with unique fields, relations, serial IDs, and soft delete:

```bash
nest-scaffold generate resource comment body:text \
  postId:uuid:belongsTo:Post \
  --id serial --soft-delete
```

## Host app requirements

The generated files expect a NestJS app with these packages installed:

```bash
npm install @nestjs/typeorm typeorm class-validator @nestjs/mapped-types
```

Add `@nestjs/swagger` when using `--swagger`:

```bash
npm install @nestjs/swagger
```

Generated controllers use `ParseUUIDPipe` for `:id` routes and default `string` columns to `varchar(255)`.
Migrations default to PostgreSQL; use `--db mysql` or `--db sqlite` for other dialects.

If your app does not use TypeORM `autoLoadEntities`, add the generated entity to your TypeORM entity registration.
