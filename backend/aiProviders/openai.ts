import OpenAI from "openai";
import {
  AIProvider,
  ChatEvent,
  ChatMessage,
  ToolDefinition,
} from "../AI.ts";

function toOpenAIInput(messages: ChatMessage[]): OpenAI.Responses.ResponseInput {
  const input = messages.flatMap((message): unknown[] => {
    if (message.role === "tool") {
      return [{
        type: "function_call_output" as const,
        call_id: message.toolCallId,
        output: message.content,
      }];
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      return [
        ...(message.content
          ? [{
            type: "message" as const,
            role: "assistant" as const,
            content: message.content,
          }]
          : []),
        ...message.toolCalls.map((toolCall) => ({
          type: "function_call" as const,
          call_id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        })),
      ];
    }

    return [{
      role: message.role,
      content: message.content,
    }];
  });

  return input as OpenAI.Responses.ResponseInput;
}

function toOpenAIResponsesTools(
  tools: ToolDefinition[],
): OpenAI.Responses.Tool[] {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as unknown as Record<string, unknown>,
    strict: true,
  }));
}

export default class OpenAIProvider implements AIProvider {
  id = "openai-responses";
  capabilities = {
    streaming: true,
    tools: true,
    vision: true,
    reasoning: true,
  };

  private client: OpenAI;

  public constructor(client: OpenAI) {
    this.client = client;
  }

  async models(): Promise<string[]> {
    const res = await this.client.models.list();

    return res.data.map((m: OpenAI.Models.Model) => m.id);
  }

  async *chatStream(
    model: string,
    messages: ChatMessage[],
    system?: string,
    tools?: ToolDefinition[],
  ): AsyncIterable<ChatEvent> {
    const input: OpenAI.Responses.ResponseInput = system
      ? [{
        content: system,
        role: "system",
      }, ...toOpenAIInput(messages)]
      : toOpenAIInput(messages);

    let processedTools: OpenAI.Responses.Tool[] | undefined = undefined;

    if (tools) processedTools = toOpenAIResponsesTools(tools);

    const res = await this.client.responses.create({
      stream: true,
      input,
      model,
      tools: processedTools,
    });

    for await (const chunk of res) {
      if (chunk.type === "response.output_text.delta") {
        yield { type: "text", text: chunk.delta };
      } else if (chunk.type === "response.reasoning_text.delta") {
        yield { type: "reasoning", text: chunk.delta };
      } else if (chunk.type === "response.completed") {
        yield { type: "done" };
        return;
      } else if (chunk.type === "response.output_item.done") {
        if (chunk.item.type == "function_call") {
          yield {
            type: "tool_call",
            arguments: chunk.item.arguments,
            id: chunk.item.call_id,
            name: chunk.item.name,
          };
        }
      } else if (chunk.type === "error") {
        yield {
          type: "error",
          error: chunk.message,
        };
      }
    }
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    system?: string,
  ): Promise<string> {
    const input: OpenAI.Responses.ResponseInput = system
      ? [{
        content: system,
        role: "system",
      }, ...toOpenAIInput(messages)]
      : toOpenAIInput(messages);

    const res = await this.client.responses.create({
      stream: false,
      input,
      model,
    });

    return res.output_text;
  }
}