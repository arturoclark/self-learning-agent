const fs = require("node:fs/promises");
const { ensureProfileScaffold } = require("./bootstrap");
const { loadConfig, saveConfig } = require("./config");
const { SLEError } = require("./errors");
const { pathExists } = require("./filesystem");
const { getProfilePath, getSleHome } = require("./paths");

function resolveProfileName({ requestedName, config }) {
  if (requestedName) {
    return requestedName;
  }

  if (config?.defaultProfile) {
    return config.defaultProfile;
  }

  throw new SLEError("No profile was provided and no default profile is configured.", {
    code: "DEFAULT_PROFILE_REQUIRED",
    exitCode: 2,
  });
}

async function requireConfig() {
  const config = await loadConfig();
  if (config) {
    return config;
  }

  throw new SLEError("SLE is not initialized. Run 'sle install' first.", {
    code: "SLE_NOT_INITIALIZED",
    exitCode: 1,
    details: { sleHome: getSleHome() },
  });
}

async function createProfile(profileName) {
  await requireConfig();

  if (await pathExists(getProfilePath(profileName))) {
    throw new SLEError(`Profile '${profileName}' already exists.`, {
      code: "PROFILE_ALREADY_EXISTS",
      exitCode: 2,
      details: { profileName, profilePath: getProfilePath(profileName) },
    });
  }

  const created = {
    directories: [],
    files: [],
  };

  await ensureProfileScaffold(profileName, created);

  return {
    name: profileName,
    path: getProfilePath(profileName),
    created,
  };
}

async function listProfiles() {
  const config = await requireConfig();
  const entries = await fs.readdir(getSleHome(), { withFileTypes: true });
  const profiles = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: getProfilePath(entry.name),
      isDefault: entry.name === config.defaultProfile,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    profiles,
    defaultProfile: config.defaultProfile,
  };
}

async function resolveExistingProfile(requestedName) {
  const config = await requireConfig();
  const profileName = resolveProfileName({ requestedName, config });
  await assertProfileExists(profileName);

  return {
    config,
    profileName,
    profilePath: getProfilePath(profileName),
  };
}

async function setDefaultProfile(profileName) {
  const config = await requireConfig();
  await assertProfileExists(profileName);

  const nextConfig = await saveConfig({
    ...config,
    defaultProfile: profileName,
  });

  return {
    defaultProfile: nextConfig.defaultProfile,
  };
}

async function getDefaultProfile() {
  const config = await requireConfig();
  await assertProfileExists(config.defaultProfile);

  return config.defaultProfile;
}

async function deleteProfile(profileName) {
  const config = await requireConfig();
  await assertProfileExists(profileName);

  if (config.defaultProfile === profileName) {
    throw new SLEError(
      `Profile '${profileName}' is the current default and cannot be deleted.`,
      {
        code: "DEFAULT_PROFILE_DELETE_FORBIDDEN",
        exitCode: 1,
        details: { profileName, defaultProfile: config.defaultProfile },
      },
    );
  }

  const profilePath = getProfilePath(profileName);
  await fs.rm(profilePath, { recursive: true, force: false });

  return {
    deletedProfile: profileName,
    profilePath,
  };
}

async function assertProfileExists(profileName) {
  const profilePath = getProfilePath(profileName);
  if (await pathExists(profilePath)) {
    return profilePath;
  }

  throw new SLEError(`Profile '${profileName}' does not exist.`, {
    code: "PROFILE_NOT_FOUND",
    exitCode: 1,
    details: { profileName, profilePath },
  });
}

module.exports = {
  createProfile,
  deleteProfile,
  getDefaultProfile,
  listProfiles,
  requireConfig,
  resolveExistingProfile,
  resolveProfileName,
  setDefaultProfile,
};
