const { Command } = require("commander");
const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");
const { validateProfileName } = require("../lib/validation");

function registerProfileCommands(program) {
  const profile = program.command("profile").description("Manage profiles.");

  profile
    .command("create")
    .argument("<name>", "Profile name.", validateProfileName)
    .description("Create a named profile.")
    .addHelpText("after", attachExamples(["sle profile create research"]))
    .action((name, command) => notImplemented(command, "profile.create", `Profile '${name}' creation will be implemented in Step 3.`));

  profile
    .command("update")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Update metadata or scaffolded files for a profile.")
    .addHelpText("after", attachExamples(["sle profile update", "sle profile update research"]))
    .action((name, command) => notImplemented(command, "profile.update", `Profile update is planned for Step 3.${name ? ` Target: ${name}.` : ""}`));

  profile
    .command("delete")
    .argument("<name>", "Profile name.", validateProfileName)
    .requiredOption("--yes", "Confirm permanent deletion.")
    .description("Delete a named profile.")
    .addHelpText("after", attachExamples(["sle profile delete research --yes"]))
    .action((name, command) => notImplemented(command, "profile.delete", `Profile '${name}' deletion will be implemented in Step 3.`));

  profile
    .command("list")
    .description("List profiles and indicate the default.")
    .addHelpText("after", attachExamples(["sle profile list", "sle profile list --json"]))
    .action((_, command) => notImplemented(command, "profile.list", "Profile listing will be implemented in Step 3."));

  profile
    .command("dir")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Print the absolute path for a profile.")
    .addHelpText("after", attachExamples(["sle profile dir", "sle profile dir research"]))
    .action((name, command) => notImplemented(command, "profile.dir", `Profile directory lookup will be implemented in Step 3.${name ? ` Target: ${name}.` : ""}`));

  profile
    .command("set-default")
    .argument("<name>", "Profile name.", validateProfileName)
    .description("Set the default profile.")
    .addHelpText("after", attachExamples(["sle profile set-default research"]))
    .action((name, command) => notImplemented(command, "profile.set-default", `Default profile switching for '${name}' will be implemented in Step 3.`));

  profile
    .command("get-default")
    .description("Print the default profile name.")
    .addHelpText("after", attachExamples(["sle profile get-default"]))
    .action((_, command) => notImplemented(command, "profile.get-default", "Default profile lookup will be implemented in Step 3."));
}

function validateOptionalProfileName(value) {
  if (value == null) {
    return value;
  }

  return validateProfileName(value);
}

module.exports = {
  registerProfileCommands,
};
