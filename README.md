# AI Direct OS Interaction Demo

A Next.js demonstration of **Agentic Tool Use with Sandboxed Environment** - the technique used by platforms like Manus AI to enable direct AI-to-OS interaction.

## Overview

This project implements the **ReAct (Reason-Act-Observe) Loop** architecture where:
1. User sends a natural language request
2. AI reasons about what bash command to execute
3. Backend executes the command in a sandboxed environment
4. AI observes the result and responds to the user

## Architecture

```
User Input → AI Reasoning → Tool Selection → Bash Execution → Observation → Response
                ↑                                                      ↓
                └──────────────────────────────────────────────────────┘
                            (ReAct Loop)
```

### Key Components

- **Frontend**: React chat interface with real-time updates
- **AI Integration**: Claude 3.5 Sonnet with tool-calling capability
- **Execution Layer**: Sandboxed bash command runner
- **Security**: Whitelisted commands, pattern blocking, timeout limits

## Features

- Chat-based natural language interface for OS commands
- **Real-time agent status streaming** - See what the AI is thinking and doing (🤔 Thinking, 🔧 Tool Use, ⚡ Executing, 👀 Observing)
- **Human-in-the-loop (HITL)** - User confirmation required for destructive operations (⚠️ Approve/Decline)
- Sandboxed command execution (limited to `/sandbox/user/` directory)
- Security features:
  - Command whitelisting
  - Dangerous pattern blocking (rm -rf /, sudo, pipes, etc.)
  - 5-second execution timeout
  - 1MB output buffer limit
- Real-time conversation with AI agent
- Persistent sandbox filesystem

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Anthropic Claude 3.5 Sonnet
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Runtime**: Node.js

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Anthropic API Key ([Get one here](https://console.anthropic.com/))

### Installation

1. Clone and install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

3. Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage Examples

Try these prompts in the chat interface:

- "Create a folder called projects"
- "List all files in the current directory"
- "Create a file hello.txt with the content 'Hello World'"
- "Show me what's in hello.txt"
- "Create three folders: frontend, backend, and docs"

## Project Structure

```
ai-os-demo/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # AI ReAct loop handler
│   │   └── execute/route.ts    # Bash execution endpoint
│   └── page.tsx                # Chat UI component
├── sandbox/
│   └── user/                   # Sandboxed execution directory
├── .env.local                  # Environment variables (API keys)
└── README.md
```

## How It Works

### 1. ReAct Loop (app/api/chat/route.ts)

The AI follows a reasoning loop:
1. Receives user message
2. Decides if a bash command is needed
3. Calls the `execute_bash` tool
4. Receives command output
5. Continues reasoning or provides final response

### 2. Command Execution (app/api/execute/route.ts)

Security layers:
- Validates command against whitelist
- Blocks dangerous patterns
- Executes in sandboxed directory
- Enforces timeout and buffer limits

### 3. Chat Interface (app/page.tsx)

- Real-time message display
- Loading states
- Error handling
- Responsive design

## Security Considerations

This demo includes basic security measures but is **NOT production-ready**:

- Commands run on the host machine (not in a VM/container)
- Whitelist can be bypassed with creative input
- Limited to development/demo purposes

For production, consider:
- **E2B SDK**: Provides isolated cloud MicroVMs
- **Docker/Firecracker**: Container-based sandboxing
- **Stricter validation**: More comprehensive command parsing
- **User authentication**: Limit access to authorized users

## Extending This Demo

### Add More Commands

Edit the whitelist in [app/api/execute/route.ts](app/api/execute/route.ts:18):

```typescript
const ALLOWED_COMMANDS = [
  'ls', 'pwd', 'mkdir', 'touch', 'echo', 'cat', 'rm', 'cp', 'mv',
  'find', 'grep', 'head', 'tail', 'wc', 'date', 'whoami',
  'git', 'npm' // Add your commands here
];
```

### Add More Tools

Add tool definitions in [app/api/chat/route.ts](app/api/chat/route.ts:10):

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: 'execute_bash',
    // ... existing tool
  },
  {
    name: 'read_file',
    description: 'Read contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        filepath: { type: 'string' }
      }
    }
  }
];
```

### Use Real Sandboxing

Replace the execute endpoint with E2B:

```typescript
import { Sandbox } from '@e2b/sdk';

const sandbox = await Sandbox.create();
const result = await sandbox.commands.run(command);
```

## Learn More

- [Anthropic Tool Use Documentation](https://docs.anthropic.com/en/docs/tool-use)
- [E2B SDK](https://e2b.dev/) - Cloud sandboxing for AI agents
- [Open Interpreter](https://github.com/OpenInterpreter/open-interpreter) - Reference implementation
- [Original Concept](../ai_direct.md) - Based on the AI Direct Ubuntu OS Interaction guide

## License

MIT - Feel free to use this as a learning resource or starting point for your own projects.
