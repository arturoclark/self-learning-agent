# self-learning-agent-cli

`self-learning-agent-cli` installs the `sla` CLI, a profile-scoped memory and skills manager for agents. It stores profile state under `~/.sla/`, exposes explicit JSON output for agent consumption, and can install thin Codex host wrappers plus a Codex `Stop` hook that routes profile persistence work back through the CLI.

## Requirements

- Node.js `>=20`

## Install

```bash
npm install -g self-learning-agent-cli
```

Run `sla help` after install to see the command surface and examples.

## Bootstrap

Initialize the home directory and default profile:

```bash
sla install
```

That creates:

```text
~/.sla/
  config.json
  default/
    SOUL.md
    memories/
      MEMORY.md
      USER.md
    skills/
      .usage.json
```

## Quickstart

Use `sla help` as the primary entrypoint:

```bash
sla help
sla help profile create
sla help memory add
```

Common flows:

```bash
sla profile create research
sla soul view research
sla memory add research --target memory --entry "The API runs in us-east-1"
sla skill create deploy research
sla skill create-reference deploy research --path release-flow.md --title "Release Flow"
sla stats profile research
sla host install codex
sla host install codex .
sla host install codex . --gitignore
sla host install codex --repository ~/development/self-learning-agent
```

`sla host install codex` installs:

- Codex skills under `~/.codex/skills/`
- a managed stop-hook script under `~/.codex/hooks/` by default, or under `<repository>/.codex/hooks/` when `--repository` is provided
- a merged hooks config at `~/.codex/hooks.json` by default, or at `<repository>/.codex/hooks.json` when `--repository` is provided
- repository-local installs write a portable hook command using global `node` and a relative `.codex/hooks/...` path so the config can be committed across machines
- when `--gitignore` is provided for a repository-local install and the repo already has a `.gitignore`, append `.codex/` if it is not already ignored
- a stop hook that prompts Codex for one final persistence pass before ending a turn

## JSON Output

All user-facing commands support `--json` for machine-readable output:

```bash
sla profile list --json
sla memory view research --target user --json
sla stats --json
```

Errors also render as structured JSON when `--json` is used.

## Release Check

Before publishing:

```bash
npm test
npm pack --dry-run
npm pack
```

The package intentionally publishes only runtime files plus this README and the license. `PLAN.md`, tests, and local analysis notes are excluded from the tarball.
