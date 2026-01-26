/**
 * Claude Code client implementation
 */

import { type Subprocess, spawn } from "bun";
import { parseStreamLine } from "./stream-parser.ts";
import type { ClaudeCodeClient, ExecuteOptions, StreamEvent } from "./types.ts";

export class BunClaudeCodeClient implements ClaudeCodeClient {
  private process: Subprocess | null = null;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async *execute(
    prompt: string,
    options?: ExecuteOptions,
  ): AsyncIterable<StreamEvent> {
    const cwd = options?.cwd ?? this.projectPath;

    // Build command arguments
    const args = ["-p", prompt, "--output-format", "stream-json"];

    // Add allowed tools if specified
    if (options?.allowedTools && options.allowedTools.length > 0) {
      args.push("--allowedTools", options.allowedTools.join(","));
    }

    // Add system prompt if specified
    if (options?.systemPrompt) {
      args.push("--system-prompt", options.systemPrompt);
    }

    // Continue conversation if specified
    if (options?.continueConversation) {
      args.push("--continue");
    }

    // Resume specific session if specified
    if (options?.resumeSession) {
      args.push("--resume", options.resumeSession);
    }

    // Max turns limit if specified
    if (options?.maxTurns) {
      args.push("--max-turns", String(options.maxTurns));
    }

    try {
      // Spawn Claude Code process
      this.process = spawn({
        cmd: ["claude", ...args],
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const stdout = this.process.stdout;
      if (!stdout || typeof stdout === "number") {
        throw new Error("Failed to get stdout from Claude Code process");
      }

      // Read and parse stdout line by line
      const decoder = new TextDecoder();
      const reader = stdout.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Process remaining buffer
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
          buffer = lines.pop() ?? "";

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

      // Wait for process to complete
      const exitCode = await this.process.exited;

      if (exitCode !== 0) {
        // Read stderr for error message
        let errorMessage = "Claude Code process exited with error";
        const processStderr = this.process.stderr;

        if (processStderr && typeof processStderr !== "number") {
          const stderrReader = processStderr.getReader();
          const stderrDecoder = new TextDecoder();
          let stderrText = "";

          try {
            while (true) {
              const { done, value } = await stderrReader.read();
              if (done) break;
              stderrText += stderrDecoder.decode(value, { stream: true });
            }
          } finally {
            stderrReader.releaseLock();
          }

          if (stderrText.trim()) {
            errorMessage = stderrText.trim();
          }
        }

        yield {
          type: "error",
          message: errorMessage,
        };
      }

      yield { type: "done" };
    } catch (error) {
      yield {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.process = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}
