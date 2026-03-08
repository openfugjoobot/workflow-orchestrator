#!/usr/bin/env node
/**
 * Workflow Orchestrator - Check & Advance
 * 
 * Called by Heartbeat to check workflow progress and advance phases.
 * Uses sessions_list API to check subagent status.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const state = require('../lib/state');
const phases = require('../lib/phases');
const spawn = require('../lib/spawn');

const STATE_PATH = state.STATE_PATH;

/**
 * Run OpenClaw CLI command and parse JSON output
 */
function runOpenClawCmd(args) {
  try {
    const cmd = `openclaw ${args.join(' ')} --json 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (err) {
    return null;
  }
}

/**
 * Read subagent status from sessions_list API
 */
function getSubagentStatus(sessionKey) {
  try {
    const result = runOpenClawCmd(['sessions', 'list', '--limit', '50']);
    
    if (!result || !result.sessions) {
      return { status: 'api_error' };
    }
    
    // Find our subagent session
    const session = result.sessions.find(s => s.key === sessionKey || s.sessionKey === sessionKey);
    
    if (!session) {
      return { status: 'not_found' };
    }
    
    // Check if session completed
    if (session.status === 'completed' || session.endedAt || session.state === 'idle') {
      return { 
        status: 'done',
        tokens: session.totalTokens || session.usage?.totalTokens,
        exitCode: session.exitCode
      };
    }
    
    // Check for timeout or failure
    if (session.status === 'failed' || session.exitCode !== 0) {
      return { 
        status: 'failed',
        exitCode: session.exitCode,
        error: session.error 
      };
    }
    
    return { status: 'running' };
    
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

/**
 * Check and advance workflow with retry logic and parallel execution support
 */
function checkAndAdvance() {
  const st = state.loadState();
  
  if (!st) {
    return { ok: false, message: 'No workflow state found' };
  }
  
  if (st.status !== 'running') {
    return { ok: false, message: `Workflow not running: ${st.status}` };
  }
  
  const phaseConfig = phases.getPhase(st.currentPhase);
  const retryCount = st.retryCount || 0;
  const maxRetries = st.config?.maxRetries || 2;
  
  // Check for parallel phase completion
  if (st.parallelPhase && st.activeSubagents) {
    const parallelStatus = spawn.checkParallelCompletion(st);
    
    if (parallelStatus && parallelStatus.allDone) {
      console.log(`✅ Phase ${st.currentPhase} (${phaseConfig?.name}) completed (parallel agents done)`);
      
      if (st.retryCount) st.retryCount = 0;
      
      const oldPhase = st.currentPhase;
      state.advancePhase(st);
      
      if (st.currentPhase > 8) {
        console.log('🎉 Workflow COMPLETED!');
        return { ok: true, status: 'completed', phase: 8 };
      }
      
      // Auto-spawn next phase
      const nextPhaseConfig = phases.getPhase(st.currentPhase);
      console.log(`➡️ Advancing to Phase ${st.currentPhase}: ${nextPhaseConfig?.name}`);
      
      const parallelAgents = nextPhaseConfig.parallelAgents || null;
      const spawnResult = spawn.spawnPhaseAgent(st, st.currentPhase, parallelAgents);
      
      if (!spawnResult.ok) {
        console.error(`❌ Failed to spawn Phase ${st.currentPhase}`);
        state.addError(st, {
          type: 'spawn_failure',
          phase: st.currentPhase,
          error: spawnResult.error
        });
        return { 
          ok: false, 
          status: 'spawn_failed',
          fromPhase: oldPhase,
          toPhase: st.currentPhase,
          error: spawnResult.error
        };
      }
      
      console.log(`🚀 Spawned ${spawnResult.parallel ? 'parallel agents' : 'agent'}: ${spawnResult.sessions.map(s => s.agentId).join(', ')}`);
      
      return { 
        ok: true, 
        status: 'spawned',
        fromPhase: oldPhase,
        toPhase: st.currentPhase,
        sessions: spawnResult.sessions,
        parallel: spawnResult.parallel
      };
    }
    
    if (parallelStatus && parallelStatus.anyFailed) {
      if (retryCount < maxRetries) {
        st.retryCount = retryCount + 1;
        state.saveState(st);
        console.log(`⚠️ Parallel agents failed (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`);
        return { ok: true, status: 'retry', phase: st.currentPhase, retryCount: st.retryCount };
      }
      console.log(`❌ Phase ${st.currentPhase} failed after ${maxRetries + 1} attempts`);
      state.addError(st, { type: 'parallel_failure', phase: st.currentPhase });
      return { ok: false, status: 'failed', phase: st.currentPhase };
    }
    
    return { ok: true, status: 'running', phase: st.currentPhase, phaseName: phaseConfig?.name, parallel: true };
  }
  
  // Single agent mode
  if (!st.activeSubagent) {
    return { ok: false, message: 'No active subagent' };
  }
  
  const subagentStatus = getSubagentStatus(st.activeSubagent);
  
  // Handle completion
  if (subagentStatus.status === 'done') {
    console.log(`✅ Phase ${st.currentPhase} (${phaseConfig?.name}) completed`);
    
    // Reset retry count on success
    if (st.retryCount) {
      st.retryCount = 0;
    }
    
    const oldPhase = st.currentPhase;
    state.advancePhase(st);
    
    if (st.currentPhase > 8) {
      console.log('🎉 Workflow COMPLETED!');
      return { ok: true, status: 'completed', phase: 8 };
    }
    
    // Auto-spawn next phase
    const nextPhaseConfig = phases.getPhase(st.currentPhase);
    console.log(`➡️ Advancing to Phase ${st.currentPhase}: ${nextPhaseConfig?.name}`);
    
    // Determine if parallel execution needed
    const parallelAgents = nextPhaseConfig.parallelAgents || null;
    
    const spawnResult = spawn.spawnPhaseAgent(st, st.currentPhase, parallelAgents);
    
    if (!spawnResult.ok) {
      console.error(`❌ Failed to spawn Phase ${st.currentPhase}`);
      state.addError(st, {
        type: 'spawn_failure',
        phase: st.currentPhase,
        error: spawnResult.error
      });
      return { 
        ok: false, 
        status: 'spawn_failed',
        fromPhase: oldPhase,
        toPhase: st.currentPhase,
        error: spawnResult.error
      };
    }
    
    console.log(`🚀 Spawned ${spawnResult.parallel ? 'parallel agents' : 'agent'}: ${spawnResult.sessions.map(s => s.agentId).join(', ')}`);
    
    return { 
      ok: true, 
      status: 'spawned',
      fromPhase: oldPhase,
      toPhase: st.currentPhase,
      sessions: spawnResult.sessions,
      parallel: spawnResult.parallel
    };
    
  } else if (subagentStatus.status === 'failed') {
    // Retry logic
    if (retryCount < maxRetries) {
      st.retryCount = retryCount + 1;
      state.saveState(st);
      console.log(`⚠️ Subagent failed (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`);
      return { 
        ok: true, 
        status: 'retry',
        phase: st.currentPhase,
        retryCount: st.retryCount
      };
    }
    
    // Max retries exceeded
    console.log(`❌ Phase ${st.currentPhase} failed after ${maxRetries + 1} attempts`);
    state.addError(st, {
      type: 'subagent_failure',
      phase: st.currentPhase,
      error: subagentStatus.error,
      retries: retryCount + 1
    });
    return { 
      ok: false, 
      status: 'failed',
      phase: st.currentPhase,
      error: 'Max retries exceeded'
    };
    
  } else if (subagentStatus.status === 'running') {
    return { 
      ok: true, 
      status: 'running',
      phase: st.currentPhase,
      phaseName: phaseConfig?.name
    };
  }
  
  // Unknown status (not_found, api_error, etc.)
  return { 
    ok: true, 
    status: subagentStatus.status,
    phase: st.currentPhase
  };
}

// Run if called directly
if (require.main === module) {
  const result = checkAndAdvance();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { checkAndAdvance };
