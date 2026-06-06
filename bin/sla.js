#!/usr/bin/env node

const { run } = require("../src/cli");

run(process.argv).catch((error) => {
  const exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
  const message = error?.stack || error?.message || String(error);
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
});
