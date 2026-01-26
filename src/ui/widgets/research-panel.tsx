/**
 * Research panel widget
 */

import { Box, Text } from "ink";
import type { ResearchItem } from "../../domain/types/index.ts";
import { colors } from "../theme/colors.ts";

interface ResearchPanelProps {
  research: ResearchItem[];
  maxHeight?: number;
}

export function ResearchPanel({ research, maxHeight }: ResearchPanelProps) {
  if (research.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No research yet</Text>
        <Text color={colors.textMuted}>
          Research items are collected as the agent explores solutions.
        </Text>
      </Box>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedResearch = [...research].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const displayResearch = maxHeight
    ? sortedResearch.slice(0, maxHeight)
    : sortedResearch;

  return (
    <Box flexDirection="column">
      {displayResearch.map((item) => (
        <ResearchItemDisplay key={item.id} item={item} />
      ))}
      {maxHeight && research.length > maxHeight && (
        <Text color={colors.textMuted}>
          ... and {research.length - maxHeight} more
        </Text>
      )}
    </Box>
  );
}

interface ResearchItemDisplayProps {
  item: ResearchItem;
}

function ResearchItemDisplay({ item }: ResearchItemDisplayProps) {
  const typeIcon = getTypeIcon(item.type);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text>{typeIcon}</Text>
        <Text color={colors.textMuted}>{item.id}</Text>
        <Text color={colors.accentPurple}>{item.type}</Text>
        {item.storyId && <Text color={colors.textMuted}>{item.storyId}</Text>}
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.textPrimary} bold>
          {item.title}
        </Text>
      </Box>
      {item.url && (
        <Box marginLeft={2}>
          <Text color={colors.accentBlue} dimColor>
            {item.url.slice(0, 60)}
            {item.url.length > 60 ? "..." : ""}
          </Text>
        </Box>
      )}
      {item.keyTakeaways.slice(0, 2).map((takeaway) => (
        <Box key={takeaway} marginLeft={2}>
          <Text color={colors.textSecondary}>• {takeaway}</Text>
        </Box>
      ))}
      {item.keyTakeaways.length > 2 && (
        <Box marginLeft={2}>
          <Text color={colors.textMuted}>
            ... and {item.keyTakeaways.length - 2} more takeaways
          </Text>
        </Box>
      )}
    </Box>
  );
}

function getTypeIcon(type: ResearchItem["type"]): string {
  switch (type) {
    case "paper":
      return "📄";
    case "documentation":
      return "📚";
    case "tutorial":
      return "📖";
    case "stackoverflow":
      return "💬";
    case "blog":
      return "📝";
    case "repository":
      return "📦";
    default:
      return "🔗";
  }
}
