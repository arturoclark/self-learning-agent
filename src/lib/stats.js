const fs = require("node:fs/promises");
const path = require("node:path");
const { getMemoryStorePath, getSkillsPath, getSoulPath } = require("./paths");
const { resolveExistingProfile, listProfiles } = require("./profiles");
const { loadUsage } = require("./usage");

const MEMORY_HEADERS = {
  memory: "# MEMORY",
  user: "# USER",
};

async function getGlobalStats() {
  const { profiles, defaultProfile } = await listProfiles();
  const summaries = await Promise.all(profiles.map((profile) => buildProfileStats(profile.name)));
  const latestActivity = pickLatestActivity(summaries.map((summary) => summary.lastActivity));

  return {
    profileCount: profiles.length,
    defaultProfile,
    totalMemories: summaries.reduce((sum, summary) => sum + summary.memories.totalEntries, 0),
    totalSkills: summaries.reduce((sum, summary) => sum + summary.skills.count, 0),
    latestActivity,
  };
}

async function getProfileStats(requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  return buildProfileStats(profileName);
}

async function buildProfileStats(profileName) {
  const usage = await loadUsage(profileName);
  const [memoryCounts, skillCount, soulModifiedAt, skillActivity, memoryMtimes] = await Promise.all([
    readMemoryCounts(profileName),
    countSkills(profileName),
    readMtimeIso(getSoulPath(profileName)),
    readSkillActivity(profileName, usage),
    readMemoryMtimes(profileName),
  ]);

  const lastModifiedMemory = deriveLastModifiedMemory(profileName, usage, memoryCounts, memoryMtimes);
  const lastActivity = pickLatestActivity([
    soulModifiedAt
      ? {
          at: soulModifiedAt,
          kind: "soul",
          label: "soul",
          profile: profileName,
        }
      : null,
    lastModifiedMemory,
    skillActivity,
  ]);

  return {
    profile: profileName,
    soul: {
      path: getSoulPath(profileName),
      modifiedAt: soulModifiedAt,
    },
    memories: {
      memory: {
        entryCount: memoryCounts.memory,
        modifiedAt: memoryMtimes.memory,
      },
      user: {
        entryCount: memoryCounts.user,
        modifiedAt: memoryMtimes.user,
      },
      totalEntries: memoryCounts.memory + memoryCounts.user,
      lastModified: lastModifiedMemory,
    },
    skills: {
      count: skillCount,
      lastModified: skillActivity,
    },
    lastActivity,
    lastWhat: lastActivity?.label ?? null,
    telemetrySchemaVersion: usage.schemaVersion,
  };
}

async function readMemoryCounts(profileName) {
  const [memoryEntries, userEntries] = await Promise.all([
    readMemoryEntryCount(profileName, "memory"),
    readMemoryEntryCount(profileName, "user"),
  ]);

  return {
    memory: memoryEntries,
    user: userEntries,
  };
}

async function readMemoryMtimes(profileName) {
  const [memory, user] = await Promise.all([
    readMtimeIso(getMemoryStorePath(profileName, "memory")),
    readMtimeIso(getMemoryStorePath(profileName, "user")),
  ]);

  return {
    memory: getLatestTimestamp([memory]),
    user: getLatestTimestamp([user]),
  };
}

async function readMemoryEntryCount(profileName, target) {
  const raw = await fs.readFile(getMemoryStorePath(profileName, target), "utf8");
  return parseMemoryEntries(raw, target).length;
}

function parseMemoryEntries(raw, target) {
  const normalized = raw.replaceAll("\r\n", "\n");
  const header = MEMORY_HEADERS[target];
  if (!normalized.startsWith(header)) {
    return [];
  }

  const remainder = normalized.slice(header.length).trim();
  if (!remainder) {
    return [];
  }

  return remainder
    .split(/\n\n---\n\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function countSkills(profileName) {
  const entries = await fs.readdir(getSkillsPath(profileName), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).length;
}

async function readSkillActivity(profileName, usage) {
  const skills = Object.entries(usage.skills);
  if (skills.length === 0) {
    return null;
  }

  let latest = null;

  for (const [skillName, activity] of skills) {
    const timestamp = activity.lastActivityAt;
    if (!timestamp) {
      continue;
    }

    const candidate = {
      at: timestamp,
      kind: "skill",
      label: `skill:${skillName}`,
      profile: profileName,
      skill: skillName,
      operation: activity.lastOperation ?? null,
    };

    latest = chooseLaterActivity(latest, candidate);
  }

  return latest;
}

function deriveLastModifiedMemory(profileName, usage, memoryCounts, memoryMtimes) {
  const candidates = [
    {
      target: "memory",
      entryCount: memoryCounts.memory,
      at: getLatestTimestamp([usage.memory.targets.memory.lastModifiedAt, memoryMtimes.memory]),
    },
    {
      target: "user",
      entryCount: memoryCounts.user,
      at: getLatestTimestamp([usage.memory.targets.user.lastModifiedAt, memoryMtimes.user]),
    },
  ].filter((candidate) => Boolean(candidate.at));

  if (candidates.length === 0) {
    return null;
  }

  const latest = candidates.reduce((current, candidate) =>
    !current || new Date(candidate.at).getTime() > new Date(current.at).getTime() ? candidate : current,
  null);

  return {
    at: latest.at,
    kind: "memory",
    label: `memory:${latest.target}`,
    profile: profileName,
    target: latest.target,
    operation:
      usage.memory.lastModifiedTarget === latest.target ? usage.memory.lastOperation ?? null : null,
    entryCount: latest.entryCount,
  };
}

function pickLatestActivity(activities) {
  return activities.filter(Boolean).reduce(chooseLaterActivity, null);
}

function chooseLaterActivity(current, candidate) {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  return new Date(candidate.at).getTime() > new Date(current.at).getTime() ? candidate : current;
}

function getLatestTimestamp(values) {
  return values.filter(Boolean).reduce((current, candidate) => {
    if (!current) {
      return candidate;
    }

    return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
  }, null);
}

async function readMtimeIso(targetPath) {
  const stats = await fs.stat(targetPath);
  return stats.mtime.toISOString();
}

module.exports = {
  getGlobalStats,
  getProfileStats,
};
