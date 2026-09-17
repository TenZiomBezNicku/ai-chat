import { Hono } from "hono";
import { streamText } from "hono/streaming";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "hono/deno";
import { chat, ChatMessage, models, registerProvider } from "./AI.ts";
import OllamaProvider from "./aiProviders/ollama.ts";
import { Ollama } from "ollama";
import OpenAIProvider from "./aiProviders/openai.ts";
import { OpenAI } from "openai/client.mjs";
import { tavily } from "@tavily/core";
import { registerTool } from "./agents.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { db } from "./db/client.ts";
import {
  attachments as attachs,
  chats,
  messageAttachments,
  messages,
  sessions,
  users,
} from "./db/schema.ts";
import { and, eq, lte } from "drizzle-orm";
import mime from "mime-types";
import { startAgent } from "./agents.ts";
import { hash, verify } from "bcrypt";
import { decodeHex, encodeHex } from "@std/encoding/hex";

const PRODUCTION_ENV =
  Deno.env.get("RODUCTION") === "true" || Deno.env.get("PRODUCTION") === "1";

Deno.mkdirSync("./data/attachments", { recursive: true });

async function deleteExpiredSessions() {
  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
}

deleteExpiredSessions();

registerProvider("ollama", new OllamaProvider(new Ollama()));

registerProvider(
  "ollama_cloud",
  new OllamaProvider(
    new Ollama({
      host: "https://ollama.com/",
    }),
  ),
);

registerProvider("openai", new OpenAIProvider(new OpenAI()));

const tavilyClient = tavily({
  apiKey: Deno.env.get("TAVILY_API_KEY"),
});

