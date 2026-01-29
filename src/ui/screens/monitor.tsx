/**
 * Monitor screen - Agent output + Knowledge panel
 *
 * Shows agent activity feed on the left and knowledge tabs on the right.
 */

import { Box, Text } from "ink";
import { useAppStore } from "../../application/state/index.ts";
import type { StreamEvent } from "../../infrastructure/ralph/index.ts";
import { useRalphState } from "../hooks/index.ts";
import { colors } from "../theme/colors.ts";
import { ActivityFeed } from "../widgets/activity-feed.tsx";
import { KnowledgePanel } from "../widgets/knowledge-panel.tsx";

interface MonitorScreenProps {
  agentOutput?: StreamEvent[];
  currentIteration?: number;
  startTime?: number;
  projectPath?: string;
}

export function MonitorScreen({
  agentOutput = [],
  currentIteration = 0,
  startTime = 0,
  projectPath = "",
}: MonitorScreenProps) {
  const { agentStatus } = useAppStore();

  // Get phase from kanban
  const { kanban } = useRalphState({
    projectPath: projectPath || process.cwd(),
    pollInterval: 2000,
  });

  const currentPhase = kanban?.current_focus?.phase || null;

  return (
    <Box flexDirection="row" height="100%">
      {/* Left panel - Activity feed (40%) */}
      <Box
        flexDirection="column"
        width="40%"
        borderStyle="single"
        borderColor={agentStatus === "running" ? colors.accentBlue : colors.textMuted}
      >
        <Box paddingX={1} justifyContent="space-between">
          <Text color={colors.accentBlue} bold>
            Activity
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
          <ActivityFeed
            events={agentOutput}
            maxActivities={40}
            currentIteration={currentIteration}
            startTime={startTime}
            phase={currentPhase}
          />
        </Box>
      </Box>

      {/* Right panel - Knowledge tabs (60%) */}
      <Box flexDirection="column" width="60%">
        <KnowledgePanel />
      </Box>
    </Box>
  );
}
