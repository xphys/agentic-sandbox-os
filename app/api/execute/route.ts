import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Define the sandbox directory - all commands will be executed within this context
const SANDBOX_DIR = path.join(process.cwd(), 'sandbox', 'user');

// Whitelist of allowed commands for safety
const ALLOWED_COMMANDS = [
  'ls', 'pwd', 'mkdir', 'touch', 'echo', 'cat', 'rm', 'cp', 'mv',
  'find', 'grep', 'head', 'tail', 'wc', 'date', 'whoami'
];

function isCommandSafe(command: string): boolean {
  const trimmedCommand = command.trim();

  // Check if command starts with an allowed command
  const commandStart = trimmedCommand.split(' ')[0];
  if (!ALLOWED_COMMANDS.includes(commandStart)) {
    return false;
  }

  // Block dangerous patterns
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,  // Block rm -rf on root
    />\s*\/dev\//,     // Block redirects to /dev
    /sudo/,            // Block sudo
    /su\s/,            // Block su
    /chmod/,           // Block chmod
    /chown/,           // Block chown
    /\|/,              // Block pipes (for simplicity)
    /;/,               // Block command chaining
    /&&/,              // Block command chaining
    /\$\(/,            // Block command substitution
    /`/,               // Block backticks
  ];

  return !dangerousPatterns.some(pattern => pattern.test(trimmedCommand));
}

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { error: 'Invalid command' },
        { status: 400 }
      );
    }

    // Security check
    if (!isCommandSafe(command)) {
      return NextResponse.json(
        { error: 'Command not allowed for security reasons', output: '' },
        { status: 403 }
      );
    }

    // Execute command in sandbox directory
    const { stdout, stderr } = await execAsync(command, {
      cwd: SANDBOX_DIR,
      timeout: 5000, // 5 second timeout
      maxBuffer: 1024 * 1024, // 1MB max output
    });

    return NextResponse.json({
      success: true,
      output: stdout || stderr,
      command,
      workingDir: SANDBOX_DIR
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      output: error.stdout || error.stderr || ''
    }, { status: 500 });
  }
}
