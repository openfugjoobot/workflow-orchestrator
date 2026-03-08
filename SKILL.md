# workflow-orchestrator Skill

Autonomous 9-phase development workflow orchestrator for OpenClaw.

## Commands

- `/workflow start <projectName>` — Start new workflow
- `/workflow status` — Show current state
- `/workflow pause` — Pause workflow
- `/workflow resume` — Resume workflow
- `/workflow cancel` — Cancel + cleanup
- `/workflow export` — Export progress as markdown

## Phases

| Phase | Name | Agent(s) | Duration |
|-------|------|----------|----------|
| 0 | REQUIREMENTS | dev-orchestrator | ~2 min |
| 1 | ANALYSIS | research | ~3 min |
| 2 | DESIGN | architect | ~3 min |
| 3 | PLANNING | dev-orchestrator | ~2 min |
| 4 | IMPLEMENTATION | backend + frontend (parallel) | ~5 min |
| 5 | QA | qa | ~2 min |
| 6 | DOCUMENTATION | docs | ~1.5 min |
| 7 | DEPLOYMENT | devops | ~3 min |
| 8 | CLOSURE | dev-orchestrator | ~1.5 min |

**Total:** ~20-25 min (varies by project complexity)

## Features

- **Heartbeat-driven** — Auto-advances every heartbeat (5 min default)
- **Retry logic** — Failed agents retry up to 2x automatically
- **Parallel execution** — Phase 4 runs backend + frontend concurrently
- **State persistence** — All progress saved with auto-backups
- **Error tracking** — Full error history in state.errors

## Usage

### CLI (Recommended)

```bash
cd ~/.openclaw/skills/workflow-orchestrator

# Start new workflow
node bin/start.js "My Awesome Project"

# Check status
node bin/status.js

# Check & advance (called by heartbeat)
node bin/orchestrator.js check
```

### Heartbeat Integration

Heartbeat automatically checks and advances workflow phases. No manual intervention needed unless errors occur.

## State Files

- `memory/workflow-state.json` — Current workflow state
- `memory/backups/` — Auto-backups (keeps last 5)

## Error Handling

| Error Type | Behavior |
|------------|----------|
| Subagent failure | Auto-retry (max 3 attempts) |
| State corruption | Restore from latest backup |
| Missing agent | Log error, alert user |
| Parallel failure | All agents must complete; partial = retry |

## Repo

https://github.com/openfugjoobot/workflow-orchestrator
