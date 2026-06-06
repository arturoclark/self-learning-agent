const fs = require("node:fs/promises");
const { CURRENT_SCHEMA_VERSION } = require("./constants");
const { pathExists, withFileLock, writeFileAtomic } = require("./filesystem");
const { getUsagePath } = require("./paths");

function createDefaultUsage() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    skills: {},
    memory: {
      lastModifiedTarget: null,
      lastOperation: null,
      lastOperationAt: null,
      targets: {
        memory: {
          entryCount: 0,
          lastModifiedAt: null,
        },
        user: {
          entryCount: 0,
          lastModifiedAt: null,
        },
      },
    },
  };
}

async function loadUsage(profileName) {
  const usagePath = getUsagePath(profileName);
  if (!(await pathExists(usagePath))) {
    return createDefaultUsage();
  }

  const raw = await fs.readFile(usagePath, "utf8");
  return normalizeUsage(JSON.parse(raw));
}

async function saveUsage(profileName, usage) {
  const normalized = normalizeUsage(usage);
  await writeFileAtomic(getUsagePath(profileName), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

async function updateMemoryUsage(profileName, update) {
  const usagePath = getUsagePath(profileName);
  const lockPath = `${usagePath}.lock`;

  return withFileLock(lockPath, async () => {
    const usage = await loadUsage(profileName);
    const nextUsage = normalizeUsage({
      ...usage,
      memory: {
        ...usage.memory,
        lastModifiedTarget: update.target,
        lastOperation: update.operation,
        lastOperationAt: update.timestamp,
        targets: {
          ...usage.memory.targets,
          [update.target]: {
            ...usage.memory.targets[update.target],
            entryCount: update.entryCount,
            lastModifiedAt: update.timestamp,
          },
        },
      },
    });

    await saveUsage(profileName, nextUsage);
    return nextUsage;
  });
}

function normalizeUsage(usage) {
  const defaults = createDefaultUsage();
  const input = usage && typeof usage === "object" ? usage : {};
  const memory = input.memory && typeof input.memory === "object" ? input.memory : {};
  const targets = memory.targets && typeof memory.targets === "object" ? memory.targets : {};

  return {
    schemaVersion: input.schemaVersion ?? defaults.schemaVersion,
    skills: input.skills && typeof input.skills === "object" && !Array.isArray(input.skills) ? input.skills : {},
    memory: {
      lastModifiedTarget: memory.lastModifiedTarget ?? defaults.memory.lastModifiedTarget,
      lastOperation: memory.lastOperation ?? defaults.memory.lastOperation,
      lastOperationAt: memory.lastOperationAt ?? defaults.memory.lastOperationAt,
      targets: {
        memory: {
          entryCount: Number.isInteger(targets.memory?.entryCount)
            ? targets.memory.entryCount
            : defaults.memory.targets.memory.entryCount,
          lastModifiedAt: targets.memory?.lastModifiedAt ?? defaults.memory.targets.memory.lastModifiedAt,
        },
        user: {
          entryCount: Number.isInteger(targets.user?.entryCount)
            ? targets.user.entryCount
            : defaults.memory.targets.user.entryCount,
          lastModifiedAt: targets.user?.lastModifiedAt ?? defaults.memory.targets.user.lastModifiedAt,
        },
      },
    },
  };
}

module.exports = {
  createDefaultUsage,
  loadUsage,
  normalizeUsage,
  saveUsage,
  updateMemoryUsage,
};
