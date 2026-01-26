/**
 * Planning screen - PRD creation and knowledge viewing
 */

import { Box, Text } from "ink";
import { useAppStore } from "../../application/state/index.ts";
import { createChatMessage } from "../../domain/types/index.ts";
import { colors } from "../theme/colors.ts";
import { ChatPanel } from "../widgets/chat-panel.tsx";
import { LearningsPanel } from "../widgets/learnings-panel.tsx";
import { ResearchPanel } from "../widgets/research-panel.tsx";
import { StoryList } from "../widgets/story-list.tsx";
import { PlanningTabs } from "../widgets/tabs.tsx";

export function PlanningScreen() {
  const {
    prd,
    learnings,
    research,
    chatMessages,
    selectedTab,
    addChatMessage,
    inputMode,
  } = useAppStore();

  const handleSendMessage = (content: string) => {
    const userMessage = createChatMessage("user", content);
    addChatMessage(userMessage);

    // TODO: Actually send to Claude Code and handle response
    // For now, just add a placeholder response
    setTimeout(() => {
      const assistantMessage = createChatMessage(
        "assistant",
        "I received your message. Claude Code integration coming soon!",
      );
      addChatMessage(assistantMessage);
    }, 500);
  };

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
