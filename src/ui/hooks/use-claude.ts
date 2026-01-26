/**
 * Hook for interacting with Claude Code in the chat panel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamEvent } from "../../infrastructure/claude/index.ts";
import { BunClaudeCodeClient } from "../../infrastructure/claude/index.ts";

const TYPING_SPEED = 5; // characters per frame
const TYPING_INTERVAL = 16; // ~60fps

interface UseClaudeOptions {
  projectPath: string;
}

interface UseClaudeReturn {
  sendMessage: (message: string) => Promise<void>;
  cancel: () => void;
  isLoading: boolean;
  currentText: string;
  displayText: string; // Animated text for streaming effect
  currentTool: string | null;
  sessionId: string | null;
  error: string | null;
}

export function useClaude(options: UseClaudeOptions): UseClaudeReturn {
  const clientRef = useRef<BunClaudeCodeClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Animate text to create streaming effect
  useEffect(() => {
    if (displayText.length >= currentText.length) {
      return;
    }

    const timer = setTimeout(() => {
      const nextLength = Math.min(
        displayText.length + TYPING_SPEED,
        currentText.length,
      );
      setDisplayText(currentText.slice(0, nextLength));
    }, TYPING_INTERVAL);

    return () => clearTimeout(timer);
  }, [currentText, displayText]);

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
      setDisplayText("");
      setCurrentTool(null);
      setError(null);

      let accumulatedText = "";

      try {
        for await (const event of client.execute(message, {
          continueConversation: sessionIdRef.current !== null,
        })) {
          processEvent(event, {
            onText: (text) => {
              accumulatedText += text;
              setCurrentText(accumulatedText);
            },
            onToolStart: (tool) => {
              setCurrentTool(tool);
            },
            onToolEnd: () => {
              setCurrentTool(null);
            },
            onDone: (sessionId) => {
              if (sessionId) {
                sessionIdRef.current = sessionId;
              }
            },
            onError: (msg) => {
              setError(msg);
            },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
        setCurrentTool(null);
      }
    },
    [getClient],
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
    displayText,
    currentTool,
    sessionId: sessionIdRef.current,
    error,
  };
}

/**
 * Process a stream event
 */
function processEvent(
  event: StreamEvent,
  handlers: {
    onText: (text: string) => void;
    onToolStart: (tool: string) => void;
    onToolEnd: () => void;
    onDone: (sessionId?: string) => void;
    onError: (message: string) => void;
  },
) {
  switch (event.type) {
    case "init":
      // Session initialized
      break;

    case "text":
      handlers.onText(event.content);
      break;

    case "tool_start":
      handlers.onToolStart(event.tool);
      break;

    case "tool_result":
      handlers.onToolEnd();
      break;

    case "done":
      handlers.onDone(event.sessionId);
      break;

    case "error":
      handlers.onError(event.message);
      break;
  }
}
