/**
 * Activity Feed - displays curated agent output
 *
 * Keeps thinking/narrative prominent while making tool operations inline
 */

import { Box, Text } from "ink";
import { useMemo } from "react";
import type { StreamEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";
import { ActivityAggregator, getToolIcon, type Activity } from "./activity-aggregator.ts";

interface ActivityFeedProps {
  events: StreamEvent[];
  maxActivities?: number;
  currentIteration?: number;
  startTime?: number;
  phase?: string | null;
}

/**
 * Format elapsed time as "Xm Ys"
 */
function formatElapsed(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Status bar showing current state
 */
function StatusBar({
  iteration,
  phase,
  startTime,
  isRunning
}: {
  iteration: number;
  phase: string | null;
  startTime: number;
  isRunning: boolean;
}) {
  if (!isRunning && iteration === 0) return null;

  return (
    <Box
      borderStyle="single"
      borderColor={colors.accentBlue}
      paddingX={1}
      marginBottom={1}
    >
      <Box marginRight={2}>
        <Text color={isRunning ? colors.accentGreen : colors.textMuted}>
          {isRunning ? "●" : "○"}
        </Text>
        <Text color={colors.textMuted}> </Text>
        <Text color={colors.text} bold>Iteration {iteration}</Text>
      </Box>
      {phase && (
        <Box marginRight={2}>
          <Text color={colors.textMuted}>│ </Text>
          <Text backgroundColor={colors.accentPurple} color={colors.bgPrimary}>
            {" "}{phase}{" "}
          </Text>
        </Box>
      )}
      {startTime > 0 && (
        <Box>
          <Text color={colors.textMuted}>│ </Text>
          <Text color={colors.textSecondary}>{formatElapsed(startTime)}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Render a single activity
 */
function ActivityItem({ activity }: { activity: Activity }) {
  switch (activity.type) {
    case "iteration":
      // Skip - already shown in status bar
      return null;

    case "phase":
      // Skip - already shown in status bar
      return null;

    case "thinking":
      return <ThinkingBlock text={activity.content} />;

    case "tool":
      return <ToolLine activity={activity} />;

    case "tool_group":
      return <ToolGroupLine activity={activity} />;

    case "milestone":
      return <MilestoneLine activity={activity} />;

    case "error":
      return (
        <Box
          borderStyle="single"
          borderColor={colors.accentRed}
          paddingX={1}
          marginY={1}
        >
          <Text color={colors.accentRed}>❌ {activity.content}</Text>
        </Box>
      );

    default:
      return null;
  }
}

/**
 * Thinking/narrative text block
 */
function ThinkingBlock({ text }: { text: string }) {
  // Split into paragraphs for better readability
  const paragraphs = text.split("\n").filter(p => p.trim());

  if (paragraphs.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {paragraphs.map((paragraph, i) => (
        <Text key={i} color={colors.text}>{paragraph}</Text>
      ))}
    </Box>
  );
}

/**
 * Single tool operation line
 */
function ToolLine({ activity }: { activity: Activity }) {
  const icon = getToolIcon(activity.toolName || "");
  const statusIcon = activity.status === "success" ? "✓" :
                     activity.status === "error" ? "✗" :
                     "◐";
  const statusColor = activity.status === "success" ? colors.accentGreen :
                      activity.status === "error" ? colors.accentRed :
                      colors.accentYellow;

  // Format the detail based on tool type
  let detail = activity.toolDetails || "";
  if (activity.toolName === "Bash") {
    // Show command, truncated
    detail = detail.length > 50 ? detail.slice(0, 50) + "..." : detail;
  } else if (activity.toolName === "Read" || activity.toolName === "Write" || activity.toolName === "Edit") {
    // Show shortened path
    const parts = detail.split("/");
    detail = parts.length > 2 ? parts.slice(-2).join("/") : detail;
  }

  return (
    <Box>
      <Text color={colors.textMuted}>{icon} </Text>
      <Text color={colors.accentBlue}>{activity.toolName}</Text>
      {detail && (
        <Text color={colors.textSecondary}> {detail}</Text>
      )}
      <Text color={statusColor}> {statusIcon}</Text>
    </Box>
  );
}

/**
 * Grouped tool operations (e.g., multiple file reads)
 */
function ToolGroupLine({ activity }: { activity: Activity }) {
  const icon = getToolIcon(activity.toolName || "");
  const count = activity.tools?.length || 0;

  // Get file names
  const fileNames = activity.tools?.map(t => {
    const parts = t.detail.split("/");
    return parts[parts.length - 1];
  }).join(", ");

  return (
    <Box>
      <Text color={colors.textMuted}>{icon} </Text>
      <Text color={colors.accentBlue}>{activity.toolName}</Text>
      <Text color={colors.textSecondary}> {count} files</Text>
      <Text color={colors.textMuted}> (</Text>
      <Text color={colors.textMuted}>{fileNames}</Text>
      <Text color={colors.textMuted}>)</Text>
      <Text color={colors.accentGreen}> ✓</Text>
    </Box>
  );
}

/**
 * Milestone line (state file updates)
 */
function MilestoneLine({ activity }: { activity: Activity }) {
  const icon = activity.content.includes("kanban") ? "📋" :
               activity.content.includes("log") ? "📜" :
               activity.content.includes("prd") ? "📄" : "📝";

  return (
    <Box>
      <Text color={colors.accentPurple}>{icon} </Text>
      <Text color={colors.accentPurple} bold>{activity.content}</Text>
      <Text color={colors.accentGreen}> ✓</Text>
    </Box>
  );
}

/**
 * Main Activity Feed component
 */
export function ActivityFeed({
  events,
  maxActivities = 30,
  currentIteration = 0,
  startTime = 0,
  phase = null,
}: ActivityFeedProps) {
  // Process events through aggregator - only process last N events for performance
  const activities = useMemo(() => {
    const aggregator = new ActivityAggregator();

    // Only process recent events to avoid performance issues with long sessions
    const recentEvents = events.slice(-200);

    for (const event of recentEvents) {
      aggregator.process(event);
    }

    // Flush any pending activities
    aggregator.flush();

    return aggregator.getActivities();
  }, [events]);

  if (events.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No output yet</Text>
        <Text color={colors.textMuted}>
          Press 's' to start the agent.
        </Text>
      </Box>
    );
  }

  // Show last N activities - keep it small for UI performance
  const displayActivities = activities.slice(-maxActivities);
  const isRunning = currentIteration > 0 && !activities.some(
    a => a.content.includes("complete") || a.content.includes("Reached max")
  );

  return (
    <Box flexDirection="column">
      {/* Status bar */}
      <StatusBar
        iteration={currentIteration}
        phase={phase}
        startTime={startTime}
        isRunning={isRunning}
      />

      {/* Truncation notice if we have more activities */}
      {activities.length > maxActivities && (
        <Box marginBottom={1}>
          <Text color={colors.textMuted} dimColor>
            ↑ {activities.length - maxActivities} earlier activities
          </Text>
        </Box>
      )}

      {/* Activity feed */}
      {displayActivities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </Box>
  );
}
