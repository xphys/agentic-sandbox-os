# Multi-Agent System Architecture

## Overview

This AI OS Demo now features a **multi-agent system** with intelligent task planning, delegation, and supervisor-controlled Human-in-the-Loop (HITL) decision making.

## Architecture

### Agent Hierarchy

```
┌─────────────────────────────────────────────┐
│         🧠 Supervisor Agent                 │
│  - Plans execution strategy                 │
│  - Delegates tasks to workers               │
│  - Makes HITL safety decisions              │
│  - Coordinates overall workflow             │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐ ┌─────▼──────┐
│ ⚡ Executor  │ │ 📊 Analyzer │
│   Agent     │ │    Agent    │
│             │ │             │
│ - Executes  │ │ - Analyzes  │
│   commands  │ │   results   │
│ - Reports   │ │ - Validates │
│   results   │ │   outcomes  │
└─────────────┘ └─────────────┘
```

## Agents

### 1. Supervisor Agent (🧠)

**Role**: Strategic planner and safety coordinator

**Responsibilities**:
- Analyzes user requests
- Creates step-by-step execution plans
- Decides when to trigger HITL confirmation
- Evaluates command safety with context awareness
- Delegates tasks to appropriate worker agents

**Key Methods**:

```typescript
// Plans the entire task execution
async planTask(userRequest: string): Promise<{
  plan: string[];        // Step-by-step execution plan
  needsHITL: boolean;    // Whether upfront approval needed
  reasoning: string;     // Safety reasoning
}>

// Evaluates individual command safety
async shouldTriggerHITL(command: string, context: string): Promise<{
  shouldConfirm: boolean;  // Whether confirmation needed
  reasoning: string;       // Explanation of decision
}>
```

**Decision Factors**:
- Will this delete, move, or modify multiple files?
- Is this a system-level operation?
- Could this have unintended consequences?
- Is the request ambiguous or unclear?
- What is the reversibility of the action?
- What is the scope of impact?

### 2. Executor Agent (⚡)

**Role**: Command execution specialist

**Responsibilities**:
- Executes bash commands in sandboxed environment
- Reports execution status and results
- Provides real-time progress updates

**Key Methods**:

```typescript
async execute(command: string): Promise<string>
```

**Status Updates**:
- `agent_working`: Starting execution
- `executing`: Running the command
- `agent_completed`: Finished with results

### 3. Analyzer Agent (📊)

**Role**: Result validation and analysis

**Responsibilities**:
- Analyzes command execution results
- Validates outcomes
- Provides insights on command effects

**Key Methods**:

```typescript
async analyze(command: string, result: string): Promise<string>
```

## Multi-Agent Workflow

### Example: "Create a project folder with README"

```
Step 1: Supervisor Planning
└─> 🧠 Supervisor: "Analyzing request..."
    ├─> Creates plan:
    │   1. Create directory 'project'
    │   2. Create README.md file
    │   3. Add initial content to README
    └─> Decision: Safe, no upfront HITL needed

Step 2: Supervisor Delegation
└─> 📋 Supervisor → ExecutorAgent
    └─> "Beginning execution with worker agents"

Step 3: Worker Execution (Step 1)
└─> 🤔 Worker: "Analyzing task..."
    └─> 🔧 Tool Use: execute_bash
        └─> 🛡️ Supervisor: "Evaluating command safety..."
            ├─> Command: mkdir project
            ├─> Pattern check: SAFE
            ├─> Supervisor check: SAFE
            └─> Decision: No confirmation needed
                └─> ⚡ Executor: "Executing: mkdir project"
                    └─> ✅ Executor: "Command completed"
                        └─> 📊 Analyzer: "Analyzing results..."
                            └─> ✅ Analyzer: "Analysis complete"
                                └─> 👀 Worker: "Observing result..."

Step 4: Worker Execution (Step 2)
└─> [Similar flow for README creation]

Step 5: Final Response
└─> ✅ "Project created with README.md"
```

### Example with HITL: "Delete all .tmp files"

