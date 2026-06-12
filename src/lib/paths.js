const os = require("os");
const path = require("path");

function getSlaHome() {
  return process.env.SLA_HOME || path.join(os.homedir(), ".sla");
}

function getCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function getConfigPath() {
  return path.join(getSlaHome(), "config.json");
}

function getProfilePath(profileName) {
  return path.join(getSlaHome(), profileName);
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

function getCodexHooksPath() {
  return path.join(getCodexHome(), "hooks");
}

function getCodexHooksConfigPath() {
  return path.join(getCodexHome(), "hooks.json");
}

function getCodexSkillPath(skillName) {
  return path.join(getCodexSkillsPath(), skillName);
}

function getCodexAgentPath(skillName, agentName = "openai") {
  return path.join(getCodexSkillPath(skillName), "agents", `${agentName}.yaml`);
}

function getCodexHookScriptPath(scriptName) {
  return path.join(getCodexHooksPath(), scriptName);
}

module.exports = {
  getCodexAgentPath,
  getCodexHookScriptPath,
  getCodexHome,
  getCodexHooksConfigPath,
  getCodexHooksPath,
  getCodexSkillPath,
  getCodexSkillsPath,
  getConfigPath,
  getMemoryStorePath,
  getMemoriesPath,
  getProfilePath,
  getSkillMarkdownPath,
  getSkillPath,
  getSkillsPath,
  getSlaHome,
  getSoulPath,
  getUsagePath,
};
