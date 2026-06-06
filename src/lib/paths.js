const os = require("os");
const path = require("path");

function getSleHome() {
  return process.env.SLE_HOME || path.join(os.homedir(), ".sle");
}

function getCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
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

function getMemoryStorePath(profileName, target) {
  return path.join(getMemoriesPath(profileName), target === "user" ? "USER.md" : "MEMORY.md");
}

function getSkillsPath(profileName) {
  return path.join(getProfilePath(profileName), "skills");
}

function getSkillPath(profileName, skillName) {
  return path.join(getSkillsPath(profileName), skillName);
}

function getSkillMarkdownPath(profileName, skillName) {
  return path.join(getSkillPath(profileName, skillName), "SKILL.md");
}

function getUsagePath(profileName) {
  return path.join(getSkillsPath(profileName), ".usage.json");
}

function getCodexSkillsPath() {
  return path.join(getCodexHome(), "skills");
}

function getCodexSkillPath(skillName) {
  return path.join(getCodexSkillsPath(), skillName);
}

function getCodexAgentPath(skillName, agentName = "openai") {
  return path.join(getCodexSkillPath(skillName), "agents", `${agentName}.yaml`);
}

module.exports = {
  getCodexAgentPath,
  getCodexHome,
  getCodexSkillPath,
  getCodexSkillsPath,
  getConfigPath,
  getMemoryStorePath,
  getMemoriesPath,
  getProfilePath,
  getSkillMarkdownPath,
  getSkillPath,
  getSkillsPath,
  getSleHome,
  getSoulPath,
  getUsagePath,
};
