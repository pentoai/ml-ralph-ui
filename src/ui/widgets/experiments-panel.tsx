/**
 * Experiments panel - displays experiments with expandable details and charts
 */

import * as asciichart from "asciichart";
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
 * Format a number for compact display
 */
function formatNumber(value: number): string {
  if (value === 0) return "0";

  const abs = Math.abs(value);

  // Very small numbers
  if (abs < 0.001) return value.toExponential(1);

  // Decimals (0.001 to 1)
  if (abs < 1) return value.toFixed(2);

  // Small integers (1 to 999)
  if (abs < 1000) return value.toFixed(abs < 10 ? 2 : 0);

  // Thousands
  if (abs < 1000000) return `${(value / 1000).toFixed(1)}k`;

  // Millions
  return `${(value / 1000000).toFixed(1)}M`;
}

/**
 * Shorten a metric key for display
 */
function shortenKey(key: string): string {
  // Common abbreviations
  const abbrevs: Record<string, string> = {
    accuracy: "acc",
    precision: "prec",
    recall: "rec",
    inference_time: "inf",
    training_time: "train",
    samples: "n",
    auc_roc: "auc",
    recall_at_5pct_fpr: "r@5%",
    f1_score: "f1",
  };

  const lower = key.toLowerCase();
  for (const [full, short] of Object.entries(abbrevs)) {
    if (lower.includes(full)) return short;
  }

  // Take last part of snake_case and truncate
  const parts = key.split("_");
  const last = parts[parts.length - 1] ?? key;
  return last.slice(0, 6);
}

/**
 * Get the single most important metric to show
 */
function getKeyMetric(metrics: Record<string, number>): { key: string; value: number } | null {
  const priority = ["auc_roc", "auc", "f1", "accuracy", "loss", "recall", "precision"];

  for (const key of priority) {
    const found = Object.entries(metrics).find(([k]) =>
      k.toLowerCase().includes(key)
    );
    if (found) {
      return { key: found[0], value: found[1] };
    }
  }

  // Take first metric if no priority found
  const first = Object.entries(metrics)[0];
  return first ? { key: first[0], value: first[1] } : null;
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
  const metrics = experiment.metrics ?? {};
  const keyMetric = getKeyMetric(metrics);
  const arrow = isExpanded ? "▼" : isSelected ? "▶" : "▷";
  const metricCount = Object.keys(metrics).length;

  // Use name if available, fallback to hypothesis_id
  const displayName = (experiment as ExperimentEvent & { name?: string }).name
    || experiment.hypothesis_id;

  return (
    <Box>
      <Text color={isSelected ? colors.accentBlue : colors.textMuted}>{arrow} </Text>
      <Box width={24}>
        <Text color={isSelected ? colors.accentBlue : colors.text} bold={isSelected}>
          {displayName.slice(0, 22)}
        </Text>
      </Box>
      {keyMetric && (
        <>
          <Text color={colors.textMuted}>│ </Text>
          <Box width={14}>
            <Text color={colors.accentGreen} bold>
              {shortenKey(keyMetric.key)}: {formatNumber(keyMetric.value)}
            </Text>
          </Box>
        </>
      )}
      {metricCount > 1 && (
        <Text color={colors.textMuted}> +{metricCount - 1}</Text>
      )}
      <Text color={colors.textMuted}> │ </Text>
      <Text color={colors.textSecondary}>{timeAgo}</Text>
    </Box>
  );
}

/**
 * Render a horizontal bar for a metric value
 */
function MetricBar({ value, max, width = 20 }: { value: number; max: number; width?: number }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  return (
    <Text>
      <Text color={colors.accentGreen}>{"█".repeat(filled)}</Text>
      <Text color={colors.bgTertiary}>{"░".repeat(empty)}</Text>
    </Text>
  );
}

/**
 * Render a chart comparing performance metrics using asciichart
 */
