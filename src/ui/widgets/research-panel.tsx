/**
 * Research panel widget - displays research from log.jsonl with visual styling
 */

import { Box, Text } from "ink";
import type React from "react";
import type { ResearchEvent } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface ResearchPanelProps {
  research: ResearchEvent[];
  offset?: number;
  limit?: number;
}

type SourceType = "kaggle" | "paper" | "github" | "docs" | "blog" | "forum" | "other";

interface SourceConfig {
  type: SourceType;
  icon: string;
  color: string;
  label: string;
}

/**
 * Get configuration for research source type
 */
function getSourceConfig(source: string): SourceConfig {
  const lower = source.toLowerCase();

  if (lower.includes("kaggle")) {
    return { type: "kaggle", icon: "🏆", color: colors.accentYellow, label: "KAGGLE" };
  }
  if (lower.includes("paper") || lower.includes("arxiv") || lower.includes("research")) {
    return { type: "paper", icon: "📄", color: colors.accentPurple, label: "PAPER" };
  }
  if (lower.includes("github") || lower.includes("repo") || lower.includes("code")) {
    return { type: "github", icon: "💻", color: colors.accentGreen, label: "GITHUB" };
  }
  if (lower.includes("doc") || lower.includes("documentation") || lower.includes("guide")) {
    return { type: "docs", icon: "📚", color: colors.accentBlue, label: "DOCS" };
  }
  if (lower.includes("blog") || lower.includes("article") || lower.includes("post")) {
    return { type: "blog", icon: "📝", color: colors.accentCyan, label: "BLOG" };
  }
  if (lower.includes("stack") || lower.includes("overflow") || lower.includes("forum") || lower.includes("discuss")) {
    return { type: "forum", icon: "💬", color: colors.textSecondary, label: "FORUM" };
  }
  return { type: "other", icon: "🔍", color: colors.accentBlue, label: "SOURCE" };
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get relevance indicator based on insight content
 */
function getRelevanceIndicator(insight: string | undefined): { level: string; color: string; dots: string } {
  if (!insight) {
    return { level: "LOW", color: colors.textMuted, dots: "●○○" };
  }

  const lower = insight.toLowerCase();

  // High relevance: specific techniques, results, or actionable advice
  if (lower.includes("achieved") || lower.includes("improved") || lower.includes("solution") ||
      lower.includes("technique") || lower.includes("method") || lower.includes("accuracy")) {
    return { level: "HIGH", color: colors.accentGreen, dots: "●●●" };
  }

  // Medium relevance: general insights or partial information
  if (lower.includes("useful") || lower.includes("interesting") || lower.includes("approach") ||
      lower.includes("consider") || lower.includes("suggest")) {
    return { level: "MED", color: colors.accentYellow, dots: "●●○" };
  }

  // Low relevance: background info or context
  return { level: "LOW", color: colors.textMuted, dots: "●○○" };
}

/**
 * Summary bar showing research counts by source type
 */
function ResearchSummary({ research }: { research: ResearchEvent[] }) {
  const counts = {
    kaggle: research.filter(r => getSourceConfig(r.source).type === "kaggle").length,
    paper: research.filter(r => getSourceConfig(r.source).type === "paper").length,
    github: research.filter(r => getSourceConfig(r.source).type === "github").length,
    docs: research.filter(r => getSourceConfig(r.source).type === "docs").length,
    other: research.filter(r => !["kaggle", "paper", "github", "docs"].includes(getSourceConfig(r.source).type)).length,
  };

  return (
    <Box marginBottom={1}>
      {counts.kaggle > 0 && (
        <Box marginRight={2}>
          <Text backgroundColor={colors.accentYellow} color={colors.bgPrimary}> {counts.kaggle} </Text>
          <Text color={colors.textMuted}> Kaggle</Text>
        </Box>
      )}
      {counts.paper > 0 && (
        <Box marginRight={2}>
          <Text backgroundColor={colors.accentPurple} color={colors.bgPrimary}> {counts.paper} </Text>
          <Text color={colors.textMuted}> Papers</Text>
        </Box>
      )}
      {counts.github > 0 && (
        <Box marginRight={2}>
          <Text backgroundColor={colors.accentGreen} color={colors.bgPrimary}> {counts.github} </Text>
          <Text color={colors.textMuted}> GitHub</Text>
        </Box>
      )}
      {counts.docs > 0 && (
        <Box marginRight={2}>
          <Text backgroundColor={colors.accentBlue} color={colors.bgPrimary}> {counts.docs} </Text>
          <Text color={colors.textMuted}> Docs</Text>
        </Box>
      )}
      {counts.other > 0 && (
        <Box marginRight={2}>
          <Text backgroundColor={colors.bgTertiary} color={colors.text}> {counts.other} </Text>
          <Text color={colors.textMuted}> Other</Text>
        </Box>
      )}
      {research.length === 0 && (
        <Box>
          <Text backgroundColor={colors.accentBlue} color={colors.bgPrimary}> 0 </Text>
          <Text color={colors.textMuted}> Research</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Clickable link component using ANSI OSC 8 hyperlinks
 */
function ClickableLink({ url, children }: { url: string; children: React.ReactNode }) {
  // OSC 8 escape sequence for clickable links: \e]8;;URL\e\\TEXT\e]8;;\e\\
  const openSeq = `\x1b]8;;${url}\x1b\\`;
  const closeSeq = `\x1b]8;;\x1b\\`;

  return (
    <Text>
      {openSeq}
      {children}
      {closeSeq}
    </Text>
  );
}

export function ResearchPanel({ research, offset = 0, limit = 5 }: ResearchPanelProps) {
  if (research.length === 0) {
    return (
      <Box flexDirection="column" padding={2}>
        <Box marginBottom={1}>
          <Text color={colors.accentYellow}>{"◇ "}</Text>
          <Text color={colors.text}>No research yet</Text>
        </Box>
        <Text color={colors.textSecondary}>
          Research findings are collected as the agent explores solutions.
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.textMuted}>Sources include:</Text>
          <Text color={colors.textMuted}>  🏆 Kaggle discussions & solutions</Text>
          <Text color={colors.textMuted}>  📄 Academic papers & arxiv</Text>
          <Text color={colors.textMuted}>  💻 GitHub repositories & code</Text>
          <Text color={colors.textMuted}>  📚 Documentation & guides</Text>
          <Text color={colors.textMuted}>  📝 Blog posts & tutorials</Text>
        </Box>
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
    <Box flexDirection="column" paddingX={1}>
      {/* Summary */}
      <ResearchSummary research={research} />

      {/* Pagination info */}
      {(hasPrev || hasMore) && (
        <Box marginBottom={1}>
          <Text color={colors.textMuted}>
            Showing {safeOffset + 1}-{Math.min(safeOffset + limit, total)} of {total}
          </Text>
          <Text color={colors.textSecondary}> (j/k to scroll)</Text>
        </Box>
      )}

      {/* Research list */}
      {displayResearch.map((item, index) => (
        <ResearchCard key={`${item.ts}-${index}`} item={item} />
      ))}
    </Box>
  );
}

interface ResearchCardProps {
  item: ResearchEvent;
}

function ResearchCard({ item }: ResearchCardProps) {
  const config = getSourceConfig(item.source);
  const timeAgo = formatRelativeTime(item.ts);
  const relevance = getRelevanceIndicator(item.insight);

  // Type-safe access to optional fields
  const extendedItem = item as ResearchEvent & { url?: string; key_insights?: string[] };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={config.color}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      {/* Header row */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text>{config.icon} </Text>
          <Text color={config.color} bold>{item.source}</Text>
          <Text color={colors.textMuted}> • </Text>
          <Text color={colors.textMuted}>{timeAgo}</Text>
          <Text color={colors.textMuted}> • </Text>
          <Text color={relevance.color}>{relevance.dots}</Text>
        </Box>
        <Box>
          <Text backgroundColor={config.color} color={colors.bgPrimary}>
            {" "}{config.label}{" "}
          </Text>
        </Box>
      </Box>

      {/* Insight */}
      {item.insight && (
        <Box marginBottom={extendedItem.url || extendedItem.key_insights ? 1 : 0}>
          <Text color={colors.text}>{item.insight}</Text>
        </Box>
      )}

      {/* Key insights if available */}
      {extendedItem.key_insights && extendedItem.key_insights.length > 0 && (
        <Box flexDirection="column" marginBottom={extendedItem.url ? 1 : 0}>
          <Text color={colors.textMuted}>Key takeaways:</Text>
          {extendedItem.key_insights.map((insight, i) => (
            <Box key={i}>
              <Text color={colors.accentGreen}>  › </Text>
              <Text color={colors.textSecondary}>{insight}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* URL if available - clickable */}
      {extendedItem.url && (
        <Box
          borderStyle="single"
          borderColor={colors.border}
          paddingX={1}
        >
          <Text color={colors.textMuted}>🔗 </Text>
          <ClickableLink url={extendedItem.url}>
            <Text color={colors.accentCyan} underline>{extendedItem.url}</Text>
          </ClickableLink>
        </Box>
      )}
    </Box>
  );
}
