/**
 * Tab navigation widget
 */

import { Box, Text } from "ink";
import { Fragment } from "react";
import { colors } from "../theme/colors.ts";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onSelect?: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab }: TabsProps) {
  return (
    <Box gap={1}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <Fragment key={tab.id}>
            <Text
              color={isActive ? colors.accentBlue : colors.textSecondary}
              bold={isActive}
            >
              [{isActive ? tab.label : tab.label}]
            </Text>
            {index < tabs.length - 1 && <Text color={colors.textMuted}> </Text>}
          </Fragment>
        );
      })}
    </Box>
  );
}

interface ModeTabsProps {
  activeMode: "planning" | "monitor";
  onSelect?: (mode: "planning" | "monitor") => void;
}

export function ModeTabs({ activeMode }: ModeTabsProps) {
  return (
    <Tabs
      tabs={[
        { id: "planning", label: "Planning" },
        { id: "monitor", label: "Monitor" },
      ]}
      activeTab={activeMode}
    />
  );
}

interface PlanningTabsProps {
  activeTab: "learnings" | "research" | "stories";
  onSelect?: (tab: "learnings" | "research" | "stories") => void;
}

export function PlanningTabs({ activeTab }: PlanningTabsProps) {
  return (
    <Tabs
      tabs={[
        { id: "stories", label: "Stories" },
        { id: "learnings", label: "Learnings" },
        { id: "research", label: "Research" },
      ]}
      activeTab={activeTab}
    />
  );
}
