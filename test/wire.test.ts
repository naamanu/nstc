import test from 'node:test';
import assert from 'node:assert/strict';
import { wireModuleSource } from '../src/wire.js';

const appModule = `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;

test('wires a generated module into an empty imports array', () => {
  const result = wireModuleSource(appModule, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, true);
  assert.match(result.source, /import { PostModule } from '\.\/resources\/posts\/posts\.module';/);
  assert.match(result.source, /imports: \[PostModule\]/);
});

test('appends to an existing imports array', () => {
  const source = appModule.replace('imports: []', 'imports: [AppService],');
  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.match(result.source, /imports: \[PostModule, AppService\]/);
});

test('skips wiring when module is already imported', () => {
  const source = appModule
    .replace('imports: []', 'imports: [PostModule],')
    .replace(
      "from './app.service';",
      "from './app.service';\nimport { PostModule } from './resources/posts/posts.module';",
    );

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, false);
  assert.equal(result.reason, 'already-present');
});

test('handles nested brackets inside imports', () => {
  const source = `@Module({
  imports: [TypeOrmModule.forRoot({ type: 'postgres' })],
  controllers: [],
})
export class AppModule {}`;

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.match(
    result.source,
    /imports: \[PostModule, TypeOrmModule\.forRoot\(\{ type: 'postgres' \}\)\]/,
  );
});

test('wires when existing imports use a multi-line import block', () => {
  const source = `import {
  Module,
} from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`;

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, true);
  assert.match(result.source, /import { PostModule } from '\.\/resources\/posts\/posts\.module';/);
  assert.match(result.source, /imports: \[PostModule\]/);
  // The new import must land after the multi-line block, not be spliced into it.
  assert.ok(
    result.source.indexOf("from '@nestjs/common'") < result.source.indexOf('PostModule } from'),
  );
});

test('injects an imports array when the module has none', () => {
  const source = `import { Module } from '@nestjs/common';

@Module({
  controllers: [],
})
export class AppModule {}
`;

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, true);
  assert.match(result.source, /imports: \[PostModule\]/);
});

test('tolerates whitespace between @Module( and { when injecting imports', () => {
  const source = `import { Module } from '@nestjs/common';

@Module( {
  controllers: [],
})
export class AppModule {}
`;

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, true);
  assert.match(result.source, /imports: \[PostModule\]/);
});

test('targets the imports array, not a similarly named key', () => {
  const source = `@Module({
  dynamicImports: [SomethingElse],
  imports: [],
})
export class AppModule {}`;

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, true);
  assert.match(result.source, /imports: \[PostModule\]/);
  assert.match(result.source, /dynamicImports: \[SomethingElse\]/);
});

test('does not treat PostModule as already present inside BlogPostModule', () => {
  const source = appModule
    .replace('imports: []', 'imports: [BlogPostModule]')
    .replace(
      "from './app.service';",
      "from './app.service';\nimport { BlogPostModule } from './resources/blog-posts/blog-posts.module';",
    );

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, true);
  assert.match(result.source, /imports: \[PostModule, BlogPostModule\]/);
});

test('refuses to wire (and leaves the file untouched) when there is no @Module', () => {
  const source = `export const value = 42;\n`;

  const result = wireModuleSource(source, {
    moduleName: 'PostModule',
    importPath: './resources/posts/posts.module',
  });

  assert.equal(result.wired, false);
  assert.equal(result.reason, 'unparseable');
  assert.equal(result.source, source);
});
