# Documentation

User guides for **nstc** — the NestJS TypeORM scaffolder CLI.

## Guides

| Guide | What you'll learn |
|-------|-------------------|
| [Getting started](getting-started.md) | Install `nstc`, scaffold your first resource, wire it into NestJS, run migrations |
| [Commands](commands.md) | Full command reference: `generate`, `destroy`, flags, and aliases |
| [Fields & types](fields-and-types.md) | Field syntax, type aliases, modifiers (`:unique`, `:belongsTo`), reserved names |
| [Configuration](configuration.md) | `.nstcrc.json` and `package.json` defaults, all config keys |
| [Generated output](generated-output.md) | What each generated file contains, REST endpoints, option effects |
| [Troubleshooting](troubleshooting.md) | Shell globbing, PostgreSQL UUIDs, entity registration, `--wire` caveats |
| [Architecture](architecture.md) | How nstc works internally, the data pipeline, and AI agent integration |

## Quick reference

```bash
nstc --help                          # Usage and options
nstc --version                       # Package version
nstc list-types                      # Supported field types and modifiers

nstc generate resource <name> <fields...> [options]
nstc g scaffold <name> <fields...>   # Short aliases

nstc destroy resource <name> [options]
nstc d scaffold <name> [options]
```

## See also

- [README](../README.md) — project overview and quick start
- [AGENTS.md](../AGENTS.md) — architecture and contributor conventions
