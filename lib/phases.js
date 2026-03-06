/**
 * Phase Definitions for 8-Phase Development Workflow
 */

const phases = {
  0: {
    name: "REQUIREMENTS",
    agentId: "dev-orchestrator",
    description: "Create requirements document",
    taskTemplate: (ctx) => `Phase 0: REQUIREMENTS - Create REQUIREMENTS.md for "${ctx.projectName}".

PROJECT: ${ctx.projectName}
DESCRIPTION: ${ctx.description || 'TBD'}

Create a comprehensive REQUIREMENTS.md with:
- Project overview
- Goals and objectives
- Functional requirements (P0/P1/P2)
- Non-functional requirements
- Constraints (budget, timeline, tech stack)
- Success criteria
- Risks and mitigations

Output: REQUIREMENTS.md in workspace root.
Ask for USER confirmation before proceeding to Phase 1.

Output in English.`,
    timeout: 120000,
    deliverable: "REQUIREMENTS.md",
    next: 1
  },
  
  1: {
    name: "ANALYSIS",
    agentId: "research",
    description: "Research technologies and APIs",
    taskTemplate: (ctx) => `Phase 1: ANALYSIS - Research for "${ctx.projectName}".

PROJECT: ${ctx.projectName}
REQUIREMENTS: See REQUIREMENTS.md

TASKS:
1. Research required technologies, APIs, and libraries
2. Evaluate alternatives with pros/cons
3. Check API rate limits, authentication, costs
4. Create proof-of-concept if needed for risky tech
5. Document findings

DELIVERABLE: specs/analysis.md with:
- Technology recommendations
- API documentation
- Sample code snippets
- Risk assessment

Output in English.`,
    timeout: 180000,
    deliverable: "specs/analysis.md",
    next: 2
  },
  
  2: {
    name: "DESIGN",
    agentId: "architect",
    description: "System architecture and design",
    taskTemplate: (ctx) => `Phase 2: DESIGN - System Architecture for "${ctx.projectName}".

PROJECT: ${ctx.projectName}
INPUTS: REQUIREMENTS.md, specs/analysis.md

TASKS:
1. Define system architecture (components, layers)
2. Design data models and schemas
3. Define API contracts (if applicable)
4. Plan error handling strategy
5. Create architecture diagram (text/Mermaid)

DELIVERABLE: specs/architecture.md with:
- Component diagram
- Data models
- API specifications
- Error handling plan

Output in English.`,
    timeout: 180000,
    deliverable: "specs/architecture.md",
    next: 3
  },
  
  3: {
    name: "PLANNING",
    agentId: "dev-orchestrator",
    description: "Create project plan and GitHub issues",
    taskTemplate: (ctx) => `Phase 3: PLANNING - Project Plan for "${ctx.projectName}".

PROJECT: ${ctx.projectName}
INPUTS: specs/architecture.md

TASKS:
1. Break down work into GitHub issues (10-15 issues)
2. Create issue labels (priority, type, domain)
3. Define sprint/iteration plan
4. Create repo structure

DELIVERABLE: specs/project-plan.md with:
- Issue list with priorities
- Label definitions
- Sprint timeline
- Repo structure

Output in English.`,
    timeout: 120000,
    deliverable: "specs/project-plan.md",
    next: 4
  },
  
  4: {
    name: "IMPLEMENTATION",
    agentId: "backend",
    description: "Implement backend and frontend",
    taskTemplate: (ctx) => `Phase 4: IMPLEMENTATION - Build "${ctx.projectName}".

PROJECT: ${ctx.projectName}
INPUTS: specs/architecture.md, specs/project-plan.md

TASK:
Implement the core functionality according to the architecture spec.

Focus on:
- Backend: APIs, business logic, data layer
- Tests: Unit + integration tests
- Documentation: Code comments, README

DELIVERABLE: Working code + tests in GitHub repo.

Output in English.`,
    timeout: 300000,
    deliverable: "src/",
    next: 5
  },
  
  5: {
    name: "QA",
    agentId: "qa",
    description: "Code review and testing",
    taskTemplate: (ctx) => `Phase 5: REVIEW - Quality Assurance for "${ctx.projectName}".

PROJECT: ${ctx.projectName}

TASKS:
1. Review all code changes
2. Verify test coverage (>80%)
3. Security review (inputs, auth, etc.)
4. Performance check
5. Run full test suite

DELIVERABLE: QA report with:
- Issues found (P0/P1/P2)
- Test results
- Approval or change requests

Output in English.`,
    timeout: 120000,
    deliverable: "specs/qa-report.md",
    next: 6
  },
  
  6: {
    name: "DOCUMENTATION",
    agentId: "docs",
    description: "Write documentation",
    taskTemplate: (ctx) => `Phase 6: DOCUMENTATION - Docs for "${ctx.projectName}".

PROJECT: ${ctx.projectName}

TASKS:
1. Write/update README.md
2. API documentation
3. User guide (if applicable)
4. Changelog
5. Contributing guide

DELIVERABLE: Complete documentation in repo.

Output in English.`,
    timeout: 90000,
    deliverable: "README.md",
    next: 7
  },
  
  7: {
    name: "DEPLOYMENT",
    agentId: "devops",
    description: "CI/CD setup and deployment",
    taskTemplate: (ctx) => `Phase 7: DEPLOYMENT - Deploy "${ctx.projectName}".

PROJECT: ${ctx.projectName}

TASKS:
1. Setup CI/CD pipeline (GitHub Actions)
2. Configure deployment environment
3. Set up monitoring/alerting
4. Create release/tag
5. Deploy to production

DELIVERABLE: Live deployment + release notes.

Output in English.`,
    timeout: 180000,
    deliverable: "Release",
    next: 8
  },
  
  8: {
    name: "CLOSURE",
    agentId: "dev-orchestrator",
    description: "Project closure and retrospective",
    taskTemplate: (ctx) => `Phase 8: CLOSURE - Wrap up "${ctx.projectName}".

PROJECT: ${ctx.projectName}

TASKS:
1. Update MEMORY.md with lessons learned
2. Close all GitHub issues
3. Create final summary report
4. Archive project state
5. Retrospective

DELIVERABLE: Closure report + summary to user.

Output in English.`,
    timeout: 90000,
    deliverable: "specs/closure-report.md",
    next: null
  }
};

/**
 * Get phase by number
 */
function getPhase(phaseNumber) {
  return phases[phaseNumber] || null;
}

/**
 * Get all phases
 */
function getAllPhases() {
  return Object.values(phases);
}

/**
 * Get next phase number
 */
function getNextPhase(phaseNumber) {
  const phase = phases[phaseNumber];
  return phase ? phase.next : null;
}

/**
 * Check if phase is terminal
 */
function isTerminal(phaseNumber) {
  return phaseNumber === 8 || phases[phaseNumber]?.next === null;
}

module.exports = {
  phases,
  getPhase,
  getAllPhases,
  getNextPhase,
  isTerminal
};
