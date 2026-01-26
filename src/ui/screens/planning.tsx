/**
 * Planning screen - PRD creation and knowledge viewing
 */

import { Box, Text } from "ink";
import { useCallback, useRef, useState } from "react";
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
  const currentToolsRef = useRef<ToolCall[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Claude Code hook
  const claude = useClaude(
    {
      projectPath: projectPath ?? process.cwd(),
      systemPrompt: buildPlanningSystemPrompt(prd),
    },
    {
      onText: () => {
        // Update the current assistant message with accumulated text
        if (currentMessageIdRef.current) {
          updateChatMessage(currentMessageIdRef.current, {
            content: claude.currentText,
          });
        }
      },
      onToolStart: (tool, description) => {
        // Add tool to current message
        const toolCall: ToolCall = {
          id: crypto.randomUUID(),
          tool,
          input: description ?? "",
          status: "running",
        };
        currentToolsRef.current = [...currentToolsRef.current, toolCall];

        if (currentMessageIdRef.current) {
          updateChatMessage(currentMessageIdRef.current, {
            toolCalls: currentToolsRef.current,
          });
        }
      },
      onToolEnd: () => {
        // Mark last tool as completed
        if (currentToolsRef.current.length > 0) {
          const lastTool =
            currentToolsRef.current[currentToolsRef.current.length - 1];
          if (lastTool) {
            currentToolsRef.current = currentToolsRef.current.map((t, i) =>
              i === currentToolsRef.current.length - 1
                ? { ...t, status: "completed" as const }
                : t,
            );

            if (currentMessageIdRef.current) {
              updateChatMessage(currentMessageIdRef.current, {
                toolCalls: currentToolsRef.current,
              });
            }
          }
        }
      },
      onDone: () => {
        setIsStreaming(false);
        currentMessageIdRef.current = null;
        currentToolsRef.current = [];
      },
      onError: (message) => {
        setError(message);
        setIsStreaming(false);
      },
    },
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage = createChatMessage("user", content);
      addChatMessage(userMessage);

      // Create placeholder assistant message
      const assistantMessage = createChatMessage("assistant", "");
      addChatMessage(assistantMessage);
      currentMessageIdRef.current = assistantMessage.id;
      currentToolsRef.current = [];
      setIsStreaming(true);

      // Send to Claude Code
      await claude.sendMessage(content);
    },
    [addChatMessage, claude],
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
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <ChatPanel
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            inputMode={inputMode}
            isLoading={isStreaming}
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
