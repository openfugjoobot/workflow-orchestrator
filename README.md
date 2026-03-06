# Workflow Orchestrator

Autonomous 8-phase development workflow orchestrator for OpenClaw.

## Overview

This skill orchestrates a complete software development lifecycle through 8 phases:

| Phase | Name | Agent |
|-------|------|-------|
| 0 | **REQUIREMENTS** | Create requirements document |
| 1 | **ANALYSIS** | Research technologies & APIs |
| 2 | **DESIGN** | System architecture |
| 3 | **PLANNING** | GitHub issues & project plan |
| 4 | **IMPLEMENTATION** | Build the project |
| 5 | **QA** | Code review & testing |
| 6 | **DOCUMENTATION** | Write docs |
| 7 | **DEPLOYMENT** | CI/CD & release |
| 8 | **CLOSURE** | Retrospective & summary |

## Installation

```bash
# Skill is located at:
~/.openclaw/skills/workflow-orchestrator/
```

## Usage

### Start a Workflow

```bash
cd ~/.openclaw/skills/workflow-orchestrator
node bin/orchestrator.js start "Weather Dashboard"
```

### Check Status

```bash
node bin/orchestrator.js status
```

### Check & Advance (Manual Step)

```bash
node bin/orchestrator.js check
```

This checks if the current subagent has completed and automatically spawns the next phase.

### Pause/Resume

```bash
node bin/orchestrator.js pause
node bin/orchestrator.js resume
```

### Cancel

```bash
node bin/orchestrator.js cancel
```

## Automation

### Heartbeat Integration

Add to your HEARTBEAT.md:

```markdown
## Workflow Check
```bash
cd ~/.openclaw/skills/workflow-orchestrator && node bin/orchestrator.js check
```
```

### Cron Job

```bash
# Run every 5 minutes
*/5 * * * * cd ~/.openclaw/skills/workflow-orchestrator && node bin/orchestrator.js check
```

## State Management

Workflow state is persisted in:
```
memory/workflow-state.json
```

Backups are automatically created in:
```
memory/backups/
```

## Configuration

Edit `memory/workflow-state.json` to customize:

```json
{
  "config": {
    "heartbeatInterval": 30000,
    "maxRetries": 2,
    "baseTimeout": 120000
  }
}
```

## Troubleshooting

### Subagent Timeout
- Check `workflow-state.json` for errors
- Increase `baseTimeout` in config
- Manually run `check` to retry

### Workflow Stuck
- Run `status` to see current phase
- Run `check` to manually advance
- Check subagent logs with `subagents list`

### State Corruption
- Backups are auto-created
- Restore: `cp memory/backups/workflow-state.XXXXX.json memory/workflow-state.json`

## License

MIT - OpenFugjooBot
