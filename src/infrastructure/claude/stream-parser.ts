/**
 * Stream parser for Claude Code CLI output
 *
 * Parses the stream-json output format and converts to normalized events.
 */

import type { StreamEvent } from "./types.ts";

/**
 * Raw event from Claude Code (union of all possible types)
 */
interface RawEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    id?: string;
    model?: string;
    role?: string;
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      content?: string;
      is_error?: boolean;
    }>;
  };
  tool_use_result?: {
    stdout?: string;
    stderr?: string;
    interrupted?: boolean;
  };
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  num_turns?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  cwd?: string;
  tools?: string[];
  model?: string;
}

/**
 * Parse a single line of stream-json output
 */
export function parseStreamLine(
  line: string,
): StreamEvent | StreamEvent[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const raw = JSON.parse(trimmed) as RawEvent;
    return parseRawEvent(raw);
  } catch {
    // If we can't parse as JSON, it might be a log line - ignore it
    return null;
  }
}

/**
 * Parse a raw event from Claude Code and convert to normalized event(s)
 */
function parseRawEvent(raw: RawEvent): StreamEvent | StreamEvent[] | null {
  switch (raw.type) {
    case "system":
      return parseSystemEvent(raw);

    case "assistant":
      return parseAssistantEvent(raw);

    case "user":
      return parseUserEvent(raw);

    case "result":
      return parseResultEvent(raw);

    default:
      return null;
  }
}

/**
 * Parse system init event
 */
function parseSystemEvent(raw: RawEvent): StreamEvent | null {
  if (raw.subtype === "init" && raw.session_id) {
    return {
      type: "init",
      sessionId: raw.session_id,
      model: raw.model ?? "unknown",
      tools: raw.tools ?? [],
    };
  }
  return null;
}

/**
 * Parse assistant message event
 *
 * An assistant message can contain multiple content items:
 * - text: The assistant's text response
 * - tool_use: A tool invocation
 */
function parseAssistantEvent(
  raw: RawEvent,
): StreamEvent | StreamEvent[] | null {
  const events: StreamEvent[] = [];

  if (!raw.message?.content) return null;

  for (const content of raw.message.content) {
    if (content.type === "text" && content.text) {
      // Check if it's an error message
      if (content.text.startsWith("API Error:")) {
        events.push({
          type: "error",
          message: content.text,
        });
      } else {
        events.push({
          type: "text",
          content: content.text,
        });
      }
    } else if (content.type === "tool_use" && content.id && content.name) {
      // Get description from input if it's a Bash command
      const input = content.input ?? {};
      const description =
        content.name === "Bash"
          ? (input.description as string | undefined)
          : undefined;

      events.push({
        type: "tool_start",
        toolId: content.id,
        tool: content.name,
        input,
        description,
      });
    }
  }

  if (events.length === 0) return null;
  if (events.length === 1) return events[0]!;
  return events;
}

/**
 * Parse user message event (tool results)
 */
function parseUserEvent(raw: RawEvent): StreamEvent | StreamEvent[] | null {
  const events: StreamEvent[] = [];

  if (!raw.message?.content) return null;

  for (const content of raw.message.content) {
    if (content.type === "tool_result" && content.tool_use_id) {
      events.push({
        type: "tool_result",
        toolId: content.tool_use_id,
        output: content.content ?? "",
        isError: content.is_error ?? false,
        stdout: raw.tool_use_result?.stdout,
        stderr: raw.tool_use_result?.stderr,
      });
    }
  }

  if (events.length === 0) return null;
  if (events.length === 1) return events[0]!;
  return events;
}

/**
 * Parse result event (end of stream)
 */
function parseResultEvent(raw: RawEvent): StreamEvent {
  if (raw.is_error) {
    return {
      type: "error",
      message: raw.result ?? "Unknown error",
    };
  }

  return {
    type: "done",
    result: raw.result,
    sessionId: raw.session_id,
    durationMs: raw.duration_ms,
    numTurns: raw.num_turns,
    costUsd: raw.total_cost_usd,
    usage: raw.usage
      ? {
          inputTokens: raw.usage.input_tokens,
          outputTokens: raw.usage.output_tokens,
        }
      : undefined,
  };
}

/**
 * Get a human-readable description for a tool call
 */
export function getToolDescription(
  tool: string,
  input: Record<string, unknown>,
): string {
  switch (tool) {
    case "Bash":
      return (
        (input.description as string) ||
        (input.command as string) ||
        "Running command..."
      );

    case "Read":
      return `Reading: ${input.file_path}`;

    case "Edit":
      return `Editing: ${input.file_path}`;

    case "Write":
      return `Writing: ${input.file_path}`;

    case "Glob":
      return `Finding files: ${input.pattern}`;

    case "Grep":
      return `Searching: ${input.pattern}`;

    case "WebSearch":
      return `Searching web: ${input.query}`;

    case "WebFetch":
      return `Fetching: ${input.url}`;

    case "Task":
      return `Running task: ${input.description}`;

    default:
      return `Running: ${tool}`;
  }
}

/**
 * Abbreviate tool output for display
 */
export function abbreviateOutput(output: string, maxLength = 200): string {
  if (output.length <= maxLength) return output;

  const lines = output.split("\n");
  if (lines.length <= 5) {
    return `${output.slice(0, maxLength)}...`;
  }

  // Show first 2 and last 2 lines
  const first = lines.slice(0, 2).join("\n");
  const last = lines.slice(-2).join("\n");
  return `${first}\n... (${lines.length - 4} more lines) ...\n${last}`;
}

/**
 * Create an async generator that yields parsed events from a readable stream
 */
export async function* parseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncIterable<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining buffer
        if (buffer.trim()) {
          const events = parseStreamLine(buffer);
          if (events) {
            if (Array.isArray(events)) {
              for (const event of events) {
                yield event;
              }
            } else {
              yield events;
            }
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const events = parseStreamLine(line);
        if (events) {
          if (Array.isArray(events)) {
            for (const event of events) {
              yield event;
            }
          } else {
            yield events;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
