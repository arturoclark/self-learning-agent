const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");

function registerHostCommands(program) {
  const host = program.command("host").description("Manage host integrations.");

  host
    .command("install")
    .argument("<host>", "Host integration name.")
    .description("Install host-facing wrappers.")
    .addHelpText("after", attachExamples(["sle host install codex"]))
    .action((hostName, command) => notImplemented(command, "host.install", `Host installation for '${hostName}' will be implemented later.`));

  host
    .command("list")
    .description("List supported host integrations and installation status.")
    .addHelpText("after", attachExamples(["sle host list", "sle host list --json"]))
    .action((_, command) => notImplemented(command, "host.list", "Host status listing will be implemented later."));
}

module.exports = {
  registerHostCommands,
};
