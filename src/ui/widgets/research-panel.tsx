/**
 * Research panel widget - displays research from log.jsonl
 */

import { Box, Text } from "ink";
import type { ResearchEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface ResearchPanelProps {
  research: ResearchEvent[];
  maxItems?: number;
}

export function ResearchPanel({ research, maxItems }: ResearchPanelProps) {
  if (research.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No research yet</Text>
        <Text color={colors.textMuted}>
          Research findings are collected as the agent explores solutions.
        </Text>
      </Box>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedResearch = [...research].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );

  const displayResearch = maxItems
    ? sortedResearch.slice(0, maxItems)
    : sortedResearch;

  return (
    <Box flexDirection="column" gap={1}>
      {displayResearch.map((item, index) => (
        <ResearchItemDisplay key={`${item.ts}-${index}`} item={item} />
      ))}
      {maxItems && research.length > maxItems && (
        <Text color={colors.textMuted}>
          ... and {research.length - maxItems} more
        </Text>
      )}
    </Box>
  );
}

interface ResearchItemDisplayProps {
  item: ResearchEvent;
}

function ResearchItemDisplay({ item }: ResearchItemDisplayProps) {
  // Format timestamp
  const date = new Date(item.ts);
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text>🔍</Text>
        <Text color={colors.textMuted}>{timeStr}</Text>
        <Text color={colors.accentPurple}>{item.source}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.text}>{item.insight}</Text>
      </Box>
    </Box>
  );
}
