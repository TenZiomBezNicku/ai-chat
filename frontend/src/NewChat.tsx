import { useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import { North, Close } from "@mui/icons-material";

const welcomeTexts = [
  "Ask me anything",
  "How can I help you?",
  "What can I help you with?",
  "What would you like to know?",
  "What’s on your mind?",
  "How can I assist you?",
  "What are you working on?",
  "What can we explore together?",
  "What would you like to do?",
  "Need a hand with something?",
  "Have a question?",
  "What can I help you figure out?",
  "What would you like to ask?",
  "Where should we start?",
  "What are you curious about?",
  "Tell me what you need",
  "What’s your question?",
  "How can I make things easier?",
  "What would you like help with?",
  "Ready when you are",
];

export default function NewChat({
  send,
  isSending,
}: {
  send: (message: string, attachments: string[]) => Promise<boolean>;
  isSending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState("");
  const [welcomeText] = useState(
    () => welcomeTexts[Math.floor(Math.random() * welcomeTexts.length)],
  );
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

    const imgs: string[] = [];

    for (const img of images) {
      imgs.push(await fileToBase64(img.file));
    }

    void send(outgoingMessage, imgs);
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

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    // URL do pokazania w <img>
    const url = URL.createObjectURL(file);
    setImages([...images, { url, file }]);
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center">
      <div className="flex w-full flex-col items-center">
        <h1 className="mb-8 text-3xl">{welcomeText}</h1>
        <form
          className="w-1/2 items-center rounded-4xl bg-neutral-700 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex">
            {images.map((img, idx) => (
              <div
                key={img.url}
                style={{
                  position: "relative",
                  width: "96px",
                  margin: "8px",
                }}
              >
                <img
                  src={img.url}
                  style={{
                    borderRadius: "8px",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                  }}
                />

                <button
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                  }}
                  onClick={() => {
                    setImages((prev) => prev.filter((_, i) => i !== idx));
                  }}
                >
                  <Close />
                </button>
              </div>
            ))}
          </div>
          <div className="flex">
            <button
              type="button"
              aria-label="Add attachment"
              onClick={openFilePicker}
            >
              <AddIcon />
            </button>
            <textarea
              placeholder="Ask for anything"
              aria-label="Message"
              className="mx-2 max-h-[75vh] w-full resize-none overflow-y-auto outline-0 h-6"
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
              <North />
            </button>
          </div>
        </form>
      </div>
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
