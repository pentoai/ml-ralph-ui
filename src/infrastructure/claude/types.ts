/**
 * Claude Code client types
 *
 * Based on Claude Code CLI stream-json output format.
 */

// ============================================================================
// Raw Claude Code Stream Events (what comes from CLI)
// ============================================================================

/**
 * System init event - first event in stream
 */
export interface RawSystemInitEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  cwd: string;
  tools: string[];
  model: string;
  mcp_servers?: Array<{ name: string; status: string }>;
}

/**
 * Assistant message event - contains text or tool_use
 */
export interface RawAssistantEvent {
  type: "assistant";
  message: {
    id: string;
    model: string;
    role: "assistant";
    content: Array<RawTextContent | RawToolUseContent>;
    stop_reason: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  session_id: string;
}

export interface RawTextContent {
  type: "text";
  text: string;
}

export interface RawToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * User message event - contains tool results
 */
export interface RawUserEvent {
  type: "user";
  message: {
    role: "user";
    content: Array<RawToolResultContent>;
  };
  session_id: string;
  tool_use_result?: {
    stdout?: string;
    stderr?: string;
    interrupted?: boolean;
  };
}

export interface RawToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

/**
 * Result event - final event in stream
 */
export interface RawResultEvent {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  result: string;
  session_id: string;
  duration_ms: number;
  num_turns: number;
  total_cost_usd: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export type RawStreamEvent =
  | RawSystemInitEvent
  | RawAssistantEvent
  | RawUserEvent
  | RawResultEvent;

// ============================================================================
// Normalized Stream Events (what we use in the app)
// ============================================================================

export type StreamEventType =
  | "init"
  | "text"
  | "tool_start"
  | "tool_result"
  | "error"
  | "done";

export interface InitEvent {
  type: "init";
  sessionId: string;
  model: string;
  tools: string[];
}

export interface TextEvent {
  type: "text";
  content: string;
}

export interface ToolStartEvent {
  type: "tool_start";
  toolId: string;
  tool: string;
  input: Record<string, unknown>;
  description?: string; // For Bash, the description field
}

export interface ToolResultEvent {
  type: "tool_result";
  toolId: string;
  output: string;
  isError: boolean;
  stdout?: string;
  stderr?: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export interface DoneEvent {
  type: "done";
  result?: string;
  sessionId?: string;
  durationMs?: number;
  numTurns?: number;
  costUsd?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type StreamEvent =
  | InitEvent
  | TextEvent
  | ToolStartEvent
  | ToolResultEvent
  | ErrorEvent
  | DoneEvent;

// ============================================================================
// Client Interface
// ============================================================================

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
   * Allowed tools for Claude Code (defaults to common tools)
   */
  allowedTools?: string[];

  /**
   * Continue from a previous conversation (uses --continue flag)
   */
  continueConversation?: boolean;

  /**
   * Resume a specific session by ID
   */
  resumeSession?: string;

  /**
   * Maximum number of turns before stopping
   */
  maxTurns?: number;
}
