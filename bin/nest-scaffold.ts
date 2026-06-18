#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli(process.argv.slice(2)).catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
