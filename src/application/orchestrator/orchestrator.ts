/**
 * Agent orchestrator implementation
 */

import { getCurrentStory, selectNextStory } from "../../domain/logic/index.ts";
import type {
  Learning,
  ProgressEntry,
  ResearchItem,
  Story,
} from "../../domain/types/index.ts";
import type { StreamEvent } from "../../infrastructure/claude/index.ts";
import { BunClaudeCodeClient } from "../../infrastructure/claude/index.ts";
import { JsonFileStore } from "../../infrastructure/file-store/index.ts";
import { buildStoryExecutionPrompt } from "../../infrastructure/prompts/index.ts";
import type {
  AgentOrchestrator,
  OrchestratorConfig,
  StoryResult,
} from "./types.ts";

type StreamEventCallback = (event: StreamEvent) => void;
type StoryCompleteCallback = (story: Story, result: StoryResult) => void;

export class DefaultOrchestrator implements AgentOrchestrator {
  private config: OrchestratorConfig;
  private client: BunClaudeCodeClient;
  private store: JsonFileStore;
  private running = false;
  private shouldStop = false;

  private streamEventCallbacks: Set<StreamEventCallback> = new Set();
  private storyCompleteCallbacks: Set<StoryCompleteCallback> = new Set();

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.client = new BunClaudeCodeClient(config.projectPath);
    this.store = new JsonFileStore(config.projectPath);
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.shouldStop = false;

