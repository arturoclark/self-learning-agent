const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");
const { validateProfileName } = require("../lib/validation");

function registerSoulCommands(program) {
  const soul = program.command("soul").description("View or edit profile soul files.");

  soul
    .command("view")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Print a profile SOUL.md.")
    .addHelpText("after", attachExamples(["sle soul view", "sle soul view research"]))
    .action((name, command) => notImplemented(command, "soul.view", `SOUL view will be implemented later.${name ? ` Target: ${name}.` : ""}`));

  soul
    .command("edit")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .option("--file <path>", "Read replacement content from a file.")
    .option("--stdin", "Read replacement content from stdin.")
    .description("Replace or update SOUL.md from file input or stdin.")
    .addHelpText("after", attachExamples(["sle soul edit research --file ./SOUL.md", "cat SOUL.md | sle soul edit --stdin"]))
    .action((name, command) => notImplemented(command, "soul.edit", `SOUL edit will be implemented later.${name ? ` Target: ${name}.` : ""}`));
}

function validateOptionalProfileName(value) {
  if (value == null) {
    return value;
  }

  return validateProfileName(value);
}

module.exports = {
  registerSoulCommands,
};
