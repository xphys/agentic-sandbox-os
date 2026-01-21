# Real-Time Agent Status Streaming

This document explains the real-time status streaming feature that shows what the AI agent is doing.

## Overview

Instead of just waiting for the final response, you now see real-time updates as the agent:
- 🤔 **Thinks** - Analyzes your request
- 🔧 **Uses Tools** - Decides to execute commands
- ⚡ **Executes** - Runs bash commands
- 👀 **Observes** - Processes command results

## What You'll See

### Example Flow

When you ask: **"Create a folder called projects"**

You'll see these status updates appear in real-time:

1. **🤔 Thinking**: "Analyzing your request..."
2. **🔧 Tool Use**: "Using tool: execute_bash"
3. **⚡ Executing**: "Executing: mkdir projects"
   - Shows the actual command: `$ mkdir projects`
4. **👀 Observing**: "Observing result..."
5. **Final Response**: "I've created the folder 'projects' for you."

### Status Types

| Icon | Status | Description | Color |
|------|--------|-------------|-------|
| 🤔 | Thinking | AI is analyzing and reasoning | Blue |
| 🔧 | Tool Use | AI decided to use a tool | Purple |
| ⚡ | Executing | Running a bash command | Yellow |
| 👀 | Observing | Processing command output | Green |

## How It Works

### Backend (Server-Sent Events)

The API uses **Server-Sent Events (SSE)** to stream status updates:

```typescript
// app/api/chat/route.ts
const stream = new ReadableStream({
  async start(controller) {
    const sendStatus = (status: AgentStatus) => {
      const data = `data: ${JSON.stringify(status)}\n\n`;
      controller.enqueue(encoder.encode(data));
    };

    // Send status updates throughout the ReAct loop
    sendStatus({ type: 'thinking', message: 'Analyzing...' });
    sendStatus({ type: 'executing', command: 'ls -la' });
    sendStatus({ type: 'observing', result: '...' });
    sendStatus({ type: 'response', text: 'Done!' });
    sendStatus({ type: 'done' });
  }
});
```

### Frontend (EventSource Reading)

The frontend reads the stream and displays status updates:

```typescript
// app/page.tsx
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const status = JSON.parse(line.slice(6));
      setAgentStatus(status); // Update UI
    }
  }
}
```

## Agent Status Types

```typescript
type AgentStatus =
  | { type: 'thinking', message: string }
  | { type: 'tool_use', tool: string, input: any }
  | { type: 'executing', command: string }
  | { type: 'observing', result: string }
  | { type: 'response', text: string }
  | { type: 'error', error: string }
  | { type: 'done' };
```

## Visual Examples

### Single Command
```
User: "List all files"

Status Updates:
🤔 Thinking: "Analyzing your request..."
🔧 Tool Use: "Using tool: execute_bash"
⚡ Executing: "Executing: ls -la"
   $ ls -la
👀 Observing: "Observing result..."

Final Response:
"Here are the files in the directory:
- file1.txt
- file2.txt"
```

### Multi-Step Operation
```
User: "Create a folder called test and create file.txt inside it"

Status Updates:
🤔 Thinking: "Analyzing your request..."
🔧 Tool Use: "Using tool: execute_bash"
⚡ Executing: "Executing: mkdir test"
   $ mkdir test
👀 Observing: "Observing result..."

🤔 Thinking: "Processing step 2..."
🔧 Tool Use: "Using tool: execute_bash"
⚡ Executing: "Executing: touch test/file.txt"
   $ touch test/file.txt
👀 Observing: "Observing result..."

Final Response:
"I've created the folder 'test' and created 'file.txt' inside it."
```

## Benefits

### 1. Transparency
Users can see exactly what the AI is doing, building trust.

### 2. Better UX
No more black box waiting - users understand progress.

### 3. Educational
Shows the ReAct loop in action: Reason → Act → Observe.

### 4. Debugging
Developers can see which commands are being executed.

### 5. Engagement
Real-time feedback keeps users engaged during longer operations.

## Implementation Details

### Status Display Component

