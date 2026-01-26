/**
 * Application state types
 */

import type {
  AgentStatus,
  AppMode,
  ChatMessage,
  Learning,
  PlanningTab,
  PRD,
  ProjectConfig,
  ResearchItem,
  Story,
  TrainingJob,
} from "../../domain/types/index.ts";

export interface AppState {
  // Mode
  mode: AppMode;

  // Project
  projectPath: string | null;
  config: ProjectConfig | null;

  // Data
  prd: PRD | null;
  learnings: Learning[];
  research: ResearchItem[];
  activeJobs: TrainingJob[];

  // Agent
  agentStatus: AgentStatus;
  currentStory: Story | null;
  agentOutput: string[];

  // Chat (planning mode)
  chatMessages: ChatMessage[];

  // UI
  selectedTab: PlanningTab;
  inputMode: boolean; // When true, keyboard goes to chat input

  // Error state
  error: string | null;
}

export interface AppActions {
  // Project
  setProjectPath: (path: string) => void;
  loadProject: () => Promise<void>;
  initializeProject: (name: string) => Promise<void>;

  // Mode
  setMode: (mode: AppMode) => void;
  setSelectedTab: (tab: PlanningTab) => void;
  setInputMode: (active: boolean) => void;

  // PRD
  setPRD: (prd: PRD) => void;
  savePRD: () => Promise<void>;

  // Agent
  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  appendAgentOutput: (line: string) => void;
  clearAgentOutput: () => void;
  setCurrentStory: (story: Story | null) => void;
  setAgentStatus: (status: AgentStatus) => void;

  // Chat
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChat: () => void;

  // Data
  addLearning: (learning: Learning) => void;
  addResearch: (item: ResearchItem) => void;
  setActiveJobs: (jobs: TrainingJob[]) => void;
  updateJob: (job: TrainingJob) => void;
  stopTrainingJob: (jobId: string) => Promise<boolean>;

  // Error
  setError: (error: string | null) => void;

  // Refresh
  refreshData: () => Promise<void>;
}

export type AppStore = AppState & AppActions;
