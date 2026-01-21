# AI Direct Ubuntu OS Interaction

**Created:** January 21, 2026 at 01:31 AM
**Published:** January 21, 2026 at 01:36 AM
**Source:** https://gemini.google.com/share/3589c8903966

---

## Question

I see manu.im use the technique like they use ai chat interact with something directly to ubuntu (for example, when I prompt they to do something, they create something in /ubuntu/user/something). As a software developer, I want to know what technique they do

---

## Answer

To achieve direct OS interaction like Manus AI (manu.im), developers use an architecture known as **Agentic Tool Use within a Sandboxed Environment**.

Instead of just "chatting," the AI is given a "Bash" or "Shell" tool. When you ask it to create a file, the LLM doesn't just output text; it outputs a structured command (like `mkdir` or `touch`) that a backend runner executes on a real (but isolated) Ubuntu system.

---

## 1. The Core Architecture

The system follows a "Reason-Act" (ReAct) loop. Here is how the flow works:

1. **User Input:** "Create a project folder in `/home/ubuntu/user/`."
2. **LLM Reasoning:** The model realizes it cannot fulfill this through text alone. It selects the `execute_bash` tool.
3. **Action:** The LLM generates a JSON object: `{"tool": "bash", "command": "mkdir -p /home/ubuntu/user/my_project"}`.
4. **Execution:** A Python backend receives this, runs it via a sub-process, and captures the result (success or error).
5. **Observation:** The result is fed back to the LLM. "Folder created successfully."
6. **Response:** The AI tells you, "I've created the folder for you."

---

## 2. Key Technologies Used

As a developer, you can replicate this using these specific components:

### A. The Execution Sandbox (Crucial for Security)

You cannot run LLM-generated code on your actual host machine because a hallucination could run `rm -rf /`. Platforms like Manus use:

- **E2B (Extreme to Board):** An open-source infrastructure specifically for AI agents that provides "sandboxed cloud environments." It spins up a tiny Ubuntu MicroVM for every session.
- **Docker/Containers:** Running the agent inside a restricted Docker container with mounted volumes.
- **Firecracker/Kata Containers:** Lightweight MicroVMs used for high-speed isolation (similar to how AWS Lambda works).

### B. Tooling Frameworks

To connect the LLM to the terminal, you typically use:

- **Model Context Protocol (MCP):** A new standard (by Anthropic) that allows AI models to connect to "Filesystem" or "Terminal" servers securely.
- **LangChain / LangGraph:** Libraries that have built-in "ShellTool" wrappers to handle the `subprocess.run()` logic.
- **Open Interpreter:** An open-source project that is the "gold standard" for this. It lets an LLM control your local terminal, treating the OS as its primary interface.

---

## 3. How the "Ubuntu" interface works

When you see a file appear in `/ubuntu/user/...`, you are likely looking at a Virtual Filesystem or a Web-based Terminal (like Xterm.js) that is synced with the sandbox.

| Feature | How it's implemented |
|---------|---------------------|
| **Persistence** | The sandbox uses a persistent volume so that if you come back tomorrow, your files in `/user/` are still there. |
| **Real-time Feedback** | The backend uses WebSockets to stream the terminal output (stdout/stderr) directly to your chat UI. |
| **Permissioning** | The AI "user" is usually a low-privilege user in the Ubuntu guest, restricted by `sudo` policies. |

---

## 4. How to Start Building This

If you want to build a "Manus-like" interaction today, the fastest path is:

1. **SDK:** Use the E2B SDK (it handles the Ubuntu VM for you).
2. **Model:** Use Claude 3.5 Sonnet or GPT-4o (they are best at writing bash scripts).
3. **Glue:** Use Open Interpreter as a reference for how to pipe LLM output into a Python `exec()` or `bash` call.

[This technical guide on building a Bash Agent](https://www.youtube.com/watch?v=eNZnAAEdhWo) explains the multi-agent architecture Manus uses to break down complex tasks into shell commands.

**Reference:** What is Manus AI And How Does It Work? A Simple Explanation For Anyone - YouTube (Bernard Marr · 35K views)

---

*Would you like me to provide a Python code snippet using the E2B SDK to create a file in a remote Ubuntu sandbox?*
