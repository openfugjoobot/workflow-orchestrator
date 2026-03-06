/**
 * State Management for Workflow Orchestrator
 * Persists workflow state to JSON file with backup
 */

const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '../memory/workflow-state.json');
const BACKUP_DIR = path.join(__dirname, '../memory/backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create initial state for a new workflow
 */
function createInitialState(projectName, options = {}) {
  const timestamp = new Date().toISOString();
  const projectId = `workflow-${projectName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  
  return {
    projectId,
    projectName,
    status: 'running',
    currentPhase: 0,
    completedPhases: [],
    activeSubagent: null,
    subagentRunId: null,
    startedAt: timestamp,
    lastUpdate: timestamp,
    artifacts: {},
    errors: [],
    config: {
      heartbeatInterval: 30000, // 30 seconds
      maxRetries: 2,
      baseTimeout: 120000, // 2 minutes
      ...options
    }
  };
}

/**
 * Load current state from file
 */
function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load state:', err.message);
    
    // Try to restore from backup
    const backups = getBackups();
    if (backups.length > 0) {
      console.log('Restoring from backup:', backups[0]);
      return restoreFromBackup(backups[0]);
    }
    
    return null;
  }
}

/**
 * Save state to file with backup
 */
function saveState(state) {
  state.lastUpdate = new Date().toISOString();
  
  // Create backup
  if (fs.existsSync(STATE_PATH)) {
    createBackup();
  }
  
  // Write new state
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Create timestamped backup
 */
function createBackup() {
  if (!fs.existsSync(STATE_PATH)) return;
  
  const timestamp = Date.now();
  const backupPath = path.join(BACKUP_DIR, `workflow-state.${timestamp}.json`);
  fs.copyFileSync(STATE_PATH, backupPath);
  
  // Cleanup old backups (keep last 5)
  cleanupOldBackups();
}

/**
 * Get list of backups
 */
function getBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('workflow-state.') && f.endsWith('.json'))
    .sort()
    .reverse();
}

/**
 * Restore from backup
 */
function restoreFromBackup(backupFile) {
  const backupPath = path.join(BACKUP_DIR, backupFile);
  const data = fs.readFileSync(backupPath, 'utf8');
  const state = JSON.parse(data);
  saveState(state);
  return state;
}

/**
 * Cleanup old backups, keep last N
 */
function cleanupOldBackups(keep = 5) {
  const backups = getBackups();
  if (backups.length <= keep) return;
  
  backups.slice(keep).forEach(backup => {
    fs.unlinkSync(path.join(BACKUP_DIR, backup));
  });
}

/**
 * Update phase in state
 */
function advancePhase(state) {
  state.completedPhases.push(state.currentPhase);
  state.currentPhase++;
  state.activeSubagent = null;
  state.subagentRunId = null;
  
  if (state.currentPhase > 8) {
    state.status = 'completed';
  }
  
  saveState(state);
  return state;
}

/**
 * Set active subagent
 */
function setActiveSubagent(state, sessionKey, runId) {
  state.activeSubagent = sessionKey;
  state.subagentRunId = runId;
  saveState(state);
  return state;
}

/**
 * Record artifact from completed phase
 */
function addArtifact(state, phase, artifact) {
  state.artifacts[`phase${phase}`] = artifact;
  saveState(state);
  return state;
}

/**
 * Record error
 */
function addError(state, error) {
  state.errors.push({
    timestamp: new Date().toISOString(),
    phase: state.currentPhase,
    error
  });
  saveState(state);
  return state;
}

/**
 * Pause workflow
 */
function pauseState(state) {
  state.status = 'paused';
  saveState(state);
  return state;
}

/**
 * Resume workflow
 */
function resumeState(state) {
  state.status = 'running';
  saveState(state);
  return state;
}

/**
 * Cancel workflow
 */
function cancelState(state) {
  state.status = 'cancelled';
  saveState(state);
  return state;
}

module.exports = {
  STATE_PATH,
  createInitialState,
  loadState,
  saveState,
  advancePhase,
  setActiveSubagent,
  addArtifact,
  addError,
  pauseState,
  resumeState,
  cancelState,
  getBackups,
  restoreFromBackup
};
