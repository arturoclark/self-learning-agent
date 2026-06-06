const path = require("node:path");
const { createDefaultConfig, loadConfig, saveConfig } = require("./config");
const { CURRENT_SCHEMA_VERSION, DEFAULT_PROFILE_NAME } = require("./constants");
const { SLEError } = require("./errors");
const {
  ensureDirectory,
  pathExists,
  writeFileIfMissing,
} = require("./filesystem");
const {
  getConfigPath,
  getMemoriesPath,
  getProfilePath,
  getSkillsPath,
  getSleHome,
  getSoulPath,
  getUsagePath,
} = require("./paths");

async function bootstrapSleHome() {
  const existingConfig = await loadConfig();
  if (existingConfig) {
    await ensureSchemaSupported(existingConfig);
  }

  const config = existingConfig
    ? {
        ...existingConfig,
        schemaVersion: existingConfig.schemaVersion ?? CURRENT_SCHEMA_VERSION,
        defaultProfile: existingConfig.defaultProfile || DEFAULT_PROFILE_NAME,
        hosts: existingConfig.hosts || {},
      }
    : createDefaultConfig();

  const sleHome = getSleHome();
  const targetProfile = config.defaultProfile;

  const created = {
    directories: [],
    files: [],
  };

  await ensureDirectoryTracked(sleHome, created);
  await ensureProfileScaffold(targetProfile, created);

  const configPath = getConfigPath();
  const configExists = await pathExists(configPath);
  const normalizedConfig = configExists ? await saveConfig(config) : await createFileTracked(
    configPath,
    `${JSON.stringify(config, null, 2)}\n`,
    created,
  ).then(() => config);

  return {
    sleHome,
    configPath,
    config: normalizedConfig,
    profilePath: getProfilePath(targetProfile),
    created,
  };
}

async function ensureSchemaReady() {
  const config = await loadConfig();
  if (!config) {
    return null;
  }

  await ensureSchemaSupported(config);
  return config;
}

async function ensureSchemaSupported(config) {
  const schemaVersion = config.schemaVersion;
  if (schemaVersion == null) {
    throw buildMigrationRequiredError(schemaVersion);
  }

  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    await runMigrationGuard({
      currentVersion: schemaVersion,
      targetVersion: CURRENT_SCHEMA_VERSION,
    });
  }
}

async function runMigrationGuard({ currentVersion, targetVersion }) {
  throw buildMigrationRequiredError(currentVersion, targetVersion);
}

function buildMigrationRequiredError(currentVersion, targetVersion = CURRENT_SCHEMA_VERSION) {
  return new SLEError("The SLE storage schema version is not supported by this build.", {
    code: "SCHEMA_MIGRATION_REQUIRED",
    exitCode: 1,
    details: {
      currentVersion,
      targetVersion,
      configPath: getConfigPath(),
    },
  });
}

async function ensureProfileScaffold(profileName, created) {
  await ensureDirectoryTracked(getProfilePath(profileName), created);
  await ensureDirectoryTracked(getMemoriesPath(profileName), created);
  await ensureDirectoryTracked(getSkillsPath(profileName), created);

  await createFileTracked(getSoulPath(profileName), "# SOUL\n", created);
  await createFileTracked(getMemoryPath(profileName), "# MEMORY\n", created);
  await createFileTracked(getUserPath(profileName), "# USER\n", created);
  await createFileTracked(
    getUsagePath(profileName),
    `${JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, skills: {} }, null, 2)}\n`,
    created,
  );
}

async function ensureDirectoryTracked(directoryPath, created) {
  if (await pathExists(directoryPath)) {
    return false;
  }

  await ensureDirectory(directoryPath);
  created.directories.push(directoryPath);
  return true;
}

async function createFileTracked(filePath, content, created) {
  await ensureDirectory(path.dirname(filePath));
  const createdFile = await writeFileIfMissing(filePath, content);
  if (createdFile) {
    created.files.push(filePath);
  }
  return createdFile;
}

function getMemoryPath(profileName) {
  return path.join(getMemoriesPath(profileName), "MEMORY.md");
}

function getUserPath(profileName) {
  return path.join(getMemoriesPath(profileName), "USER.md");
}

module.exports = {
  bootstrapSleHome,
  ensureSchemaReady,
  ensureProfileScaffold,
};