registerTool(
  (args) => {
    return JSON.stringify({
      result: new Intl.DateTimeFormat("sv-SE", {
        timeZone: JSON.parse(args).zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(new Date()),
    });
  },
  {
    name: "get_current_time",
    description: "Reads current time in `YYYY-MM-DD HH:mm:ss` format",
    parameters: {
      type: "object",
      properties: { zone: { type: "string", description: "Timezone" } },
      required: ["zone"],
      additionalProperties: false,
    },
  },
);

registerTool(
  async (args) => {
    const { query } = JSON.parse(args);

    const res = await tavilyClient.search(query, { searchDepth: "advanced" });

    return JSON.stringify(res);
  },
  {
    name: "web_search",
    description: "Searches for information on the Internet",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Search query" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
);

function parseDataUrl(dataUrl: string): {
  mimeType: string;
  base64: string;
} {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);

  if (!match) {
    throw new Error("Invalid base64 data URL");
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

const app = new Hono<{ Variables: { userId: string; sessionId: string } }>();

app.use("/api/v1/*", async (c, next) => {
  const token = getCookie(c, "token");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let tokenBytes: Uint8Array;

  try {
    tokenBytes = decodeHex(token);
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const hashedToken = await crypto.subtle.digest(
    "SHA-256",
    tokenBytes as Uint8Array<ArrayBuffer>,
  );

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, encodeHex(hashedToken)));

  if (session.length < 1) {
    return c.json({ error: "Invalid token" }, 401);
  }

  if (Date.now() >= session[0].expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, session[0].id));

    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", session[0].userId);
  c.set("sessionId", session[0].id);

  await next();
});

app.post("/api/v1/chat", async (c) => {
  const reqJson = (await c.req.json()) as {
    chatId?: string;
    model: string;
    message: string;
    attachments?: string[];
  };

  if (!reqJson.message)
    return c.json(
      { kind: "Bad request", error: 'Required "message" field was not given' },
      400,
    );

  if (!reqJson.model)
    return c.json(
      { kind: "Bad request", error: 'Required "model" field was not given' },
      400,
    );

  let chatId = reqJson.chatId;

  let genTitle = false;

  if (!chatId) {
    chatId = randomUUID();

    await db.insert(chats).values({
      createdAt: new Date(),
      updatedAt: new Date(),
      id: chatId,
      userId: c.get("userId"),
    });

    genTitle = true;
  } else {
    if (
      (
        await db
          .select()
          .from(chats)
          .where(and(eq(chats.id, chatId), eq(chats.userId, c.get("userId"))))
      ).length < 1
    ) {
      return c.status(404);
    }

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, c.get("userId"))));
  }

  const messageId = randomUUID();

  await db.insert(messages).values({
    chatId,
    content: reqJson.message,
    createdAt: new Date(),
    id: messageId,
    model: reqJson.model,
    role: "user",
  });

  const attachments = (reqJson.attachments ?? []) as string[];

  const images: string[] = [];

  const attachmentsEndpoints: string[] = [];

  for (const attachment of attachments) {
    const parsed = parseDataUrl(attachment);

    if (parsed.mimeType.startsWith("image/")) {
      images.push(parsed.base64);
    }

    const fileBytes = Uint8Array.fromBase64(parsed.base64);
    const attachmentHash = encodeHex(
      await crypto.subtle.digest("SHA-256", fileBytes),
    );
    const ext = mime.extension(parsed.mimeType);
    const existingAttachment = await db
      .select()
      .from(attachs)
      .where(
        and(
          eq(attachs.userId, c.get("userId")),
          eq(attachs.hash, attachmentHash),
        ),
      );
    const attachmentId = existingAttachment[0]?.id ?? randomUUID();

    if (existingAttachment.length === 0) {
      Deno.writeFileSync(
        `./data/attachments/${attachmentId}.${ext}`,
        fileBytes,
      );

      await db.insert(attachs).values({
        createdAt: new Date(),
        hash: attachmentHash,
        id: attachmentId,
        mimeType: parsed.mimeType,
        path: `./data/attachments/${attachmentId}.${ext}`,
        size: fileBytes.byteLength,
        userId: c.get("userId"),
      });
    }

    await db.insert(messageAttachments).values({
      attachmentId,
      messageId,
    });

    attachmentsEndpoints.push(`/api/v1/attachment/${attachmentId}`);
  }

  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId));

  const finalMessages: {
    role: string;
    content: string;
    images: string[];
  }[] = [];

  for (const msg of chatMessages) {
    const chatAttachments = await db
      .select({ mimeType: attachs.mimeType, path: attachs.path })
      .from(messageAttachments)
      .innerJoin(attachs, eq(messageAttachments.attachmentId, attachs.id))
      .where(eq(messageAttachments.messageId, msg.id));

    finalMessages.push({
      ...msg,
      images: chatAttachments.flatMap((img) => {
        if (img.mimeType.startsWith("image/")) {
          return [Deno.readFileSync(img.path).toBase64()];
        }
        return [];
      }),
    });
  }

  return streamText(c, async (stream) => {
    let clientConnected = true;

    stream.onAbort(() => {
      clientConnected = false;
    });

    const send = async (event: unknown) => {
      if (!clientConnected) return;

      try {
        await stream.writeln(JSON.stringify(event));
      } catch {
        clientConnected = false;
      }
    };

    const assistantMessageId = randomUUID();

    await send({
      kind: "chatId",
      messageId: assistantMessageId,
      chatId,
    });

    await send({
      kind: "attachments",
      attachments: attachmentsEndpoints,
    });

    try {
      const response = startAgent(
        finalMessages as ChatMessage[],
        reqJson.model,
        16,
      );

      let res = "";

      for await (const token of response) {
        switch (token.type) {
          case "text":
            res += token.text;

            await send({
              kind: "response_final",
              content: token.text,
            });
            break;

          case "done":
            await send({
              kind: "done",
            });
            break;

          case "reasoning":
            await send({
              kind: "response_think",
              content: token.text,
            });
            break;

          case "tool_call":
            await send({
              kind: "tool_call",
              tool: token.name,
              arguments: JSON.parse(token.arguments),
            });
            break;

          case "error":
            await send({
              kind: "error",
              error: token.error,
            });
            break;
        }
      }

      await db.insert(messages).values({
        chatId,
        content: res,
        createdAt: new Date(),
        id: assistantMessageId,
        model: reqJson.model,
        role: "assistant",
      });

      if (genTitle) {
        const title = await chat({
          model: reqJson.model,
          messages: [
            {
              content: `# User:\n${reqJson.message}\n\n# Assistant:\n${res}`,
              role: "user",
            },
          ],
          system:
            "Your task is to generate a short chat title based on the user's message and the assistant's response. Do not use markdown",
        });

        await db.update(chats).set({ title }).where(eq(chats.id, chatId));

        await send({
          kind: "title",
          title,
        });
      }
    } catch (error) {
      console.error("Chat generation failed:", error);

      await send({
        kind: "error",
        error: "Unknown error while generating response.",
      });
    }
  });
});

app.get("/api/v1/chat/:id", async (c) => {
  const chat = await db
    .select()
    .from(chats)
    .where(
      and(
        eq(chats.userId, c.get("userId")),
        eq(chats.id, c.req.param().id ?? ""),
      ),
    );

  if (chat.length == 0) {
    return c.status(404);
  }

  // const chatMessages = await db
  //   .select()
  //   .from(messages)
  //   .where(eq(messages.chatId, url.searchParams.get("chatId") ?? ""));

  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, c.req.param().id ?? ""));

  const finalMessages: {
    id: string;
    chatId: string;
    role: string;
    content: string;
    model: string;
    createdAt: Date;
    images: string[];
  }[] = [];

  for (const msg of chatMessages) {
    const chatAttachments = await db
      .select({ id: attachs.id, mimeType: attachs.mimeType })
      .from(messageAttachments)
      .innerJoin(attachs, eq(messageAttachments.attachmentId, attachs.id))
      .where(eq(messageAttachments.messageId, msg.id));

    finalMessages.push({
      ...msg,
      images: chatAttachments.flatMap((img) => {
        if (img.mimeType.startsWith("image/")) {
          return [`/api/v1/attachment/${img.id}`];
        }
        return [];
      }),
    });
  }

  return c.json({ chat: chat[0], messages: finalMessages });
});

