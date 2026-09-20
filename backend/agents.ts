import {
  ChatEvent,
  ChatMessage,
  chatStream,
  ToolCall,
  ToolDefinition,
} from "./AI.ts";

const tools: ToolDefinition[] = [];
const functions: Map<string, (args: string) => Promise<string> | string> =
  new Map();

export function registerTool(
  func: (args: string) => Promise<string> | string,
  tool: ToolDefinition,
) {
  if (functions.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }

  tools.push(tool);
  functions.set(tool.name, func);
}

export async function* startAgent(
  messages: ChatMessage[],
  model: string,
  maxTurns: number = 6,
  system?: string,
): AsyncIterable<ChatEvent> {
  const history = [...messages];

  for (let i = 0; i < maxTurns; i++) {
    const res = await chatStream({
      messages: history,
      system,
      model,
      tools: tools,
    });

    let text = "";
    const toolCalls: ToolCall[] = [];

    for await (const chunk of res) {
      if (chunk.type === "text") {
        text += chunk.text;
        yield chunk;
      } else if (chunk.type === "reasoning") {
        yield chunk;
      } else if (chunk.type === "tool_call") {
        yield chunk;
        toolCalls.push(chunk);
      } else if (chunk.type === "error") {
        yield chunk;
        return;
      }
    }

    history.push({
      role: "assistant",
      content: text,
      ...(toolCalls.length ? { toolCalls } : {}),
    });

    if (!toolCalls.length) {
      yield { type: "done" };
      return;
    }

    for (const toolCall of toolCalls) {
      const func = functions.get(toolCall.name);

      if (!func) {
        yield { type: "error", error: `Unknown function: ${toolCall.name}` };
        return;
      }

      try {
        const result = await func(toolCall.arguments);

        history.push({
          role: "tool",
          content: result,
          toolCallId: toolCall.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        history.push({
          role: "tool",
          content: JSON.stringify({ error: message }),
          toolCallId: toolCall.id,
        });
      }
    }
  }

  yield { type: "error", error: "Agent reached the maximum number of turns" };
}

export function isToolRegistered(tool: string): boolean {
  return functions.has(tool);
}
