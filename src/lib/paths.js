const os = require("os");
const path = require("path");

function getSleHome() {
  return process.env.SLE_HOME || path.join(os.homedir(), ".sle");
}

function getConfigPath() {
  return path.join(getSleHome(), "config.json");
}

function getProfilePath(profileName) {
  return path.join(getSleHome(), profileName);
}

function getSoulPath(profileName) {
  return path.join(getProfilePath(profileName), "SOUL.md");
}

function getMemoriesPath(profileName) {
  return path.join(getProfilePath(profileName), "memories");
}

function getSkillsPath(profileName) {
  return path.join(getProfilePath(profileName), "skills");
}

function getUsagePath(profileName) {
  return path.join(getSkillsPath(profileName), ".usage.json");
}

module.exports = {
  getConfigPath,
  getMemoriesPath,
  getProfilePath,
  getSkillsPath,
  getSleHome,
  getSoulPath,
  getUsagePath,
};
