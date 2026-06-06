const { attachExamples } = require("../lib/examples");
const { bootstrapSleHome } = require("../lib/bootstrap");
const { writeResult } = require("../lib/output");

function registerInstallCommand(program) {
  program
    .command("install")
    .description("Initialize ~/.sle and bootstrap the default profile.")
    .addHelpText("after", attachExamples(["sle install", "sle install --json"]))
    .action(async (_, command) => {
      const result = await bootstrapSleHome();
      const createdDirectoryCount = result.created.directories.length;
      const createdFileCount = result.created.files.length;

      return writeResult(
        command,
        {
          ok: true,
          data: {
            sleHome: result.sleHome,
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
              ? `SLE is already initialized at ${result.sleHome}.`
              : `Initialized SLE at ${result.sleHome} with default profile '${result.config.defaultProfile}'.`,
        },
      );
    });
}

module.exports = {
  registerInstallCommand,
};
