# Usage Examples

## Example Conversations

### Example 1: Creating a Project Structure

**User:**
```
Create a new project structure with folders for frontend, backend, and docs
```

**AI Agent (Behind the scenes):**
```typescript
// Tool: execute_bash
// Command: mkdir -p frontend backend docs
```

**AI Response:**
```
I've created three folders for your project:
- frontend/
- backend/
- docs/

Your project structure is now ready!
```

**Verification:**
```
User: "List all folders"
AI executes: ls -la
AI shows: frontend, backend, docs directories
```

---

### Example 2: Working with Files

**User:**
```
Create a README.md file with "Hello from AI!"
```

**AI Agent:**
```typescript
// Tool: execute_bash
// Command: echo "Hello from AI!" > README.md
```

**AI Response:**
```
I've created README.md with the content "Hello from AI!"
```

**User:**
```
Show me what's in the README
```

**AI Agent:**
```typescript
// Tool: execute_bash
// Command: cat README.md
```

**AI Response:**
```
The README.md file contains:
Hello from AI!
```

---

### Example 3: Complex Operations

**User:**
```
Create a simple project with index.html, style.css, and script.js
```

**AI Agent (Multiple tool calls):**
```typescript
// Call 1: touch index.html style.css script.js
// Call 2: echo "<!DOCTYPE html>..." > index.html
// Call 3: echo "body { margin: 0; }" > style.css
```

**AI Response:**
```
I've created a basic web project with:
- index.html (with HTML boilerplate)
- style.css (with basic styling)
- script.js (empty, ready for your code)

Your project is ready!
```

---

### Example 4: File Organization

**User:**
```
I want to organize my files. Create a src folder and move all .js files into it
```

**AI Agent:**
```typescript
// Call 1: mkdir src
// Call 2: mv *.js src/ (or handles no .js files gracefully)
```

**AI Response:**
```
I've created a 'src' folder and moved all JavaScript files into it.
Your files are now organized!
```

---

### Example 5: Searching Files

**User:**
```
Find all text files in the current directory
```

**AI Agent:**
```typescript
// Tool: execute_bash
// Command: find . -name "*.txt" -type f
```

**AI Response:**
```
I found these text files:
- ./notes.txt
- ./README.txt
- ./docs/guide.txt
```

---

## Real-World Use Cases

### Use Case 1: Quick Prototyping

**Scenario:** Developer needs to quickly set up a new component structure

```
User: "Create a React component structure with Button, Input, and Card folders,
       each with an index.tsx and styles.css"

AI creates:
Button/
  ├── index.tsx
  └── styles.css
Input/
  ├── index.tsx
  └── styles.css
Card/
  ├── index.tsx
  └── styles.css
```

### Use Case 2: File Organization

**Scenario:** Clean up a messy directory

```
User: "Create folders for images, documents, and scripts. Move .jpg files to images,
       .txt to documents, and .sh to scripts"

AI organizes files automatically with multiple commands
```

### Use Case 3: Project Initialization

**Scenario:** Start a new API project

```
User: "Create a basic API structure with routes, controllers, models, and middleware folders"

AI creates standard backend structure instantly
```

### Use Case 4: Documentation Generation

**Scenario:** Need documentation structure

```
User: "Create a docs folder with README.md, API.md, and SETUP.md files"

AI creates organized documentation structure
```

---

## Command Patterns That Work

### ✅ Supported Operations

| Category | Examples |
|----------|----------|
| **Directory** | "Create a folder called X", "Make directories A, B, C" |
| **File Creation** | "Create file X with content Y", "Touch files A, B, C" |
| **File Reading** | "Show me what's in X", "Read the content of Y" |
| **Listing** | "List all files", "Show me the directory contents" |
| **Finding** | "Find all .txt files", "Search for files named X" |
| **Moving** | "Move X to Y", "Rename A to B" |
| **Copying** | "Copy X to Y", "Duplicate file A as B" |
| **Deleting** | "Remove file X", "Delete folder Y" (except dangerous paths) |

---

## Commands That Are Blocked

### ❌ Security Restrictions

| Pattern | Reason | Example |
|---------|--------|---------|
| `rm -rf /` | Root deletion | "Delete everything in root" |
| `sudo` | Privilege escalation | "Run command as root" |
| Pipes `\|` | Command chaining | "List files and grep for X" |
| `chmod` | Permission changes | "Make file executable" |
| Command substitution | Injection risk | "Run $(malicious)" |
| System paths | Security | "Create file in /etc/" |

