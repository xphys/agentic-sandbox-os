# Human-in-the-Loop (HITL) Feature

This document explains the Human-in-the-Loop feature that adds user confirmation for potentially destructive operations.

## Overview

Instead of automatically executing all commands, the AI agent now asks for your approval before running potentially destructive operations. This adds an extra layer of safety and control.

## What It Looks Like

### Example Flow

**User:** "Delete all .tmp files"

**Agent:**
```
⚠️ Human Confirmation Required
This command will delete multiple files using wildcards.

$ rm *.tmp

[✓ Approve]  [✗ Decline]
```

You can then choose to:
- **Approve** - Command executes
- **Decline** - Command is cancelled

## Commands That Require Confirmation

The system automatically detects potentially destructive commands:

| Pattern | Reason | Example |
|---------|--------|---------|
| `rm -r` | Recursive delete | `rm -r folder/` |
| `rm *` | Delete with wildcards | `rm *.txt` |
| `mv *` | Move with wildcards | `mv *.js old/` |
| `cp -r *` | Recursive copy with wildcards | `cp -r * backup/` |
| `> /dev/` | Redirect to device files | `echo data > /dev/sda` |

## Visual Example

### Before HITL (Automatic Execution)
```
User: "Remove all test files"
🤔 Thinking...
🔧 Tool Use: execute_bash
⚡ Executing: rm test*
👀 Observing...
✅ "Removed all test files"
```

### With HITL (User Confirmation)
```
User: "Remove all test files"
🤔 Thinking...
🔧 Tool Use: execute_bash

⚠️ Human Confirmation Required
This command will delete multiple files using wildcards.
$ rm test*

[✓ Approve]  [✗ Decline]

← User clicks "Approve"

⚡ Executing: rm test*
👀 Observing...
✅ "Removed all test files"
```

## How It Works

### 1. Detection ([app/api/chat/route.ts:49](app/api/chat/route.ts#L49))

```typescript
function requiresHumanConfirmation(command: string): boolean {
  const destructivePatterns = [
    /\brm\b.*-r/,           // Recursive delete
    /\brm\b.*\*/,           // Delete with wildcards
    /\bmv\b.*\*/,           // Move with wildcards
    /\bcp\b.*-r.*\*/,       // Copy recursive with wildcards
    />\s*\/dev\//,          // Redirects to devices
  ];

  return destructivePatterns.some(pattern => pattern.test(command));
}
```

### 2. Pause Execution

When a command needs confirmation:
1. Agent generates a unique `confirmationId`
2. Sends `await_confirmation` status to frontend
3. Execution pauses, waiting for user response
4. Frontend displays confirmation dialog

### 3. User Decision

User clicks either:
- **Approve** → Sends confirmation to `/api/confirm`
- **Decline** → Sends rejection to `/api/confirm`

### 4. Resume Execution

Backend receives the decision:
- **Approved** → Command executes normally
- **Declined** → Command skipped, returns "cancelled" message

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│                                                             │
│  [⚠️ Confirmation Dialog]                                  │
│  "This will delete files"                                   │
│  $ rm *.tmp                                                 │
│  [✓ Approve] [✗ Decline]                                   │
└────────────────┬────────────────────────────────────────────┘
                 │ POST /api/confirm
                 │ {confirmationId, approved}
                 ↓
┌─────────────────────────────────────────────────────────────┐
│               Confirmation Handler                          │
│            (app/api/confirm/route.ts)                       │
│                                                             │
│  1. Validate confirmationId                                 │
│  2. Resolve pending promise                                 │
│  3. Resume execution                                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                   ReAct Loop                                │
│              (app/api/chat/route.ts)                        │
│                                                             │
│  waitForConfirmation(id) → waits                           │
│  ↓                                                          │
│  if approved: execute command                               │
│  if declined: skip command                                  │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Add More Confirmation Patterns