function PerformanceChart({ metrics }: { metrics: [string, number][] }) {
  if (metrics.length === 0) return null;

  // Create a simple bar-style comparison using asciichart
  // We'll plot each metric as a point to show relative values
  const values = metrics.map(([_, v]) => v);
  const labels = metrics.map(([k]) => shortenKey(k));

  try {
    const chart = asciichart.plot(values, {
      height: 4,
      min: 0,
      max: 1,
      format: (x: number) => x.toFixed(2),
    });

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color={colors.textMuted}>{chart}</Text>
        <Box marginTop={0}>
          <Text color={colors.textSecondary}>
            {"  "}
            {labels.map((l, i) => `${i + 1}:${l}`).join("  ")}
          </Text>
        </Box>
      </Box>
    );
  } catch {
    return null;
  }
}

/**
 * Expanded experiment details
 */
function ExperimentDetails({ experiment }: { experiment: ExperimentEvent }) {
  const metricsObj = experiment.metrics ?? {};
  const metrics = Object.entries(metricsObj);
  const extExp = experiment as ExperimentEvent & { name?: string; config?: Record<string, unknown> };

  // Find max value for bar scaling (only for values 0-1 range, like percentages)
  const normalizedMetrics = metrics.filter(([_, v]) => v >= 0 && v <= 1);
  const largeMetrics = metrics.filter(([_, v]) => v < 0 || v > 1);

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
      {/* Header with name and hypothesis */}
      <Box marginBottom={1}>
        {extExp.name && (
          <Text color={colors.accentBlue} bold>{extExp.name}</Text>
        )}
        <Text color={colors.textMuted}> ({experiment.hypothesis_id})</Text>
      </Box>

      {/* Config summary if available */}
      {extExp.config && Object.keys(extExp.config).length > 0 && (
        <Box marginBottom={1}>
          <Text color={colors.textSecondary}>
            {Object.entries(extExp.config).slice(0, 4).map(([k, v]) =>
              `${k}=${String(v)}`
            ).join(", ")}
            {Object.keys(extExp.config).length > 4 && " ..."}
          </Text>
        </Box>
      )}

      {/* Performance chart */}
      {normalizedMetrics.length >= 2 && (
        <>
          <Box marginBottom={1}>
            <Text color={colors.accentPurple} bold>Performance Chart:</Text>
          </Box>
          <PerformanceChart metrics={normalizedMetrics} />
        </>
      )}

      {/* Normalized metrics (0-1 range) with bars */}
      {normalizedMetrics.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text color={colors.textMuted} bold>Metrics:</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            {normalizedMetrics.map(([key, value]) => (
              <Box key={key}>
                <Box width={20}>
                  <Text color={colors.textSecondary}>{key.slice(0, 18)}</Text>
                </Box>
                <Box width={22}>
                  <MetricBar value={value} max={1} width={15} />
                </Box>
                <Text color={colors.accentGreen}>{value.toFixed(3)}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}

      {/* Other metrics (counts, times, etc.) */}
      {largeMetrics.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text color={colors.textMuted} bold>Stats:</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            {largeMetrics.map(([key, value]) => (
              <Box key={key}>
                <Box width={24}>
                  <Text color={colors.textSecondary}>{key}</Text>
                </Box>
                <Text color={colors.accentGreen}>{formatNumber(value)}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}

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

  // Auto-scroll to keep selection visible
  // Calculate offset based on selectedIndex to ensure selected item is visible
  let autoOffset = offset;
  if (selectedIndex < offset) {
    // Selection is above visible range - scroll up
    autoOffset = selectedIndex;
  } else if (selectedIndex >= offset + limit) {
    // Selection is below visible range - scroll down
    autoOffset = selectedIndex - limit + 1;
  }
  const safeOffset = Math.max(0, Math.min(autoOffset, total - limit));

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
        const isExpanded = expandedId === String(globalIndex);

        return (
          <Box key={`${exp.hypothesis_id}-${exp.ts}-${index}`} flexDirection="column">
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
