const { Command } = require("commander");
const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");

function registerInstallCommand(program) {
  program
    .command("install")
    .description("Initialize ~/.sle and bootstrap the default profile.")
    .addHelpText("after", attachExamples(["sle install", "sle install --json"]))
    .action((_, command) =>
      notImplemented(command, "install", "Step 2 will implement filesystem bootstrap."),
    );
}

module.exports = {
  registerInstallCommand,
};
