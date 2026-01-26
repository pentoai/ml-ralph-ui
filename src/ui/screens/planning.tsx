/**
 * Planning screen - PRD creation and knowledge viewing
 */

import { Box, Text } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../application/state/index.ts";
import type { PRD, ToolCall } from "../../domain/types/index.ts";
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

  // Claude Code hook - simpler version without callbacks
  const claude = useClaude({
    projectPath: projectPath ?? process.cwd(),
    systemPrompt: buildPlanningSystemPrompt(prd),
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

/**
 * Build system prompt for planning mode
 */
function buildPlanningSystemPrompt(prd: PRD | null): string {
  const basePrompt = `You are an ML engineering assistant helping to plan and execute machine learning projects.

Your role in planning mode is to:
1. Help create and refine Product Requirement Documents (PRDs)
2. Break down ML projects into actionable user stories
3. Provide guidance on ML best practices
4. Help with experiment design and evaluation strategies

When the user asks about their project, help them:
- Define clear success metrics
- Identify data requirements
- Plan model evaluation strategies
- Structure their work into small, testable stories

Be concise and practical. Focus on actionable advice.`;

  if (!prd) {
    return `${basePrompt}

No PRD has been created yet. Help the user create one by:
1. Understanding their ML problem
2. Defining the target variable and prediction unit
3. Establishing success criteria
4. Identifying data sources and requirements
5. Breaking down the work into user stories`;
  }

  const storySummary = prd.stories
    .map((s) => `- [${s.status}] ${s.id}: ${s.title}`)
    .join("\n");

  return `${basePrompt}

Current PRD: ${prd.project}
Goal: ${prd.goal}

Stories:
${storySummary}

Help the user refine this PRD or answer questions about their ML project.`;
}
