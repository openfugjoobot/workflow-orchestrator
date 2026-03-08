/**
 * Subagent Spawning for Workflow Orchestrator
 * Handles spawning and tracking of phase agents
 */

const { execSync } = require('child_process');
const state = require('./state');
const phases = require('./phases');

/**
 * Run OpenClaw CLI command
 */
function runOpenClawCmd(args, options = {}) {
  try {
    const cmd = `openclaw ${args.join(' ')} ${options.json ? '--json' : ''} 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    if (options.json) {
      return JSON.parse(output);
    }
    return output.trim();
  } catch (err) {
    console.error('OpenClaw cmd failed:', err.message);
    return null;
  }
}

/**
 * Spawn a subagent for a specific phase
 */
function spawnPhaseAgent(st, phaseNumber, parallelAgents = null) {
  const phaseConfig = phases.getPhase(phaseNumber);
  if (!phaseConfig) {
    return { ok: false, error: `Unknown phase: ${phaseNumber}` };
  }

  const agentIds = parallelAgents || [phaseConfig.agentId];
  const spawnedSessions = [];

  // Build context for task template
  const ctx = {
    projectName: st.projectName,
    description: st.description || 'TBD',
    artifacts: st.artifacts,
    completedPhases: st.completedPhases
  };

  // Generate task from template
  const task = phaseConfig.taskTemplate(ctx);

  console.log(`🚀 Spawning ${agentIds.length} agent(s) for Phase ${phaseNumber}: ${phaseConfig.name}`);

  for (const agentId of agentIds) {
    const label = `workflow-${st.projectId}-phase${phaseNumber}-${agentId}`;
    
    // Spawn subagent via sessions_spawn
    const args = [
      'sessions', 'spawn',
      '--runtime', 'subagent',
      '--agent-id', agentId,
      '--label', `"${label}"`,
      '--mode', 'session',
      '--cleanup', 'keep',
      '--task', `"${task.replace(/"/g, '\\"')}"`
    ];

    // Add timeout if specified
    if (phaseConfig.timeout) {
      args.push('--timeout', String(Math.floor(phaseConfig.timeout / 1000)));
    }

    const result = runOpenClawCmd(args, { json: true });
    
    if (result && result.sessionKey) {
      spawnedSessions.push({
        agentId,
        sessionKey: result.sessionKey,
        label
      });
      console.log(`  ✅ Spawned ${agentId} → ${result.sessionKey}`);
    } else {
      console.error(`  ❌ Failed to spawn ${agentId}`);
      state.addError(st, {
        type: 'spawn_failure',
        phase: phaseNumber,
        agentId
      });
    }
  }

  if (spawnedSessions.length === 0) {
    return { ok: false, error: 'No agents spawned successfully' };
  }

  // Track in state
  if (parallelAgents) {
    // Parallel execution: track all sessions
    st.activeSubagents = spawnedSessions.map(s => s.sessionKey);
    st.parallelPhase = true;
  } else {
    // Single agent
    st.activeSubagent = spawnedSessions[0].sessionKey;
    st.parallelPhase = false;
  }
  
  st.subagentRunId = `run-${Date.now()}`;
  state.saveState(st);

  return {
    ok: true,
    phase: phaseNumber,
    sessions: spawnedSessions,
    parallel: !!parallelAgents
  };
}

/**
 * Check if all parallel agents completed
 */
function checkParallelCompletion(st) {
  if (!st.parallelPhase || !st.activeSubagents) {
    return null;
  }

  const results = st.activeSubagents.map(sessionKey => {
    const status = getSubagentStatus(sessionKey);
    return { sessionKey, ...status };
  });

  const allDone = results.every(r => r.status === 'done' || r.status === 'failed');
  const anyFailed = results.some(r => r.status === 'failed');

  return {
    allDone,
    anyFailed,
    results
  };
}

/**
 * Get subagent status (wrapper for orchestrator.js function)
 */
function getSubagentStatus(sessionKey) {
  try {
    const result = runOpenClawCmd(['sessions', 'list', '--limit', '50'], { json: true });
    
    if (!result || !result.sessions) {
      return { status: 'api_error' };
    }
    
    const session = result.sessions.find(s => s.key === sessionKey || s.sessionKey === sessionKey);
    
    if (!session) {
      return { status: 'not_found' };
    }
    
    if (session.status === 'completed' || session.endedAt || session.state === 'idle') {
      return { 
        status: 'done',
        tokens: session.totalTokens || session.usage?.totalTokens
      };
    }
    
    if (session.status === 'failed' || session.exitCode !== 0) {
      return { 
        status: 'failed',
        exitCode: session.exitCode
      };
    }
    
    return { status: 'running' };
    
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

module.exports = {
  spawnPhaseAgent,
  checkParallelCompletion,
  getSubagentStatus,
  runOpenClawCmd
};
