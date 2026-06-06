const { attachExamples } = require("../lib/examples");
const {
  addMemoryEntry,
  listMemoryEntries,
  removeMemoryEntry,
  replaceMemoryEntry,
  viewMemoryTarget,
} = require("../lib/memory");
const { writeResult } = require("../lib/output");
const { validateMemoryTarget, validateProfileName } = require("../lib/validation");

function registerMemoryCommands(program) {
  const memory = program.command("memory").description("Manage built-in memory stores.");

  memory
    .command("list")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("List memory entries across built-in memory stores.")
    .addHelpText("after", attachExamples(["sla memory list", "sla memory list research --json"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await listMemoryEntries(name);
      const human = result.targets
        .map(
          ({ target, entryCount, entries }) =>
            `${target} (${entryCount})${entries.length ? `\n${entries.map((entry) => `- ${entry}`).join("\n")}` : "\n(no entries)"}`,
        )
        .join("\n\n");

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human },
      );
    });

  memory
    .command("add")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .requiredOption("--entry <text>", "Entry text to add.")
    .description("Add a new memory entry.")
    .addHelpText("after", attachExamples(["sla memory add research --target memory --entry \"Postgres runs locally\""]))
    .action(async (...args) => {
      const name = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await addMemoryEntry(name, options.target, options.entry);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Added entry to ${result.target} for profile '${result.profile}'.` },
      );
    });

  memory
    .command("replace")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .requiredOption("--match <text>", "Entry text to replace.")
    .requiredOption("--entry <text>", "Replacement entry text.")
    .description("Replace a matching memory entry.")
    .addHelpText("after", attachExamples(["sla memory replace research --target user --match \"Prefers Vim\" --entry \"Prefers Helix\""]))
    .action(async (...args) => {
      const name = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await replaceMemoryEntry(name, options.target, options.match, options.entry);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Replaced entry in ${result.target} for profile '${result.profile}'.` },
      );
    });

  memory
    .command("remove")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .requiredOption("--match <text>", "Entry text to remove.")
    .description("Remove a matching memory entry.")
    .addHelpText("after", attachExamples(["sla memory remove research --target memory --match \"Old endpoint\""]))
    .action(async (...args) => {
      const name = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await removeMemoryEntry(name, options.target, options.match);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Removed entry from ${result.target} for profile '${result.profile}'.` },
      );
    });

  memory
    .command("view")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--target <target>", "Memory target: memory or user.", validateMemoryTarget)
    .description("Print raw or parsed contents for a memory target.")
    .addHelpText("after", attachExamples(["sla memory view research --target memory"]))
    .action(async (...args) => {
      const name = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await viewMemoryTarget(name, options.target);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: result.raw.trimEnd() },
      );
    });
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
