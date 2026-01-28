/**
 * PRD panel - displays the full PRD content
 */

import { Box, Text } from "ink";
import type { PRD } from "../../infrastructure/ralph/index.ts";
import { colors } from "../theme/colors.ts";

interface PrdPanelProps {
  prd: PRD | null;
}

export function PrdPanel({ prd }: PrdPanelProps) {
  if (!prd) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={colors.textMuted}>No PRD found.</Text>
        <Text color={colors.textMuted}>
          Use Claude Code in the terminal to create one.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Project & Status */}
      <Box flexDirection="column">
        <Text bold color={colors.text}>
          {prd.project}
        </Text>
        <Text color={prd.status === "approved" ? colors.accentGreen : colors.accentYellow}>
          Status: {prd.status}
        </Text>
      </Box>

      {/* Problem */}
      <Box flexDirection="column">
        <Text bold color={colors.accentBlue}>Problem</Text>
        <Text color={colors.textSecondary}>{prd.problem}</Text>
      </Box>

      {/* Goal */}
      <Box flexDirection="column">
        <Text bold color={colors.accentBlue}>Goal</Text>
        <Text color={colors.textSecondary}>{prd.goal}</Text>
      </Box>

      {/* Success Criteria */}
      <Box flexDirection="column">
        <Text bold color={colors.accentBlue}>Success Criteria</Text>
        {prd.success_criteria.map((criterion, i) => (
          <Text key={i} color={colors.textSecondary}>
            • {criterion}
          </Text>
        ))}
      </Box>

      {/* Constraints */}
      {prd.constraints.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={colors.accentBlue}>Constraints</Text>
          {prd.constraints.map((constraint, i) => (
            <Text key={i} color={colors.textSecondary}>
              • {constraint}
            </Text>
          ))}
        </Box>
      )}

      {/* Scope */}
      <Box flexDirection="column">
        <Text bold color={colors.accentBlue}>Scope</Text>
        <Box flexDirection="column" marginLeft={1}>
          <Text color={colors.accentGreen}>In:</Text>
          {prd.scope.in.map((item, i) => (
            <Text key={i} color={colors.textSecondary}>
              • {item}
            </Text>
          ))}
          {prd.scope.out.length > 0 && (
            <>
              <Text color={colors.accentRed}>Out:</Text>
              {prd.scope.out.map((item, i) => (
                <Text key={i} color={colors.textSecondary}>
                  • {item}
                </Text>
              ))}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