**Note:** If you need these operations, they must be added explicitly to the whitelist with proper safeguards.

---

## Tips for Best Results

### 1. Be Specific
✅ "Create a folder called 'my-project'"
❌ "Make something for my project"

### 2. Natural Language Works
✅ "Show me all files in this directory"
✅ "List everything here"
✅ "What files are in this folder?"
(All produce same result)

### 3. Multi-Step Operations
The AI can handle complex requests:
```
"Create a project structure with src and tests folders,
then create index.js in src and index.test.js in tests"
```

### 4. Context Awareness
The AI remembers what it created:
```
User: "Create a notes.txt file"
AI: [Creates file]
User: "Now add 'Hello' to it"
AI: [Knows which file to modify]
```

---

## Error Handling Examples

### Example 1: Command Not Allowed

**User:** "Install npm packages"

**AI Response:**
```
I cannot execute npm commands as they're not in the allowed command list.
This is a security restriction. The allowed commands are:
ls, pwd, mkdir, touch, echo, cat, rm, cp, mv, find, grep, head, tail, wc, date, whoami
```

### Example 2: File Doesn't Exist

**User:** "Show me what's in nonexistent.txt"

**AI Response:**
```
I tried to read nonexistent.txt but got an error:
cat: nonexistent.txt: No such file or directory

Would you like me to create this file first?
```

### Example 3: Permission Issue

**User:** "Create a file in /root/"

**AI Response:**
```
I cannot create files outside the sandbox directory.
All operations are restricted to /sandbox/user/ for security.
```

---

## Performance Examples

### Fast Operations (< 100ms)
- `ls` - List files
- `pwd` - Current directory
- `echo` - Create simple files
- `cat` - Read small files

### Medium Operations (100-500ms)
- `find` - Search filesystem
- `grep` - Search in files
- `cp -r` - Copy directories

### Complex Operations (500ms-5s)
- Multiple sequential commands
- Large file operations
- Recursive operations

---

## Comparison to Traditional Terminal

| Task | Traditional Terminal | AI OS Demo |
|------|---------------------|------------|
| Create folder | `mkdir project` | "Create a folder called project" |
| Create file | `touch file.txt && echo "hello" > file.txt` | "Create file.txt with 'hello'" |
| List files | `ls -la` | "Show me all files" or "List everything" |
| Find files | `find . -name "*.js"` | "Find all JavaScript files" |
| Multiple ops | `mkdir a && mkdir b && touch a/file.txt` | "Create folders a and b, with file.txt in a" |

**Advantage:** Natural language is more intuitive for beginners and faster for experienced users who want to describe intent rather than syntax.

---

## Advanced Usage Patterns

### Pattern 1: Batch Operations

```
User: "Create 5 folders named week1, week2, week3, week4, week5"

AI executes: mkdir week1 week2 week3 week4 week5
```

### Pattern 2: Conditional Logic

```
User: "If there's a config.txt file, show me its contents, otherwise create it with default settings"

AI handles logic:
1. Check if file exists (ls or cat)
2. Based on result, either read or create
```

### Pattern 3: Template Creation

```
User: "Create a basic HTML template in index.html"

AI generates proper HTML boilerplate with echo commands
```

---

## Testing the Demo

### Basic Functionality Test

1. Start the server
2. Try these in order:

```
1. "Create a folder called test"
2. "List all folders"
3. "Create a file hello.txt in test"
4. "Show me what's in test folder"
5. "Remove the test folder"
```

### Error Handling Test

```
1. "Install a package" (blocked)
2. "Read /etc/passwd" (blocked)
3. "Run sudo command" (blocked)
4. "Show nonexistent file" (graceful error)
```

### Complex Operation Test

```
"Create a complete project structure with:
- src folder containing index.js and utils.js
- tests folder containing index.test.js
- docs folder containing README.md
- a root-level package.json file"
```

---

## Next Steps

After trying these examples:
1. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand how it works
2. Check [README.md](README.md) for customization options
3. Try building your own custom commands
4. Experiment with E2B SDK for production use

## Community Examples

Share your interesting use cases! The AI can:
- Generate project scaffolding
- Organize files automatically
- Create documentation structures
- Set up test environments
- Build config files
- Manage log files
- And much more!

---

**Remember:** This demo runs in a sandbox for safety. All operations are isolated to the `/sandbox/user/` directory.
