const { Command } = require("commander");
const { registerHelpCommand } = require("./help");
const { registerHostCommands } = require("./host");
const { registerInstallCommand } = require("./install");
const { registerMemoryCommands } = require("./memory");
const { registerProfileCommands } = require("./profile");
const { registerSkillCommands } = require("./skill");
const { registerSoulCommands } = require("./soul");
const { registerStatsCommands } = require("./stats");
const { attachExamples } = require("../lib/examples");
const { ensureSchemaReady } = require("../lib/bootstrap");

function buildRootCommand() {
  const program = new Command();

  program
    .name("sla")
    .description("Profile-scoped memory and skills CLI for agents.")
    .helpCommand(false)
    .showHelpAfterError("(use --help for usage)")
    .showSuggestionAfterError()
    .option("--json", "Emit machine-readable JSON output.")
    .hook("preAction", async (command) => {
      const opts = command.optsWithGlobals();
      if (opts.json) {
        command.configureOutput({
          writeOut: (str) => process.stdout.write(str),
          writeErr: (str) => process.stderr.write(str),
          outputError: (str, write) => write(str),
        });
      }

      await ensureSchemaReady();
    })
    .addHelpText(
      "after",
      attachExamples([
        "sla install",
        "sla profile list",
        "sla help skill create",
        "sla memory add default --target memory --entry \"The API runs in us-east-1\"",
      ]),
    )
    .action(() => {
      program.outputHelp();
    });

  registerInstallCommand(program);
  registerProfileCommands(program);
  registerSoulCommands(program);
  registerMemoryCommands(program);
  registerSkillCommands(program);
  registerStatsCommands(program);
  registerHostCommands(program);
  registerHelpCommand(program);

  program.configureOutput({
    outputError: (str, write) => write(str),
  });

  program.exitOverride((error) => {
    if (error.code === "commander.helpDisplayed") {
      return;
    }

    throw error;
  });

  return program;
}

module.exports = {
  buildRootCommand,
};
