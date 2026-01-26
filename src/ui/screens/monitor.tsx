/**
 * Monitor screen - Agent execution and metrics
 */

import { Box, Text } from "ink";
import { useAppStore } from "../../application/state/index.ts";
import { colors } from "../theme/colors.ts";
import { AgentOutput } from "../widgets/agent-output.tsx";
import { CurrentTask } from "../widgets/current-task.tsx";
import { JobListItem, MetricsChart } from "../widgets/metrics-chart.tsx";

export function MonitorScreen() {
  const { agentOutput, currentStory, prd, agentStatus, activeJobs } =
    useAppStore();

  // Get current story from PRD if not set in state
  const activeStory =
    currentStory ??
    prd?.stories.find((s) => s.status === "in_progress") ??
    null;

  // Running jobs only
  const runningJobs = activeJobs.filter((j) => j.status === "running");
  const recentJobs = activeJobs
    .filter((j) => j.status !== "running")
    .slice(0, 3);

  return (
    <Box flexDirection="row" height="100%">
      {/* Left panel - Agent output */}
      <Box
        flexDirection="column"
        width="60%"
        borderStyle="single"
        borderColor={colors.textMuted}
      >
        <Box paddingX={1} justifyContent="space-between">
          <Text color={colors.accentBlue} bold>
            Agent Output
          </Text>
          <Text
            color={
              agentStatus === "running" ? colors.accentGreen : colors.textMuted
            }
          >
            {agentStatus === "running" ? "● Running" : "○ Idle"}
          </Text>
        </Box>
        <Box
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
          overflowY="hidden"
        >
          <AgentOutput lines={agentOutput} maxLines={20} />
        </Box>
      </Box>

      {/* Right panel - Metrics and status */}
      <Box
        flexDirection="column"
        width="40%"
        borderStyle="single"
        borderColor={colors.textMuted}
      >
        {/* Experiments section */}
        <Box flexDirection="column" paddingX={1}>
          <Box justifyContent="space-between">
            <Text color={colors.accentBlue} bold>
              Experiments
            </Text>
            {runningJobs.length > 0 && (
              <Text color={colors.accentGreen}>
                {runningJobs.length} running
              </Text>
            )}
          </Box>

          {runningJobs.length > 0 && runningJobs[0] ? (
            <Box flexDirection="column" marginTop={1}>
              {/* Show full metrics for most recent running job */}
              <MetricsChart job={runningJobs[0]} />

              {/* List remaining running jobs compactly */}
              {runningJobs.length > 1 && (
                <Box flexDirection="column">
                  {runningJobs.slice(1).map((job) => (
                    <JobListItem key={job.id} job={job} />
                  ))}
                </Box>
              )}
            </Box>
          ) : recentJobs.length > 0 ? (
            <Box flexDirection="column" marginTop={1}>
              <Text color={colors.textMuted}>Recent jobs:</Text>
              {recentJobs.map((job) => (
                <JobListItem key={job.id} job={job} />
              ))}
            </Box>
          ) : (
            <Box
              flexDirection="column"
              borderStyle="round"
              borderColor={colors.textMuted}
              padding={1}
              marginTop={1}
            >
              <Text color={colors.textMuted}>No active training jobs</Text>
              <Text color={colors.textMuted} dimColor>
                Metrics will appear here when training runs
              </Text>
            </Box>
          )}
        </Box>

        {/* Current task section */}
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <CurrentTask story={activeStory} />
        </Box>

        {/* Controls section */}
        <Box
          flexDirection="row"
          paddingX={1}
          marginTop={1}
          gap={2}
          justifyContent="center"
        >
          <Text color={colors.textMuted}>[s] Start/Stop</Text>
          {runningJobs.length > 0 && (
            <Text color={colors.textMuted}>[t] Stop Training</Text>
          )}
          <Text color={colors.textMuted}>[w] Open W&B</Text>
        </Box>
      </Box>
    </Box>
  );
}
