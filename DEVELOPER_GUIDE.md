# Developer Guide

Complete guide for developers who want to understand, modify, or extend this project.

## Table of Contents
1. [Setup & Development](#setup--development)
2. [Project Structure](#project-structure)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Customization](#customization)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Setup & Development

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)
- Anthropic API key
- Basic understanding of Next.js and TypeScript

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your API key

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Available Scripts

```json
{
  "dev": "next dev",           // Development server (port 3000)
  "build": "next build",       // Production build
  "start": "next start",       // Start production server
  "lint": "eslint"             // Run linter
}
```

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Optional (for production)
NODE_ENV=production
PORT=3000
```

---

## Project Structure

### Directory Layout

```
ai-os-demo/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── chat/
│   │   │   └── route.ts       # AI chat endpoint
│   │   └── execute/
│   │       └── route.ts       # Command execution
│   ├── page.tsx               # Main chat UI
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
├── sandbox/                   # Command execution directory
│   ├── README.md
│   └── user/                  # User workspace
├── public/                    # Static assets
├── *.md                       # Documentation
└── config files               # Next.js, TypeScript, etc.
```

### Key Files

| File | Purpose | Lines of Code |
|------|---------|---------------|
| `app/api/chat/route.ts` | ReAct loop implementation | ~100 |
| `app/api/execute/route.ts` | Command validation & execution | ~80 |
| `app/page.tsx` | Chat UI component | ~150 |

---

## Core Concepts

### 1. ReAct Loop

The ReAct (Reason + Act) pattern:

```typescript
while (toolUseCount < maxToolUses) {
  // 1. REASON: AI analyzes request
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    tools,
    messages: currentMessages
  });

  // 2. ACT: Check if AI wants to use a tool
  const toolUseBlock = response.content.find(
    block => block.type === 'tool_use'
  );

  if (!toolUseBlock) {
    // Final response, exit loop
    return response;
  }

  // 3. EXECUTE: Run the tool
  const result = await executeTool(toolUseBlock);

  // 4. OBSERVE: Add result to conversation
  currentMessages.push({
    role: 'assistant',
    content: response.content
  });
  currentMessages.push({
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: result }]
  });
}
```

### 2. Tool Definition

Tools are defined using Anthropic's schema:

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: 'execute_bash',
    description: 'Execute a bash command in a sandboxed environment',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute'
        }
      },
      required: ['command']
    }
  }
];
```

### 3. Security Layers

Three layers of security:

```typescript
// Layer 1: Command Whitelist
const ALLOWED_COMMANDS = ['ls', 'pwd', 'mkdir', ...];
const commandStart = command.split(' ')[0];
if (!ALLOWED_COMMANDS.includes(commandStart)) {
  throw new Error('Command not allowed');
}

// Layer 2: Pattern Blocking
const dangerousPatterns = [/rm\s+-rf\s+\//, /sudo/, ...];
if (dangerousPatterns.some(p => p.test(command))) {
  throw new Error('Dangerous pattern detected');
}

// Layer 3: Execution Constraints
const result = await execAsync(command, {
  cwd: SANDBOX_DIR,        // Restrict to sandbox
  timeout: 5000,           // 5 second limit
  maxBuffer: 1024 * 1024   // 1MB output limit
});
```

---

## API Reference

### POST /api/chat

Execute a conversation with AI agent.

**Request:**
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

**Response:**
```typescript
{
  response: string;        // AI's final response
  toolUses: number;        // Number of tools used
  error?: string;          // Error message if failed
}
```

**Example:**
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Create a folder called test' }
    ]
  })
});
```

### POST /api/execute

Execute a bash command (internal API, called by AI).

**Request:**
```typescript
{
  command: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  output: string;          // stdout/stderr
  command: string;         // Original command
  workingDir: string;      // Execution directory
  error?: string;          // Error message if failed
}
```

**Security:**
- Validates against whitelist
- Blocks dangerous patterns
- Restricts to sandbox directory
- Enforces timeout and buffer limits

---

## Customization

### Adding New Commands

Edit `app/api/execute/route.ts`:

```typescript
const ALLOWED_COMMANDS = [
  'ls', 'pwd', 'mkdir', 'touch', 'echo', 'cat', 'rm', 'cp', 'mv',
  'find', 'grep', 'head', 'tail', 'wc', 'date', 'whoami',

  // Add your commands here:
  'git',
  'npm',
  'python3',
  'node'
];
```

**Warning:** Each new command increases security risk. Thoroughly test and understand implications.

### Adding New Tools

Edit `app/api/chat/route.ts`:

```typescript
// 1. Define the tool
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
        filepath: {
          type: 'string',
          description: 'Path to file to read'
        }
      },
      required: ['filepath']
    }
  }
];

// 2. Handle the tool call
if (toolUseBlock.name === 'execute_bash') {
  // existing handler
} else if (toolUseBlock.name === 'read_file') {
  const { filepath } = toolUseBlock.input;
  toolResult = await readFileContent(filepath);
}
```

### Customizing UI

Edit `app/page.tsx`:

```typescript
// Change theme colors
className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900"

