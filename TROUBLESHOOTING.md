# Troubleshooting Guide

Common issues and solutions for the AI OS Interaction Demo.

## "Maximum tool use iterations reached"

### Problem
You see the error: "Maximum tool use iterations reached. Please try a simpler request."

### What It Means
The AI agent made 8 tool calls in a row without providing a final response. This safety limit prevents infinite loops.

### Why It Happens

1. **Complex multi-step operations**: The request requires many sequential commands
2. **AI getting stuck**: The AI keeps trying commands without concluding
3. **Ambiguous requests**: The AI is unsure when the task is "done"

### Solutions

#### Solution 1: Break Down Your Request

**Instead of:**
```
"Set up a complete project with folders, files, configs, documentation,
tests, and example code"
```

**Try:**
```
"Create folders for src, tests, and docs"
```

Then follow up with:
```
"Now create index.js in the src folder"
```

#### Solution 2: Be More Specific

**Instead of:**
```
"Organize my files"
```

**Try:**
```
"Create a 'documents' folder and move all .txt files into it"
```

#### Solution 3: Check API Key and Model

The fix I applied uses Claude 3.5 Sonnet instead of Haiku, which is better at knowing when to stop:

```typescript
// In app/api/chat/route.ts
model: 'claude-3-5-sonnet-20241022'  // Better reasoning
```

Make sure your `.env.local` has a valid API key:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Recent Fix Applied

I've made the following improvements:

1. **Changed model** from Haiku to Sonnet (better at task completion)
2. **Added system prompt** to guide the AI to provide final responses
3. **Increased max iterations** from 5 to 8 (handles more complex tasks)
4. **Added graceful fallback** - if limit reached, AI provides a summary

### Updated Code

The system prompt now includes:
```typescript
system: 'You are a helpful AI assistant that can execute bash commands
in a sandboxed environment. After executing commands and observing the
results, provide a clear, concise response to the user about what you
did. Do not execute unnecessary additional commands.'
```

### When You Still Hit the Limit

If you hit the limit even after the fix, the system now:
1. Makes one final call to summarize what was accomplished
2. Returns a meaningful response instead of just an error
3. The operations already executed are still completed

## API Key Errors

### "ANTHROPIC_API_KEY is required"

**Solution:**
```bash
cd ai-os-demo
cp .env.local.example .env.local
# Edit .env.local and add your key
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Restart the dev server after adding the key:
```bash
pnpm dev
```

## Command Not Allowed

### "Command not allowed for security reasons"

**Problem:** You tried a command that's blocked for security.

**Blocked patterns:**
- `rm -rf /` - Root deletion
- `sudo` - Privilege escalation
- `chmod` - Permission changes
- `|` - Pipes (command chaining)
- `$(...)` - Command substitution

**Solution:** Use allowed commands only:
```bash
ls, pwd, mkdir, touch, echo, cat, rm, cp, mv,
find, grep, head, tail, wc, date, whoami
```

To add more commands, edit `app/api/execute/route.ts`:
```typescript
const ALLOWED_COMMANDS = [
  'ls', 'pwd', 'mkdir', 'touch', 'echo', 'cat', 'rm', 'cp', 'mv',
  'find', 'grep', 'head', 'tail', 'wc', 'date', 'whoami',
  'git',  // Add your command here
];
```

## Status Not Appearing

### Streaming status indicators don't show

**Symptoms:**
- No colored status boxes appear
- Just shows loading dots
- Final response appears but no intermediate states

**Solutions:**

1. **Check browser console** for errors:
   - Press F12 to open DevTools
   - Look for JavaScript errors

2. **Verify streaming is working:**
   - Open DevTools → Network tab
   - Look for `/api/chat` request
   - Check if `Content-Type: text/event-stream`

3. **Clear browser cache:**
   ```bash
   # Hard refresh
   Ctrl+Shift+R (Windows/Linux)
   Cmd+Shift+R (Mac)
   ```

4. **Check if proxy/VPN is buffering:**
   - Some proxies buffer SSE streams
   - Try disabling VPN temporarily

## Build Errors

### TypeScript errors during build

**Error:**
```
Type error: Property 'X' does not exist
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
pnpm install

