/**
 * Chat panel widget - for PRD creation conversation
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { ChatMessage } from "../../domain/types/index.ts";
import { colors } from "../theme/colors.ts";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  currentTool?: string | null;
  maxMessages?: number;
  inputMode?: boolean;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  currentTool = null,
  maxMessages = 50,
  inputMode = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");

  useInput((inputChar, key) => {
    // Only handle input when in input mode
    if (!inputMode) return;

    if (key.return && input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && !key.escape && inputChar) {
      setInput((prev) => prev + inputChar);
    }
  });

  // Show last N messages
  const displayMessages = messages.slice(-maxMessages);

  return (
    <Box flexDirection="column" height="100%">
      {/* Messages area */}
      <Box flexDirection="column" flexGrow={1}>
        {displayMessages.length === 0 ? (
          <Box padding={1}>
            <Text color={colors.textMuted}>
              Start a conversation to create your PRD.
            </Text>
          </Box>
        ) : (
          displayMessages.map((msg) => (
            <ChatMessageDisplay key={msg.id} message={msg} />
          ))
        )}
        {isLoading && (
          <Box paddingX={1}>
            <Text color={colors.accentYellow}>
              ● {currentTool ? `Running: ${currentTool}` : "Thinking..."}
            </Text>
          </Box>
        )}
      </Box>

      {/* Input area */}
      <Box
        borderStyle="single"
        borderColor={inputMode ? colors.accentBlue : colors.textMuted}
        paddingX={1}
      >
        <Text color={inputMode ? colors.accentBlue : colors.textMuted}>
          &gt;{" "}
        </Text>
        <Text>{input}</Text>
        {inputMode ? (
          <Text color={colors.accentBlue}>│</Text>
        ) : (
          <Text color={colors.textMuted}> (press i to type)</Text>
        )}
      </Box>
    </Box>
  );
}

interface ChatMessageDisplayProps {
  message: ChatMessage;
}

function ChatMessageDisplay({ message }: ChatMessageDisplayProps) {
  const isUser = message.role === "user";

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Text color={isUser ? colors.accentGreen : colors.accentBlue} bold>
        {isUser ? "You" : "Claude"}:
      </Text>
      <Box marginLeft={2}>
        <Text color={colors.textPrimary} wrap="wrap">
          {message.content}
        </Text>
      </Box>
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box marginLeft={2} flexDirection="column">
          {message.toolCalls.map((tool) => (
            <Text key={tool.id} color={colors.textMuted}>
              [{tool.tool}]
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
