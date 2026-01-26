/**
 * Hook for interacting with Claude Code in the chat panel
 */

import { useCallback, useRef, useState } from "react";
import type { StreamEvent } from "../../infrastructure/claude/index.ts";
import { BunClaudeCodeClient } from "../../infrastructure/claude/index.ts";

interface UseClaudeOptions {
  projectPath: string;
  systemPrompt?: string;
}

interface UseClaudeReturn {
  sendMessage: (message: string) => Promise<void>;
  cancel: () => void;
  isLoading: boolean;
  currentText: string;
  currentTool: string | null;
  sessionId: string | null;
}

interface StreamCallbacks {
  onText?: (text: string) => void;
  onToolStart?: (tool: string, description?: string) => void;
  onToolEnd?: () => void;
  onDone?: (sessionId?: string) => void;
  onError?: (message: string) => void;
}

export function useClaude(
  options: UseClaudeOptions,
  callbacks?: StreamCallbacks,
): UseClaudeReturn {
  const clientRef = useRef<BunClaudeCodeClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  // Initialize client lazily
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new BunClaudeCodeClient(options.projectPath);
    }
    return clientRef.current;
  }, [options.projectPath]);

  const sendMessage = useCallback(
    async (message: string) => {
      const client = getClient();
      setIsLoading(true);
      setCurrentText("");
      setCurrentTool(null);

      let accumulatedText = "";

      try {
        for await (const event of client.execute(message, {
          systemPrompt: options.systemPrompt,
          continueConversation: sessionIdRef.current !== null,
          resumeSession: sessionIdRef.current ?? undefined,
        })) {
          handleStreamEvent(event, {
            onText: (text) => {
              accumulatedText += text;
              setCurrentText(accumulatedText);
              callbacks?.onText?.(text);
            },
            onToolStart: (tool, description) => {
              setCurrentTool(tool);
              callbacks?.onToolStart?.(tool, description);
            },
            onToolEnd: () => {
              setCurrentTool(null);
              callbacks?.onToolEnd?.();
            },
            onDone: (sessionId) => {
              if (sessionId) {
                sessionIdRef.current = sessionId;
              }
              callbacks?.onDone?.(sessionId);
            },
            onError: callbacks?.onError,
          });
        }
      } finally {
        setIsLoading(false);
        setCurrentTool(null);
      }
    },
    [getClient, options.systemPrompt, callbacks],
  );

  const cancel = useCallback(() => {
    if (clientRef.current?.isRunning()) {
      clientRef.current.cancel();
    }
  }, []);

  return {
    sendMessage,
    cancel,
    isLoading,
    currentText,
    currentTool,
    sessionId: sessionIdRef.current,
  };
}

/**
 * Handle a stream event and dispatch to appropriate callbacks
 */
function handleStreamEvent(event: StreamEvent, callbacks: StreamCallbacks) {
  switch (event.type) {
    case "init":
      // Session initialized
      break;

    case "text":
      callbacks.onText?.(event.content);
      break;

    case "tool_start":
      callbacks.onToolStart?.(event.tool, event.description);
      break;

    case "tool_result":
      callbacks.onToolEnd?.();
      break;

    case "done":
      callbacks.onDone?.(event.sessionId);
      break;

    case "error":
      callbacks.onError?.(event.message);
      break;
  }
}
