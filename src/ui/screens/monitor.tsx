/**
 * Monitor screen - Agent output + Knowledge panel
 *
 * Shows agent output on the left and knowledge tabs on the right.
 */

import { Box, Text } from "ink";
import { useAppStore } from "../../application/state/index.ts";
import type { StreamEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";
import { AgentOutput } from "../widgets/agent-output.tsx";
import { KnowledgePanel } from "../widgets/knowledge-panel.tsx";

interface MonitorScreenProps {
  agentOutput?: StreamEvent[];
  currentIteration?: number;
}

export function MonitorScreen({
  agentOutput = [],
  currentIteration = 0,
}: MonitorScreenProps) {
  const { agentStatus } = useAppStore();

  return (
    <Box flexDirection="row" height="100%">
      {/* Left panel - Agent output (1/3) */}
      <Box
        flexDirection="column"
        width="33%"
        borderStyle="single"
        borderColor={colors.textMuted}
      >
        <Box paddingX={1} justifyContent="space-between">
          <Text color={colors.accentBlue} bold>
            Agent Output
          </Text>
          <Box gap={2}>
            {currentIteration > 0 && (
              <Text color={colors.textSecondary}>
                Iteration {currentIteration}
              </Text>
            )}
            <Text
              color={
                agentStatus === "running" ? colors.accentGreen : colors.textMuted
              }
            >
              {agentStatus === "running" ? "Running" : "Idle"}
            </Text>
          </Box>
        </Box>
        <Box
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
          overflowY="hidden"
        >
          <AgentOutput
            events={agentOutput}
            maxLines={30}
            currentIteration={currentIteration}
          />
        </Box>
      </Box>

      {/* Right panel - Knowledge tabs (2/3) */}
      <Box flexDirection="column" width="67%">
        <KnowledgePanel />
      </Box>
    </Box>
  );
}
