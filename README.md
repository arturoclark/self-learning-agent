# self-learning-agent

`self-learning-agent` installs the `sle` CLI, a profile-scoped memory and skills manager for agents. It stores profile state under `~/.sle/`, exposes explicit JSON output for agent consumption, and can install thin Codex host wrappers that route profile work back through the CLI.

## Requirements

- Node.js `>=20`

## Install

```bash
npm install -g self-learning-agent
```

Run `sle help` after install to see the command surface and examples.

## Bootstrap

Initialize the home directory and default profile:

```bash
sle install
```

That creates:

```text
~/.sle/
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

Use `sle help` as the primary entrypoint:

```bash
sle help
sle help profile create
sle help memory add
```

Common flows:

```bash
sle profile create research
sle soul view research
sle memory add research --target memory --entry "The API runs in us-east-1"
sle skill create deploy research
sle stats profile research
sle host install codex
```

## JSON Output

All user-facing commands support `--json` for machine-readable output:

```bash
sle profile list --json
sle memory view research --target user --json
sle stats --json
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
