export interface ChatRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

export type ChatMessage =
  | {
    role: "user";
    content: string;
    images?: string[];
  }
  | {
    role: "assistant";
    content: string;
    images?: string[];
    toolCalls?: ToolCall[];
  }
  | {
    role: "tool";
    content: string;
    toolCallId: string;
  };

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ChatEvent =
  | {
    type: "text";
    text: string;
  }
  | {
    type: "reasoning";
    text: string;
  }
  | {
    type: "tool_call";
    id: string;
    name: string;
    arguments: string;
  }
  | {
    type: "done";
  }
  | {
    type: "error";
    error: string;
  };

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters: JSONSchema;
}

export type JSONSchema =
  | JSONSchemaObject
  | JSONSchemaArray
  | JSONSchemaString
  | JSONSchemaNumber
  | JSONSchemaInteger
  | JSONSchemaBoolean
  | JSONSchemaNull;

export interface JSONSchemaBase {
  description?: string;
  title?: string;
  default?: unknown;
  enum?: unknown[];
}

export interface JSONSchemaObject extends JSONSchemaBase {
  type: "object";
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean;

  [key: string]: unknown;
}

export interface JSONSchemaArray extends JSONSchemaBase {
  type: "array";
  items?: JSONSchema;
  minItems?: number;
  maxItems?: number;
}

export interface JSONSchemaString extends JSONSchemaBase {
  type: "string";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface JSONSchemaNumber extends JSONSchemaBase {
  type: "number";
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
}

export interface JSONSchemaInteger extends JSONSchemaBase {
  type: "integer";
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
}

export interface JSONSchemaBoolean extends JSONSchemaBase {
  type: "boolean";
}

export interface JSONSchemaNull extends JSONSchemaBase {
  type: "null";
}

export interface AIProvider {
  readonly id: string;

  readonly capabilities: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    reasoning: boolean;
  };

  chatStream(
    model: string,
    messages: ChatMessage[],
    system?: string,
    tools?: ToolDefinition[],
  ): AsyncIterable<ChatEvent>;

  chat(
    model: string,
    messages: ChatMessage[],
    system?: string,
  ): Promise<string>;

  models(): Promise<string[]>;
}

const providers: Map<string, AIProvider> = new Map();

export function registerProvider(id: string, provider: AIProvider) {
  providers.set(id, provider);
}

export async function models(
  provider?: string,
): Promise<{ provider: string; name: string }[]> {
  if (provider) {
    const p = providers.get(provider);

    if (!p) throw new Error("Invalid Provider");

    const models = (await p.models()).map((m) => {
      return {
        name: m,
        provider,
      };
    });

    return models;
  }

  const models: { provider: string; name: string }[] = [];

  for (const p of providers) {
    (await p[1].models()).forEach((m) => {
      models.push({
        name: m,
        provider: p[0],
      });
    });
  }

  return models;
}

export async function* chatStream(
  request: ChatRequest,
): AsyncIterable<ChatEvent> {
  const [providerId, ...modelParts] = request.model.split("/");
  const model = modelParts.join("/");

  const provider = providers.get(providerId);

  if (provider) {
    const response = provider.chatStream(
      model,
      request.messages,
      request.system,
      request.tools,
    );

    for await (const chunk of response) {
      yield chunk;
    }

    return;
  }
}

export function chat(request: ChatRequest): Promise<string> {
  const [providerId, ...modelParts] = request.model.split("/");
  const model = modelParts.join("/");

  const provider = providers.get(providerId);

  if (provider) {
    return provider.chat(
      model,
      request.messages,
      request.system,
    );
  }

  throw new Error("Provider not found!");
}
