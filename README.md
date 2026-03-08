# Workflow Orchestrator Skill

**Repository:** https://github.com/openfugjoobot/workflow-orchestrator

## Overview

Autonomous 8-phase development workflow for OpenClaw. Orchestrates specialized agents through a complete software development lifecycle.

| Phase | Name | Agent |
|-------|------|-------|
| 0 | REQUIREMENTS | dev-orchestrator |
| 1 | ANALYSIS | research |
| 2 | DESIGN | architect |
| 3 | PLANNING | dev-orchestrator |
| 4 | IMPLEMENTATION | backend + frontend |
| 5 | QA | qa |
| 6 | DOCUMENTATION | docs |
| 7 | DEPLOYMENT | devops |
| 8 | CLOSURE | dev-orchestrator |

## How It Works

The workflow is **fully autonomous**. Once started:

1. `start.js` creates initial state and spawns Phase 0
2. Heartbeat calls `orchestrator.js check` every 5 minutes
3. Orchestrator detects completion → auto-advances to next phase
4. **Auto-spawn** immediately launches the next phase's agent(s)
5. Parallel phases (e.g., Phase 4: backend + frontend) run concurrently
6. Retry logic handles failures (max 3 attempts per phase)
7. Completion triggers Phase 8 (Closure) and notifies user

**No manual intervention needed** unless errors exceed retry limits.

## Manual Usage

### Start Workflow

```bash
cd ~/.openclaw/skills/workflow-orchestrator
node bin/start.js "Your Project Name"
```

This creates initial state and spawns Phase 0 (REQUIREMENTS).

Optional description:
```bash
node bin/start.js "Weather Dashboard" "Build a weather dashboard app with forecasts"
```

### Check & Advance

```bash
node bin/orchestrator.js check
```

This is called automatically by heartbeat. Manual usage for debugging.

### View State

```bash
cat memory/workflow-state.json
```

## State Machine

```
idle → running → (phase 0→8) → completed
              ↓
           paused/cancelled
```

State persisted with automatic backups.

## Integration

### Heartbeat

Add to `HEARTBEAT.md`:

```markdown
## Workflow Orchestrator Check
```bash
cd ~/.openclaw/skills/workflow-orchestrator && node bin/orchestrator.js check 2>&1 | tail -5
```
```

## Architecture

```
bin/orchestrator.js   - Check & advance logic
lib/state.js          - State management + backups
lib/phases.js         - Phase definitions + templates
memory/
  workflow-state.json - Persisted state
  backups/            - Auto-backups
```

## Error Handling

- **Subagent failure**: Auto-retry up to `maxRetries` (default: 2)
- **State corruption**: Auto-restores from latest backup
- **Missing agent**: Logs error in state.errors array
- **Parallel failures**: All parallel agents must complete; partial failures trigger retry

## Parallel Execution

Phase 4 (IMPLEMENTATION) runs `backend` and `frontend` agents in parallel. Both must complete before advancing to Phase 5 (QA).

To add more parallel phases, extend `phaseConfig.parallelAgents` in `lib/phases.js`.

## Files

- `SKILL.md` - Skill definition for OpenClaw
- `README.md` - This file
- `.github/workflows/ci.yml` - CI pipeline
- `bin/orchestrator.js` - Main executable
- `lib/` - Core modules
- `memory/` - State storage

## License

MIT - OpenFugjooBot