```typescript
const renderAgentStatus = () => {
  if (!agentStatus) return null;

  const getStatusDisplay = () => {
    switch (agentStatus.type) {
      case 'thinking':
        return {
          icon: '🤔',
          text: agentStatus.message,
          color: 'bg-blue-500/20 border-blue-500/50 text-blue-300'
        };
      case 'executing':
        return {
          icon: '⚡',
          text: `Executing: ${agentStatus.command}`,
          color: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
        };
      // ... other cases
    }
  };

  return (
    <div className={`rounded-2xl px-4 py-3 border ${color} animate-pulse`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
};
```

### Styling

Each status has:
- **Unique color** - Easy to distinguish at a glance
- **Icon** - Visual indicator of status type
- **Pulse animation** - Shows it's active
- **Monospace font** - For commands and technical details

## Comparison: Before vs After

### Before (No Streaming)
```
User: "Create a folder called projects"
[Loading dots for 3 seconds...]
AI: "I've created the folder 'projects' for you."
```

### After (With Streaming)
```
User: "Create a folder called projects"
🤔 Thinking: "Analyzing your request..."
🔧 Tool Use: "Using tool: execute_bash"
⚡ Executing: "Executing: mkdir projects"
   $ mkdir projects
👀 Observing: "Observing result..."
AI: "I've created the folder 'projects' for you."
```

## Performance

- **Latency**: Minimal overhead (~50ms)
- **Bandwidth**: Small JSON payloads (~100 bytes each)
- **Updates**: 4-6 status updates per typical request
- **Experience**: Feels instant and responsive

## Browser Compatibility

Server-Sent Events are supported in all modern browsers:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ All mobile browsers

## Extending the Status System

### Add New Status Types

1. Define in backend:
```typescript
// app/api/chat/route.ts
type AgentStatus =
  | ... existing types
  | { type: 'planning', steps: string[] }
  | { type: 'validating', check: string };
```

2. Send from ReAct loop:
```typescript
sendStatus({
  type: 'planning',
  steps: ['Create folder', 'Create file', 'Write content']
});
```

3. Display in frontend:
```typescript
case 'planning':
  return {
    icon: '📝',
    text: `Planning: ${agentStatus.steps.length} steps`,
    color: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
  };
```

### Add Progress Bars

```typescript
// For multi-step operations
sendStatus({
  type: 'progress',
  current: 2,
  total: 5,
  message: 'Creating files...'
});
```

### Add Timestamps

```typescript
sendStatus({
  type: 'executing',
  command: 'ls -la',
  timestamp: Date.now()
});
```

## Multi-Agent Support (Future)

The streaming architecture is ready for multi-agent systems:

```typescript
sendStatus({
  type: 'agent_spawn',
  agentId: 'agent-123',
  agentType: 'file-manager',
  task: 'Organize files'
});

sendStatus({
  type: 'agent_update',
  agentId: 'agent-123',
  status: 'working',
  progress: 0.6
});

sendStatus({
  type: 'agent_complete',
  agentId: 'agent-123',
  result: 'Files organized'
});
```

This would show multiple agents working in parallel, each with their own status indicator.

## Troubleshooting

### Status Not Showing

**Problem**: Status updates don't appear

**Solutions**:
- Check browser console for errors
- Verify SSE headers are correct
- Ensure no proxy is buffering the stream

### Status Flashing Too Fast

**Problem**: Status changes too quickly to read

**Solutions**:
- Add minimum display time:
```typescript
const MIN_STATUS_DISPLAY = 500; // ms
await new Promise(r => setTimeout(r, MIN_STATUS_DISPLAY));
```

### Status Stuck

**Problem**: Status shows but never completes

**Solutions**:
- Check for errors in server logs
- Verify `done` status is being sent
- Add timeout on frontend

## Learn More

- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- [ReAct Paper](https://arxiv.org/abs/2210.03629)

## Summary

Real-time status streaming transforms the user experience from:
- **"Waiting and wondering"** → **"Watching and understanding"**

It makes the AI's thought process transparent and creates a more engaging, trustworthy interaction.
