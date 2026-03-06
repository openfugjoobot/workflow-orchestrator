#!/usr/bin/env node
/**
 * Workflow Orchestrator - Main Entry Point
 * 
 * Usage:
 *   node orchestrator.js start <projectName>
 *   node orchestrator.js status
 *   node orchestrator.js pause
 *   node orchestrator.js resume
 *   node orchestrator.js cancel
 */

const { execSync } = require('child_process');
const state = require('./lib/state');
const phases = require('./lib/phases');

const PROJECT_WORKSPACE = process.env.PROJECT_WORKSPACE || '/home/ubuntu/.openclaw/workspace';

/**
 * Execute OpenClaw command
 */
function openclaw(args) {
  try {
    const result = execSync(`openclaw ${args}`, {
      encoding: 'utf8',
      cwd: PROJECT_WORKSPACE,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true, output: result };
  } catch (err) {
    return { 
      ok: false, 
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr
    };
  }
}

/**
 * Spawn a subagent
 */
function spawnSubagent(agentId, task, timeout) {
  console.log(`Spawning ${agentId}...`);
  
  const sessionLabel = `workflow-${Date.now()}`;
  
  // Use sessions_spawn via openclaw
  const result = openclaw(`sessions_spawn --agent ${agentId} --label ${sessionLabel} --mode run --runtime subagent --timeout ${timeout/1000} --task "${task.replace(/"/g, '\\"')}"`);
  
  if (!result.ok) {
    console.error('Failed to spawn subagent:', result.error);
    return null;
  }
  
  // Parse output to extract sessionKey and runId
  // Output format: {"status":"accepted","sessionKey":"...","runId":"..."}
  try {
    const json = JSON.parse(result.output);
    return {
      sessionKey: json.sessionKey || json.childSessionKey,
      runId: json.runId
    };
  } catch (e) {
    console.error('Failed to parse spawn response:', result.output);
    return null;
  }
}

/**
 * Check subagent status
 */
function checkSubagent(sessionKey) {
  const result = openclaw(`subagents list --recent-minutes 60`);
  
  if (!result.ok) {
    return { status: 'unknown', error: result.error };
  }
  
  try {
    const json = JSON.parse(result.output);
    const active = json.active || [];
    const recent = json.recent || [];
    
    // Check if our session is active
    const activeMatch = active.find(a => a.sessionKey === sessionKey);
    if (activeMatch) {
      return { status: 'running', runtime: activeMatch.runtime };
    }
    
    // Check if recently completed
    const recentMatch = recent.find(r => r.sessionKey === sessionKey);
    if (recentMatch) {
      return { 
        status: recentMatch.status, 
        runtime: recentMatch.runtime,
        tokens: recentMatch.totalTokens
      };
    }
    
    return { status: 'not_found' };
  } catch (e) {
    return { status: 'parse_error', error: e.message };
  }
}

/**
 * Start new workflow
 */
function startWorkflow(projectName, options = {}) {
  console.log(`Starting workflow for: ${projectName}`);
  
  // Check if workflow already running
  const existingState = state.loadState();
  if (existingState && existingState.status === 'running') {
    console.log('Workflow already running. Use --force to restart.');
    return { ok: false, error: 'Workflow already in progress' };
  }
  
  // Create initial state
  const initialState = state.createInitialState(projectName, options);
  state.saveState(initialState);
  
  console.log(`Workflow ID: ${initialState.projectId}`);
  console.log(`Starting Phase 0: ${phases.getPhase(0).name}`);
  
  // Spawn Phase 0
  const phase = phases.getPhase(0);
  const task = phase.taskTemplate({ projectName, ...options });
  
  const subagent = spawnSubagent(phase.agentId, task, phase.timeout);
  
  if (!subagent) {
    state.addError(initialState, 'Failed to spawn Phase 0 subagent');
    return { ok: false, error: 'Failed to spawn subagent' };
  }
  
  state.setActiveSubagent(initialState, subagent.sessionKey, subagent.runId);
  
  console.log(`Subagent spawned: ${subagent.sessionKey}`);
  console.log('Workflow started. Run "status" to check progress.');
  
  return { ok: true, state: initialState };
}

/**
 * Show workflow status
 */
function showStatus() {
  const st = state.loadState();
  
  if (!st) {
    console.log('No active workflow found.');
    return;
  }
  
  const currentPhase = phases.getPhase(st.currentPhase);
  
  console.log(`\nWorkflow: ${st.projectName}`);
  console.log(`Status: ${st.status}`);
  console.log(`Current Phase: ${st.currentPhase} - ${currentPhase?.name || 'COMPLETE'}`);
  console.log(`Active Subagent: ${st.activeSubagent || 'none'}`);
  console.log(`Completed Phases: ${st.completedPhases.join(', ') || 'none'}`);
  console.log(`Artifacts: ${Object.keys(st.artifacts).length}`);
  
  if (st.activeSubagent) {
    const subagentStatus = checkSubagent(st.activeSubagent);
    console.log(`Subagent Status: ${subagentStatus.status}`);
    if (subagentStatus.runtime) {
      console.log(`Runtime: ${subagentStatus.runtime}`);
    }
  }
  
  if (st.errors.length > 0) {
    console.log(`\nErrors: ${st.errors.length}`);
    st.errors.forEach((e, i) => {
      console.log(`  ${i+1}. [${e.timestamp}] Phase ${e.phase}: ${e.error}`);
    });
  }
}

/**
 * Check and advance workflow
 */
function checkAndAdvance() {
  const st = state.loadState();
  
  if (!st || st.status !== 'running') {
    console.log('No active workflow to check.');
    return;
  }
  
  if (!st.activeSubagent) {
    console.log('No active subagent. Workflow may need manual intervention.');
    return;
  }
  
  console.log('Checking subagent status...');
  const subagentStatus = checkSubagent(st.activeSubagent);
  
  console.log(`Subagent status: ${subagentStatus.status}`);
  
  if (subagentStatus.status === 'done' || subagentStatus.status === 'timeout') {
    console.log(`Phase ${st.currentPhase} completed.`);
    
    // Advance to next phase
    const oldPhase = phases.getPhase(st.currentPhase);
    state.advancePhase(st);
    
    if (st.currentPhase > 8) {
      console.log('🎉 Workflow completed!');
      return;
    }
    
    const newPhase = phases.getPhase(st.currentPhase);
    console.log(`Starting Phase ${st.currentPhase}: ${newPhase.name}`);
    
    const task = newPhase.taskTemplate({ 
      projectName: st.projectName 
    });
    
    const subagent = spawnSubagent(newPhase.agentId, task, newPhase.timeout);
    
    if (!subagent) {
      state.addError(st, `Failed to spawn Phase ${st.currentPhase} subagent`);
      console.error('Failed to spawn subagent for next phase.');
      return;
    }
    
    state.setActiveSubagent(st, subagent.sessionKey, subagent.runId);
    console.log(`Subagent spawned: ${subagent.sessionKey}`);
    
  } else if (subagentStatus.status === 'running') {
    console.log(`Subagent still running (${subagentStatus.runtime})`);
    
  } else if (subagentStatus.status === 'not_found') {
    console.log('Subagent not found - may have completed or failed.');
    // Consider it done and advance
    state.advancePhase(st);
  }
}

/**
 * Pause workflow
 */
function pauseWorkflow() {
  const st = state.loadState();
  if (!st) {
    console.log('No active workflow found.');
    return;
  }
  
  state.pauseState(st);
  console.log('Workflow paused.');
}

/**
 * Resume workflow
 */
function resumeWorkflow() {
  const st = state.loadState();
  if (!st) {
    console.log('No paused workflow found.');
    return;
  }
  
  state.resumeState(st);
  console.log('Workflow resumed.');
  checkAndAdvance();
}

/**
 * Cancel workflow
 */
function cancelWorkflow() {
  const st = state.loadState();
  if (!st) {
    console.log('No active workflow found.');
    return;
  }
  
  state.cancelState(st);
  console.log('Workflow cancelled.');
}

// Main command handler
const command = process.argv[2];
const projectName = process.argv.slice(3).join(' ');

switch (command) {
  case 'start':
    if (!projectName) {
      console.log('Usage: node orchestrator.js start <projectName>');
      process.exit(1);
    }
    startWorkflow(projectName);
    break;
    
  case 'status':
    showStatus();
    break;
    
  case 'check':
    checkAndAdvance();
    break;
    
  case 'pause':
    pauseWorkflow();
    break;
    
  case 'resume':
    resumeWorkflow();
    break;
    
  case 'cancel':
    cancelWorkflow();
    break;
    
  default:
    console.log('Usage: node orchestrator.js <command> [args]');
    console.log('\nCommands:');
    console.log('  start <project>  Start new workflow');
    console.log('  status           Show workflow status');
    console.log('  check            Check and advance workflow');
    console.log('  pause            Pause workflow');
    console.log('  resume           Resume workflow');
    console.log('  cancel           Cancel workflow');
    process.exit(1);
}