Edit [app/api/chat/route.ts:49](app/api/chat/route.ts#L49):

```typescript
function requiresHumanConfirmation(command: string): boolean {
  const destructivePatterns = [
    /\brm\b.*-r/,
    /\brm\b.*\*/,
    /\bmv\b.*\*/,
    /\bcp\b.*-r.*\*/,
    />\s*\/dev\//,

    // Add your patterns:
    /git\s+push.*--force/,     // Force push
    /npm\s+publish/,            // Publish package
    /docker\s+rm/,              // Remove containers
  ];

  return destructivePatterns.some(pattern => pattern.test(command));
}
```

### Customize Confirmation Reasons

Edit [app/api/chat/route.ts:61](app/api/chat/route.ts#L61):

```typescript
function getConfirmationReason(command: string): string {
  if (/\brm\b.*-r/.test(command)) {
    return 'This command will recursively delete files/folders.';
  }
  if (/git\s+push.*--force/.test(command)) {
    return 'Force pushing can overwrite remote history.';
  }
  // Add more specific reasons...
  return 'This command may have significant effects.';
}
```

### Change Timeout Duration

Edit [app/api/chat/route.ts:84](app/api/chat/route.ts#L84):

```typescript
async function waitForConfirmation(confirmationId: string): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConfirmations.set(confirmationId, {
      resolve,
      timestamp: Date.now()
    });

    // Change timeout (default: 2 minutes)
    setTimeout(() => {
      if (pendingConfirmations.has(confirmationId)) {
        resolve(false);  // Auto-reject
        pendingConfirmations.delete(confirmationId);
      }
    }, 5 * 60 * 1000);  // 5 minutes
  });
}
```

## Benefits

### 1. Safety
Prevents accidental destructive operations:
```
User: "Clean up my directory"
AI might interpret as: rm -rf *
→ User gets to approve first
```

### 2. Transparency
User sees exactly what will be executed:
```
⚠️ Human Confirmation Required
$ rm -r old_projects/
```

### 3. Control
User remains in control of their system:
```
- Approve safe operations
- Decline risky operations
- Review commands before execution
```

### 4. Learning
User learns what commands the AI is using:
```
"Move files to backup"
→ Shows: mv *.txt backup/
→ User learns the actual bash command
```

## Use Cases

### 1. File Cleanup
```
User: "Remove all log files older than 7 days"
AI: find . -name "*.log" -mtime +7 -delete
→ Confirmation required (deletion with find)
```

### 2. Batch Operations
```
User: "Move all images to the photos folder"
AI: mv *.jpg *.png photos/
→ Confirmation required (wildcards could match many files)
```

### 3. System Modifications
```
User: "Clear the cache"
AI: rm -rf cache/
→ Confirmation required (recursive delete)
```

## Timeout Behavior

If user doesn't respond within 2 minutes:
- Confirmation auto-rejects
- Command is not executed
- AI receives "cancelled" message
- No changes made to the system

```
⚠️ Confirmation Request
[User walks away]
[2 minutes pass]
→ Auto-declined
→ "Command execution cancelled by timeout"
```

## Error Handling

### Confirmation Not Found
```
- User clicks too late (>2 min)
- Server restarted
→ Returns 404 error
→ User sees: "Confirmation expired, please try again"
```

### Network Error
```
- Lost internet connection
- API unreachable
→ Command not executed
→ Safe default: decline
```

## Security Considerations

### Current Implementation
- Confirmations stored in memory
- Unique IDs prevent replay attacks
- 2-minute timeout prevents stale confirmations
- Auto-reject on timeout

### Production Recommendations

1. **Use Redis/Database**
   ```typescript
   // Instead of in-memory Map
   import Redis from 'ioredis';
   const redis = new Redis();

   await redis.setex(confirmationId, 120, JSON.stringify({
     command,
     userId,
     timestamp: Date.now()
   }));
   ```

2. **Add User Authentication**
   ```typescript
   // Ensure confirmations belong to the right user
   if (confirmation.userId !== session.userId) {
     throw new Error('Unauthorized');
   }
   ```

3. **Rate Limiting**
   ```typescript
   // Prevent spam
   if (userConfirmationCount > 10) {
     throw new Error('Too many pending confirmations');
   }
   ```

4. **Audit Logging**
   ```typescript
   await db.auditLog.create({
     userId,
     command,
     approved,
     timestamp: Date.now()
   });
   ```

## Disable HITL (Optional)

To disable human-in-the-loop for testing:

```typescript
// In app/api/chat/route.ts
function requiresHumanConfirmation(command: string): boolean {
  return false;  // Disable all confirmations
}
```

Or for specific patterns:

```typescript
function requiresHumanConfirmation(command: string): boolean {
  // Only require confirmation for rm -rf /
  return /rm\s+-rf\s+\//.test(command);
}
```

## Testing

### Test HITL Flow

1. Start dev server:
   ```bash
   pnpm dev
   ```

2. Try a destructive command:
   ```
   User: "Remove all .tmp files"
   ```

3. You should see:
   ```
   ⚠️ Human Confirmation Required
   This command will delete multiple files using wildcards.
   $ rm *.tmp
   [✓ Approve]  [✗ Decline]
   ```

4. Test both paths:
   - Click Approve → Command executes
   - Click Decline → Command cancelled

### Test Timeout

1. Request a destructive operation
2. Wait 2+ minutes without responding
3. Should auto-decline and show timeout message

## Comparison to Other Systems

| System | HITL Support | Implementation |
|--------|--------------|----------------|
| This Demo | ✅ | Pattern-based detection |
| Open Interpreter | ✅ | Asks before execution |
| Replit Agent | ⚠️ | Limited (auto-executes most) |
| GitHub Copilot | ❌ | Code suggestions only |
| ChatGPT Code Interpreter | ✅ | Manual approval required |

## Future Enhancements

### 1. Confidence Levels
```typescript
type ConfirmationLevel = 'low' | 'medium' | 'high';

function getConfirmationLevel(command: string): ConfirmationLevel {
  if (/rm -rf \//.test(command)) return 'high';
  if (/rm -r/.test(command)) return 'medium';
  return 'low';
}

// Auto-approve low, always ask for high
```

### 2. Smart Defaults
```typescript
// Remember user preferences
if (userPreviouslyApproved(similarCommand)) {
  // Auto-approve similar commands
}
```

### 3. Dry Run Mode
```typescript
// Show what would happen without executing
{
  type: 'dry_run',
  command: 'rm *.tmp',
  affectedFiles: ['test.tmp', 'old.tmp']
}
```

### 4. Batch Confirmations
```typescript
// Approve multiple commands at once
{
  type: 'batch_confirmation',
  commands: ['mkdir test', 'touch test/file.txt'],
  estimatedImpact: 'Create 1 folder, 1 file'
}
```

## Summary

Human-in-the-Loop adds critical safety to your AI OS demo:

- ⚠️ **Detect** - Automatically identifies destructive operations
- 🛑 **Pause** - Stops execution and waits for user
- 👤 **Confirm** - User approves or declines
- ✅ **Execute** - Only runs if approved

This transforms the system from "AI does everything" to "AI assists, human decides" - the gold standard for autonomous agents.

---

**Try it:** `pnpm dev` and ask the AI to delete files with wildcards!
