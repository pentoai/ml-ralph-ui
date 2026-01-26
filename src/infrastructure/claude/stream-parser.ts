/**
 * Parse Claude Code JSON stream output
 */

import type { StreamEvent } from "./types.ts";

interface RawStreamMessage {
  type: string;
  subtype?: string;
  content_block_id?: string;
  tool_id?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  error?: string;
  text?: string;
  delta?: {
    text?: string;
    partial_json?: string;
  };
  result?: {
    text?: string;
  };
}

/**
 * Parse a single line of Claude Code stream JSON
 */
export function parseStreamLine(line: string): StreamEvent | null {
  if (!line.trim()) {
    return null;
  }

  try {
    const message = JSON.parse(line) as RawStreamMessage;
    return parseStreamMessage(message);
  } catch {
    // If it's not JSON, treat as plain text
    return {
      type: "text",
      content: line,
    };
  }
}

/**
 * Parse a Claude Code stream message into our event type
 */
function parseStreamMessage(message: RawStreamMessage): StreamEvent | null {
  switch (message.type) {
    case "assistant":
      // Assistant message with text
      if (message.subtype === "text" && message.text) {
        return {
          type: "text",
          content: message.text,
        };
      }
      break;

    case "content_block_start":
      // Tool use starting
      if (message.subtype === "tool_use" && message.tool_name) {
        return {
          type: "tool_start",
          toolId: message.content_block_id ?? message.tool_id ?? "",
          tool: message.tool_name,
          input: message.tool_input ?? {},
        };
      }
      break;

    case "content_block_delta":
      // Streaming content
      if (message.delta?.text) {
        return {
          type: "text",
          content: message.delta.text,
        };
      }
      if (message.delta?.partial_json) {
        // Tool input streaming - emit as tool_running
        return {
          type: "tool_running",
          toolId: message.content_block_id ?? "",
          tool: "",
          content: message.delta.partial_json,
        };
      }
      break;

    case "content_block_stop":
      // Content block ended - ignore for now
      break;

    case "tool_result":
      // Tool completed
      return {
        type: "tool_end",
        toolId: message.tool_id ?? message.content_block_id ?? "",
        tool: message.tool_name ?? "",
        output: message.tool_output,
        error: message.error,
      };

    case "result":
      // Final result
      return {
        type: "done",
        result: message.result?.text,
      };

    case "error":
      return {
        type: "error",
        message: message.error ?? "Unknown error",
      };

    case "system":
      // System messages - could be init, etc.
      if (message.subtype === "init") {
        // Session started
        return null;
      }
      break;
  }

  return null;
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
          const event = parseStreamLine(buffer);
          if (event) {
            yield event;
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const event = parseStreamLine(line);
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
