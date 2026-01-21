import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const tools: Anthropic.Tool[] = [
  {
    name: 'execute_bash',
    description: 'Execute a bash command in a sandboxed environment. Use this to interact with the filesystem, run commands, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
      },
      required: ['command'],
    },
  },
];

async function executeBashCommand(command: string): Promise<string> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command }),
  });

  const data = await response.json();

  if (!response.ok) {
    return `Error: ${data.error}\n${data.output || ''}`;
  }

  return data.output || 'Command executed successfully (no output)';
}

// Store pending confirmations
const pendingConfirmations = new Map<string, {
  resolve: (value: boolean) => void;
  timestamp: number;
}>();

// Check if command requires human confirmation
function requiresHumanConfirmation(command: string): boolean {
  const destructivePatterns = [
    /\brm\b.*-r/,           // Recursive delete
    /\brm\b.*\*/,           // Delete with wildcards
    /\bmv\b.*\*/,           // Move with wildcards (could overwrite)
    /\bcp\b.*-r.*\*/,       // Copy recursive with wildcards
    />\s*\/dev\//,          // Redirects to devices
  ];

  return destructivePatterns.some(pattern => pattern.test(command));
}

// Get reason for requiring confirmation
function getConfirmationReason(command: string): string {
  if (/\brm\b.*-r/.test(command)) {
    return 'This command will recursively delete files/folders.';
  }
  if (/\brm\b.*\*/.test(command)) {
    return 'This command will delete multiple files using wildcards.';
  }
  if (/\bmv\b.*\*/.test(command)) {
    return 'This command will move multiple files and may overwrite existing files.';
  }
  if (/\bcp\b.*-r.*\*/.test(command)) {
    return 'This command will recursively copy multiple files.';
  }
  if (/>\s*\/dev\//.test(command)) {
    return 'This command redirects output to a device file.';
  }
  return 'This command may have significant effects on your files.';
}

// Wait for user confirmation
async function waitForConfirmation(confirmationId: string): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConfirmations.set(confirmationId, {
      resolve,
      timestamp: Date.now()
    });

    // Auto-reject after 2 minutes
    setTimeout(() => {
      if (pendingConfirmations.has(confirmationId)) {
        resolve(false);
        pendingConfirmations.delete(confirmationId);
      }
    }, 2 * 60 * 1000);
  });
}

// Handle confirmation response
export async function handleConfirmation(confirmationId: string, approved: boolean): Promise<boolean> {
  const confirmation = pendingConfirmations.get(confirmationId);
  if (confirmation) {
    confirmation.resolve(approved);
    pendingConfirmations.delete(confirmationId);
    return true;
  }
  return false;
}

// Multi-agent status types
type AgentStatus =
  | { type: 'supervisor_thinking', message: string, plan?: string[] }
  | { type: 'supervisor_delegating', task: string, targetAgent: string }
  | { type: 'supervisor_deciding_hitl', command: string, reasoning: string }
  | { type: 'agent_working', agent: string, task: string }
  | { type: 'agent_completed', agent: string, result: string }
  | { type: 'thinking', message: string }
  | { type: 'tool_use', tool: string, input: any }
  | { type: 'await_confirmation', command: string, reason: string, confirmationId: string, supervisorReasoning?: string }
  | { type: 'executing', command: string, executor: string }
  | { type: 'observing', result: string }
  | { type: 'response', text: string }
  | { type: 'error', error: string }
  | { type: 'done' };

// Supervisor Agent: Plans and delegates tasks
class SupervisorAgent {
  private anthropic: Anthropic;
  private sendStatus: (status: AgentStatus) => void;

  constructor(anthropic: Anthropic, sendStatus: (status: AgentStatus) => void) {
    this.anthropic = anthropic;
    this.sendStatus = sendStatus;
  }

