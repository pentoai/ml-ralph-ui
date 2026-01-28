/**
 * Main App component
 */

import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentOrchestrator } from "../application/orchestrator/index.ts";
import { createOrchestrator } from "../application/orchestrator/index.ts";
import { useAppStore } from "../application/state/index.ts";
import { ensureInitialized, type StreamEvent } from "../infrastructure/ralph/index.ts";
import { useTmuxLayout } from "./hooks/index.ts";
import { MonitorScreen } from "./screens/monitor.tsx";
import { PlanningScreen } from "./screens/planning.tsx";
import { colors } from "./theme/colors.ts";
// import { Logo } from "./widgets/logo.tsx";
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
  // Quit confirmation state
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  // Start confirmation state
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  // No PRD dialog state
  const [showNoPrdDialog, setShowNoPrdDialog] = useState(false);
  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  // Agent output for monitor screen
  const [agentOutput, setAgentOutput] = useState<StreamEvent[]>([]);
  // Current iteration
  const [currentIteration, setCurrentIteration] = useState(0);

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
    config,
    activeJobs,
    stopTrainingJob,
    inputMode,
    setInputMode,
  } = useAppStore();

  // Tmux layout manager
  const tmuxLayout = useTmuxLayout({
    cwd: projectPath,
    sessionName: `ml-ralph-${projectPath.split("/").pop() || "default"}`,
  });

  // Initialize ml-ralph on mount
  useEffect(() => {
    const init = async () => {
      const success = await ensureInitialized(projectPath);
      setIsInitialized(success);
      if (!success) {
        setError("Failed to initialize ml-ralph. Check permissions.");
      }
    };
    init();
  }, [projectPath, setError]);

  // Initialize project on mount
  useEffect(() => {
    setProjectPath(projectPath);
    loadProject();
  }, [projectPath, setProjectPath, loadProject]);

  // Handle output from orchestrator
  const handleOutput = useCallback((event: StreamEvent) => {
    setAgentOutput((prev) => [...prev, event]);
  }, []);

  // Handle iteration change
  const handleIterationChange = useCallback((iteration: number) => {
    setCurrentIteration(iteration);
  }, []);

  // Handle completion
  const handleComplete = useCallback(
    (reason: "project_complete" | "max_iterations") => {
      setAgentStatus("idle");
      if (reason === "project_complete") {
        setAgentOutput((prev) => [
          ...prev,
          { type: "text", content: "\n═══ Project complete! ═══\n" },
        ]);
      } else {
        setAgentOutput((prev) => [
          ...prev,
          { type: "text", content: "\nReached max iterations.\n" },
        ]);
      }
    },
    [setAgentStatus]
  );

  // Create orchestrator when config is loaded
  useEffect(() => {
    if (config && !orchestratorRef.current) {
      orchestratorRef.current = createOrchestrator({
        projectPath,
        autoAdvance: config.agent.autoAdvance,
      });
      // Subscribe to events
      orchestratorRef.current.onOutput(handleOutput);
      orchestratorRef.current.onIterationChange(handleIterationChange);
      orchestratorRef.current.onComplete(handleComplete);
    }
  }, [config, projectPath, handleOutput, handleIterationChange, handleComplete]);

  // Handle mode changes - create/destroy tmux split
  useEffect(() => {
    if (!tmuxLayout.isInitialized) return;

    if (mode === "planning") {
      tmuxLayout.enterPlanningMode();
    } else {
      tmuxLayout.enterMonitorMode();
    }
  }, [
    mode,
    tmuxLayout.isInitialized,
    tmuxLayout.enterPlanningMode,
    tmuxLayout.enterMonitorMode,
  ]);

  // Perform actual quit - kill tmux session too
  const doQuit = async () => {
    if (orchestratorRef.current?.isRunning()) {
      orchestratorRef.current.stop();
    }
    // Kill the entire tmux session
    const sessionName = `ml-ralph-${projectPath.split("/").pop() || "default"}`;
    try {
      const proc = Bun.spawn(["tmux", "kill-session", "-t", sessionName], {
        stdout: "pipe",
        stderr: "pipe",
      });
      await proc.exited;
    } catch {
      // Ignore errors, just exit
    }
    exit();
  };

  // Start the agent
  const doStart = async () => {
    setShowStartConfirm(false);
    setAgentStatus("running");
    setAgentOutput([]); // Clear previous output
    setCurrentIteration(0);
    setMode("monitor"); // Switch to monitor mode to see output
    try {
      await orchestratorRef.current?.start();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (err ? String(err) : "Unknown error starting agent");
      setError(errorMsg);
      setAgentStatus("idle");
    }
  };

  // Handle keyboard input
  useInput((input, key) => {
    // Handle quit confirmation dialog
    if (showQuitConfirm) {
      if (input === "y" || input === "Y") {
        doQuit();
        return;
      }
      if (input === "n" || input === "N" || key.escape) {
        setShowQuitConfirm(false);
        return;
      }
      return; // Ignore other keys while dialog is open
    }

    // Handle start confirmation dialog
    if (showStartConfirm) {
      if (input === "y" || input === "Y") {
        doStart();
        return;
      }
      if (input === "n" || input === "N" || key.escape) {
        setShowStartConfirm(false);
        return;
      }
      return; // Ignore other keys while dialog is open
    }

    // Handle no PRD dialog
    if (showNoPrdDialog) {
      if (key.escape || input === "o" || input === "O") {
        setShowNoPrdDialog(false);
        return;
      }
      return; // Ignore other keys while dialog is open
    }

    // Ctrl+C shows quit confirmation (instead of direct quit)
    if (key.ctrl && input === "c") {
      setShowQuitConfirm(true);
      return;
    }

    // Escape: exit input mode, clear error, or cancel quit
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
    if (inputMode) {
      return;
    }

    // Focus terminal pane (press 'f' in planning mode)
    if (mode === "planning" && input === "f") {
      tmuxLayout.focusTerminal();
      return;
    }

    // Keep 'i' to focus terminal for familiarity
    if (mode === "planning" && input === "i") {
      tmuxLayout.focusTerminal();
      return;
    }

    // Quit - show confirmation
    if (input === "q") {
      setShowQuitConfirm(true);
      return;
    }

    // Switch modes
    if (key.tab) {
      setMode(mode === "planning" ? "monitor" : "planning");
      return;
    }

    // Tab shortcuts (work in both modes)
    if (input === "1") setSelectedTab("prd");
    if (input === "2") setSelectedTab("hypotheses");
    if (input === "3") setSelectedTab("learnings");
    if (input === "4") setSelectedTab("research");

    // Start/stop agent
    if (input === "s") {
      if (agentStatus === "running") {
        orchestratorRef.current?.stop();
        setAgentStatus("idle");
      } else {
        // Check if PRD exists before allowing start
        const checkPrd = async () => {
          const prdPath = `${projectPath}/.ml-ralph/prd.json`;
          const prdExists = await Bun.file(prdPath).exists();
          if (prdExists) {
            setShowStartConfirm(true);
          } else {
            setShowNoPrdDialog(true);
          }
        };
        checkPrd();
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
        import("bun").then(({ spawn }) => {
          spawn(["open", jobWithWandB.wandbUrl!]);
        });
      }
      return;
    }
  });

  // Warning if not in tmux
  const showTmuxWarning = !tmuxLayout.isInTmux && tmuxLayout.isInitialized;

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Logo - disabled for now
      <Box justifyContent="center">
        <Logo />
      </Box>
      */}

      {/* Navigation bar with mode tabs and help */}
      <Box paddingX={1} justifyContent="space-between" marginBottom={0}>
        <ModeTabs activeMode={mode} />
        <HelpBar mode={mode} agentStatus={agentStatus} />
      </Box>

      {/* Tmux warning */}
      {showTmuxWarning && (
        <Box
          paddingX={1}
          borderStyle="single"
          borderColor={colors.accentYellow}
        >
          <Text color={colors.accentYellow}>
            Run inside tmux for the best experience: tmux new-session -s
            ml-ralph
          </Text>
        </Box>
      )}

      {/* Init warning */}
      {!isInitialized && (
        <Box
          paddingX={1}
          borderStyle="single"
          borderColor={colors.accentYellow}
        >
          <Text color={colors.accentYellow}>
            Initializing ml-ralph...
          </Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box paddingX={1} borderStyle="single" borderColor={colors.accentRed}>
          <Text color={colors.accentRed}>Error: {error}</Text>
          <Text color={colors.textMuted}> (Esc to dismiss)</Text>
        </Box>
      )}

      {/* Main content */}
      <Box flexGrow={1}>
        {mode === "planning" ? (
          <PlanningScreen />
        ) : (
          <MonitorScreen
            agentOutput={agentOutput}
            currentIteration={currentIteration}
          />
        )}
      </Box>

      {/* Quit confirmation dialog */}
      {showQuitConfirm && <QuitConfirmDialog />}

      {/* Start confirmation dialog */}
      {showStartConfirm && <StartConfirmDialog />}

      {/* No PRD dialog */}
      {showNoPrdDialog && <NoPrdDialog />}
    </Box>
  );
}