```
Step 1: Supervisor Planning
└─> 🧠 Supervisor: "Analyzing request..."
    ├─> Creates plan:
    │   1. Find all .tmp files
    │   2. Delete matched files
    └─> Decision: REQUIRES UPFRONT HITL
        └─> Reasoning: "Will delete multiple files with wildcards"

Step 2: Upfront HITL Request
└─> ⚠️ Human Confirmation Required
    ├─> Plan: "Find .tmp files → Delete matched files"
    ├─> Reason: "Will delete multiple files with wildcards"
    └─> 🧠 Supervisor: "Recommends confirmation: destructive operation"
        └─> [✓ Approve] [✗ Decline] ← User Decision

Step 3a: If Approved
└─> Continue with execution flow...

Step 3b: If Declined
└─> 🛑 "Task cancelled by user"
```

### Example with Command-Level HITL: "Organize files"

```
Step 1: Supervisor Planning
└─> 🧠 Supervisor: "Analyzing request..."
    └─> Decision: Safe to start, evaluate commands individually

Step 2: Safe Command
└─> Command: ls -la
    └─> 🛡️ Supervisor: "SAFE - read-only operation"
        └─> ⚡ Execute immediately (no confirmation)

Step 3: Destructive Command
└─> Command: rm *.log
    └─> 🛡️ Supervisor: "REQUIRES CONFIRMATION"
        ├─> Pattern: Matches wildcard deletion
        ├─> Reasoning: "Multiple files, irreversible"
        └─> ⚠️ Request user approval
            └─> User decides: Approve or Decline
```

## Status Types

### Supervisor Statuses

| Status | Icon | Description | Color |
|--------|------|-------------|-------|
| `supervisor_thinking` | 🧠 | Planning execution strategy | Indigo |
| `supervisor_delegating` | 📋 | Assigning work to agents | Cyan |
| `supervisor_deciding_hitl` | 🛡️ | Evaluating command safety | Amber |

### Worker Agent Statuses

| Status | Icon | Description | Color |
|--------|------|-------------|-------|
| `agent_working` | ⚙️ | Agent performing task | Teal |
| `agent_completed` | ✅ | Agent finished task | Emerald |
| `thinking` | 🤔 | Worker analyzing | Blue |
| `tool_use` | 🔧 | Using a tool | Purple |
| `executing` | ⚡ | Running command | Yellow |
| `observing` | 👀 | Processing results | Green |

### HITL Status

| Status | Icon | Description | Color |
|--------|------|-------------|-------|
| `await_confirmation` | ⚠️ | User approval needed | Orange |

## HITL Decision Levels

### Level 1: Upfront Planning HITL

**When**: Supervisor determines entire task is risky

**Examples**:
- "Delete all files in this directory"
- "Remove old projects"
- "Clean up everything"

**User Sees**: Complete execution plan before any action

### Level 2: Command-Level HITL

**When**: Individual command within task is risky

**Examples**:
- `rm *.txt` (wildcard deletion)
- `mv * backup/` (batch move)
- `rm -r folder/` (recursive delete)

**User Sees**: Specific command with supervisor's reasoning

### Level 3: Pattern-Based HITL

**When**: Command matches destructive patterns

**Patterns**:
- `rm -r` (recursive delete)
- `rm *` (wildcard delete)
- `mv *` (wildcard move)
- `cp -r *` (recursive copy with wildcards)
- `> /dev/` (device file writes)

### Level 4: No HITL

**When**: Commands are safe and reversible

**Examples**:
- `ls` (list files)
- `pwd` (show directory)
- `cat file.txt` (read file)
- `mkdir folder` (create folder)
- `echo "text" > file.txt` (write to file)

## Implementation Details

### Backend Architecture

**File**: [app/api/chat/route.ts](app/api/chat/route.ts)

