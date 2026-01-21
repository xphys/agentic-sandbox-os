# Sandboxed File System

This directory simulates a sandboxed Ubuntu environment where AI commands are executed.

## Security Features:
- Commands are whitelisted (only safe commands allowed)
- Execution is limited to this sandbox directory
- Dangerous patterns (rm -rf /, sudo, etc.) are blocked
- 5-second timeout for all commands
- Maximum 1MB output buffer

## Structure:
- /sandbox/user/ - User workspace directory where files and folders are created
