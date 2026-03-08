#!/usr/bin/env node
/**
 * Workflow Orchestrator - Start New Workflow
 * 
 * Usage: node bin/start.js "<projectName>"
 * Example: node bin/start.js "Weather Dashboard"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const stateLib = require('../lib/state');
const phases = require('../lib/phases');
const spawn = require('../lib/spawn');

const STATE_PATH = path.join(__dirname, '../memory/workflow-state.json');

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
 * Check if workflow already running
 */
function hasActiveWorkflow() {
  if (!fs.existsSync(STATE_PATH)) {
    return false;
  }
  
  try {
    const st = stateLib.loadState();
    return st && st.status === 'running';
  } catch (err) {
    return false;
  }
}

/**
 * Start new workflow
 */
function startWorkflow(projectName, description = null) {
  console.log(`🚀 Starting workflow for project: "${projectName}"`);
  
  // Check if already running
  if (hasActiveWorkflow()) {
    console.error('❌ A workflow is already running. Cancel it first or wait for completion.');
    return { ok: false, error: 'Workflow already running' };
  }
  
  // Create initial state
  const st = stateLib.createInitialState(projectName, {
    description
  });
  
  console.log(`📝 Created workflow state: ${st.projectId}`);
  
  // Save state
  stateLib.saveState(st);
  
  // Spawn Phase 0 (REQUIREMENTS)
  const phaseConfig = phases.getPhase(0);
  const ctx = {
    projectName,
    description: description || 'TBD'
  };
  
  console.log(`➡️  Spawning Phase 0: ${phaseConfig.name} (${phaseConfig.agentId})`);
  
  const spawnResult = spawn.spawnPhaseAgent(st, 0);
  
  if (!spawnResult.ok) {
    console.error('❌ Failed to spawn Phase 0 agent');
    stateLib.cancelState(st);
    return spawnResult;
  }
  
  console.log(`✅ Workflow started!`);
  console.log(`   Project: ${projectName}`);
  console.log(`   Phase 0: ${phaseConfig.name}`);
  console.log(`   Agent: ${spawnResult.sessions[0].agentId}`);
  console.log(`   Session: ${spawnResult.sessions[0].sessionKey}`);
  console.log('');
  console.log('The heartbeat will automatically advance through phases.');
  console.log('Check status with: node bin/orchestrator.js check');
  
  return {
    ok: true,
    workflow: st,
    phase: 0,
    session: spawnResult.sessions[0]
  };
}

// CLI entry point
const projectName = process.argv.slice(2).join(' ');

if (!projectName) {
  console.error('Usage: node start.js "<projectName>"');
  console.error('Example: node start.js "Weather Dashboard"');
  process.exit(1);
}

const result = startWorkflow(projectName);
process.exit(result.ok ? 0 : 1);
