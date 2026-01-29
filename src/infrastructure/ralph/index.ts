/**
 * ML-Ralph infrastructure - init, runner, and log parser
 */

export { initRalph, isInitialized, ensureInitialized } from "./init.ts";
export type { InitOptions, InitResult } from "./init.ts";

export { RalphRunner, createRunner } from "./runner.ts";
export type { RunnerConfig, StreamEvent } from "./runner.ts";

export {
  readLogFile,
  readPrdFile,
  readKanbanFile,
  aggregateEvents,
  watchLogFile,
  appendEvent,
} from "./log-parser.ts";
export type { HypothesisWithStatus, PrdChange, LogSummary, Kanban, KanbanTask, CompletedTask, AbandonedTask } from "./log-parser.ts";

export type {
  RalphEvent,
  PRD,
  PhaseEvent,
  ResearchEvent,
  HypothesisEvent,
  ExperimentEvent,
  LearningEvent,
  DecisionEvent,
  PrdUpdatedEvent,
  StatusEvent,
} from "./templates.ts";