  async planTask(userRequest: string): Promise<{
    plan: string[];
    needsHITL: boolean;
    reasoning: string;
  }> {
    this.sendStatus({
      type: 'supervisor_thinking',
      message: 'Supervisor analyzing request and creating execution plan...'
    });

    const planningResponse = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a supervisor agent responsible for planning tasks and ensuring safety.

User request: "${userRequest}"

Analyze this request and provide:
1. A step-by-step execution plan (2-5 steps)
2. Whether human confirmation should be required BEFORE starting (based on risk assessment)
3. Your reasoning for the safety decision

Consider these factors for HITL decision:
- Will this delete, move, or modify multiple files?
- Is this a system-level operation?
- Could this have unintended consequences?
- Is the request ambiguous or unclear?

Respond in JSON format:
{
  "plan": ["step 1", "step 2", ...],
  "needsHITL": true/false,
  "reasoning": "explanation of safety decision"
}`
      }]
    });

    const textBlock = planningResponse.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    if (!textBlock) {
      return {
        plan: ['Execute the user request'],
        needsHITL: false,
        reasoning: 'Default execution'
      };
    }

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = textBlock.text.trim();
      const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/) || jsonText.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const plan = JSON.parse(jsonText);

      this.sendStatus({
        type: 'supervisor_thinking',
        message: `Plan created: ${plan.plan.length} steps identified`,
        plan: plan.plan
      });

      return plan;
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        plan: ['Execute the user request'],
        needsHITL: false,
        reasoning: 'Could not parse plan, proceeding with caution'
      };
    }
  }

  async shouldTriggerHITL(command: string, context: string): Promise<{
    shouldConfirm: boolean;
    reasoning: string;
  }> {
    this.sendStatus({
      type: 'supervisor_deciding_hitl',
      command,
      reasoning: 'Evaluating command safety...'
    });

    // First, use pattern-based detection
    const patternMatch = requiresHumanConfirmation(command);

    // Then, ask supervisor for intelligent decision
    const safetyResponse = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a safety supervisor evaluating whether a command needs human approval.

Command: "${command}"
Context: "${context}"

Pattern-based detection says: ${patternMatch ? 'REQUIRES CONFIRMATION' : 'SAFE'}

Provide your assessment in JSON:
{
  "shouldConfirm": true/false,
  "reasoning": "brief explanation"
}

Consider:
- Data loss risk
- Scope of impact
- Reversibility
- User intent clarity`
      }]
    });

    const textBlock = safetyResponse.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    if (!textBlock) {
      return {
        shouldConfirm: patternMatch,
        reasoning: getConfirmationReason(command)
      };
    }

    try {
      let jsonText = textBlock.text.trim();
      const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/) || jsonText.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const decision = JSON.parse(jsonText);
      return decision;
    } catch (error) {
      return {
        shouldConfirm: patternMatch,
        reasoning: getConfirmationReason(command)
      };
    }
  }
}

// Executor Agent: Executes bash commands
class ExecutorAgent {
  private sendStatus: (status: AgentStatus) => void;
  private agentId: string;

  constructor(sendStatus: (status: AgentStatus) => void) {
    this.sendStatus = sendStatus;
    this.agentId = 'executor-1';
  }

  async execute(command: string): Promise<string> {
    this.sendStatus({
      type: 'agent_working',
      agent: 'Executor',
      task: `Executing: ${command}`
    });

    this.sendStatus({
      type: 'executing',
      command,
      executor: this.agentId
    });

    const result = await executeBashCommand(command);

    this.sendStatus({
      type: 'agent_completed',
      agent: 'Executor',
      result: result.substring(0, 100) + (result.length > 100 ? '...' : '')
    });

    return result;
  }
}

// Analyzer Agent: Analyzes command results
class AnalyzerAgent {
  private sendStatus: (status: AgentStatus) => void;

  constructor(sendStatus: (status: AgentStatus) => void) {
    this.sendStatus = sendStatus;
  }

