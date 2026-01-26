/**
 * Orchestrator types
 */

import type {
  Learning,
  ProgressEntry,
  ResearchItem,
  Story,
} from "../../domain/types/index.ts";
import type { StreamEvent } from "../../infrastructure/claude/index.ts";

export interface AgentOrchestrator {
  /**
   * Start the agent loop
   */
  start(): Promise<void>;

  /**
   * Stop the agent
   */
  stop(): Promise<void>;

  /**
   * Check if agent is running
   */
  isRunning(): boolean;

  /**
   * Subscribe to stream events
   */
  onStreamEvent(callback: (event: StreamEvent) => void): () => void;

  /**
   * Subscribe to story completion
   */
  onStoryComplete(
    callback: (story: Story, result: StoryResult) => void,
  ): () => void;
}

export interface StoryResult {
  progress: ProgressEntry;
  learnings: Learning[];
  research: ResearchItem[];
  storyComplete: boolean;
}

export interface OrchestratorConfig {
  projectPath: string;
  autoAdvance: boolean;
}
