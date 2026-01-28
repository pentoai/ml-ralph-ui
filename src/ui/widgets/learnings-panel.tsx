/**
 * Learnings panel widget - displays learnings from log.jsonl
 */

import { Box, Text } from "ink";
import type { LearningEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface LearningsPanelProps {
  learnings: LearningEvent[];
  offset?: number;
  limit?: number;
}

export function LearningsPanel({ learnings, offset = 0, limit = 10 }: LearningsPanelProps) {
  if (learnings.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No learnings yet</Text>
        <Text color={colors.textMuted}>
          Learnings are captured as the agent analyzes experiments.
        </Text>
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
    <Box flexDirection="column" gap={1}>
      {(hasPrev || hasMore) && (
        <Text color={colors.textMuted}>
          Showing {safeOffset + 1}-{Math.min(safeOffset + limit, total)} of {total} (j/k to scroll)
        </Text>
      )}
      {displayLearnings.map((learning, index) => (
        <LearningItem key={`${learning.ts}-${index}`} learning={learning} />
      ))}
    </Box>
  );
}

interface LearningItemProps {
  learning: LearningEvent;
}

function LearningItem({ learning }: LearningItemProps) {
  // Format timestamp
  const date = new Date(learning.ts);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={colors.accentYellow}>💡</Text>
        <Text color={colors.textMuted}>{timeStr}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.text}>{learning.insight}</Text>
      </Box>
    </Box>
  );
}
