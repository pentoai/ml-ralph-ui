/**
 * Main App component
 */

import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useRef, useState } from "react";
import type { AgentOrchestrator } from "../application/orchestrator/index.ts";
import { createOrchestrator } from "../application/orchestrator/index.ts";
import { useAppStore } from "../application/state/index.ts";
import { MonitorScreen } from "./screens/monitor.tsx";
import { PlanningScreen } from "./screens/planning.tsx";
import { colors } from "./theme/colors.ts";
import { StatusBar } from "./widgets/status-bar.tsx";
import { ModeTabs } from "./widgets/tabs.tsx";

interface AppProps {
  projectPath: string;
}

export function App({ projectPath }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

  // Track terminal dimensions
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows ?? 24);

  useEffect(() => {
    const handleResize = () => {
      if (stdout?.rows) {
        setTerminalHeight(stdout.rows);
      }
    };

    stdout?.on("resize", handleResize);
    return () => {
      stdout?.off("resize", handleResize);
    };
  }, [stdout]);

  const {
    mode,
    setMode,
    setSelectedTab,
    setProjectPath,
    loadProject,
    error,
    setError,
    agentStatus,
    setAgentStatus,
    appendAgentOutput,
    config,
    activeJobs,
    stopTrainingJob,
    inputMode,
    setInputMode,
  } = useAppStore();

  // Initialize project on mount
  useEffect(() => {
    setProjectPath(projectPath);
    loadProject();
  }, [projectPath, setProjectPath, loadProject]);

  // Create orchestrator when config is loaded
  useEffect(() => {
    if (config && !orchestratorRef.current) {
      orchestratorRef.current = createOrchestrator({
        projectPath,
        autoAdvance: config.agent.autoAdvance,
      });

      // Subscribe to events
      orchestratorRef.current.onStreamEvent((event) => {
        if (event.type === "text") {
          appendAgentOutput(event.content);
        } else if (event.type === "tool_start") {
          appendAgentOutput(`> ${event.tool}: Starting...`);
        } else if (event.type === "tool_end") {
          appendAgentOutput(`> ${event.tool}: Done`);
        } else if (event.type === "error") {
          appendAgentOutput(`ERROR: ${event.message}`);
        }
      });
    }
  }, [config, projectPath, appendAgentOutput]);

  // Handle keyboard input
  useInput((input, key) => {
    // Always allow Ctrl+C to quit
    if (key.ctrl && input === "c") {
      if (orchestratorRef.current?.isRunning()) {
        orchestratorRef.current.stop();
      }
      exit();
      return;
    }

    // Escape: exit input mode or clear error
    if (key.escape) {
      if (inputMode) {
        setInputMode(false);
        return;
      }
      if (error) {
        setError(null);
        return;
      }
    }

    // When in input mode, don't process global shortcuts
    // (let ChatPanel handle input)
    if (inputMode) {
      return;
    }

    // Enter input mode in planning mode (press 'i' or Enter)
    if (mode === "planning" && (input === "i" || key.return)) {
      setInputMode(true);
      return;
    }

    // Quit
    if (input === "q") {
      if (orchestratorRef.current?.isRunning()) {
        orchestratorRef.current.stop();
      }
      exit();
      return;
    }

    // Switch modes
    if (key.tab) {
      setMode(mode === "planning" ? "monitor" : "planning");
      return;
    }

    // Tab shortcuts in planning mode
    if (mode === "planning") {
      if (input === "1") setSelectedTab("stories");
      if (input === "2") setSelectedTab("learnings");
      if (input === "3") setSelectedTab("research");
    }

    // Start/stop agent
    if (input === "s") {
      if (agentStatus === "running") {
        orchestratorRef.current?.stop();
        setAgentStatus("idle");
      } else {
        setAgentStatus("running");
        orchestratorRef.current?.start().catch((err) => {
          setError(err.message);
          setAgentStatus("idle");
        });
      }
      return;
    }

    // Stop training jobs
    if (input === "t" && mode === "monitor") {
      const runningJob = activeJobs.find((j) => j.status === "running");
      if (runningJob) {
        stopTrainingJob(runningJob.id).catch((err: Error) => {
          setError(`Failed to stop training: ${err.message}`);
        });
      }
      return;
    }

    // Open W&B
    if (input === "w" && mode === "monitor") {
      const runningJobs = activeJobs.filter((j) => j.status === "running");
      const jobWithWandB =
        runningJobs.find((j) => j.wandbUrl) ??
        activeJobs.find((j) => j.wandbUrl);
      if (jobWithWandB?.wandbUrl) {
        // Open W&B URL in browser
        import("bun").then(({ spawn }) => {
          spawn(["open", jobWithWandB.wandbUrl!]);
        });
      }
      return;
    }
  });

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Header with mode tabs */}
      <Box paddingX={1} justifyContent="space-between">
        <ModeTabs activeMode={mode} />
        <Text color={colors.textMuted}>
          {inputMode
            ? "Esc: exit input | Enter: send"
            : "q: quit | Tab: mode | s: start/stop | i: chat"}
        </Text>
      </Box>

      {/* Error display */}
      {error && (
        <Box paddingX={1} borderStyle="single" borderColor={colors.accentRed}>
          <Text color={colors.accentRed}>Error: {error}</Text>
          <Text color={colors.textMuted}> (Esc to dismiss)</Text>
        </Box>
      )}

      {/* Main content */}
      <Box flexGrow={1}>
        {mode === "planning" ? <PlanningScreen /> : <MonitorScreen />}
      </Box>

      {/* Status bar */}
      <StatusBar />
    </Box>
  );
}
