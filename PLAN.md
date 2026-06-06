# Build `sle`: Profile-Scoped Memory and Skills CLI for Agents

## Summary

Build a Node.js CLI, in plain JavaScript, that manages agent profiles under `~/.sle/` using Hermes-inspired patterns:

- facts in bounded profile memory files
- procedures in filesystem-native skill directories
- thin host-installed skills that call the CLI rather than reimplement storage logic
- lightweight operational metadata for stats and verification
- publish-ready npm packaging

The first implementation will support local profile management end to end, Codex skill installation end to end, and an adapter boundary for Claude/other hosts later. It will also include npm release readiness, with package metadata collected from the user during implementation before release-related files are finalized.

## Architecture and Public Interfaces

### Storage model

Use this home layout:

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
      <skill-name>/
        SKILL.md
        references/
        templates/
        scripts/
        assets/
  <profile-name>/
    SOUL.md
    memories/
      MEMORY.md
      USER.md
    skills/
      .usage.json
      ...
```

Use `config.json` for:

- `schemaVersion`
- `defaultProfile`
- installed host integration metadata
- future migration flags if needed

Keep Hermes-aligned content ownership:

- `memories/MEMORY.md`: agent/project facts
- `memories/USER.md`: user-specific preferences and stable context
- `skills/<name>/SKILL.md`: procedure and instructions
- `skills/.usage.json`: usage and last-activity telemetry
- no semantic provider in v1; only built-in file-backed memory

Operational rules:

- schema versioning is present from day one and checked on startup
- repo-tracked data writes use atomic write helpers everywhere
- concurrent session safety is enforced with file locking or equivalent single-writer protection for mutable files
- all user-facing commands support human-readable output by default and `--json` for machine-readable agent consumption
- stats and activity metadata use one normalized telemetry shape across profiles and hosts
- skill metadata validation requires `SKILL.md` frontmatter with at least `name` and `description`

### CLI surface

Plan the CLI as `sle`, implemented with `commander`.

Core commands:

- `sle install`
  Creates `~/.sle`, writes global config, creates the default profile, and bootstraps the required directory and file structure.
- `sle help [command]`
  Shows top-level help or command-specific help, including examples and default-profile behavior.
- `sle profile create <name>`
  Creates a new named profile with `SOUL.md`, `memories/`, `skills/`, and initial sidecar files.
- `sle profile update [name]`
  Updates profile-level metadata or scaffolded files for an existing profile; if no name is given, uses the default profile.
- `sle profile delete <name> --yes`
  Permanently deletes a profile after explicit confirmation, with safeguards around deleting the current default profile.
- `sle profile list`
  Lists all profiles and indicates which one is currently the default.
- `sle profile dir [name]`
  Prints the absolute filesystem path for the selected profile.
- `sle profile set-default <name>`
  Sets the named profile as the default profile in global config.
- `sle profile get-default`
  Prints the current default profile name.
- `sle soul view [name]`
  Prints the profile’s `SOUL.md` content.
- `sle soul edit [name] --file <path>` or `--stdin`
  Replaces or updates the profile’s `SOUL.md` from file input or piped stdin.
- `sle memory list [name]`
  Lists memory entries across the profile’s built-in memory stores, with enough summary to inspect what is stored.
- `sle memory add [name] --target memory|user`
  Adds a new entry to `MEMORY.md` or `USER.md` for the selected profile.
- `sle memory replace [name] --target memory|user`
  Replaces an existing matching memory entry in the chosen memory target.
- `sle memory remove [name] --target memory|user`
  Removes an existing matching memory entry from the chosen memory target.
- `sle memory view [name] --target memory|user`
  Prints the raw contents or parsed entries of one built-in memory target.
- `sle skill list [name]`
  Lists installed skills for the profile using metadata-only summaries.
- `sle skill view <skill> [name]`
  Shows the full `SKILL.md` for a named skill, and optionally later support-file access if expanded.
- `sle skill create <skill> [name]`
  Creates a new skill directory and starter `SKILL.md` for the selected profile.
- `sle skill edit <skill> [name]`
  Replaces or updates the `SKILL.md` content for an existing skill.
- `sle skill delete <skill> [name] --yes`
  Deletes a skill directory after explicit confirmation.
- `sle skill write-file <skill> --subdir references|templates|scripts|assets --path <relative-path>`
  Writes a managed support file inside one of the allowed skill subdirectories.
- `sle skill remove-file <skill> --path <relative-path> --yes`
  Removes a managed support file from a skill after explicit confirmation.
- `sle stats`
  Shows global system metrics across all profiles, including counts and recent activity.
- `sle stats profile [name]`
  Shows detailed metrics for one profile, including soul, memory, and skill activity.
- `sle host install codex`
  Installs Codex-facing skills that teach the agent how to operate on `sle` profiles through this CLI.
- `sle host list`
  Lists supported host integrations and whether they are installed.

Help behavior:

- `sle help` prints top-level usage, major concepts, and key examples
- `sle help <command>` prints focused help for that command path
- help output includes curated examples so agents can find the right command without external docs
- help output includes profile-resolution rules and default-profile behavior where relevant
- `-h` and `--help` still work through `commander`, but `sle help` is the documented stable interface for users and agents

Resolution rules:

- if `[name]` is omitted, use `config.defaultProfile`
- if no default is configured, fail explicitly
- name collisions never guess; require exact profile or skill name
- write operations must be atomic and path-safe

Profile lifecycle policy:

- deleting the default profile is refused unless the default is changed first or an explicit override flow is added later
- profile rename is out of scope as a command in v1; if introduced later, it must update default-profile references and preserve telemetry
- profile deletion removes profile-local memories, skills, soul, and telemetry in one operation

### Installed agent skills

Install Codex-hosted skills as thin wrappers that instruct the agent to use `sle` commands.

First installed skills:

- `/use-profile {profile}`
- `/create-profile`
- `/update-profile`

Behavior:

- `/use-profile {profile}` tells the agent to read from and write to that `sle` profile during the session
- `/create-profile` scaffolds a profile and captures explicit user intent into `SOUL.md`; no automatic synthesis in v1
- `/update-profile` updates `SOUL.md`, memories, or skills for the named profile, defaulting to the configured default when omitted

Codex installer target:

- install into `~/.codex/...` using the host’s skill directory conventions
- record installation metadata in `config.json`

Host integration design:

- define a host adapter abstraction in v1
- Codex is the only concrete adapter implemented now
- adapters own host-specific install paths, generated skill wrappers, and installation status checks
- core profile, memory, skill, stats, and telemetry logic stays host-agnostic

## Step Plan

### Step 1: Project bootstrap and command shell [DONE]

What this achieves:
Create the Node package, executable entrypoint, command parser, help system, error model, JSON output conventions, and a small internal module layout that keeps storage logic separate from command handlers.

Results:
- runnable `sle` executable from local dev
- consistent help output and subcommand structure
- explicit `sle help` command wired to the same command registry as `commander`
- shared utilities for path resolution, profile resolution, validation, JSON output, and formatted CLI output
- curated example snippets embedded in help text
- test harness for command-level integration tests

### Step 2: `~/.sle` install, config, and schema management [DONE]

What this achieves:
Initialize the application home, global config, schema version, and default profile so the system has a stable source of truth from the first run.

Results:
- `sle install` creates `~/.sle/`
- writes `config.json` with `schemaVersion`, `defaultProfile`, and host-install metadata container
- creates `~/.sle/default/`
- creates `SOUL.md`, `memories/MEMORY.md`, `memories/USER.md`, `skills/`, and `skills/.usage.json`
- startup checks schema version and routes through a migration hook
- install is idempotent and safe to rerun

### Step 3: Profile lifecycle management [DONE]

What this achieves:
Let users create, inspect, select, and remove named profiles cleanly, with explicit default-profile handling and no ambiguous behavior.

Results:
- create named profiles under `~/.sle/<name>/`
- list existing profiles and identify the default
- return absolute path for a profile directory
- set and get the default profile through `config.json`
- delete requires `--yes`
- deleting the current default is refused unless the default is changed first
- rename remains intentionally unimplemented in v1, with that restriction documented in help and README
- profile names are validated and normalized consistently

### Step 4: SOUL management

What this achieves:
Make each profile’s purpose explicit and editable so agents can understand the profile’s role before interacting with its memories and skills.

Results:
- `SOUL.md` exists for every profile
- CLI can print current soul content
- CLI can replace or update soul content from stdin or file input
- update flow preserves atomic writes, locking, and clean error messages
- `SOUL.md` template is minimal and host-agnostic

### Step 5: Hermes-style memory management [DONE]

What this achieves:
Implement the built-in durable fact store using Hermes-style flat markdown files, while keeping operations simple and safe for agents.

Results:
- two memory targets per profile: `memory` and `user`
- add, replace, remove, list, and view operations for memory entries
- entries stored in markdown files with a stable delimiter model rather than JSON records
- duplicate adds are rejected
- writes are atomic and concurrency-safe
- memory commands support `--json`
- stats metadata captures last modified target, last operation time, and entry counts in a normalized telemetry format
- command behavior is explicit when content is missing or matches multiple entries

### Step 6: Skill management and filesystem contract

What this achieves:
Implement local procedural knowledge storage that mirrors Hermes’ skill directory model and supports agent-safe maintenance.

Results:
- create skill directories with required `SKILL.md`
- validate `SKILL.md` frontmatter with required `name` and `description`
- support edit and delete operations for skill bodies
- support managed files only inside `references`, `templates`, `scripts`, and `assets`
- block traversal and unsafe paths
- usage sidecar tracks view, edit, and use timestamps and counters using the shared telemetry shape
- skill listing returns metadata-only summaries suitable for agent consumption
- skill commands support `--json`

### Step 7: Stats and verification surface

What this achieves:
Give users and agents quick proof that storage is working, with both global and profile-scoped visibility.

Results:
- global stats show profile count, default profile, total memories, total skills, and latest activity across all profiles
- per-profile stats show memory entry counts by target, skill count, last modified memory, last modified skill, and last activity time
- stats surface the “last what” value in a compact human-readable form
- usage sidecars are the source for skill activity; file mtimes supplement memory and soul activity
- stats output is available in human-readable and `--json` forms
- telemetry schema is stable and documented for reuse by future host adapters

### Step 8: Codex host installer and adapter abstraction

What this achieves:
Install thin integration skills so agents in Codex can operate on `sle` profiles using CLI commands instead of manual filesystem conventions, while setting the design boundary for future hosts.

Results:
- `sle host install codex` installs the starter skills into the Codex skill location
- installed skills include `/use-profile`, `/create-profile`, and `/update-profile`
- skill content explicitly tells the agent to use `sle` commands for profile reads and writes
- installation is idempotent and tracked in global config
- host adapter interface is implemented and Codex conforms to it
- `sle host list` reports adapter availability and installation status

### Step 9: Hardening, packaging, and npm release readiness

What this achieves:
Make the CLI safe to evolve after first release, resilient against partial writes or home layout changes, and ready to publish as a real npm package.

Results:
- atomic write and locking helpers are reused everywhere mutable state is written
- friendly failures for missing install, missing default profile, invalid profile names, invalid skill paths, and invalid frontmatter
- `package.json` is finalized for npm publishing with `name`, `version`, `bin`, `files`, `engines`, `license`, `repository`, and publish-safe metadata
- packaging includes only required runtime files and excludes accidental publish artifacts
- publish artifact validation checks tarball contents so tests, local fixtures, and unrelated files are not leaked
- package metadata values are collected from the user during implementation before release files are finalized
- `npm pack` succeeds and produces a correct tarball
- tarball install smoke test confirms the `sle` binary works after global or local package install
- package is ready for `npm publish`
- README includes install, bootstrap, help, JSON output, and release-oriented quickstart guidance centered on `sle help`

## Test Plan

Cover these scenarios:

- fresh `sle install` on a clean machine
- rerunning `sle install` without duplicating or corrupting state
- schema version mismatch routes through the migration guard
- `sle help` top-level output
- `sle help profile create` and equivalent command-path help output
- creating multiple profiles and switching default
- omitting profile name and correctly falling back to default
- refusing operations when no default exists
- refusing deletion of the current default profile
- adding, replacing, and removing memory entries in both targets
- duplicate memory add rejection
- concurrent write protection for soul, memory, and skill mutations
- creating a skill, viewing it, editing it, and managing support files
- rejecting traversal paths, invalid subdirs, and invalid `SKILL.md` frontmatter
- deleting profiles and skills only with confirmation flags
- global stats after mixed profile activity
- per-profile stats after soul, memory, and skill updates
- `--json` output shape for profile, memory, skill, stats, and host commands
- Codex host install on first run and re-run
- installed `/use-profile` workflow correctly points the session at the chosen profile by instruction
- `npm pack` output installs cleanly and exposes the `sle` binary
- published-package dry run verifies required files are present and unexpected files are absent
- invalid profile names, missing skills, and ambiguous references fail without guessing

## NPM Release Inputs To Ask The User For During Implementation

Before finalizing publish-ready package files, ask the user for:

- npm package name
- initial version
- license
- repository URL
- author or organization name
- npm scope or unscoped preference
- minimum supported Node version
- package description
- keywords
- whether the package should be public immediately or kept private first

If any of these are missing, stop and ask rather than guessing.

## Assumptions and Defaults

- implementation is plain JavaScript on Node, no TypeScript
- `commander` is the CLI library
- built-in memory is Hermes-style flat markdown files, not JSON records
- profile memories use exactly two stores in v1: `MEMORY.md` and `USER.md`
- profile authoring is scaffold-only in v1; no AI synthesis of `SOUL.md` or starter memories
- stats include usage telemetry, not just raw filesystem counts
- Codex is the only concrete host installer in v1
- profile omission always means “use default profile”
- global state lives in `~/.sle/config.json`; profile state lives inside each profile directory
- npm publish happens only after package metadata has been explicitly provided by the user
