/**
 * Application state store using Zustand
 */

import { create } from "zustand";
import type {
  ChatMessage,
  Learning,
  PRD,
  ResearchItem,
  Story,
  TrainingJob,
} from "../../domain/types/index.ts";
import { createDefaultConfig } from "../../domain/types/index.ts";
import { JsonFileStore } from "../../infrastructure/file-store/index.ts";
import type { AppState, AppStore } from "./types.ts";

const initialState: AppState = {
  mode: "planning",
  projectPath: null,
  config: null,
  prd: null,
  learnings: [],
  research: [],
  activeJobs: [],
  agentStatus: "idle",
  currentStory: null,
  agentOutput: [],
  chatMessages: [],
  selectedTab: "stories",
  inputMode: false,
  error: null,
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  // Project
  setProjectPath: (path: string) => {
    set({ projectPath: path });
  },

  loadProject: async () => {
    const { projectPath } = get();
    if (!projectPath) {
      set({ error: "No project path set" });
      return;
    }

    try {
      const store = new JsonFileStore(projectPath);

      if (!(await store.exists())) {
        set({ error: "Project not initialized. Run ml-ralph init first." });
        return;
      }

      const [config, prd, learnings, research, activeJobs] = await Promise.all([
        store.readConfig(),
        store.readPRD(),
        store.readLearnings(),
        store.readResearch(),
        store.readActiveJobs(),
      ]);

      set({
        config,
        prd,
        learnings,
        research,
        activeJobs,
        error: null,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load project",
      });
    }
  },

  initializeProject: async (name: string) => {
    const { projectPath } = get();
    if (!projectPath) {
      set({ error: "No project path set" });
      return;
    }

    try {
      const store = new JsonFileStore(projectPath);
      const config = createDefaultConfig(name);
      await store.initialize(config);
      set({ config, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize project",
      });
    }
  },

  // Mode
  setMode: (mode) => set({ mode }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setInputMode: (active) => set({ inputMode: active }),

  // PRD
  setPRD: (prd: PRD) => set({ prd }),

  savePRD: async () => {
    const { projectPath, prd } = get();
    if (!projectPath || !prd) return;

    try {
      const store = new JsonFileStore(projectPath);
      await store.writePRD({
        ...prd,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to save PRD",
      });
    }
  },

  // Agent
  startAgent: async () => {
    set({ agentStatus: "running", agentOutput: [] });
    // Actual agent start is handled by orchestrator
  },

  stopAgent: async () => {
    set({ agentStatus: "idle", currentStory: null });
    // Actual agent stop is handled by orchestrator
  },

  appendAgentOutput: (line: string) => {
    set((state) => ({
      agentOutput: [...state.agentOutput, line],
    }));
  },

  clearAgentOutput: () => set({ agentOutput: [] }),

  setCurrentStory: (story: Story | null) => set({ currentStory: story }),

  setAgentStatus: (status) => set({ agentStatus: status }),

  // Chat
  addChatMessage: (message: ChatMessage) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    }));
  },

  clearChat: () => set({ chatMessages: [] }),

  // Data
  addLearning: (learning: Learning) => {
    set((state) => ({
      learnings: [...state.learnings, learning],
    }));

    // Persist to file
    const { projectPath } = get();
    if (projectPath) {
      const store = new JsonFileStore(projectPath);
      store.appendLearning(learning).catch(console.error);
    }
  },

  addResearch: (item: ResearchItem) => {
    set((state) => ({
      research: [...state.research, item],
    }));

    // Persist to file
    const { projectPath } = get();
    if (projectPath) {
      const store = new JsonFileStore(projectPath);
      store.appendResearch(item).catch(console.error);
    }
  },

  setActiveJobs: (jobs: TrainingJob[]) => {
    set({ activeJobs: jobs });

    // Persist to file
    const { projectPath } = get();
    if (projectPath) {
      const store = new JsonFileStore(projectPath);
      store.writeActiveJobs(jobs).catch(console.error);
    }
  },

  updateJob: (job: TrainingJob) => {
    set((state) => ({
      activeJobs: state.activeJobs.map((j) => (j.id === job.id ? job : j)),
    }));
  },

  stopTrainingJob: async (jobId: string): Promise<boolean> => {
    const { activeJobs, projectPath } = get();
    const job = activeJobs.find((j) => j.id === jobId);

    if (!job || job.status !== "running") {
      return false;
    }

    try {
      // Send SIGTERM to the process
      process.kill(job.pid, "SIGTERM");

      // Update job status
      const updatedJob: TrainingJob = {
        ...job,
        status: "stopped",
        completedAt: new Date().toISOString(),
      };

      set((state) => ({
        activeJobs: state.activeJobs.map((j) =>
          j.id === jobId ? updatedJob : j,
        ),
      }));

      // Persist to file
      if (projectPath) {
        const store = new JsonFileStore(projectPath);
        const updatedJobs = get().activeJobs;
        await store.writeActiveJobs(updatedJobs);
      }

      return true;
    } catch {
      return false;
    }
  },

  // Error
  setError: (error) => set({ error }),

  // Refresh
  refreshData: async () => {
    const { projectPath } = get();
    if (!projectPath) return;

    try {
      const store = new JsonFileStore(projectPath);
      const [learnings, research, activeJobs] = await Promise.all([
        store.readLearnings(),
        store.readResearch(),
        store.readActiveJobs(),
      ]);

      set({ learnings, research, activeJobs });
    } catch (error) {
      console.error("Failed to refresh data:", error);
    }
  },
}));
