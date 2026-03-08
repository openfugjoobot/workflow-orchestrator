#!/usr/bin/env node
/**
 * Workflow Orchestrator - Show Status
 * 
 * Usage: node bin/status.js
 */

const fs = require('fs');
const path = require('path');
const stateLib = require('../lib/state');
const phases = require('../lib/phases');
const spawn = require('../lib/spawn');

/**
 * Format duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Show workflow status
 */
function showStatus() {
  const st = stateLib.loadState();
  
  if (!st) {
    console.log('📭 No workflow found');
    console.log('Start one with: node bin/start.js "Project Name"');
    return;
  }
  
  console.log(`\n📊 Workflow Status: ${st.projectName}`);
  console.log(`   Project ID: ${st.projectId}`);
  console.log(`   Status: ${st.status.toUpperCase()}`);
  console.log('');
  
  // Current phase
  if (st.status === 'running') {
    const phaseConfig = phases.getPhase(st.currentPhase);
    console.log(`⏳ Current Phase: ${st.currentPhase} - ${phaseConfig?.name}`);
    
    if (st.parallelPhase) {
      console.log(`   Mode: Parallel execution`);
      console.log(`   Active agents: ${st.activeSubagents?.length || 0}`);
    } else if (st.activeSubagent) {
      console.log(`   Agent: ${phaseConfig?.agentId}`);
      
      // Check live status
      const liveStatus = spawn.getSubagentStatus(st.activeSubagent);
      console.log(`   Subagent: ${liveStatus.status}`);
    }
    
    if (st.retryCount > 0) {
      console.log(`   ⚠️ Retry: ${st.retryCount}/${st.config?.maxRetries || 2}`);
    }
    console.log('');
  }
  
  // Progress
  console.log(`📈 Progress: ${st.completedPhases.length}/9 phases completed`);
  if (st.completedPhases.length > 0) {
    const completedNames = st.completedPhases.map(p => phases.getPhase(p)?.name).join(' → ');
    console.log(`   Completed: ${completedNames}`);
  }
  console.log('');
  
  // Timing
  if (st.startedAt) {
    const started = new Date(st.startedAt);
    const duration = Date.now() - started.getTime();
    console.log(`⏱️ Runtime: ${formatDuration(duration)}`);
    console.log(`   Started: ${started.toLocaleString('de-IT')}`);
  }
  
  // Artifacts
  if (st.artifacts && Object.keys(st.artifacts).length > 0) {
    console.log('');
    console.log(`📦 Artifacts: ${Object.keys(st.artifacts).length}`);
    for (const [key, value] of Object.entries(st.artifacts)) {
      console.log(`   ${key}: ${typeof value === 'string' ? value : 'object'}`);
    }
  }
  
  // Errors
  if (st.errors && st.errors.length > 0) {
    console.log('');
    console.log(`❌ Errors: ${st.errors.length}`);
    st.errors.slice(-3).forEach(err => {
      console.log(`   Phase ${err.phase}: ${err.error?.type || err.type || 'unknown'}`);
    });
  }
  
  console.log('');
  
  // Status-specific hints
  if (st.status === 'completed') {
    console.log('🎉 Workflow completed! Use /workflow export for summary.');
  } else if (st.status === 'paused') {
    console.log('⏸️ Workflow paused. Resume with: node bin/resume.js');
  } else if (st.status === 'cancelled') {
    console.log('❌ Workflow cancelled.');
  }
  
  console.log('');
}

showStatus();
