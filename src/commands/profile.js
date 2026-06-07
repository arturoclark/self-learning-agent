const { attachExamples } = require("../lib/examples");
const { classifyProfileKnowledge, getProfileContext } = require("../lib/profile-context");
const { writeResult } = require("../lib/output");
const {
  createProfile,
  deleteProfile,
  getDefaultProfile,
  listProfiles,
  resolveExistingProfile,
  setDefaultProfile,
} = require("../lib/profiles");
const { notImplemented } = require("../lib/not-implemented");
const { validateProfileName } = require("../lib/validation");

function registerProfileCommands(program) {
  const profile = program.command("profile").description("Manage profiles.");
  profile.addHelpText("after", "\nRename is intentionally not implemented in v1.\n");

  profile
    .command("create")
    .argument("<name>", "Profile name.", validateProfileName)
    .description("Create a named profile.")
    .addHelpText("after", attachExamples(["sla profile create research"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await createProfile(name);

      return writeResult(
        command,
        {
          ok: true,
          data: {
            profile: result.name,
            profilePath: result.path,
            created: result.created,
          },
        },
        {
          human: `Created profile '${result.name}' at ${result.path}.`,
        },
      );
    });

  profile
    .command("update")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Update metadata or scaffolded files for a profile.")
    .addHelpText("after", attachExamples(["sla profile update", "sla profile update research"]))
    .action((...args) =>
      notImplemented(
        args.at(-1),
        "profile.update",
        `Profile update is planned for a later step.${args[0] ? ` Target: ${args[0]}.` : ""}`,
      ),
    );

  profile
    .command("delete")
    .argument("<name>", "Profile name.", validateProfileName)
    .requiredOption("--yes", "Confirm permanent deletion.")
    .description("Delete a named profile.")
    .addHelpText("after", attachExamples(["sla profile delete research --yes"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await deleteProfile(name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        {
          human: `Deleted profile '${result.deletedProfile}'.`,
        },
      );
    });

  profile
    .command("list")
    .description("List profiles and indicate the default.")
    .addHelpText("after", attachExamples(["sla profile list", "sla profile list --json"]))
    .action(async (...args) => {
      const command = args.at(-1);
      const result = await listProfiles();
      const human =
        result.profiles.length === 0
          ? "No profiles found."
          : result.profiles
              .map((profileEntry) =>
                `${profileEntry.name}${profileEntry.isDefault ? " (default)" : ""}: ${profileEntry.path}`,
              )
              .join("\n");

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human },
      );
    });

  profile
    .command("dir")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Print the absolute path for a profile.")
    .addHelpText("after", attachExamples(["sla profile dir", "sla profile dir research"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await resolveExistingProfile(name);

      return writeResult(
        command,
        {
          ok: true,
          data: {
            profile: result.profileName,
            profilePath: result.profilePath,
          },
        },
        {
          human: result.profilePath,
        },
      );
    });

  profile
    .command("context")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Return the canonical agent bootstrap context for a profile.")
    .addHelpText("after", attachExamples(["sla profile context", "sla profile context research --json"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await getProfileContext(name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        {
          human: result.renderedContext.trimEnd(),
        },
      );
    });

  profile
    .command("classify")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .option("--file <path>", "Read candidate content from a file.")
    .option("--stdin", "Read candidate content from stdin.")
    .description("Classify candidate knowledge as memory, user, skill, or none.")
    .addHelpText("after", attachExamples(["sla profile classify research --stdin", "sla profile classify --file ./note.md --json"]))
    .action(async (...args) => {
      const name = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await classifyProfileKnowledge(name, options);
      const recommendation =
        result.classification === "skill"
          ? `skill:${result.recommendedSkillName}`
          : result.recommendedTarget || "none";

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        {
          human: `${result.classification}: ${result.rationale}\nRecommendation: ${recommendation}`,
        },
      );
    });

  profile
    .command("set-default")
    .argument("<name>", "Profile name.", validateProfileName)
    .description("Set the default profile.")
    .addHelpText("after", attachExamples(["sla profile set-default research"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await setDefaultProfile(name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        {
          human: `Default profile is now '${result.defaultProfile}'.`,
        },
      );
    });

  profile
    .command("get-default")
    .description("Print the default profile name.")
    .addHelpText("after", attachExamples(["sla profile get-default"]))
    .action(async (...args) => {
      const command = args.at(-1);
      const defaultProfile = await getDefaultProfile();

      return writeResult(
        command,
        {
          ok: true,
          data: {
            defaultProfile,
          },
        },
        {
          human: defaultProfile,
        },
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
  registerProfileCommands,
};
