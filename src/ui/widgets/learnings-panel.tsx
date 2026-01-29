/**
 * Learnings panel - displays learnings from log.jsonl
 * Matches the visual structure of hypotheses-panel.tsx
 */

import { Box, Text } from "ink";
import type { LearningEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface LearningsPanelProps {
  learnings: LearningEvent[];
  offset?: number;
  limit?: number;
}

/**
 * Categorize a learning based on its content
 */
function categorizeLearning(insight: string): { category: string; icon: string; color: string } {
  const lower = insight.toLowerCase();

  if (lower.includes("model") || lower.includes("architecture") || lower.includes("neural")) {
    return { category: "MODEL", icon: "🧠", color: colors.accentPurple };
  }
  if (lower.includes("data") || lower.includes("feature") || lower.includes("preprocess")) {
    return { category: "DATA", icon: "📊", color: colors.accentBlue };
  }
  if (lower.includes("train") || lower.includes("epoch") || lower.includes("loss") || lower.includes("learning rate")) {
    return { category: "TRAINING", icon: "⚡", color: colors.accentYellow };
  }
  if (lower.includes("metric") || lower.includes("accuracy") || lower.includes("score") || lower.includes("evaluat")) {
    return { category: "METRICS", icon: "📈", color: colors.accentGreen };
  }
  if (lower.includes("bug") || lower.includes("error") || lower.includes("fix") || lower.includes("issue")) {
    return { category: "DEBUG", icon: "🔧", color: colors.accentRed };
  }
  return { category: "INSIGHT", icon: "💡", color: colors.accentYellow };
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
 * Summary bar showing total count
 */
function LearningsSummary({ learnings }: { learnings: LearningEvent[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = learnings.filter(l => new Date(l.ts) >= today).length;

  return (
    <Box marginBottom={1}>
      <Box marginRight={2}>
        <Text backgroundColor={colors.accentYellow} color={colors.bgPrimary}> {learnings.length} </Text>
        <Text color={colors.textMuted}> Total</Text>
      </Box>
      {todayCount > 0 && (
        <Box>
          <Text backgroundColor={colors.accentGreen} color={colors.bgPrimary}> +{todayCount} </Text>
          <Text color={colors.textMuted}> Today</Text>
        </Box>
      )}
    </Box>
  );
}

export function LearningsPanel({ learnings, offset = 0, limit = 5 }: LearningsPanelProps) {
  if (learnings.length === 0) {
    return (
      <Box flexDirection="column" padding={2}>
        <Box marginBottom={1}>
          <Text color={colors.accentYellow}>{"◇ "}</Text>
          <Text color={colors.text}>No learnings yet</Text>
        </Box>
        <Text color={colors.textSecondary}>
          Learnings are captured as the agent analyzes experiments and reflects.
        </Text>
        <Box marginTop={1}>
          <Text color={colors.textMuted}>
            Start the agent to begin capturing learnings.
          </Text>
        </Box>
      </Box>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedLearnings = [...learnings].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );

  const total = sortedLearnings.length;
  const safeOffset = Math.min(offset, Math.max(0, total - 1));
  const displayLearnings = sortedLearnings.slice(safeOffset, safeOffset + limit);
  const hasMore = safeOffset + limit < total;
  const hasPrev = safeOffset > 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Summary */}
      <LearningsSummary learnings={learnings} />

      {/* Pagination info */}
      {(hasPrev || hasMore) && (
        <Box marginBottom={1}>
          <Text color={colors.textMuted}>
            Showing {safeOffset + 1}-{Math.min(safeOffset + limit, total)} of {total}
          </Text>
          <Text color={colors.textSecondary}> (j/k to scroll)</Text>
        </Box>
      )}

      {/* Learnings list */}
      {displayLearnings.map((learning, index) => (
        <LearningCard key={`${learning.ts}-${index}`} learning={learning} />
      ))}
    </Box>
  );
}

interface LearningCardProps {
  learning: LearningEvent;
}

function LearningCard({ learning }: LearningCardProps) {
  const { category, icon, color } = categorizeLearning(learning.insight);
  const timeAgo = formatRelativeTime(learning.ts);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      {/* Header row */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text color={color} bold>{icon}</Text>
          <Text color={colors.textMuted}> • </Text>
          <Text color={colors.textMuted}>{timeAgo}</Text>
        </Box>
        <Box>
          <Text backgroundColor={color} color={colors.bgPrimary}>
            {" "}{category}{" "}
          </Text>
        </Box>
      </Box>

      {/* Insight text */}
      <Box>
        <Text color={colors.text}>{learning.insight}</Text>
      </Box>

      {/* Source if available */}
      {learning.source && (
        <Box marginTop={1}>
          <Text color={colors.textMuted}>Source: </Text>
          <Text color={colors.textSecondary}>{learning.source}</Text>
        </Box>
      )}
    </Box>
  );
}
