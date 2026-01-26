/**
 * Agent output widget - displays streaming output from Claude Code
 */

import { Box, Text } from "ink";
import { colors } from "../theme/colors.ts";

interface AgentOutputProps {
  lines: string[];
  maxLines?: number;
}

export function AgentOutput({ lines, maxLines = 20 }: AgentOutputProps) {
  if (lines.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No output yet</Text>
        <Text color={colors.textMuted}>
          Start the agent to see execution output.
        </Text>
      </Box>
    );
  }

  // Show the last N lines
  const displayLines = lines.slice(-maxLines);

  return (
    <Box flexDirection="column">
      {displayLines.map((line) => (
        <OutputLine key={line} line={line} />
      ))}
    </Box>
  );
}

interface OutputLineProps {
  line: string;
}

function OutputLine({ line }: OutputLineProps) {
  // Detect tool usage patterns
  if (line.startsWith("> ") || line.startsWith("─")) {
    return <Text color={colors.accentBlue}>{line}</Text>;
  }

  // Detect errors
  if (
    line.toLowerCase().includes("error") ||
    line.toLowerCase().includes("failed")
  ) {
    return <Text color={colors.accentRed}>{line}</Text>;
  }

  // Detect success
  if (
    line.toLowerCase().includes("success") ||
    line.toLowerCase().includes("complete")
  ) {
    return <Text color={colors.accentGreen}>{line}</Text>;
  }

  // Default
  return <Text color={colors.textPrimary}>{line}</Text>;
}

interface ToolActivityProps {
  tool: string;
  status: "running" | "completed" | "error";
  input?: string;
}

export function ToolActivity({ tool, status, input }: ToolActivityProps) {
  const statusColor =
    status === "running"
      ? colors.accentYellow
      : status === "completed"
        ? colors.accentGreen
        : colors.accentRed;

  const statusIcon =
    status === "running" ? "◐" : status === "completed" ? "✓" : "✗";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={statusColor}
      paddingX={1}
      marginY={1}
    >
      <Box gap={1}>
        <Text color={statusColor}>{statusIcon}</Text>
        <Text color={colors.accentBlue} bold>
          {tool}
        </Text>
      </Box>
      {input && (
        <Text color={colors.textSecondary} wrap="truncate">
          {input.slice(0, 60)}
          {input.length > 60 ? "..." : ""}
        </Text>
      )}
    </Box>
  );
}
