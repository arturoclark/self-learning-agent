const { attachExamples } = require("../lib/examples");
const { bootstrapSlaHome } = require("../lib/bootstrap");
const { writeResult } = require("../lib/output");

function registerInstallCommand(program) {
  program
    .command("install")
    .description("Initialize ~/.sla and bootstrap the default profile.")
    .addHelpText("after", attachExamples(["sla install", "sla install --json"]))
    .action(async (_, command) => {
      const result = await bootstrapSlaHome();
      const createdDirectoryCount = result.created.directories.length;
      const createdFileCount = result.created.files.length;

      return writeResult(
        command,
        {
          ok: true,
          data: {
            slaHome: result.slaHome,
            configPath: result.configPath,
            defaultProfile: result.config.defaultProfile,
            profilePath: result.profilePath,
            schemaVersion: result.config.schemaVersion,
            created: result.created,
          },
        },
        {
          human:
            createdDirectoryCount === 0 && createdFileCount === 0
              ? `SLA is already initialized at ${result.slaHome}.`
              : `Initialized SLA at ${result.slaHome} with default profile '${result.config.defaultProfile}'.`,
        },
      );
    });
}

module.exports = {
  registerInstallCommand,
};