/**
 * Help bar component with keyboard shortcuts
 */
function HelpBar({
  mode,
  agentStatus,
}: {
  mode: "planning" | "monitor";
  agentStatus: string;
}) {
  const Shortcut = ({ keys, label }: { keys: string; label: string }) => (
    <Box marginRight={2}>
      <Text backgroundColor={colors.bgTertiary} color={colors.text}>
        {" "}
        {keys}{" "}
      </Text>
      <Text color={colors.textSecondary}> {label}</Text>
    </Box>
  );

  if (mode === "planning") {
    return (
      <Box>
        <Shortcut keys="Tab" label="Monitor" />
        <Shortcut keys="f" label="Terminal" />
        <Shortcut keys="1-4" label="Tabs" />
        <Shortcut keys="s" label={agentStatus === "running" ? "Stop" : "Start"} />
        <Shortcut keys="q" label="Quit" />
      </Box>
    );
  }

  return (
    <Box>
      <Shortcut keys="Tab" label="Planning" />
      <Shortcut keys="1-4" label="Tabs" />
      <Shortcut keys="s" label={agentStatus === "running" ? "Stop" : "Start"} />
      <Shortcut keys="q" label="Quit" />
    </Box>
  );
}

/**
 * Quit confirmation dialog
 */
function QuitConfirmDialog() {
  return (
    <Box
      position="absolute"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
    >
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={colors.accentYellow}
        paddingX={3}
        paddingY={1}
      >
        <Text bold color={colors.text}>
          Quit ml-ralph?
        </Text>
        <Box marginTop={1}>
          <Text color={colors.textSecondary}>
            This will close the tmux session.
          </Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <Box marginRight={2}>
            <Text backgroundColor={colors.accentGreen} color={colors.bgPrimary}>
              {" "}
              Y{" "}
            </Text>
            <Text color={colors.textSecondary}> Yes</Text>
          </Box>
          <Box>
            <Text backgroundColor={colors.accentRed} color={colors.bgPrimary}>
              {" "}
              N{" "}
            </Text>
            <Text color={colors.textSecondary}> No</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Start confirmation dialog
 */
function StartConfirmDialog() {
  return (
    <Box
      position="absolute"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
    >
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={colors.accentBlue}
        paddingX={3}
        paddingY={1}
      >
        <Text bold color={colors.text}>
          Start ml-ralph agent?
        </Text>
        <Box marginTop={1}>
          <Text color={colors.textSecondary}>
            This will start the autonomous ML agent loop.
          </Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <Box marginRight={2}>
            <Text backgroundColor={colors.accentGreen} color={colors.bgPrimary}>
              {" "}
              Y{" "}
            </Text>
            <Text color={colors.textSecondary}> Yes</Text>
          </Box>
          <Box>
            <Text backgroundColor={colors.accentRed} color={colors.bgPrimary}>
              {" "}
              N{" "}
            </Text>
            <Text color={colors.textSecondary}> No</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * No PRD dialog - prompts user to create a PRD first
 */
function NoPrdDialog() {
  return (
    <Box
      position="absolute"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
    >
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={colors.accentYellow}
        paddingX={3}
        paddingY={1}
      >
        <Text bold color={colors.text}>
          No PRD found
        </Text>
        <Box marginTop={1}>
          <Text color={colors.textSecondary}>
            Create a PRD before starting the agent.
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textSecondary}>
            Use Claude Code in the terminal (press{" "}
            <Text color={colors.accentBlue}>f</Text>) to create one:
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textMuted}>
            Tell Claude about your ML project and ask it to
          </Text>
        </Box>
        <Box>
          <Text color={colors.textMuted}>
            write a PRD to{" "}
            <Text color={colors.accentBlue}>.ml-ralph/prd.json</Text>
          </Text>
        </Box>
        <Box marginTop={1} justifyContent="center">
          <Box>
            <Text backgroundColor={colors.textMuted} color={colors.bgPrimary}>
              {" "}
              Esc{" "}
            </Text>
            <Text color={colors.textSecondary}> OK</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
