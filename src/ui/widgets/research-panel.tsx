/**
 * Research panel widget - displays research from log.jsonl
 */

import { Box, Text } from "ink";
import type { ResearchEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface ResearchPanelProps {
  research: ResearchEvent[];
  offset?: number;
  limit?: number;
}

export function ResearchPanel({ research, offset = 0, limit = 10 }: ResearchPanelProps) {
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

  const total = sortedResearch.length;
  const safeOffset = Math.min(offset, Math.max(0, total - 1));
  const displayResearch = sortedResearch.slice(safeOffset, safeOffset + limit);
  const hasMore = safeOffset + limit < total;
  const hasPrev = safeOffset > 0;

  return (
    <Box flexDirection="column" gap={1}>
      {(hasPrev || hasMore) && (
        <Text color={colors.textMuted}>
          Showing {safeOffset + 1}-{Math.min(safeOffset + limit, total)} of {total} (j/k to scroll)
        </Text>
      )}
      {displayResearch.map((item, index) => (
        <ResearchItemDisplay key={`${item.ts}-${index}`} item={item} />
      ))}
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