// Modify message styling
className="bg-purple-600 text-white"  // User messages
className="bg-zinc-800 text-zinc-100" // AI messages

// Add features
const [history, setHistory] = useState<Message[]>([]);
const [fileTree, setFileTree] = useState<FileNode[]>([]);
```

### Changing AI Model

Edit `app/api/chat/route.ts`:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',  // Current
  // model: 'claude-3-opus-20240229',   // More capable
  // model: 'claude-3-haiku-20240307',  // Faster/cheaper
  max_tokens: 4096,
  tools,
  messages: currentMessages
});
```

**Model Comparison:**
- **Haiku**: Fastest, cheapest, good for simple commands
- **Sonnet**: Balanced, recommended for this use case
- **Opus**: Most capable, best reasoning, higher cost

---

## Testing

### Manual Testing

```bash
# Start server
pnpm dev

# Test basic functionality
1. "Create a folder called test"
2. "List files"
3. "Create file hello.txt"
4. "Show hello.txt"

# Test error handling
1. "Run sudo command" (should be blocked)
2. "Delete root directory" (should be blocked)
3. "Read nonexistent file" (should error gracefully)
```

### Build Testing

```bash
# Check TypeScript errors
pnpm build

# Should see:
# ✓ Compiled successfully
# ✓ Generating static pages
```

### Security Testing

```bash
# Test command injection
User: "Create file test; rm -rf /"
Expected: Blocked by pattern detection

# Test path traversal
User: "Create file in /etc/"
Expected: Restricted to sandbox

# Test resource limits
User: "Run command that outputs 10MB"
Expected: Truncated at 1MB

# Test timeout
User: "Sleep for 10 seconds"
Expected: Killed after 5 seconds
```

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
ANTHROPIC_API_KEY=your_key_here
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
# Build and run
docker build -t ai-os-demo .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your_key ai-os-demo
```

### Important: Production Security

**This demo is NOT production-ready as-is.** For production:

1. **Use Real Sandboxing:**
```typescript
import { Sandbox } from '@e2b/sdk';

const sandbox = await Sandbox.create();
const result = await sandbox.commands.run(command);
await sandbox.close();
```

2. **Add Authentication:**
```typescript
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```

3. **Add Rate Limiting:**
```typescript
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

await limiter.check(request, 10, 'CACHE_TOKEN');
```

4. **Add Monitoring:**
```typescript
import { analytics } from '@/lib/analytics';

analytics.track('command_executed', {
  command,
  userId,
  success: true
});
```

---

## Troubleshooting

### Common Issues

#### 1. API Key Error
```
Error: ANTHROPIC_API_KEY is required
```
**Solution:**
- Check `.env.local` exists
- Verify API key is correct
- Restart dev server after adding env vars

#### 2. Command Not Allowed
```
Error: Command not allowed for security reasons
```
**Solution:**
- Check if command is in `ALLOWED_COMMANDS`
- Verify no dangerous patterns in command
- Review security logs

#### 3. Timeout Error
```
Error: Command timed out after 5000ms
```
**Solution:**
- Simplify command
- Check for infinite loops
- Increase timeout (with caution)

#### 4. Build Errors
```
Type error: Property 'X' does not exist
```
**Solution:**
- Run `pnpm install` to ensure all deps installed
- Check TypeScript version compatibility
- Review type definitions

### Debug Mode

Enable detailed logging:

```typescript
// In app/api/chat/route.ts
const DEBUG = true;

if (DEBUG) {
  console.log('Request:', { messages });
  console.log('Tool use:', toolUseBlock);
  console.log('Result:', toolResult);
}
```

### Performance Optimization

```typescript
// Cache AI responses
const cache = new Map();
const cacheKey = JSON.stringify(messages);
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}

// Stream responses (future enhancement)
const stream = await anthropic.messages.stream({...});
for await (const chunk of stream) {
  // Send chunk to client
}
```

---

## Best Practices

### Security
1. Always validate input
2. Use whitelist approach
3. Never trust user input
4. Implement rate limiting
5. Use proper sandboxing in production

### Code Quality
1. Type everything with TypeScript
2. Handle all error cases
3. Add loading states
4. Provide helpful error messages
5. Write clear comments

### Performance
1. Minimize API calls
2. Cache when possible
3. Use appropriate AI model
4. Optimize bundle size
5. Implement lazy loading

---

## Resources

- [Anthropic Tool Use Docs](https://docs.anthropic.com/en/docs/tool-use)
- [Next.js Documentation](https://nextjs.org/docs)
- [E2B SDK](https://e2b.dev/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Support

For issues or questions:
1. Check [EXAMPLES.md](EXAMPLES.md) for usage patterns
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for design details
3. Read [QUICKSTART.md](QUICKSTART.md) for setup help
4. Open an issue on GitHub

---

**Happy coding!** Feel free to extend, modify, and improve this demo.