    try {
      await this.runLoop();
    } finally {
      this.running = false;
    }
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    await this.client.cancel();
  }

  isRunning(): boolean {
    return this.running;
  }

  onStreamEvent(callback: StreamEventCallback): () => void {
    this.streamEventCallbacks.add(callback);
    return () => this.streamEventCallbacks.delete(callback);
  }

  onStoryComplete(callback: StoryCompleteCallback): () => void {
    this.storyCompleteCallbacks.add(callback);
    return () => this.storyCompleteCallbacks.delete(callback);
  }

  private emitStreamEvent(event: StreamEvent): void {
    for (const callback of this.streamEventCallbacks) {
      callback(event);
    }
  }

  private emitStoryComplete(story: Story, result: StoryResult): void {
    for (const callback of this.storyCompleteCallbacks) {
      callback(story, result);
    }
  }

  private async runLoop(): Promise<void> {
    while (!this.shouldStop) {
      const prd = await this.store.readPRD();
      if (!prd) {
        this.emitStreamEvent({
          type: "error",
          message: "No PRD found. Create a PRD first.",
        });
        break;
      }

      // Check for current in-progress story
      let story = getCurrentStory(prd.stories);

      // If none, select next
      if (!story) {
        story = selectNextStory(prd.stories);
      }

      if (!story) {
        this.emitStreamEvent({
          type: "text",
          content: "All stories complete! Agent stopping.",
        });
        break;
      }

      // Update story status to in_progress
      if (story.status === "pending") {
        const updatedStories = prd.stories.map((s) =>
          s.id === story!.id ? { ...s, status: "in_progress" as const } : s,
        );
        await this.store.writePRD({ ...prd, stories: updatedStories });
      }

      // Execute story
      const result = await this.executeStory(story, prd);

      if (this.shouldStop) break;

      // Handle result
      if (result) {
        // Save progress
        await this.store.appendProgress(result.progress);

        // Save learnings
        for (const learning of result.learnings) {
          await this.store.appendLearning(learning);
        }

        // Save research
        for (const research of result.research) {
          await this.store.appendResearch(research);
        }

        // Update story status if complete
        if (result.storyComplete) {
          const updatedPrd = await this.store.readPRD();
          if (updatedPrd) {
            const updatedStories = updatedPrd.stories.map((s) =>
              s.id === story!.id
                ? {
                    ...s,
                    status: "done" as const,
                    completedAt: new Date().toISOString(),
                  }
                : s,
            );
            await this.store.writePRD({
              ...updatedPrd,
              stories: updatedStories,
            });
          }
        }

        this.emitStoryComplete(story, result);
      }

      // If not auto-advancing, stop after one story
      if (!this.config.autoAdvance) {
        break;
      }
    }
  }

  private async executeStory(
    story: Story,
    prd: import("../../domain/types/index.ts").PRD,
  ): Promise<StoryResult | null> {
    const learnings = await this.store.readLearnings();
    const research = await this.store.readResearch();

    // Get relevant learnings (last 10 and any that apply to this story)
    const relevantLearnings = learnings
      .filter(
        (l) =>
          l.appliesTo?.includes(story.id) ||
          learnings.indexOf(l) >= learnings.length - 10,
      )
      .slice(-10);

    // Get recent research (last 5)
    const recentResearch = research.slice(-5);

    const prompt = buildStoryExecutionPrompt({
      prd,
      story,
      relevantLearnings,
      recentResearch,
    });

    let fullOutput = "";

    try {
      for await (const event of this.client.execute(prompt, {
        cwd: this.config.projectPath,
        continueConversation: false,
      })) {
        this.emitStreamEvent(event);

        if (event.type === "text") {
          fullOutput += event.content;
        }

        if (this.shouldStop) {
          return null;
        }
      }

      // Parse result from output
      return this.parseStoryResult(story, fullOutput);
    } catch (error) {
      this.emitStreamEvent({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  private parseStoryResult(story: Story, output: string): StoryResult {
    // Try to extract JSON from the output
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as {
          progress?: Partial<ProgressEntry>;
          learnings?: Array<Partial<Learning>>;
          research?: Array<Partial<ResearchItem>>;
          storyComplete?: boolean;
        };

        // Build progress entry
        const progress: ProgressEntry = {
          id: `P-${Date.now()}`,
          timestamp: new Date().toISOString(),
          storyId: story.id,
          storyTitle: story.title,
          type: story.type,
          hypothesis: parsed.progress?.hypothesis ?? story.hypothesis,
          assumptions: parsed.progress?.assumptions ?? [],
          changes: parsed.progress?.changes ?? [],
          evaluation: parsed.progress?.evaluation ?? {
            datasetSplit: "",
            metric: "",
            baseline: "",
            result: "",
          },
          evidence: parsed.progress?.evidence ?? [],
          decision: parsed.progress?.decision ?? "keep",
          reasoning: parsed.progress?.reasoning ?? "",
          nextStep: parsed.progress?.nextStep ?? "",
          backlogChanges: parsed.progress?.backlogChanges,
        };

        // Build learnings
        const learnings: Learning[] = (parsed.learnings ?? []).map((l, i) => ({
          id: `L-${Date.now()}-${i}`,
          timestamp: new Date().toISOString(),
          insight: l.insight ?? "",
          implications: l.implications ?? [],
          category: l.category ?? "process",
          tags: l.tags ?? [],
          source: {
            storyId: story.id,
            evidence: (l as { evidence?: string }).evidence ?? "",
            ...(l.source ?? {}),
          },
          impact: l.impact ?? "medium",
          confidence: l.confidence ?? "likely",
        }));

        // Build research
        const research: ResearchItem[] = (parsed.research ?? []).map(
          (r, i) => ({
            id: `R-${Date.now()}-${i}`,
            timestamp: new Date().toISOString(),
            title: r.title ?? "",
            summary: r.summary ?? "",
            url: r.url,
            type: r.type ?? "other",
            tags: r.tags ?? [],
            relevance: r.relevance ?? "",
            storyId: story.id,
            keyTakeaways: r.keyTakeaways ?? [],
            codeSnippets: r.codeSnippets,
          }),
        );

        return {
          progress,
          learnings,
          research,
          storyComplete: parsed.storyComplete ?? false,
        };
      } catch {
        // Failed to parse JSON, return minimal result
      }
    }

    // Return minimal result if parsing failed
    return {
      progress: {
        id: `P-${Date.now()}`,
        timestamp: new Date().toISOString(),
        storyId: story.id,
        storyTitle: story.title,
        type: story.type,
        hypothesis: story.hypothesis,
        assumptions: [],
        changes: [],
        evaluation: {
          datasetSplit: "",
          metric: "",
          baseline: "",
          result: "",
        },
        evidence: [],
        decision: "investigate",
        reasoning: "Could not parse structured output",
        nextStep: "Review agent output manually",
      },
      learnings: [],
      research: [],
      storyComplete: false,
    };
  }
}

/**
 * Create an orchestrator instance
 */
export function createOrchestrator(
  config: OrchestratorConfig,
): AgentOrchestrator {
  return new DefaultOrchestrator(config);
}
