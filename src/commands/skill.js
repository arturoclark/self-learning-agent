const { attachExamples } = require("../lib/examples");
const { writeResult } = require("../lib/output");
const {
  createSkill,
  deleteSkill,
  editSkill,
  listSkills,
  removeSkillFile,
  viewSkill,
  writeSkillFile,
} = require("../lib/skills");
const { validateProfileName, validateRelativeManagedPath, validateSkillName, validateSkillSubdir } = require("../lib/validation");

function registerSkillCommands(program) {
  const skill = program.command("skill").description("Manage skills within a profile.");

  skill
    .command("list")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("List skills for a profile.")
    .addHelpText("after", attachExamples(["sle skill list", "sle skill list research --json"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await listSkills(name);
      const human =
        result.skills.length === 0
          ? "No skills found."
          : result.skills.map((entry) => `${entry.skill}: ${entry.description}`).join("\n");

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human },
      );
    });

  skill
    .command("view")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Show a skill SKILL.md.")
    .addHelpText("after", attachExamples(["sle skill view deploy", "sle skill view deploy research"]))
    .action(async (...args) => {
      const skillName = args[0];
      const name = args[1];
      const command = args.at(-1);
      const result = await viewSkill(skillName, name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: result.raw.trimEnd() },
      );
    });

  skill
    .command("create")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Create a new skill.")
    .addHelpText("after", attachExamples(["sle skill create deploy", "sle skill create deploy research"]))
    .action(async (...args) => {
      const skillName = args[0];
      const name = args[1];
      const command = args.at(-1);
      const result = await createSkill(skillName, name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Created skill '${result.skill}' for profile '${result.profile}'.` },
      );
    });

  skill
    .command("edit")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .option("--file <path>", "Read replacement content from a file.")
    .option("--stdin", "Read replacement content from stdin.")
    .description("Replace or update a SKILL.md.")
    .addHelpText("after", attachExamples(["sle skill edit deploy research --file ./SKILL.md", "cat SKILL.md | sle skill edit deploy --stdin"]))
    .action(async (...args) => {
      const skillName = args[0];
      const name = args[1];
      const options = args[2];
      const command = args.at(-1);
      const result = await editSkill(skillName, name, options);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Updated SKILL.md for '${result.skill}' in profile '${result.profile}'.` },
      );
    });

  skill
    .command("delete")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--yes", "Confirm permanent deletion.")
    .description("Delete a skill.")
    .addHelpText("after", attachExamples(["sle skill delete deploy research --yes"]))
    .action(async (...args) => {
      const skillName = args[0];
      const name = args[1];
      const command = args.at(-1);
      const result = await deleteSkill(skillName, name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Deleted skill '${result.deletedSkill}' from profile '${result.profile}'.` },
      );
    });

  skill
    .command("write-file")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--subdir <name>", "Managed skill subdirectory.", validateSkillSubdir)
    .requiredOption("--path <relativePath>", "Relative path inside the managed subdirectory.", validateRelativeManagedPath)
    .option("--file <path>", "Read file content from a file.")
    .option("--stdin", "Read file content from stdin.")
    .description("Write a managed skill support file.")
    .addHelpText("after", attachExamples(["sle skill write-file deploy research --subdir scripts --path check.sh --file ./check.sh", "cat check.sh | sle skill write-file deploy --subdir scripts --path check.sh --stdin"]))
    .action(async (...args) => {
      const skillName = args[0];
      const name = args[1];
      const options = args[2];
      const command = args.at(-1);
      const result = await writeSkillFile(skillName, name, options);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Wrote ${result.path} for skill '${result.skill}' in profile '${result.profile}'.` },
      );
    });

  skill
    .command("remove-file")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--path <relativePath>", "Relative path inside the skill directory.", validateRelativeManagedPath)
    .requiredOption("--yes", "Confirm permanent deletion.")
    .description("Remove a managed skill support file.")
    .addHelpText("after", attachExamples(["sle skill remove-file deploy research --path scripts/check.sh --yes"]))
    .action(async (...args) => {
      const skillName = args[0];
      const name = args[1];
      const options = args[2];
      const command = args.at(-1);
      const result = await removeSkillFile(skillName, name, options.path);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: `Removed ${result.path} from skill '${result.skill}' in profile '${result.profile}'.` },
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
  registerSkillCommands,
};
