import OpenAI from "openai";
import { ImgGenProvider } from "../AI.ts";
import { randomUUID } from "node:crypto";

export default class OpenAIProvider implements ImgGenProvider {
  id = "openai-image";

  private client: OpenAI;

  public constructor(client: OpenAI) {
    this.client = client;
  }

  async genImage(
    model: string,
    prompt: string,
  ): Promise<{ path: string; id: string } | undefined> {
    const img = await this.client.images.generate({
      prompt,
      model,
      output_format: "png",
      size: "auto",
    });

    if (!img.data) return undefined;

    const base64img = img.data[0].b64_json;

    if (!base64img) return undefined;

    const imageBuffer = Buffer.from(base64img, "base64");

    const id = randomUUID();
    const path = `./data/attachments/${id}.png`;

    await Deno.writeFile(path, imageBuffer);

    return { path, id };
  }
}
