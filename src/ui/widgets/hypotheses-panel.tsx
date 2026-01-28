/**
 * Hypotheses panel - displays hypotheses from log.jsonl
 */

import { Box, Text } from "ink";
import type { HypothesisWithStatus } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface HypothesesPanelProps {
  hypotheses: HypothesisWithStatus[];
}

export function HypothesesPanel({ hypotheses }: HypothesesPanelProps) {
  if (hypotheses.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No hypotheses yet</Text>
        <Text color={colors.textMuted}>
          Create a PRD and start the agent to generate hypotheses.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      {hypotheses.map((h) => (
        <HypothesisItem key={h.id} hypothesis={h} />
      ))}
    </Box>
  );
}

interface HypothesisItemProps {
  hypothesis: HypothesisWithStatus;
}

function HypothesisItem({ hypothesis }: HypothesisItemProps) {
  const statusColors: Record<string, string> = {
    pending: colors.accentYellow,
    keep: colors.accentGreen,
    reject: colors.accentRed,
    iterate: colors.accentBlue,
    pivot: colors.accentYellow,
  };

  const statusIcons: Record<string, string> = {
    pending: "○",
    keep: "✓",
    reject: "✗",
    iterate: "↻",
    pivot: "⟳",
  };

  const statusColor = statusColors[hypothesis.status] || colors.textMuted;
  const statusIcon = statusIcons[hypothesis.status] || "?";

  // Get latest metrics if any experiments
  const latestExperiment = hypothesis.experiments[hypothesis.experiments.length - 1];
  const metrics = latestExperiment?.metrics;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={statusColor}
      paddingX={1}
    >
      {/* Header: ID and status */}
      <Box justifyContent="space-between">
        <Text color={colors.accentBlue} bold>
          {hypothesis.id}
        </Text>
        <Text color={statusColor}>
          {statusIcon} {hypothesis.status}
        </Text>
      </Box>

      {/* Hypothesis text */}
      <Text color={colors.text}>{hypothesis.hypothesis}</Text>

      {/* Expected outcome */}
      {hypothesis.expected && (
        <Text color={colors.textMuted}>
          Expected: {hypothesis.expected}
        </Text>
      )}

      {/* Metrics if available */}
      {metrics && (
        <Box marginTop={1}>
          <Text color={colors.textSecondary}>
            Metrics:{" "}
            {Object.entries(metrics)
              .map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(3) : v}`)
              .join(", ")}
          </Text>
        </Box>
      )}

      {/* Decision reason if decided */}
      {hypothesis.decision && (
        <Box marginTop={1}>
          <Text color={colors.textMuted}>
            → {hypothesis.decision.reason}
          </Text>
        </Box>
      )}
    </Box>
  );
}
