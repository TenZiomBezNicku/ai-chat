import { type Message, Ollama, type Tool } from "ollama";
import {
  AIProvider,
  ChatEvent,
  ChatMessage,
  providerTypes,
  ToolDefinition,
} from "../AI.ts";

function toOllamaMessage(message: ChatMessage): Message {
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
    };
  }

  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content,
      tool_calls: message.toolCalls.map((toolCall) => ({
        function: {
          name: toolCall.name,
          arguments: JSON.parse(toolCall.arguments) as Record<string, unknown>,
        },
      })),
    };
  }

  if (message.role === "user") {
    return {
      role: message.role,
      content: message.content,
      images: message.images,
    };
  } else {
    return {
      role: message.role,
      content: message.content,
    };
  }
}

function toOllamaTools(tools: ToolDefinition[]): Tool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Tool["function"]["parameters"],
    },
  }));
}

export default class OllamaProvider implements AIProvider {
  capabilities = {
    streaming: true,
    tools: true,
    vision: true,
    reasoning: true,
  };

  private client: Ollama;

  public constructor(baseUrl: string, apiKey?: string) {
    this.client = new Ollama({
      host: baseUrl,
      headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : undefined,
    });
  }

  async models(): Promise<string[]> {
    const res = await this.client.list();

    return res.models.map((model) => model.name);
  }

  async *chatStream(
    model: string,
    messages: ChatMessage[],
    system?: string,
    tools?: ToolDefinition[],
  ): AsyncIterable<ChatEvent> {
    const input: Message[] = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages.map(toOllamaMessage),
    ];

    const res = await this.client.chat({
      stream: true,
      model,
      messages: input,
      tools: tools?.length ? toOllamaTools(tools) : undefined,
    });

    let toolCallIndex = 0;

    for await (const chunk of res) {
      if (chunk.message.thinking) {
        yield { type: "reasoning", text: chunk.message.thinking };

        continue;
      }

      if (chunk.message.tool_calls) {
        for (const toolCall of chunk.message.tool_calls) {
          yield {
            type: "tool_call",
            id: `ollama-call-${toolCallIndex++}`,
            name: toolCall.function.name,
            arguments: JSON.stringify(toolCall.function.arguments),
          };
        }

        continue;
      }

      yield { type: "text", text: chunk.message.content };
    }
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    system?: string,
  ): Promise<string> {
    const input: Message[] = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages.map(toOllamaMessage),
    ];

    const res = await this.client.chat({
      stream: false,
      model,
      messages: input,
    });

    return res.message.content;
  }
}

providerTypes.set("ollama", OllamaProvider);
