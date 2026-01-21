# Quick Start Guide

Get the AI OS Interaction demo running in 5 minutes.

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Get Your API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key
5. Copy the key

## Step 3: Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

## Step 4: Run the Server

```bash
pnpm dev
```

## Step 5: Try It Out

Open [http://localhost:3000](http://localhost:3000) and try these commands:

1. **Create a folder**:
   ```
   Create a folder called my_project
   ```

2. **List files**:
   ```
   Show me all files in the directory
   ```

3. **Create a file**:
   ```
   Create a file called notes.txt with the text "AI OS Demo Works!"
   ```

4. **Read the file**:
   ```
   What's in notes.txt?
   ```

## Understanding the Flow

When you send: "Create a folder called my_project"

1. Frontend sends message to `/api/chat`
2. Claude receives your message
3. Claude decides to use `execute_bash` tool
4. Claude generates: `mkdir my_project`
5. Backend executes command in `/sandbox/user/`
6. Output is sent back to Claude
7. Claude responds: "I've created the folder for you"

## Troubleshooting

### API Key Error
```
Error: ANTHROPIC_API_KEY is required
```
**Solution**: Make sure `.env.local` exists and contains your API key

### Command Not Allowed
```
Error: Command not allowed for security reasons
```
**Solution**: The command you tried is blocked. Check `ALLOWED_COMMANDS` in `app/api/execute/route.ts`

### Timeout Error
```
Error: Command timed out
```
**Solution**: Commands are limited to 5 seconds. Try a simpler command.

## Next Steps

- Read the [full README](README.md) for architecture details
- Explore [app/api/chat/route.ts](app/api/chat/route.ts) to see the ReAct loop
- Check [app/api/execute/route.ts](app/api/execute/route.ts) for security implementation
- Look at [sandbox/user/](sandbox/user/) to see created files

## Safety Note

This demo runs commands on your local machine. It includes security measures but should only be used for learning and development. Never deploy this to production without proper sandboxing (Docker, E2B, etc.).