app.get("/api/v1/chats", async (c) => {
  const userChats = await db
    .select()
    .from(chats)
    .orderBy(chats.updatedAt)
    .where(eq(chats.userId, c.get("userId")));

  return c.json(userChats.reverse());
});

app.get("/api/v1/models", async (c) => {
  return c.json(await models());
});

app.get("/api/v1/attachment/:id", async (c) => {
  const id = c.req.param().id;

  const attachments = await db
    .select()
    .from(attachs)
    .where(and(eq(attachs.id, id), eq(attachs.userId, c.get("userId"))));

  if (attachments.length < 1) {
    return c.status(404);
  }

  const img = Deno.readFileSync(attachments[0].path);

  return c.body(img.buffer, 200, {
    "Content-Type": attachments[0].mimeType,
  });
});

app.get("/api/v1/files", async (c) => {
  const userId = c.get("userId");

  return c.json(
    (await db.select().from(attachs).where(eq(attachs.userId, userId))).map(
      (v) => {
        return {
          id: v.id,
          createdAt: v.createdAt,
          mimeType: v.mimeType,
          size: v.size,
        };
      },
    ),
  );
});

app.get("/api/v1/files/:id", async (c) => {
  const userId = c.get("userId");

  return c.json(
    (
      await db
        .select({
          id: attachs.id,
          createdAt: attachs.createdAt,
          mimeType: attachs.mimeType,
          size: attachs.size,
        })
        .from(attachs)
        .where(
          and(eq(attachs.userId, userId), eq(attachs.id, c.req.param("id"))),
        )
    )[0],
  );
});

app.delete("/api/v1/logout", async (c) => {
  const sessionId = c.get("sessionId");

  await db.delete(sessions).where(eq(sessions.id, sessionId));

  deleteCookie(c, "token");

  return c.redirect("/");
});

app.post("/api/auth/register", async (c) => {
  const { username, password } = await c.req.json();

  if (
    (await db.select().from(users).where(eq(users.username, username))).length >
    0
  ) {
    return c.status(409);
  }

  const id = randomUUID();

  const passwordHash = await hash(password);

  db.transaction((tx) => {
    const hasUsers =
      tx.select({ id: users.id }).from(users).limit(1).all().length > 0;

    tx.insert(users)
      .values({
        createdAt: new Date(),
        id,
        passwordHash,
        username,
        role: hasUsers ? "user" : "admin",
      })
      .run();
  });

  const token = randomBytes(64);

  const sessionId = randomUUID();

  setCookie(c, "token", token.toHex(), {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: PRODUCTION_ENV,
    maxAge: 14 * 24 * 60 * 60,
  });

  const hashedToken = await crypto.subtle.digest(
    "SHA-256",
    token as Uint8Array<ArrayBuffer>,
  );

  await db.insert(sessions).values({
    id: sessionId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    tokenHash: encodeHex(hashedToken),
    userId: id,
  });

  return c.json({ userId: id, sessionId }, 201);
});

app.post("/api/auth/login", async (c) => {
  const { username, password } = await c.req.json();

  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  if (user.length == 0) {
    return c.status(401);
  }

  if (!(await verify(password, user[0].passwordHash))) {
    return c.status(401);
  }

  const token = randomBytes(64);

  const sessionId = randomUUID();

  setCookie(c, "token", token.toHex(), {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: PRODUCTION_ENV,
    maxAge: 14 * 24 * 60 * 60,
  });

  const hashedToken = await crypto.subtle.digest(
    "SHA-256",
    token as Uint8Array<ArrayBuffer>,
  );

  await db.insert(sessions).values({
    id: sessionId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    tokenHash: encodeHex(hashedToken),
    userId: user[0].id,
  });

  return c.json({ userId: user[0].id, sessionId });
});

app.use(
  "/*",
  serveStatic({
    root: "./dist",
  }),
);

app.on(
  "GET",
  ["/", "/c/:id", "/files"],
  serveStatic({
    path: "./dist/index.html",
  }),
);

setInterval(deleteExpiredSessions, 15 * 60 * 1000);

Deno.serve(
  {
    port: Number(Deno.env.get("PORT") ?? 3000),
    hostname: Deno.env.get("HOST") ?? "0.0.0.0",
  },
  app.fetch,
);
