/**
 * Learnings panel widget
 */

import { Box, Text } from "ink";
import type { Learning } from "../../domain/types/index.ts";
import { colors, getImpactColor } from "../theme/colors.ts";

interface LearningsPanelProps {
  learnings: Learning[];
  maxHeight?: number;
}

export function LearningsPanel({ learnings, maxHeight }: LearningsPanelProps) {
  if (learnings.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No learnings yet</Text>
        <Text color={colors.textMuted}>
          Learnings are extracted as the agent completes stories.
        </Text>
      </Box>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedLearnings = [...learnings].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const displayLearnings = maxHeight
    ? sortedLearnings.slice(0, maxHeight)
    : sortedLearnings;

  return (
    <Box flexDirection="column">
      {displayLearnings.map((learning) => (
        <LearningItem key={learning.id} learning={learning} />
      ))}
      {maxHeight && learnings.length > maxHeight && (
        <Text color={colors.textMuted}>
          ... and {learnings.length - maxHeight} more
        </Text>
      )}
    </Box>
  );
}

interface LearningItemProps {
  learning: Learning;
}

function LearningItem({ learning }: LearningItemProps) {
  const impactColor = getImpactColor(learning.impact);
  const impactSymbol =
    learning.impact === "high" ? "●" : learning.impact === "medium" ? "◐" : "○";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text color={impactColor}>{impactSymbol}</Text>
        <Text color={colors.textMuted}>{learning.id}</Text>
        <Text color={colors.accentPurple}>{learning.category}</Text>
        <Text color={colors.textMuted}>{learning.source.storyId}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.textPrimary}>{learning.insight}</Text>
      </Box>
      {learning.implications.slice(0, 2).map((impl) => (
        <Box key={impl} marginLeft={2}>
          <Text color={colors.accentGreen}>→ {impl}</Text>
        </Box>
      ))}
      {learning.implications.length > 2 && (
        <Box marginLeft={2}>
          <Text color={colors.textMuted}>
            ... and {learning.implications.length - 2} more implications
          </Text>
        </Box>
      )}
    </Box>
  );
}
