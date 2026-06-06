const { attachExamples } = require("../lib/examples");
const { writeResult } = require("../lib/output");
const { editSoul, viewSoul } = require("../lib/soul");
const { validateProfileName } = require("../lib/validation");

function registerSoulCommands(program) {
  const soul = program.command("soul").description("View or edit profile soul files.");

  soul
    .command("view")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Print a profile SOUL.md.")
    .addHelpText("after", attachExamples(["sle soul view", "sle soul view research"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await viewSoul(name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: result.raw.trimEnd() },
      );
    });

  soul
    .command("edit")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .option("--file <path>", "Read replacement content from a file.")
    .option("--stdin", "Read replacement content from stdin.")
    .description("Replace or update SOUL.md from file input or stdin.")
    .addHelpText("after", attachExamples(["sle soul edit research --file ./SOUL.md", "cat SOUL.md | sle soul edit --stdin"]))
    .action(async (...args) => {
      const name = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await editSoul(name, options);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Updated SOUL.md for profile '${result.profile}'.` },
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
  registerSoulCommands,
};
