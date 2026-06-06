const { SLAError } = require("../lib/errors");

function registerHelpCommand(program) {
  program
    .command("help")
    .argument("[command...]", "Command path to show help for.")
    .description("Show top-level help or focused help for a command path.")
    .action((commandPath) => {
      const target = resolveCommand(program, commandPath || []);
      if (!target) {
        throw new SLAError("Unknown command path.", {
          code: "UNKNOWN_COMMAND",
          exitCode: 2,
          details: { commandPath },
        });
      }

      target.outputHelp();
    });
}

function resolveCommand(root, commandPath) {
  let current = root;

  for (const segment of commandPath) {
    const next = current.commands.find((command) => command.name() === segment);
    if (!next) {
      return null;
    }
    current = next;
  }

  return current;
}

module.exports = {
  registerHelpCommand,
};
