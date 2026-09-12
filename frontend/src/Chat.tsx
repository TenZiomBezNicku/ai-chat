import { useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import NorthIcon from "@mui/icons-material/North";
import { Close } from "@mui/icons-material";
import type { ChatMessage } from "./App";
import Markdown from "./Markdown";

export default function Chat({
  send,
  messages,
  isSending,
}: {
  send: (message: string, attachments: string[]) => Promise<boolean>;
  messages: ChatMessage[];
  isSending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState("");
  const [images, setImages] = useState<
    {
      file: File;
      url: string;
    }[]
  >([]);

  const canSend = message.trim().length > 0 && !isSending;
  const submit = async () => {
    if (!canSend) return;

    const outgoingMessage = message;
    setMessage("");

    const attachments: string[] = [];

    for (const image of images) {
      attachments.push(await fileToBase64(image.file));
    }

    void send(outgoingMessage, attachments);
  };

  function openFilePicker() {
    inputRef.current?.click();
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Invalid FileReader result"));
          return;
        }

        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsDataURL(file);
    });
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    setImages((current) => [...current, { url, file }]);
  };

  return (
    <div className="flex min-h-screen flex-1 justify-center pb-28">
      <div className="w-4/7 wrap-break-word py-4">
        {messages.map((currentMessage, index) => (
          <div
            className={
              currentMessage.role === "user"
                ? "my-8 ml-auto w-2/3 whitespace-pre-wrap rounded bg-neutral-700 p-2 prose prose-invert max-w-none"
                : "my-8 w-full whitespace-pre-wrap prose prose-invert max-w-none"
            }
            key={`${currentMessage.role}-${index}`}
          >
            {currentMessage.images.map((image) => (
              <img
                src={image}
                style={{
                  width: "96px",
                  borderRadius: "8px",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                }}
              />
            ))}
            <Markdown content={currentMessage.content} />
          </div>
        ))}
      </div>
      <form
        className="fixed bottom-6 flex w-full flex-col items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex">
          {images.map((image, index) => (
            <div
              key={image.url}
              style={{
                position: "relative",
                width: "96px",
                margin: "8px",
              }}
            >
              <img
                src={image.url}
                style={{
                  borderRadius: "8px",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                }}
              />
              <button
                type="button"
                aria-label="Remove attachment"
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                }}
                onClick={() => {
                  setImages((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index),
                  );
                }}
              >
                <Close />
              </button>
            </div>
          ))}
        </div>
        <div className="flex w-1/2 items-center rounded-4xl bg-neutral-700 p-4">
          <button type="button" aria-label="Add attachment" onClick={openFilePicker}>
            <AddIcon />
          </button>
          <textarea
            placeholder="Ask for anything"
            aria-label="Message"
            className="mx-2 h-6 w-full resize-none outline-0"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);

              event.target.style.height = "24px";
              event.target.style.height = `${event.target.scrollHeight}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" aria-label="Send message" disabled={!canSend}>
            <NorthIcon />
          </button>
        </div>
      </form>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        hidden
      />
    </div>
  );
}
