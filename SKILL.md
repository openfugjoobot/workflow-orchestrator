# workflow-orchestrator Skill

Autonomous 8-phase development workflow orchestrator for OpenClaw.

## Commands

- `/workflow start <projectName>` - Start new workflow
- `/workflow status` - Show current state
- `/workflow pause` - Pause workflow
- `/workflow resume` - Resume workflow
- `/workflow cancel` - Cancel + cleanup
- `/workflow export` - Export progress as markdown

## Phases

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

## State

Persisted in `memory/workflow-state.json`

## Usage

```bash
openclaw skill workflow-orchestrator run --params '{"action":"start","project":"Weather Dashboard"}'
```

Or via command: `/workflow start Weather Dashboard`

## Repo

https://github.com/openfugjoobot/workflow-orchestrator