```typescript
// Agent classes
class SupervisorAgent {
  async planTask(userRequest: string)
  async shouldTriggerHITL(command: string, context: string)
}

class ExecutorAgent {
  async execute(command: string): Promise<string>
}

class AnalyzerAgent {
  async analyze(command: string, result: string): Promise<string>
}

// Main flow
export async function POST(request: NextRequest) {
  // Initialize agents
  const supervisor = new SupervisorAgent(anthropic, sendStatus);
  const executor = new ExecutorAgent(sendStatus);
  const analyzer = new AnalyzerAgent(sendStatus);

  // Supervisor creates plan
  const { plan, needsHITL, reasoning } = await supervisor.planTask(userMessage);

  // Upfront HITL if needed
  if (needsHITL) {
    // Request confirmation
    const approved = await waitForConfirmation(confirmationId);
    if (!approved) return;
  }

  // Execute with worker agents
  while (toolUseCount < maxToolUses) {
    // Worker decides what to do
    const response = await anthropic.messages.create({...});

    // For each command, supervisor checks safety
    const { shouldConfirm } = await supervisor.shouldTriggerHITL(command, context);

    if (shouldConfirm) {
      // Request command-level confirmation
      const approved = await waitForConfirmation(confirmationId);
      if (!approved) continue;
    }

    // Execute with executor agent
    const result = await executor.execute(command);

    // Analyze with analyzer agent
    await analyzer.analyze(command, result);
  }
}
```

### Frontend Display

**File**: [app/page.tsx](app/page.tsx)

```typescript
type AgentStatus =
  | { type: 'supervisor_thinking', message: string, plan?: string[] }
  | { type: 'supervisor_delegating', task: string, targetAgent: string }
  | { type: 'supervisor_deciding_hitl', command: string, reasoning: string }
  | { type: 'agent_working', agent: string, task: string }
  | { type: 'agent_completed', agent: string, result: string }
  | ... other statuses

const renderAgentStatus = () => {
  // Special rendering for each agent type
  switch (agentStatus.type) {
    case 'supervisor_thinking':
      return <SupervisorThinkingDisplay />;
    case 'agent_working':
      return <AgentWorkingDisplay />;
    // ... etc
  }
};
```

## Benefits

### 1. Intelligent Safety Decisions

Instead of simple pattern matching, the supervisor agent uses AI reasoning:

```
Pattern: "rm *.txt" → Always requires confirmation
Supervisor: "rm *.txt in test directory with 2 files" → May not require confirmation
```

### 2. Context-Aware HITL

Supervisor considers:
- What has been done so far
- What the user is trying to accomplish
- The scope and impact of the command
- The reversibility of the action

### 3. Better User Experience

Users see:
- Clear execution plans before starting
- Individual agent activities
- Which agent is doing what
- Why confirmation is needed

### 4. Transparency

Multi-agent status shows:
- 🧠 Supervisor thinking and planning
- 📋 Task delegation
- 🛡️ Safety evaluations
- ⚡ Command execution
- 📊 Result analysis

## Configuration

### Adjust HITL Sensitivity

