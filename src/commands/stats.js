const { attachExamples } = require("../lib/examples");
const { writeResult } = require("../lib/output");
const { getGlobalStats, getProfileStats } = require("../lib/stats");
const { validateProfileName } = require("../lib/validation");

function registerStatsCommands(program) {
  const stats = program.command("stats").description("Show global or profile metrics.");

  stats
    .description("Show global metrics across profiles.")
    .addHelpText("after", attachExamples(["sle stats", "sle stats --json"]))
    .action(async (...args) => {
      const command = args.at(-1);
      const result = await getGlobalStats();

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: formatGlobalStats(result) },
      );
    });

  stats
    .command("profile")
    .argument("[name]", "Profile name.", validateOptionalProfileName)
    .description("Show detailed metrics for one profile.")
    .addHelpText("after", attachExamples(["sle stats profile", "sle stats profile research"]))
    .action(async (...args) => {
      const name = args[0];
      const command = args.at(-1);
      const result = await getProfileStats(name);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human: formatProfileStats(result) },
      );
    });
}

function formatGlobalStats(result) {
  const lines = [
    `Profiles: ${result.profileCount}`,
    `Default: ${result.defaultProfile}`,
    `Total memories: ${result.totalMemories}`,
    `Total skills: ${result.totalSkills}`,
  ];

  if (result.latestActivity) {
    lines.push(`Latest activity: ${formatActivity(result.latestActivity)}`);
  } else {
    lines.push("Latest activity: none");
  }

  return lines.join("\n");
}

function formatProfileStats(result) {
  const lines = [
    `Profile: ${result.profile}`,
    `Soul updated: ${result.soul.modifiedAt ?? "unknown"}`,
    `Memories: memory=${result.memories.memory.entryCount}, user=${result.memories.user.entryCount}, total=${result.memories.totalEntries}`,
    `Skills: ${result.skills.count}`,
    `Last memory: ${result.memories.lastModified ? formatActivity(result.memories.lastModified) : "none"}`,
    `Last skill: ${result.skills.lastModified ? formatActivity(result.skills.lastModified) : "none"}`,
    `Last activity: ${result.lastActivity ? formatActivity(result.lastActivity) : "none"}`,
  ];

  return lines.join("\n");
}

function formatActivity(activity) {
  const scope = activity.profile ? `${activity.profile}: ` : "";
  return `${scope}${activity.label} @ ${activity.at}`;
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
