#!/usr/bin/env bun
/**
 * ml-ralph - Autonomous ML engineering agent with TUI
 */

import { render } from "ink";
import { App } from "./ui/app.tsx";

// Get project path from command line or use current directory
const projectPath = process.argv[2] ?? process.cwd();

// Check for help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
ml-ralph - Autonomous ML engineering agent with TUI

Usage:
  ml-ralph [project-path]    Launch TUI for the specified project (default: current directory)
  ml-ralph init [name]       Initialize a new ml-ralph project
  ml-ralph --help            Show this help message

Keyboard shortcuts (in TUI):
  Tab         Switch between Planning and Monitor modes
  1/2/3       Switch tabs in Planning mode (Stories/Learnings/Research)
  i/Enter     Enter chat input mode (Planning mode)
  Esc         Exit chat input mode / Dismiss errors
  s           Start/Stop the agent
  t           Stop active training job (Monitor mode)
  w           Open W&B dashboard (Monitor mode)
  q           Quit

For more information, visit: https://github.com/ml-ralph/ml-ralph
`);
  process.exit(0);
}

// Check for init command
if (process.argv[2] === "init") {
  const name = process.argv[3] ?? "my-ml-project";
  const targetPath = process.argv[4] ?? process.cwd();
  const { JsonFileStore } = await import(
    "./infrastructure/file-store/index.ts"
  );
  const { createDefaultConfig } = await import("./domain/types/index.ts");

  const store = new JsonFileStore(targetPath);
  const config = createDefaultConfig(name);

  try {
    await store.initialize(config);
    console.log(`Initialized ml-ralph project: ${name}`);
    console.log(`Created .ml-ralph/ directory with config.json`);
    console.log(`\nRun 'ml-ralph' to start the TUI.`);
  } catch (error) {
    console.error("Failed to initialize project:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Render the TUI
render(<App projectPath={projectPath} />);
