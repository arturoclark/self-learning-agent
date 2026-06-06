const { attachExamples } = require("../lib/examples");
const { installHost, listHosts } = require("../lib/hosts");
const { writeResult } = require("../lib/output");

function registerHostCommands(program) {
  const host = program.command("host").description("Manage host integrations.");

  host
    .command("install")
    .argument("<host>", "Host integration name.")
    .description("Install host-facing wrappers.")
    .addHelpText("after", attachExamples(["sla host install codex"]))
    .action(async (...args) => {
      const hostName = args[0];
      const command = args.at(-1);
      const result = await installHost(hostName);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        {
          human: `Installed ${result.host} host wrappers at ${result.installPath}.`,
        },
      );
    });

  host
    .command("list")
    .description("List supported host integrations and installation status.")
    .addHelpText("after", attachExamples(["sla host list", "sla host list --json"]))
    .action(async (...args) => {
      const command = args.at(-1);
      const result = await listHosts();
      const human = result.hosts
        .map((entry) =>
          entry.installed
            ? `${entry.host}: installed at ${entry.installPath}`
            : `${entry.host}: available, not installed`,
        )
        .join("\n");

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human },
      );
    });
}

module.exports = {
  registerHostCommands,
};
