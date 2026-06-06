const { Command } = require("commander");
const { buildRootCommand } = require("./commands/root");
const { formatError } = require("./lib/output");

async function run(argv = process.argv) {
  const program = buildRootCommand();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const rendered = formatError(error, program);
    const target = rendered.stream === "stdout" ? process.stdout : process.stderr;
    target.write(`${rendered.body}\n`);
    process.exitCode = rendered.exitCode;
  }
}

module.exports = {
  Command,
  run,
};
