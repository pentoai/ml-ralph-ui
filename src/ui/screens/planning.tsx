/**
 * Planning screen - PRD creation and knowledge viewing
 */

import { Box, Text } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../application/state/index.ts";
import type { ToolCall } from "../../domain/types/index.ts";
import { createChatMessage } from "../../domain/types/index.ts";
import { useClaude } from "../hooks/index.ts";
import { colors } from "../theme/colors.ts";
import { ChatPanel } from "../widgets/chat-panel.tsx";
import { LearningsPanel } from "../widgets/learnings-panel.tsx";
import { ResearchPanel } from "../widgets/research-panel.tsx";
import { StoryList } from "../widgets/story-list.tsx";
import { PlanningTabs } from "../widgets/tabs.tsx";

export function PlanningScreen() {
  const {
    projectPath,
    prd,
    learnings,
    research,
    chatMessages,
    selectedTab,
    addChatMessage,
    updateChatMessage,
    inputMode,
    setError,
  } = useAppStore();

  // Track the current streaming message
  const currentMessageIdRef = useRef<string | null>(null);
  const [currentTools, setCurrentTools] = useState<ToolCall[]>([]);

  // Claude Code hook
  const claude = useClaude({
    projectPath: projectPath ?? process.cwd(),
  });

  // Update message content when claude.displayText changes (animated)
  useEffect(() => {
    if (currentMessageIdRef.current && claude.displayText) {
      updateChatMessage(currentMessageIdRef.current, {
        content: claude.displayText,
      });
    }
  }, [claude.displayText, updateChatMessage]);

  // Update tool display when claude.currentTool changes
  useEffect(() => {
    if (currentMessageIdRef.current && claude.currentTool) {
      const newTool: ToolCall = {
        id: crypto.randomUUID(),
        tool: claude.currentTool,
        input: "",
        status: "running",
      };
      setCurrentTools((prev) => {
        // Mark previous tools as completed
        const updated = prev.map((t) => ({
          ...t,
          status: "completed" as const,
        }));
        return [...updated, newTool];
      });
    }
  }, [claude.currentTool]);

  // Update message with tools
  useEffect(() => {
    if (currentMessageIdRef.current && currentTools.length > 0) {
      updateChatMessage(currentMessageIdRef.current, {
        toolCalls: currentTools,
      });
    }
  }, [currentTools, updateChatMessage]);

  // Handle loading state changes (completion)
  useEffect(() => {
    if (!claude.isLoading && currentMessageIdRef.current) {
      // Claude finished - clean up
      currentMessageIdRef.current = null;
      setCurrentTools([]);
    }
  }, [claude.isLoading]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage = createChatMessage("user", content);
      addChatMessage(userMessage);

      // Create placeholder assistant message
      const assistantMessage = createChatMessage("assistant", "");
      addChatMessage(assistantMessage);
      currentMessageIdRef.current = assistantMessage.id;
      setCurrentTools([]);

      // Send to Claude Code
      try {
        await claude.sendMessage(content);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [addChatMessage, claude.sendMessage, setError],
  );

  const stories = prd?.stories ?? [];

  return (
    <Box flexDirection="row" flexGrow={1}>
      {/* Left panel - Chat */}
      <Box
        flexDirection="column"
        width="50%"
        borderStyle="single"
        borderColor={colors.textMuted}
        flexGrow={1}
      >
        <Box paddingX={1} borderBottom>
          <Text color={colors.accentBlue} bold>
            Claude Code
          </Text>
          {(claude.isLoading ||
            claude.displayText.length < claude.currentText.length) && (
            <Text color={colors.accentYellow}>
              {" "}
              [{claude.displayText.length}/{claude.currentText.length}]
            </Text>
          )}
          {claude.error && (
            <Text color={colors.accentRed}>
              {" "}
              Error: {claude.error.slice(0, 50)}
            </Text>
          )}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <ChatPanel
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            inputMode={inputMode}
            isLoading={claude.isLoading}
            currentTool={claude.currentTool}
          />
        </Box>
      </Box>

      {/* Right panel - Knowledge tabs */}
      <Box
        flexDirection="column"
        width="50%"
        borderStyle="single"
        borderColor={colors.textMuted}
        flexGrow={1}
      >
        <Box paddingX={1}>
          <PlanningTabs activeTab={selectedTab} />
        </Box>

        <Box
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
          overflowY="hidden"
        >
          {selectedTab === "stories" && <StoryList stories={stories} />}
          {selectedTab === "learnings" && (
            <LearningsPanel learnings={learnings} />
          )}
          {selectedTab === "research" && <ResearchPanel research={research} />}
        </Box>
      </Box>
    </Box>
  );
}
