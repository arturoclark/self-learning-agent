const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");
const { validateMemoryTarget, validateProfileName } = require("../lib/validation");

function registerMemoryCommands(program) {
  const memory = program.command("memory").description("Manage built-in memory stores.");

  memory
    .command("list")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("List memory entries across built-in memory stores.")
    .addHelpText("after", attachExamples(["sle memory list", "sle memory list research --json"]))
    .action((name, command) => notImplemented(command, "memory.list", `Memory listing will be implemented later.${name ? ` Target: ${name}.` : ""}`));

  memory
    .command("add")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .requiredOption("--entry <text>", "Entry text to add.")
    .description("Add a new memory entry.")
    .addHelpText("after", attachExamples(["sle memory add research --target memory --entry \"Postgres runs locally\""]))
    .action((name, command) => notImplemented(command, "memory.add", `Memory add will be implemented later.${name ? ` Target: ${name}.` : ""}`));

  memory
    .command("replace")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .requiredOption("--match <text>", "Entry text to replace.")
    .requiredOption("--entry <text>", "Replacement entry text.")
    .description("Replace a matching memory entry.")
    .addHelpText("after", attachExamples(["sle memory replace research --target user --match \"Prefers Vim\" --entry \"Prefers Helix\""]))
    .action((name, command) => notImplemented(command, "memory.replace", `Memory replace will be implemented later.${name ? ` Target: ${name}.` : ""}`));

  memory
    .command("remove")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .requiredOption("--match <text>", "Entry text to remove.")
    .description("Remove a matching memory entry.")
    .addHelpText("after", attachExamples(["sle memory remove research --target memory --match \"Old endpoint\""]))
    .action((name, command) => notImplemented(command, "memory.remove", `Memory remove will be implemented later.${name ? ` Target: ${name}.` : ""}`));

  memory
    .command("view")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .description("Print raw or parsed contents for a memory target.")
    .addHelpText("after", attachExamples(["sle memory view research --target memory"]))
    .action((name, command) => notImplemented(command, "memory.view", `Memory view will be implemented later.${name ? ` Target: ${name}.` : ""}`));
}

function validateOptionalProfileName(value) {
  if (value == null) {
    return value;
  }

  return validateProfileName(value);
}

module.exports = {
  registerMemoryCommands,
};
