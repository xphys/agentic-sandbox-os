# Architecture Overview

## System Design

This project implements the **ReAct (Reasoning + Acting) Loop** pattern for AI-to-OS interaction.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                         (app/page.tsx)                          │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Message    │    │    Input     │    │   Loading    │   │
│  │   Display    │    │    Field     │    │    State     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/chat
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AI ReAct Loop                              │
│                   (app/api/chat/route.ts)                       │
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐              │
│  │ Reason:  │ ──→ │  Action: │ ──→ │ Observe: │              │
│  │ Analyze  │     │  Select  │     │  Get     │              │
│  │ Request  │     │  Tool    │     │  Result  │              │
│  └──────────┘     └────┬─────┘     └────↑─────┘              │
│                        │ execute_bash    │                     │
│                        ↓                 │                     │
│              ┌─────────────────────┐    │                     │
│              │ POST /api/execute   │────┘                     │
│              └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Sandboxed Execution                           │
│                (app/api/execute/route.ts)                       │
│                                                                 │
│  ┌────────────────┐                                            │
│  │ 1. Validate    │  - Check whitelist                         │
│  │    Command     │  - Block dangerous patterns                │
│  └────────┬───────┘                                            │
│           │                                                     │
│  ┌────────↓───────┐                                            │
│  │ 2. Execute     │  - Run in sandbox dir                      │
│  │    in Sandbox  │  - 5s timeout, 1MB limit                   │
│  └────────┬───────┘                                            │
│           │                                                     │
│  ┌────────↓───────┐                                            │
│  │ 3. Return      │  - stdout/stderr                           │
│  │    Output      │  - Error handling                          │
│  └────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
                    ┌─────────────────┐
                    │  Sandbox FS     │
                    │  /sandbox/user/ │
                    └─────────────────┘
```

## Component Breakdown

### 1. Frontend (app/page.tsx)

**Responsibilities:**
- Render chat interface
- Manage conversation state
- Handle user input
- Display AI responses

**Key Features:**
- Real-time message updates
- Loading indicators
- Error handling
- Auto-scroll to latest message

**Technologies:**
- React Server Components
- TypeScript
- Tailwind CSS

### 2. AI Chat API (app/api/chat/route.ts)

**Responsibilities:**
- Implement ReAct loop
- Manage tool calls
- Handle conversation context

**ReAct Loop Steps:**
1. **Reason**: AI analyzes user request
2. **Act**: AI decides to use `execute_bash` tool
3. **Observe**: AI receives command output
4. **Repeat**: Continue until final response

**Tool Definition:**
```typescript
{
  name: 'execute_bash',
  description: 'Execute bash commands in sandbox',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string' }
    }
  }
}
```

**Safety Limits:**
- Max 5 tool uses per request (prevent infinite loops)
- Timeout: 4096 token response limit

### 3. Execution API (app/api/execute/route.ts)

**Responsibilities:**
- Validate commands
- Execute in sandbox
- Return results safely

**Security Layers:**

#### Layer 1: Command Whitelist
```typescript
ALLOWED_COMMANDS = [
  'ls', 'pwd', 'mkdir', 'touch', 'echo', 'cat', 'rm',
  'cp', 'mv', 'find', 'grep', 'head', 'tail', 'wc'
]
```

#### Layer 2: Pattern Blocking
- `rm -rf /` - Prevent root deletion
- `sudo` - Block privilege escalation
- Pipes `|` - Prevent command chaining
- Command substitution `$()` - Block injection
- Backticks - Block code execution

#### Layer 3: Execution Constraints
- Working Directory: `/sandbox/user/` only
- Timeout: 5 seconds max
- Buffer: 1MB max output
- No network access

### 4. Sandbox Directory

**Structure:**
```
sandbox/
├── README.md           # Documentation
└── user/              # Execution directory
    └── (user files)   # AI-created files appear here
