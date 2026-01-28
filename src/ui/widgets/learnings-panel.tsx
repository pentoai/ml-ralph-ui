/**
 * Learnings panel widget - displays learnings from log.jsonl
 */

import { Box, Text } from "ink";
import type { LearningEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface LearningsPanelProps {
  learnings: LearningEvent[];
  maxItems?: number;
}

export function LearningsPanel({ learnings, maxItems }: LearningsPanelProps) {
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

  const displayLearnings = maxItems
    ? sortedLearnings.slice(0, maxItems)
    : sortedLearnings;

  return (
    <Box flexDirection="column" gap={1}>
      {displayLearnings.map((learning, index) => (
        <LearningItem key={`${learning.ts}-${index}`} learning={learning} />
      ))}
      {maxItems && learnings.length > maxItems && (
        <Text color={colors.textMuted}>
          ... and {learnings.length - maxItems} more
        </Text>
      )}
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
