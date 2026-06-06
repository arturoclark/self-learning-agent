const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");
const { validateProfileName } = require("../lib/validation");

function registerStatsCommands(program) {
  const stats = program.command("stats").description("Show global or profile metrics.");

  stats
    .description("Show global metrics across profiles.")
    .addHelpText("after", attachExamples(["sle stats", "sle stats --json"]))
    .action((_, command) => notImplemented(command, "stats", "Stats will be implemented later."));

  stats
    .command("profile")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Show detailed metrics for one profile.")
    .addHelpText("after", attachExamples(["sle stats profile", "sle stats profile research"]))
    .action((name, command) => notImplemented(command, "stats.profile", `Profile stats will be implemented later.${name ? ` Target: ${name}.` : ""}`));
}

function validateOptionalProfileName(value) {
  if (value == null) {
    return value;
  }

  return validateProfileName(value);
}

module.exports = {
  registerStatsCommands,
};
