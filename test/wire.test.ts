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
