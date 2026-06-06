const fs = require("node:fs/promises");
const { SLEError } = require("./errors");
const { CURRENT_SCHEMA_VERSION, DEFAULT_PROFILE_NAME } = require("./constants");
const { getConfigPath } = require("./paths");
const { pathExists, writeFileAtomic } = require("./filesystem");

function createDefaultConfig(overrides = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    defaultProfile: DEFAULT_PROFILE_NAME,
    hosts: {},
    ...overrides,
  };
}

async function loadConfig() {
  const configPath = getConfigPath();
  if (!(await pathExists(configPath))) {
    return null;
  }

  let parsed;
  try {
    const raw = await fs.readFile(configPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new SLEError("The SLE config file is invalid and could not be read.", {
      code: "INVALID_CONFIG",
      exitCode: 1,
      details: { configPath, reason: error.message },
    });
  }

  return normalizeConfig(parsed);
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new SLEError("The SLE config file must contain a JSON object.", {
      code: "INVALID_CONFIG",
      exitCode: 1,
    });
  }

  return {
    ...config,
    hosts: isPlainObject(config.hosts) ? config.hosts : {},
  };
}

async function saveConfig(config) {
  const normalized = normalizeConfig(config);
  await writeFileAtomic(getConfigPath(), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  createDefaultConfig,
  loadConfig,
  saveConfig,
};
