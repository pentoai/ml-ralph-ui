/**
 * TmuxPane widget - displays tmux pane content and handles input
 */

import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { TmuxPaneContent } from "../../infrastructure/tmux/index.ts";
import { colors } from "../theme/colors.ts";

interface TmuxPaneProps {
  /** Pane content from useTmuxPane */
  content: TmuxPaneContent | null;
  /** Whether the session is running */
  isRunning: boolean;
  /** Any error */
  error: string | null;
  /** Whether this pane has input focus */
  active: boolean;
  /** Callback to send keys */
  onSendKeys: (keys: string) => void;
  /** Callback to send text */
  onSendText: (text: string) => void;
}

export function TmuxPane({
  content,
  isRunning,
  error,
  active,
  onSendKeys,
  onSendText,
}: TmuxPaneProps) {
  // Handle keyboard input when active
  useInput(
    (input, key) => {
      if (!active) return;

      // Handle special keys
      if (key.return) {
        onSendKeys("Enter");
      } else if (key.backspace || key.delete) {
        onSendKeys("BSpace");
      } else if (key.escape) {
        onSendKeys("Escape");
      } else if (key.upArrow) {
        onSendKeys("Up");
      } else if (key.downArrow) {
        onSendKeys("Down");
      } else if (key.leftArrow) {
        onSendKeys("Left");
      } else if (key.rightArrow) {
        onSendKeys("Right");
      } else if (key.tab) {
        onSendKeys("Tab");
      } else if (key.ctrl && input === "c") {
        onSendKeys("C-c");
      } else if (key.ctrl && input === "d") {
        onSendKeys("C-d");
      } else if (key.ctrl && input === "z") {
        onSendKeys("C-z");
      } else if (key.ctrl && input === "l") {
        onSendKeys("C-l");
      } else if (key.ctrl && input === "a") {
        onSendKeys("C-a");
      } else if (key.ctrl && input === "e") {
        onSendKeys("C-e");
      } else if (key.ctrl && input === "u") {
        onSendKeys("C-u");
      } else if (key.ctrl && input === "k") {
        onSendKeys("C-k");
      } else if (key.ctrl && input === "w") {
        onSendKeys("C-w");
      } else if (input && !key.ctrl && !key.meta) {
        // Regular character input - send as literal text
        onSendText(input);
      }
    },
    { isActive: active },
  );

  // Loading state
  if (!isRunning && !error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color={colors.accentYellow}>
            <Spinner type="dots" />
          </Text>
          <Text color={colors.textMuted}> Starting terminal...</Text>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.accentRed}>Error: {error}</Text>
        <Text color={colors.textMuted}>
          Make sure tmux is installed: brew install tmux
        </Text>
      </Box>
    );
  }

  // No content yet
  if (!content) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color={colors.accentYellow}>
            <Spinner type="dots" />
          </Text>
          <Text color={colors.textMuted}> Waiting for terminal output...</Text>
        </Box>
      </Box>
    );
  }

  // Render pane content
  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Terminal content - index keys are fine here since lines have no stable identity */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {content.lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: terminal lines have no stable identity
          <Text key={index} wrap="truncate">
            {line || " "}
          </Text>
        ))}
      </Box>

      {/* Focus indicator */}
      <Box paddingX={1} paddingTop={0}>
        {active ? (
          <Text color={colors.accentGreen}>● Input active (Esc to exit)</Text>
        ) : (
          <Text color={colors.textMuted}>○ Press i to type</Text>
        )}
      </Box>
    </Box>
  );
}
