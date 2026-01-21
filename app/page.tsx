'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type AgentStatus =
  | { type: 'supervisor_thinking', message: string, plan?: string[] }
  | { type: 'supervisor_delegating', task: string, targetAgent: string }
  | { type: 'supervisor_deciding_hitl', command: string, reasoning: string }
  | { type: 'agent_working', agent: string, task: string }
  | { type: 'agent_completed', agent: string, result: string }
  | { type: 'thinking', message: string }
  | { type: 'tool_use', tool: string, input: any }
  | { type: 'await_confirmation', command: string, reason: string, confirmationId: string, supervisorReasoning?: string }
  | { type: 'executing', command: string, executor?: string }
  | { type: 'observing', result: string }
  | { type: 'response', text: string }
  | { type: 'error', error: string }
  | { type: 'done' };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I can interact with a sandboxed Ubuntu-like environment. Try asking me to create files, list directories, or perform other bash operations. Example: "Create a folder called my_project"'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, agentStatus]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setAgentStatus(null);

    try {
      // Convert messages to Anthropic format
      const apiMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let finalResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const status: AgentStatus = JSON.parse(data);

              if (status.type === 'response') {
                finalResponse = status.text;
              } else if (status.type === 'error') {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Error: ${status.error}`
                }]);
                setAgentStatus(null);
                setIsLoading(false);
                return;
              } else if (status.type === 'done') {
                setAgentStatus(null);
                if (finalResponse) {
                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: finalResponse
                  }]);
                }
              } else {
                setAgentStatus(status);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
      setAgentStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (confirmationId: string, approved: boolean) => {
    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmationId, approved }),
      });
    } catch (error) {
      console.error('Failed to send confirmation:', error);
    }
  };

  const renderAgentStatus = () => {
    if (!agentStatus) return null;

    // Special handling for confirmation requests
    if (agentStatus.type === 'await_confirmation') {
      return (
        <div className="flex justify-start">
          <div className="rounded-2xl px-4 py-3 border bg-orange-500/20 border-orange-500/50 text-orange-300">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <div className="text-xs font-semibold mb-1 opacity-70">
                  {agentStatus.supervisorReasoning ? '🧠 Supervisor: Human Confirmation Required' : 'Human Confirmation Required'}
                </div>
                <div className="text-sm font-mono mb-2">{agentStatus.reason}</div>
                {agentStatus.supervisorReasoning && (
                  <div className="text-xs mb-2 opacity-70 italic">
                    {agentStatus.supervisorReasoning}
                  </div>
                )}
                <div className="text-xs mt-1 opacity-80 font-mono break-all bg-black/20 p-2 rounded">
                  $ {agentStatus.command}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleConfirmation(agentStatus.confirmationId, true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleConfirmation(agentStatus.confirmationId, false)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✗ Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const getStatusDisplay = () => {
      switch (agentStatus.type) {
        case 'supervisor_thinking':
          return {
            icon: '🧠',
            text: agentStatus.message,
            color: 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300',
            label: 'Supervisor Agent',
            details: agentStatus.plan ? (
              <div className="text-xs mt-2 opacity-70">
                <div className="font-semibold mb-1">Execution Plan:</div>
                {agentStatus.plan.map((step, i) => (
                  <div key={i} className="ml-2">• {step}</div>
                ))}
              </div>
            ) : undefined
          };
        case 'supervisor_delegating':
          return {
            icon: '📋',
            text: agentStatus.task,
            color: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
            label: `Supervisor → ${agentStatus.targetAgent}`
          };
        case 'supervisor_deciding_hitl':
          return {
            icon: '🛡️',
            text: `Evaluating safety: ${agentStatus.command}`,
            color: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
            label: 'Supervisor Safety Check'
          };
        case 'agent_working':
          return {
            icon: '⚙️',
            text: agentStatus.task,
            color: 'bg-teal-500/20 border-teal-500/50 text-teal-300',
            label: `${agentStatus.agent} Agent`
          };
        case 'agent_completed':
          return {
            icon: '✅',
            text: agentStatus.result,
            color: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
            label: `${agentStatus.agent} Agent`
          };
        case 'thinking':
          return {
            icon: '🤔',
            text: agentStatus.message,
            color: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
            label: 'Worker Agent'
          };
        case 'tool_use':
          return {
            icon: '🔧',
            text: `Using tool: ${agentStatus.tool}`,
            color: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
            label: 'Worker Agent'
          };
        case 'executing':
          return {
            icon: '⚡',
            text: `Executing: ${agentStatus.command}`,
            color: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
            label: agentStatus.executor ? `Executor Agent (${agentStatus.executor})` : 'Executor Agent'
          };
        case 'observing':
          return {
            icon: '👀',
            text: `Observing result...`,
            color: 'bg-green-500/20 border-green-500/50 text-green-300',
            label: 'Worker Agent'
          };
        default:
          return null;
      }
    };

    const display = getStatusDisplay();
    if (!display) return null;

    return (
      <div className="flex justify-start">
        <div className={`rounded-2xl px-4 py-3 border ${display.color} animate-pulse`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{display.icon}</span>
            <div className="flex-1">
              <div className="text-xs font-semibold mb-1 opacity-70">{display.label}</div>
              <div className="text-sm font-mono">{display.text}</div>
              {agentStatus.type === 'executing' && (
                <div className="text-xs mt-1 opacity-60 font-mono break-all">
                  $ {agentStatus.command}
                </div>
              )}
              {display.details}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-700 bg-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">AI Direct OS Interaction Demo</h1>
          <p className="text-sm text-zinc-400 mt-1">
            ReAct Loop: Reasoning + Acting with Sandboxed Bash Execution
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                }`}
              >
                <div className="text-xs font-semibold mb-1 opacity-70">
                  {message.role === 'user' ? 'You' : 'AI Agent'}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {/* Agent Status Display */}
          {renderAgentStatus()}

          {/* Loading indicator when waiting for first response */}
          {isLoading && !agentStatus && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Form */}
      <div className="border-t border-zinc-700 bg-zinc-900/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to create files, list directories, etc..."
              disabled={isLoading}
              className="flex-1 bg-zinc-800 text-white border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
          <div className="mt-2 text-xs text-zinc-500">
            Try: "Create a folder called projects", "List all files", "Create a file hello.txt with content 'Hello World'"
          </div>
        </div>
      </div>
    </div>
  );
}
