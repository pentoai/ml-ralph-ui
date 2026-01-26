/**
 * Claude Code client types
 */

export type StreamEventType =
  | "text"
  | "tool_start"
  | "tool_running"
  | "tool_end"
  | "error"
  | "done";

export interface TextEvent {
  type: "text";
  content: string;
}

export interface ToolStartEvent {
  type: "tool_start";
  toolId: string;
  tool: string;
  input: unknown;
}

export interface ToolRunningEvent {
  type: "tool_running";
  toolId: string;
  tool: string;
  content?: string;
}

export interface ToolEndEvent {
  type: "tool_end";
  toolId: string;
  tool: string;
  output: unknown;
  error?: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface DoneEvent {
  type: "done";
  result?: string;
}

export type StreamEvent =
  | TextEvent
  | ToolStartEvent
  | ToolRunningEvent
  | ToolEndEvent
  | ErrorEvent
  | DoneEvent;

export interface ClaudeCodeClient {
  /**
   * Execute a prompt and stream the response
   */
  execute(prompt: string, options?: ExecuteOptions): AsyncIterable<StreamEvent>;

  /**
   * Cancel the current execution
   */
  cancel(): Promise<void>;

  /**
   * Check if currently executing
   */
  isRunning(): boolean;
}

export interface ExecuteOptions {
  /**
   * Working directory for the Claude Code process
   */
  cwd?: string;

  /**
   * Allowed tools for Claude Code
   */
  allowedTools?: string[];

  /**
   * System prompt to prepend
   */
  systemPrompt?: string;

  /**
   * Continue from a previous conversation
   */
  continueConversation?: boolean;
}
