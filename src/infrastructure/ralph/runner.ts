/**
 * ML-Ralph runner - executes the autonomous agent loop
 */

import type { Subprocess } from "bun";

export interface RunnerConfig {
  projectPath: string;
  maxIterations?: number;
  onOutput?: (event: StreamEvent) => void;
  onIterationStart?: (iteration: number) => void;
  onIterationEnd?: (iteration: number, result: string) => void;
  onComplete?: (reason: "project_complete" | "max_iterations") => void;
  onError?: (error: Error) => void;
}

export interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "iteration_marker";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  isError?: boolean;
}

export class RalphRunner {
  private config: RunnerConfig;
  private running = false;
  private currentProcess: Subprocess | null = null;
  private currentIteration = 0;

  constructor(config: RunnerConfig) {
    this.config = {
      maxIterations: 100,
      ...config,
    };
  }

  /**
   * Check if RALPH.md exists (initialized)
   */
  async isInitialized(): Promise<boolean> {
    const ralphMdPath = `${this.config.projectPath}/.ml-ralph/RALPH.md`;
    return Bun.file(ralphMdPath).exists();
  }

  /**
   * Start the autonomous loop
   */
  async start(): Promise<void> {
    if (this.running) return;

    const initialized = await this.isInitialized();
    if (!initialized) {
      this.config.onError?.(new Error("Not initialized. Run init first."));
      return;
    }

    this.running = true;
    this.currentIteration = 0;

    const prompt = `Read .ml-ralph/RALPH.md for instructions.

Execute one iteration of the cognitive loop. Update state files as needed.
When done, output exactly: <iteration_complete>

If the project is complete (success criteria met), output: <project_complete>`;

    try {
      for (let i = 1; i <= this.config.maxIterations!; i++) {
        if (!this.running) break;

        this.currentIteration = i;
        this.config.onIterationStart?.(i);

        // Emit iteration marker
        this.config.onOutput?.({
          type: "iteration_marker",
          content: `═══ Iteration ${i} ═══`,
        });

        const result = await this.runIteration(prompt);

        this.config.onIterationEnd?.(i, result);

        if (result.includes("<project_complete>")) {
          this.config.onComplete?.("project_complete");
          break;
        }
      }

      if (this.currentIteration >= this.config.maxIterations!) {
        this.config.onComplete?.("max_iterations");
      }
    } catch (error) {
      this.config.onError?.(
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      this.running = false;
      this.currentProcess = null;
    }
  }

  /**
   * Stop the running loop
   */
  stop(): void {
    this.running = false;
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  /**
   * Check if the runner is currently running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current iteration number
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  /**
   * Run a single iteration
   */
  private async runIteration(prompt: string): Promise<string> {
    const cmd = [
      "claude",
      "--dangerously-skip-permissions",
      "-p",
      prompt,
      "--output-format",
      "stream-json",
    ];

    const proc = Bun.spawn(cmd, {
      cwd: this.config.projectPath,
      stdout: "pipe",
      stderr: "pipe",
    });
    this.currentProcess = proc;

    let fullResult = "";
    const stdout = proc.stdout;
    if (!stdout || typeof stdout === "number") {
      throw new Error("Failed to capture stdout from claude process");
    }
    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            this.handleStreamEvent(event);

            if (event.type === "result") {
              fullResult = event.result || "";
            }
          } catch {
            // Not JSON, emit as text
            this.config.onOutput?.({
              type: "text",
              content: line,
            });
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          this.handleStreamEvent(event);
          if (event.type === "result") {
            fullResult = event.result || "";
          }
        } catch {
          this.config.onOutput?.({
            type: "text",
            content: buffer,
          });
        }
      }
    } finally {
      reader.releaseLock();
    }

    await proc.exited;
    return fullResult;
  }

  /**
   * Handle a streaming JSON event from Claude Code
   */
  private handleStreamEvent(event: Record<string, unknown>): void {
    const eventType = event.type as string;

    if (eventType === "assistant") {
      const message = event.message as Record<string, unknown> | undefined;
      const content = (message?.content as Array<Record<string, unknown>>) || [];

      for (const block of content) {
        const blockType = block.type as string;

        if (blockType === "text") {
          const text = block.text as string;
          if (text) {
            this.config.onOutput?.({
              type: "text",
              content: text,
            });
          }
        } else if (blockType === "tool_use") {
          const toolName = block.name as string;
          const toolInput = block.input as Record<string, unknown>;

          let description = "";
          if (toolName === "Bash") {
            description =
              (toolInput.description as string) ||
              (toolInput.command as string)?.slice(0, 50) ||
              "";
          } else if (
            toolName === "Read" ||
            toolName === "Write" ||
            toolName === "Edit"
          ) {
            description = toolInput.file_path as string;
          } else if (toolName === "Glob" || toolName === "Grep") {
            description = toolInput.pattern as string;
          }

          this.config.onOutput?.({
            type: "tool_call",
            content: description,
            toolName,
            toolInput,
          });
        }
      }
    } else if (eventType === "user") {
      const message = event.message as Record<string, unknown> | undefined;
      const content = (message?.content as Array<Record<string, unknown>>) || [];

      for (const block of content) {
        if ((block.type as string) === "tool_result") {
          const isError = block.is_error as boolean;
          this.config.onOutput?.({
            type: "tool_result",
            content: isError ? "failed" : "success",
            isError,
          });
        }
      }
    } else if (eventType === "result") {
      // Final result - nothing to emit
    }
  }
}

/**
 * Create a new runner instance
 */
export function createRunner(config: RunnerConfig): RalphRunner {
  return new RalphRunner(config);
}
