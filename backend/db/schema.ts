import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),

  chatId: text("chat_id").notNull(),

  role: text("role").notNull(),

  content: text("content").notNull(),

  model: text("model").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),

    userId: text("user_id").notNull(),

    name: text("name").notNull(),

    hash: text("hash").notNull(),

    path: text("path").notNull(),

    mimeType: text("mime_type").notNull(),

    size: integer("size").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique("attachments_user_hash_unique").on(table.userId, table.hash),
  ],
);

export const messageAttachments = sqliteTable(
  "message_attachments",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),

    attachmentId: text("attachment_id")
      .notNull()
      .references(() => attachments.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.messageId, table.attachmentId],
    }),
  ],
);

export const modelsSettings = sqliteTable("models_settings", {
  id: text("id").primaryKey(),
  modelName: text("model_name").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const encryptedKV = sqliteTable("encrypted_kv", {
  key: text("key").primaryKey(),
  value: blob("value").notNull(),
  iv: blob("iv").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(),
  apiKey: blob("api_key"),
  iv: blob("iv"),
  providerId: text("provider_id").notNull(),
  baseUrl: text("base_url").notNull(),
});