```

**Purpose:**
- Isolate file operations
- Prevent system-wide changes
- Easy cleanup/reset

## Data Flow

### Example: "Create a file hello.txt"

1. **User → Frontend**
   ```
   User types: "Create a file hello.txt with 'Hello World'"
   ```

2. **Frontend → AI API**
   ```json
   POST /api/chat
   {
     "messages": [
       { "role": "user", "content": "Create a file hello.txt..." }
     ]
   }
   ```

3. **AI Reasoning**
   ```
   Claude thinks: "I need to use execute_bash to create this file"
   Tool: execute_bash
   Input: { "command": "echo 'Hello World' > hello.txt" }
   ```

4. **AI API → Execute API**
   ```json
   POST /api/execute
   {
     "command": "echo 'Hello World' > hello.txt"
   }
   ```

5. **Execute API Processing**
   ```
   ✓ Check: "echo" is in whitelist
   ✓ Check: No dangerous patterns
   ✓ Execute: In /sandbox/user/
   ✓ Result: Command executed successfully
   ```

6. **Execute API → AI API**
   ```json
   {
     "success": true,
     "output": "",
     "workingDir": "/sandbox/user/"
   }
   ```

7. **AI Observation**
   ```
   Claude observes: "Command succeeded"
   Claude responds: "I've created hello.txt with 'Hello World'"
   ```

8. **AI API → Frontend**
   ```json
   {
     "response": "I've created hello.txt with 'Hello World'",
     "toolUses": 1
   }
   ```

9. **Frontend → User**
   ```
   Display: AI message in chat interface
   ```

## Security Model

### Current Implementation (Development)

```
User Input → Validation → Local Execution → Sandboxed Directory
              ↓
         ✓ Whitelist
         ✓ Pattern Block
         ✓ Timeout
         ✓ Buffer Limit
         ✗ VM Isolation
         ✗ Network Isolation
```

### Production Implementation (Recommended)

```
User Input → Validation → E2B/Docker → Isolated MicroVM
              ↓              ↓
         ✓ Whitelist    ✓ VM Isolation
         ✓ Pattern      ✓ Network Control
         ✓ Timeout      ✓ Resource Limits
         ✓ Buffer       ✓ Ephemeral
```

## Technology Choices

### Why Next.js?
- Full-stack in one project
- API routes for backend
- React for frontend
- TypeScript support
- Easy deployment

### Why Claude 3.5 Sonnet?
- Excellent tool-calling capability
- Strong reasoning for bash commands
- Fast response times
- Cost-effective

### Why Local Execution (Dev)?
- Simple setup
- No external dependencies
- Fast iteration
- Easy debugging

### Why E2B/Docker (Prod)?
- True isolation
- Security boundaries
- Scalable
- Production-ready

## Extension Points

### Add New Tools

```typescript
// In app/api/chat/route.ts
{
  name: 'search_web',
  description: 'Search the internet',
  input_schema: { ... }
}
```

### Add New Commands

```typescript
// In app/api/execute/route.ts
const ALLOWED_COMMANDS = [
  ...existing,
  'git', 'npm', 'python'
]
```

### Add Real Sandboxing

```typescript
// Replace app/api/execute/route.ts
import { Sandbox } from '@e2b/sdk';

const sandbox = await Sandbox.create();
const result = await sandbox.commands.run(command);
```

### Add Persistence

```typescript
// Store conversation history
import { Redis } from '@upstash/redis';

await redis.set(`chat:${sessionId}`, messages);
```

## Performance Considerations

- **AI Latency**: 1-3s per Claude API call
- **Command Execution**: <100ms for simple commands
- **Total Response Time**: 1-5s depending on ReAct iterations
- **Concurrent Users**: Limited by API rate limits

## Future Improvements

1. **WebSocket Streaming**: Real-time command output
2. **Multi-session**: Separate sandboxes per user
3. **File Browser**: Visual filesystem explorer
4. **Command History**: Show executed commands
5. **Terminal UI**: Full terminal emulator interface
