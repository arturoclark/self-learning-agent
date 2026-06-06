const { attachExamples } = require("../lib/examples");
const { notImplemented } = require("../lib/not-implemented");
const { validateProfileName, validateRelativeManagedPath, validateSkillName, validateSkillSubdir } = require("../lib/validation");

function registerSkillCommands(program) {
  const skill = program.command("skill").description("Manage skills within a profile.");

  skill
    .command("list")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("List skills for a profile.")
    .addHelpText("after", attachExamples(["sle skill list", "sle skill list research --json"]))
    .action((name, command) => notImplemented(command, "skill.list", `Skill listing will be implemented later.${name ? ` Target: ${name}.` : ""}`));

  skill
    .command("view")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Show a skill SKILL.md.")
    .addHelpText("after", attachExamples(["sle skill view deploy", "sle skill view deploy research"]))
    .action((skillName, name, command) => notImplemented(command, "skill.view", `Skill view will be implemented later. Skill: ${skillName}.${name ? ` Profile: ${name}.` : ""}`));

  skill
    .command("create")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Create a new skill.")
    .addHelpText("after", attachExamples(["sle skill create deploy", "sle skill create deploy research"]))
    .action((skillName, name, command) => notImplemented(command, "skill.create", `Skill creation will be implemented later. Skill: ${skillName}.${name ? ` Profile: ${name}.` : ""}`));

  skill
    .command("edit")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .option("--file <path>", "Read replacement content from a file.")
    .option("--stdin", "Read replacement content from stdin.")
    .description("Replace or update a SKILL.md.")
    .addHelpText("after", attachExamples(["sle skill edit deploy research --file ./SKILL.md", "cat SKILL.md | sle skill edit deploy --stdin"]))
    .action((skillName, name, command) => notImplemented(command, "skill.edit", `Skill edit will be implemented later. Skill: ${skillName}.${name ? ` Profile: ${name}.` : ""}`));

  skill
    .command("delete")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--yes", "Confirm permanent deletion.")
    .description("Delete a skill.")
    .addHelpText("after", attachExamples(["sle skill delete deploy research --yes"]))
    .action((skillName, name, command) => notImplemented(command, "skill.delete", `Skill delete will be implemented later. Skill: ${skillName}.${name ? ` Profile: ${name}.` : ""}`));

  skill
    .command("write-file")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--subdir <name>", "Managed skill subdirectory.", validateSkillSubdir)
    .requiredOption("--path <relativePath>", "Relative path inside the managed subdirectory.", validateRelativeManagedPath)
    .description("Write a managed skill support file.")
    .addHelpText("after", attachExamples(["sle skill write-file deploy research --subdir scripts --path check.sh"]))
    .action((skillName, name, command) => notImplemented(command, "skill.write-file", `Skill support file write will be implemented later. Skill: ${skillName}.${name ? ` Profile: ${name}.` : ""}`));

  skill
    .command("remove-file")
    .argument("<skill>", "Skill name.", validateSkillName)
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .requiredOption("--path <relativePath>", "Relative path inside the skill directory.", validateRelativeManagedPath)
    .requiredOption("--yes", "Confirm permanent deletion.")
    .description("Remove a managed skill support file.")
    .addHelpText("after", attachExamples(["sle skill remove-file deploy research --path scripts/check.sh --yes"]))
    .action((skillName, name, command) => notImplemented(command, "skill.remove-file", `Skill support file removal will be implemented later. Skill: ${skillName}.${name ? ` Profile: ${name}.` : ""}`));
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