# Clean build cache
rm -rf .next
pnpm run build
```

### Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

## Slow Response Times

### AI takes too long to respond

**Expected times:**
- Simple commands: 1-2 seconds
- Complex operations: 2-5 seconds
- Multi-step tasks: 5-10 seconds

**If much slower:**

1. **Check API rate limits:**
   - You may have exceeded your Anthropic API quota
   - Check console for 429 errors

2. **Check network:**
   ```bash
   # Test API connectivity
   curl https://api.anthropic.com/v1/messages -I
   ```

3. **Switch to faster model:**
   ```typescript
   // In app/api/chat/route.ts
   model: 'claude-3-haiku-20240307'  // Faster but less capable
   ```

## Commands Not Executing

### Commands don't run or return empty results

**Symptoms:**
- Status shows "Executing" but nothing happens
- Empty results even for `ls`

**Debug steps:**

1. **Check sandbox directory exists:**
   ```bash
   ls -la ai-os-demo/sandbox/user/
   ```

2. **Test execute API directly:**
   ```bash
   curl -X POST http://localhost:3000/api/execute \
     -H "Content-Type: application/json" \
     -d '{"command": "pwd"}'
   ```

3. **Check server logs:**
   - Look for errors in terminal where you ran `pnpm dev`

4. **Verify permissions:**
   ```bash
   # Sandbox should be writable
   chmod 755 sandbox/user/
   ```

## Connection Errors

### "Failed to fetch" or network errors

**Solutions:**

1. **Verify server is running:**
   ```bash
   curl http://localhost:3000
   ```

2. **Check firewall:**
   - Ensure port 3000 is not blocked
   - Try different port: `PORT=3001 pnpm dev`

3. **Browser CORS issues:**
   - Should not happen in development
   - If it does, clear browser cache

## AI Behavior Issues

### AI doesn't understand requests

**Problem:** AI gives irrelevant responses or doesn't execute commands.

**Solutions:**

1. **Be more explicit:**
   ```
   Bad:  "Make a file"
   Good: "Create a file called test.txt"
   ```

2. **Use command-like language:**
   ```
   Bad:  "Can you possibly create something?"
   Good: "Create a folder called projects"
   ```

3. **Specify the full action:**
   ```
   Bad:  "Add hello to file"
   Good: "Create a file hello.txt with content 'Hello World'"
   ```

### AI executes wrong commands

**Problem:** AI runs different commands than expected.

**Why:** Natural language is ambiguous. The AI interprets your intent.

**Example:**
```
User: "Remove test"
AI might run: rm -r test    (if it's a folder)
AI might run: rm test       (if it's a file)
```

**Solution:** Be specific about what `test` is:
```
User: "Remove the test folder"
User: "Delete the file test.txt"
```

## Environment Issues

### Module not found

**Error:**
```
Cannot find module '@anthropic-ai/sdk'
```

**Solution:**
```bash
pnpm install
```

### Wrong Node version

**Error:**
```
The engine "node" is incompatible
```

**Solution:**
```bash
# Check your Node version
node --version

# Should be 18+
# If not, upgrade:
nvm install 18
nvm use 18
```

## Development Issues

### Hot reload not working

**Problem:** Changes don't appear without manual refresh.

**Solutions:**

1. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   ```

2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   pnpm dev
   ```

3. **Check file watchers:**
   ```bash
   # macOS may need increased limit
   echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

## Still Having Issues?

### Debug Checklist

- [ ] Latest code pulled/updated
- [ ] Dependencies installed (`pnpm install`)
- [ ] Valid API key in `.env.local`
- [ ] Dev server running (`pnpm dev`)
- [ ] Port 3000 accessible
- [ ] Browser cache cleared
- [ ] Console errors checked (F12)
- [ ] Server logs checked (terminal)

### Get More Help

1. **Check logs:**
   ```bash
   # Server logs (terminal running pnpm dev)
   # Browser logs (DevTools console)
   # Network tab (DevTools)
   ```

2. **Enable debug mode:**
   ```typescript
   // In app/api/chat/route.ts
   console.log('Messages:', messages);
   console.log('Tool use:', toolUseBlock);
   console.log('Result:', toolResult);
   ```

3. **Test components individually:**
   - Test execute API: `curl -X POST http://localhost:3000/api/execute -d '{"command":"ls"}'`
   - Test frontend: Check if UI loads
   - Test streaming: Check Network tab for SSE

### Contact

If you're still stuck:
1. Check [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for detailed setup
2. Review [EXAMPLES.md](EXAMPLES.md) for proper usage patterns
3. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system

---

**Most common solution:** Restart the dev server and clear your browser cache! 🔄
