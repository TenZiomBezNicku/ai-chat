function ensureEncryptionKey(name: string): string {
  const existing = Deno.env.get(name);
  if (existing) return existing;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

  Deno.writeTextFileSync(".env", `\n${name}=${key}`, {
    append: true,
    create: true,
  });

  Deno.env.set(name, key);

  return key;
}

ensureEncryptionKey("API_KEYS_ENCRYPTION_KEY");
ensureEncryptionKey("KV_ENCRYPTION_KEY");