Edit [app/api/chat/route.ts:147](app/api/chat/route.ts#L147):

```typescript
// In SupervisorAgent.planTask()
content: `Consider these factors for HITL decision:
- Will this delete, move, or modify multiple files?  ← High priority
- Is this a system-level operation?                  ← Medium priority
- Could this have unintended consequences?           ← High priority
- Is the request ambiguous or unclear?               ← Low priority
`
```

### Add More Agents

```typescript
class ValidatorAgent {
  async validate(result: string): Promise<boolean> {
    // Validate execution results
    return true;
  }
}

class PlannerAgent {
  async createDetailedPlan(task: string): Promise<string[]> {
    // Create more detailed plans
    return ['step1', 'step2'];
  }
}

// Initialize in POST handler
const validator = new ValidatorAgent(sendStatus);
const planner = new PlannerAgent(anthropic, sendStatus);
```

### Customize Agent Prompts

```typescript
// Supervisor planning prompt
content: `You are a supervisor agent responsible for planning tasks and ensuring safety.

Your priorities:
1. User safety (prevent data loss)
2. Task completion (fulfill user intent)
3. Efficiency (minimize steps)
4. Clarity (explain decisions)

User request: "${userRequest}"
...`
```

## Testing

### Test Upfront HITL

```bash
cd ai-os-demo
pnpm dev
```

Try:
```
"Delete all temporary files in the current directory"
```

Expected:
1. 🧠 Supervisor creates plan
2. ⚠️ Upfront confirmation request
3. User approves/declines
4. Execution proceeds or cancels

### Test Command-Level HITL

Try:
```
"List all .log files, then delete them"
```

Expected:
1. 🧠 Supervisor: Safe to start
2. ⚡ Executor: `ls *.log` (no confirmation)
3. 🛡️ Supervisor: Evaluates `rm *.log`
4. ⚠️ Command-level confirmation
5. User approves/declines

### Test Multi-Step with Multiple Agents

Try:
```
"Create a project folder, add a README, and list the contents"
```

Expected:
1. 🧠 Supervisor: Plans 3 steps
2. 📋 Supervisor: Delegates to ExecutorAgent
3. ⚙️ Executor: Creates folder
4. ✅ Executor: Complete
5. 📊 Analyzer: Analyzes result
6. ✅ Analyzer: Complete
7. [Repeat for README and ls]

## Comparison to Single-Agent

| Aspect | Single-Agent | Multi-Agent |
|--------|--------------|-------------|
| **Planning** | None | Supervisor creates plan |
| **Safety** | Pattern-based only | AI-powered reasoning |
| **HITL** | Fixed rules | Context-aware decisions |
| **Visibility** | Basic status | Agent-level granularity |
| **Delegation** | N/A | Clear task assignment |
| **Scalability** | Limited | Easily add agents |

## Architecture Benefits

### Separation of Concerns

- **Supervisor**: Strategic decisions
- **Executor**: Tactical execution
- **Analyzer**: Quality assurance

### Extensibility

Add new agents without changing core logic:
```typescript
class SecurityAgent extends BaseAgent {
  async scanForVulnerabilities(command: string) { ... }
}

class OptimizationAgent extends BaseAgent {
  async suggestBetterCommand(command: string) { ... }
}
```

### Parallelization (Future)

```typescript
// Execute multiple commands in parallel
const results = await Promise.all([
  executor1.execute('ls'),
  executor2.execute('pwd'),
  executor3.execute('whoami')
]);
```

## Future Enhancements

### 1. Agent Learning

```typescript
class SupervisorAgent {
  private userPreferences: Map<string, boolean>;

  async shouldTriggerHITL(command: string): Promise<boolean> {
    // Check if user previously approved similar commands
    if (this.userPreferences.has(commandPattern)) {
      return !this.userPreferences.get(commandPattern);
    }
    // ... normal logic
  }

  recordUserDecision(command: string, approved: boolean) {
    const pattern = this.extractPattern(command);
    this.userPreferences.set(pattern, approved);
  }
}
```

### 2. Agent Collaboration

```typescript
// Agents discuss before acting
const supervisorOpinion = await supervisor.evaluate(command);
const securityOpinion = await securityAgent.evaluate(command);
const executorOpinion = await executor.evaluate(command);

const consensus = await supervisor.makeDecision([
  supervisorOpinion,
  securityOpinion,
  executorOpinion
]);
```

### 3. Agent Specialization

```typescript
class FileSystemAgent extends ExecutorAgent {
  specializes = ['ls', 'mkdir', 'rm', 'cp', 'mv'];
}

class NetworkAgent extends ExecutorAgent {
  specializes = ['curl', 'wget', 'ping', 'ssh'];
}

// Supervisor delegates to specialist
if (command.startsWith('curl')) {
  result = await networkAgent.execute(command);
}
```

### 4. Parallel Agent Execution

```typescript
// Multiple agents work simultaneously
const tasks = [
  { agent: 'executor1', command: 'mkdir project' },
  { agent: 'executor2', command: 'mkdir tests' },
  { agent: 'executor3', command: 'mkdir docs' }
];

await supervisor.executeParallel(tasks);
```

## Summary

The multi-agent system provides:

✅ **Intelligent Planning** - Supervisor analyzes and plans before executing
✅ **Context-Aware Safety** - AI-powered HITL decisions, not just patterns
✅ **Clear Delegation** - See which agent is doing what
✅ **Better Visibility** - Agent-level status updates
✅ **Extensible Design** - Easy to add new agents
✅ **Separation of Concerns** - Each agent has specific responsibilities

This transforms the system from a simple command executor to an intelligent, coordinated multi-agent platform that prioritizes safety while maintaining efficiency.

---

**Status**: ✅ Fully Implemented
**Build**: ✅ Successful
**Testing**: Ready to use with `pnpm dev`
