const fs = require("node:fs/promises");
const { SLAError } = require("./errors");
const { getProfilePath, getSoulPath } = require("./paths");
const { resolveExistingProfile } = require("./profiles");
const { listMemoryEntries } = require("./memory");
const { listSkills } = require("./skills");

async function getProfileContext(requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const [soulRaw, memorySummary, skillSummary] = await Promise.all([
    fs.readFile(getSoulPath(profileName), "utf8"),
    listMemoryEntries(profileName),
    listSkills(profileName),
  ]);

  const memoryTarget = memorySummary.targets.find((entry) => entry.target === "memory");
  const userTarget = memorySummary.targets.find((entry) => entry.target === "user");
  const renderedContext = renderProfileContext({
    profile: profileName,
    soulRaw,
    memoryEntries: memoryTarget?.entries || [],
    userEntries: userTarget?.entries || [],
    skills: skillSummary.skills,
  });

  return {
    profile: profileName,
    profilePath: getProfilePath(profileName),
    soul: {
      path: getSoulPath(profileName),
      raw: soulRaw,
    },
    memories: {
      memory: {
        entryCount: memoryTarget?.entryCount || 0,
        entries: memoryTarget?.entries || [],
      },
      user: {
        entryCount: userTarget?.entryCount || 0,
        entries: userTarget?.entries || [],
      },
      totalEntries: (memoryTarget?.entryCount || 0) + (userTarget?.entryCount || 0),
    },
    skills: {
      count: skillSummary.skills.length,
      index: skillSummary.skills,
    },
    renderedContext,
  };
}

async function classifyProfileKnowledge(requestedName, options) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const source = resolveContentSource(options, "INVALID_PROFILE_CLASSIFY_INPUT");
  const raw = normalizeDocumentContent(
    await readContentSource(source),
    "Profile classification content may not be empty.",
    "INVALID_PROFILE_CLASSIFY_CONTENT",
  );
  const classification = classifyKnowledge(raw);

  return {
    profile: profileName,
    source: source.type,
    input: raw,
    classification: classification.kind,
    rationale: classification.rationale,
    recommendedTarget: classification.recommendedTarget,
    recommendedSkillName: classification.recommendedSkillName,
  };
}

function renderProfileContext({ profile, soulRaw, memoryEntries, userEntries, skills }) {
  return [
    `# Profile Context: ${profile}`,
    "",
    "## SOUL",
    "",
    soulRaw.trim() || "(empty)",
    "",
    "## MEMORY",
    "",
    renderEntryBlock(memoryEntries),
    "",
    "## USER",
    "",
    renderEntryBlock(userEntries),
    "",
    "## SKILL INDEX",
    "",
    renderSkillIndex(skills),
    "",
  ].join("\n");
}

function renderEntryBlock(entries) {
  if (entries.length === 0) {
    return "(no entries)";
  }

  return entries.map((entry) => `- ${entry.replaceAll("\n", "\n  ")}`).join("\n");
}

function renderSkillIndex(skills) {
  if (skills.length === 0) {
    return "(no skills)";
  }

  return skills
    .map((skill) => {
      const usageSummary = formatSkillUsage(skill.usage);
      return `- ${skill.skill}: ${skill.description}${usageSummary ? ` [${usageSummary}]` : ""}`;
    })
    .join("\n");
}

function formatSkillUsage(usage) {
  if (!usage) {
    return "";
  }

  const parts = [];
  if (usage.useCount > 0) {
    parts.push(`used ${usage.useCount}x`);
  }
  if (usage.viewCount > 0) {
    parts.push(`viewed ${usage.viewCount}x`);
  }
  if (usage.editCount > 0) {
    parts.push(`edited ${usage.editCount}x`);
  }
  return parts.join(", ");
}

function classifyKnowledge(raw) {
  const normalized = raw.trim();
  const collapsed = normalized.replaceAll("\r\n", "\n");
  const lower = collapsed.toLowerCase();
  const lines = collapsed.split("\n").map((line) => line.trim()).filter(Boolean);

  if (isEphemeral(lower)) {
    return {
      kind: "none",
      rationale: "The content looks turn-local, temporary, or task-tracking oriented rather than durable profile knowledge.",
      recommendedTarget: null,
      recommendedSkillName: null,
    };
  }

  if (isProcedural(collapsed, lines, lower)) {
    return {
      kind: "skill",
      rationale: "The content looks like reusable procedure or workflow guidance that should live as a skill rather than a flat fact entry.",
      recommendedTarget: "skill",
      recommendedSkillName: suggestSkillName(lines),
    };
  }

  if (isUserSpecific(lower)) {
    return {
      kind: "user",
      rationale: "The content looks like durable user-specific preference or identity context.",
      recommendedTarget: "user",
      recommendedSkillName: null,
    };
  }

  return {
    kind: "memory",
    rationale: "The content reads like durable declarative context that fits the built-in memory store.",
    recommendedTarget: "memory",
    recommendedSkillName: null,
  };
}

function isEphemeral(lower) {
  return (
    /\b(today|this turn|for now|temporar(?:y|ily)|just now|current task|next step|todo|follow up|remind me)\b/.test(
      lower,
    ) ||
    /\bdebug this specific failure\b/.test(lower)
  );
}

function isProcedural(raw, lines, lower) {
  if (lines.length >= 4 && lines.filter((line) => /^(\d+\.|- |\* |step \d+)/i.test(line)).length >= 2) {
    return true;
  }

  if (/```/.test(raw)) {
    return true;
  }

  if (/\b(runbook|workflow|procedure|checklist|how to|steps|playbook|recipe)\b/.test(lower)) {
    return true;
  }

  if (lines.length >= 3 && lines.some((line) => /^(run|open|check|create|update|use|verify|deploy|restart)\b/i.test(line))) {
    return true;
  }

  return false;
}

function isUserSpecific(lower) {
  return /\b(prefers?|likes?|dislikes?|timezone|pronouns?|works in|their preference|user preference|i prefer)\b/.test(
    lower,
  );
}

function suggestSkillName(lines) {
  const seedLine = lines.find((line) => !/^(\d+\.|- |\* )/.test(line)) || lines[0] || "skill";
  const slug = seedLine
    .toLowerCase()
    .replace(/^[#\s]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");

  return slug || "skill";
}

function resolveContentSource(options = {}, code) {
  const hasFile = Boolean(options.file);
  const hasStdin = Boolean(options.stdin);

  if (hasFile === hasStdin) {
    throw new SLAError("Provide exactly one input source: --file or --stdin.", {
      code,
      exitCode: 2,
      details: {
        file: options.file ?? null,
        stdin: hasStdin,
      },
    });
  }

  if (hasFile) {
    return {
      type: "file",
      path: options.file,
    };
  }

  return {
    type: "stdin",
  };
}

async function readContentSource(source) {
  if (source.type === "file") {
    return fs.readFile(source.path, "utf8");
  }

  return fs.readFile("/dev/stdin", "utf8");
}

function normalizeDocumentContent(content, message, code) {
  const normalized = String(content).replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    throw new SLAError(message, {
      code,
      exitCode: 2,
    });
  }

  return `${normalized}\n`;
}

module.exports = {
  classifyProfileKnowledge,
  getProfileContext,
};
