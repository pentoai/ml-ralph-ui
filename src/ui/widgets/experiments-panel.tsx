/**
 * Experiments panel - displays experiments with expandable details and charts
 */

import { Box, Text } from "ink";
import type { ExperimentEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface ExperimentsPanelProps {
  experiments: ExperimentEvent[];
  selectedIndex: number;
  expandedId: string | null;
  offset?: number;
  limit?: number;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Generate a sparkline from an array of numbers
 * TODO: Use this for training loss curves when we have time-series data
 */
export function sparkline(data: number[]): string {
  if (data.length === 0) return "";
  const chars = "▁▂▃▄▅▆▇█";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  return data
    .map(v => {
      const normalized = (v - min) / range;
      const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
      return chars[index];
    })
    .join("");
}

/**
 * Format metrics for display
 */
function formatMetric(key: string, value: number): string {
  // Format based on metric type
  if (key.includes("time") || key.includes("ms")) {
    return `${value.toFixed(1)}ms`;
  }
  if (value < 0.01) {
    return value.toExponential(2);
  }
  if (value < 1) {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

/**
 * Get key metrics to show in collapsed view
 */
function getKeyMetrics(metrics: Record<string, number>): { key: string; value: number }[] {
  const priority = ["auc_roc", "auc", "f1", "accuracy", "recall", "precision", "loss"];
  const result: { key: string; value: number }[] = [];

  for (const key of priority) {
    const found = Object.entries(metrics).find(([k]) =>
      k.toLowerCase().includes(key)
    );
    if (found) {
      result.push({ key: found[0], value: found[1] });
      if (result.length >= 2) break;
    }
  }

  // If no priority metrics found, take first two
  if (result.length === 0) {
    const entries = Object.entries(metrics).slice(0, 2);
    result.push(...entries.map(([key, value]) => ({ key, value })));
  }

  return result;
}

/**
 * Collapsed experiment row
 */
function ExperimentRow({
  experiment,
  isSelected,
  isExpanded
}: {
  experiment: ExperimentEvent;
  isSelected: boolean;
  isExpanded: boolean;
}) {
  const timeAgo = formatRelativeTime(experiment.ts);
  const keyMetrics = getKeyMetrics(experiment.metrics);
  const arrow = isExpanded ? "▼" : isSelected ? "▶" : "▷";

  return (
    <Box>
      <Text color={isSelected ? colors.accentBlue : colors.textMuted}>{arrow} </Text>
      <Box width={16}>
        <Text color={isSelected ? colors.accentBlue : colors.text} bold={isSelected}>
          {experiment.hypothesis_id}
        </Text>
      </Box>
      <Text color={colors.textMuted}> │ </Text>
      <Box width={20}>
        {keyMetrics.map((m, i) => (
          <Text key={m.key} color={colors.accentGreen}>
            {i > 0 ? " " : ""}{m.key.split("_").pop()}: {formatMetric(m.key, m.value)}
          </Text>
        ))}
      </Box>
      <Text color={colors.textMuted}> │ </Text>
      <Text color={colors.textSecondary}>{timeAgo}</Text>
    </Box>
  );
}

/**
 * Expanded experiment details
 */
function ExperimentDetails({ experiment }: { experiment: ExperimentEvent }) {
  const metrics = Object.entries(experiment.metrics);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.accentBlue}
      paddingX={2}
      paddingY={1}
      marginLeft={2}
      marginBottom={1}
    >
      {/* Metrics grid */}
      <Box marginBottom={1}>
        <Text color={colors.textMuted} bold>Metrics:</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {metrics.map(([key, value]) => (
          <Box key={key}>
            <Box width={20}>
              <Text color={colors.textSecondary}>{key}:</Text>
            </Box>
            <Text color={colors.accentGreen}>{formatMetric(key, value)}</Text>
          </Box>
        ))}
      </Box>

      {/* Observations */}
      {experiment.observations && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={colors.textMuted} bold>Observations:</Text>
          <Text color={colors.text}>{experiment.observations}</Text>
        </Box>
      )}

      {/* Surprises */}
      {experiment.surprises && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={colors.accentYellow} bold>Surprises:</Text>
          <Text color={colors.text}>{experiment.surprises}</Text>
        </Box>
      )}

      {/* wandb link */}
      {experiment.wandb_url && (
        <Box>
          <Text color={colors.textMuted}>wandb: </Text>
          <Text color={colors.accentCyan}>{experiment.wandb_url}</Text>
        </Box>
      )}
    </Box>
  );
}

export function ExperimentsPanel({
  experiments,
  selectedIndex,
  expandedId,
  offset = 0,
  limit = 5
}: ExperimentsPanelProps) {
  if (experiments.length === 0) {
    return (
      <Box flexDirection="column" padding={2}>
        <Box marginBottom={1}>
          <Text color={colors.accentYellow}>{"◇ "}</Text>
          <Text color={colors.text}>No experiments yet</Text>
        </Box>
        <Text color={colors.textSecondary}>
          Experiments are logged when the agent runs model training or evaluation.
        </Text>
        <Box marginTop={1}>
          <Text color={colors.textMuted}>
            Start the agent to begin running experiments.
          </Text>
        </Box>
      </Box>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedExperiments = [...experiments].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );

  const total = sortedExperiments.length;
  const safeOffset = Math.min(offset, Math.max(0, total - 1));
  const displayExperiments = sortedExperiments.slice(safeOffset, safeOffset + limit);
  const hasMore = safeOffset + limit < total;
  const hasPrev = safeOffset > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Navigation hint */}
      <Box marginBottom={1}>
        <Text color={colors.textMuted}>
          {total} experiment{total !== 1 ? "s" : ""}
        </Text>
        <Text color={colors.textSecondary}> (j/k navigate, Enter expand)</Text>
      </Box>

      {/* Pagination info */}
      {(hasPrev || hasMore) && (
        <Box marginBottom={1}>
          <Text color={colors.textMuted}>
            Showing {safeOffset + 1}-{Math.min(safeOffset + limit, total)} of {total}
          </Text>
        </Box>
      )}

      {/* Experiments list */}
      {displayExperiments.map((exp, index) => {
        const globalIndex = safeOffset + index;
        const isSelected = globalIndex === selectedIndex;
        const isExpanded = expandedId === `${exp.hypothesis_id}-${exp.ts}`;

        return (
          <Box key={`${exp.hypothesis_id}-${exp.ts}`} flexDirection="column">
            <ExperimentRow
              experiment={exp}
              isSelected={isSelected}
              isExpanded={isExpanded}
            />
            {isExpanded && <ExperimentDetails experiment={exp} />}
          </Box>
        );
      })}
    </Box>
  );
}
