# self-learning-agent

`self-learning-agent` installs the `sla` CLI, a profile-scoped memory and skills manager for agents. It stores profile state under `~/.sla/`, exposes explicit JSON output for agent consumption, and can install thin Codex host wrappers that route profile work back through the CLI.

## Requirements

- Node.js `>=20`

## Install

```bash
npm install -g self-learning-agent
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
sla stats profile research
sla host install codex
```

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