  async analyze(command: string, result: string): Promise<string> {
    this.sendStatus({
      type: 'agent_working',
      agent: 'Analyzer',
      task: 'Analyzing command results...'
    });

    const analysis = `Command: ${command}\nResult: ${result}`;

    this.sendStatus({
      type: 'agent_completed',
      agent: 'Analyzer',
      result: 'Analysis complete'
    });

    return analysis;
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const sendStatus = (status: AgentStatus) => {
        const data = `data: ${JSON.stringify(status)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
          sendStatus({ type: 'error', error: 'Invalid messages format' });
          controller.close();
          return;
        }

        // Initialize multi-agent system
        const supervisor = new SupervisorAgent(anthropic, sendStatus);
        const executor = new ExecutorAgent(sendStatus);
        const analyzer = new AnalyzerAgent(sendStatus);

        // Get the user's latest request
        const userMessage = messages[messages.length - 1]?.content || '';

        // Supervisor creates execution plan
        const { plan, needsHITL, reasoning } = await supervisor.planTask(userMessage);

        // If supervisor determines upfront HITL is needed
        if (needsHITL) {
          const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

          sendStatus({
            type: 'await_confirmation',
            command: plan.join(' → '),
            reason: reasoning,
            confirmationId,
            supervisorReasoning: `Supervisor recommends confirmation: ${reasoning}`
          });

          const approved = await waitForConfirmation(confirmationId);

          if (!approved) {
            sendStatus({
              type: 'response',
              text: `Task cancelled by user. Planned steps were: ${plan.join(', ')}`
            });
            sendStatus({ type: 'done' });
            controller.close();
            return;
          }
        }

        sendStatus({
          type: 'supervisor_delegating',
          task: 'Beginning execution with worker agents',
          targetAgent: 'ExecutorAgent'
        });

        // ReAct Loop with multi-agent coordination
        let currentMessages = [...messages];
        let toolUseCount = 0;
        const maxToolUses = 8;

        while (toolUseCount < maxToolUses) {
          sendStatus({
            type: 'thinking',
            message: toolUseCount === 0
              ? 'Worker agent analyzing task...'
              : `Processing step ${toolUseCount + 1}...`
          });

          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            tools,
            messages: currentMessages,
            system: `You are a worker agent in a multi-agent system. A supervisor has planned the execution strategy.

Execute commands to fulfill the user's request. The supervisor handles safety decisions, so focus on execution quality.
After executing commands and observing results, provide a clear response about what you accomplished.`
          });

          const toolUseBlock = response.content.find(
            (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
          );

          if (!toolUseBlock) {
            const textBlock = response.content.find(
              (block): block is Anthropic.TextBlock => block.type === 'text'
            );

            if (textBlock) {
              sendStatus({
                type: 'response',
                text: textBlock.text
              });
            }

            sendStatus({ type: 'done' });
            controller.close();
            return;
          }

          toolUseCount++;

          sendStatus({
            type: 'tool_use',
            tool: toolUseBlock.name,
            input: toolUseBlock.input
          });

          let toolResult = '';

          if (toolUseBlock.name === 'execute_bash') {
            const command = (toolUseBlock.input as { command: string }).command;

            // Supervisor evaluates if this specific command needs HITL
            const { shouldConfirm, reasoning: hitlReasoning } = await supervisor.shouldTriggerHITL(
              command,
              `Executing step ${toolUseCount} of plan`
            );

            if (shouldConfirm) {
              const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

              sendStatus({
                type: 'await_confirmation',
                command,
                reason: hitlReasoning,
                confirmationId,
                supervisorReasoning: `Supervisor decision: ${hitlReasoning}`
              });

              const approved = await waitForConfirmation(confirmationId);

              if (!approved) {
                toolResult = 'Command execution cancelled by user after supervisor safety review.';
                sendStatus({
                  type: 'observing',
                  result: 'User declined command execution'
                });
              } else {
                // Execute with executor agent
                toolResult = await executor.execute(command);

                // Analyze with analyzer agent
                await analyzer.analyze(command, toolResult);

                sendStatus({
                  type: 'observing',
                  result: toolResult.substring(0, 200)
                });
              }
            } else {
              // No confirmation needed - execute directly
              toolResult = await executor.execute(command);

              // Analyze result
              await analyzer.analyze(command, toolResult);

              sendStatus({
                type: 'observing',
                result: toolResult.substring(0, 200)
              });
            }
          }

          // Add tool result to conversation
          currentMessages.push({
            role: 'assistant',
            content: response.content,
          });

          currentMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseBlock.id,
                content: toolResult,
              },
            ],
          });
        }

        // Max iterations reached
        sendStatus({
          type: 'thinking',
          message: 'Supervisor summarizing completed work...'
        });

        const finalResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [
            ...currentMessages,
            {
              role: 'user',
              content: 'Please provide a summary of what you accomplished so far.'
            }
          ],
        });

        const finalText = finalResponse.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );

        sendStatus({
          type: 'response',
          text: finalText?.text || 'Multi-agent system completed the operations. All planned tasks have been executed.'
        });
        sendStatus({ type: 'done' });
        controller.close();

      } catch (error: any) {
        console.error('Chat API Error:', error);
        sendStatus({
          type: 'error',
          error: error.message || 'An error occurred'
        });
        sendStatus({ type: 'done' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
