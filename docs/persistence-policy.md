# Persistence Policy

Use this policy when deciding what to store in an `sla` profile.

## Memory

Store content in built-in memory when it is durable, declarative context:

- project or environment facts
- stable constraints
- durable preferences
- short notes that can be read as standalone facts

Use the `user` target only for user-specific durable context.

## Skills

Store content as a skill when it is reusable procedural knowledge:

- workflows
- runbooks
- checklists
- prompt recipes
- decision trees
- command sequences

If the content benefits from support files under `references`, `templates`, `scripts`, or `assets`, it should be a skill.

## Do Not Store

Do not store content that is obviously turn-local or temporary unless the user explicitly asks:

- one-off todos
- transient debugging notes
- current-turn reminders
- temporary next steps

## CLI Support

Use `sla profile classify [name] --stdin|--file` when the correct storage target is ambiguous.
