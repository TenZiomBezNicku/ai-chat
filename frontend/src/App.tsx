import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Chat from "./Chat";
import NewChat from "./NewChat";
import Files from "./Files";
import AdminPanel from "./AdminPanel";
import Drawer from "@mui/material/Drawer";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";

type ChatSummary = { id: string; title: string | null };
type SidebarLinksProps = {
  chats: ChatSummary[];
  isAdmin: boolean;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
};

function SidebarLinks({
  chats,
  isAdmin,
  onNavigate,
  onLogout,
}: SidebarLinksProps) {
  return (
    <>
      <button
        className="my-1 h-10 w-[calc(100%-8px)] rounded-lg bg-neutral-800 p-2 text-left hover:bg-neutral-700"
        onClick={() => onNavigate("/")}
      >
        AI Chat
      </button>
      <button
        className="my-1 h-10 w-[calc(100%-8px)] rounded-lg bg-neutral-800 p-2 text-left hover:bg-neutral-700"
        onClick={() => onNavigate("/files")}
      >
        <span className="block truncate">Files</span>
      </button>
      <nav className="mt-4 flex-1 overflow-y-auto" aria-label="Chats">
        {chats.map((currentChat) => (
          <button
            className="my-1 h-10 w-[calc(100%-8px)] rounded-lg bg-neutral-800 p-2 text-left hover:bg-neutral-700"
            key={currentChat.id}
            onClick={() =>
              onNavigate(`/c/${encodeURIComponent(currentChat.id)}`)
            }
          >
            <span className="block truncate">
              {currentChat.title || "Chat"}
            </span>
          </button>
        ))}
      </nav>
      {isAdmin ? (
        <button
          className="my-1 h-10 w-[calc(100%-8px)] rounded-lg bg-neutral-800 p-2 text-left hover:bg-neutral-700"
          onClick={() => onNavigate("/admin")}
        >
          Admin Panel
        </button>
      ) : null}
      <button
        className="my-1 h-10 w-[calc(100%-8px)] rounded-lg bg-neutral-800 p-2 text-left hover:bg-neutral-700"
        onClick={onLogout}
      >
        Logout
      </button>
    </>
  );
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  model: string;
  searchingInternet: boolean;
  images: string[];
};
type StreamEvent =
  | { kind: "chatId"; chatId: string }
  | { kind: "response_final"; content: string }
  | { kind: "response_think"; content: string }
  | { kind: "tool_call"; tool: string; arguments: any }
  | { kind: "attachments"; attachments: string[] }
  | { kind: "done" }
  | { kind: "error"; error: string }
  | { kind: "title"; title: string };

class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

function parseStreamEvent(value: unknown): StreamEvent {
  if (typeof value !== "object" || value === null) {
    throw new Error("The server returned an invalid response.");
  }

  const event = value as Record<string, unknown>;
  if (event.kind === "chatId" && typeof event.chatId === "string") {
    return { kind: "chatId", chatId: event.chatId };
  }
  if (event.kind === "response_final" && typeof event.content === "string") {
    return { kind: "response_final", content: event.content };
  }
  if (event.kind === "response_think" && typeof event.content === "string") {
    return { kind: "response_think", content: event.content };
  }
  if (event.kind === "error" && typeof event.error === "string") {
    return { kind: "error", error: event.error };
  }
  if (event.kind === "done") {
    return { kind: "done" };
  }
  if (event.kind === "title" && typeof event.title === "string") {
    return { kind: "title", title: event.title };
  }
  if (event.kind === "tool_call" && typeof event.tool === "string") {
    return { kind: "tool_call", tool: event.tool, arguments: event.arguments };
  }
  if (event.kind === "attachments" && typeof event.attachments === "object") {
    return { kind: "attachments", attachments: event.attachments as string[] };
  }

  throw new Error("The server returned an invalid response.");
}

function chatIdFromPath(pathname: string) {
  const prefix = "/c/";
  const chatId = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : "";
  return chatId && !chatId.includes("/") ? chatId : null;
}

function pathIsFiles(pathname: string) {
  if (pathname === "/files") {
    return true;
  }

  if (pathname.startsWith("/files/")) {
    return pathname.slice("/files/".length);
  }

  return false;
}

function pathIsAdmin(pathname: string) {
  if (pathname == "/admin") return true;
  return false;
}

async function loadChats(signal?: AbortSignal): Promise<ChatSummary[]> {
  const response = await fetch("/api/v1/chats", {
    signal,
    credentials: "include",
  });
  if (response.status === 403 || response.status === 401)
    throw new UnauthorizedError();
  if (!response.ok) throw new Error("Unable to load the chat list.");

  const data: unknown = await response.json();
  if (!Array.isArray(data))
    throw new Error("The server returned an invalid chat list.");

  return data.filter(
    (chat): chat is ChatSummary =>
      typeof chat === "object" &&
      chat !== null &&
      typeof (chat as ChatSummary).id === "string" &&
      ((chat as ChatSummary).title === null ||
        typeof (chat as ChatSummary).title === "string"),
  );
}

async function loadMessages(
  chatId: string,
  signal: AbortSignal,
): Promise<ChatMessage[]> {
  const response = await fetch(`/api/v1/chat/${encodeURIComponent(chatId)}`, {
    signal,
    credentials: "include",
  });
  if (response.status === 403 || response.status === 401)
    throw new UnauthorizedError();
  if (!response.ok) throw new Error("Unable to load this chat.");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { messages?: unknown }).messages)
  ) {
    throw new Error("The server returned an invalid chat.");
  }

  return (data as { messages: unknown[] }).messages.filter(
    (message): message is ChatMessage =>
      typeof message === "object" &&
      message !== null &&
      ((message as ChatMessage).role === "user" ||
        (message as ChatMessage).role === "assistant") &&
      typeof (message as ChatMessage).content === "string" &&
      typeof (message as ChatMessage).model === "string",
  );
}

async function getModels() {
  const response = await fetch("/api/v1/models", {
    credentials: "include",
  });

  if (response.status === 403 || response.status === 401)
    throw new UnauthorizedError();
  if (!response.ok) throw new Error("Unable to load model list.");

  const models = await response.json();

  return models;
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [conversation, setConversation] = useState<{
    chatId: string | null;
    messages: ChatMessage[];
  }>({
    chatId: null,
    messages: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [me, setMe] = useState<{
    id: string;
    username: string;
    role: string;
  } | null>(null);
  const sendingRef = useRef(false);
  const chatId = chatIdFromPath(pathname);
  const messages = conversation.chatId === chatId ? conversation.messages : [];

  const navigate = useCallback((nextPathname: string, replace = false) => {
    window.history[replace ? "replaceState" : "pushState"](
      {},
      "",
      nextPathname,
    );
    setPathname(nextPathname);
  }, []);

  const handleUnauthorized = useCallback(() => {
    setIsAuthenticated(false);
    setError(null);
  }, []);

  const refreshChats = useCallback(() => {
    void loadChats()
      .then(setChats)
      .catch((reason: unknown) => {
        if (reason instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(
          reason instanceof Error ? reason.message : "Unable to load chats.",
        );
      });
  }, [handleUnauthorized]);

  const refreshModels = useCallback(async () => {
    try {
      const loadedModels = await getModels();

      setModels(loadedModels);

      if (loadedModels.length > 0) {
        setModel(`${loadedModels[0].provider}/${loadedModels[0].name}`);
      } else {
        setModel("");
      }
    } catch (reason) {
      if (reason instanceof UnauthorizedError) {
        handleUnauthorized();
        return;
      }
      setError(
        reason instanceof Error ? reason.message : "Unable to load the models.",
      );
      navigate("/", true);
    }
  }, [handleUnauthorized, navigate]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/me", { credentials: "include" });

      if (res.status === 403 || res.status === 401) {
        setIsAuthenticated(false);
        setMe(null);
        return null;
      }

      const json = await res.json();
      setMe(json);
      return json as {
        id: string;
        username: string;
        role: string;
      } | null;
    } catch {
      setMe(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!chatId || conversation.chatId === chatId) return;

    const controller = new AbortController();
    void loadMessages(chatId, controller.signal)
      .then((loadedMessages) => {
        setConversation({ chatId, messages: loadedMessages });
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setError(
          reason instanceof Error ? reason.message : "Unable to load the chat.",
        );
        navigate("/", true);
      });

    return () => controller.abort();
  }, [chatId, conversation.chatId, handleUnauthorized, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshModels();
  }, [isAuthenticated, refreshModels]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadCurrentUser();
  }, [isAuthenticated, loadCurrentUser]);

  const authenticate = useCallback(
    async (mode: "login" | "register", username: string, password: string) => {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        if (mode === "register" && response.status === 409) {
          throw new Error("Użytkownik o takim loginie już istnieje.");
        }
        throw new Error(
          mode === "login"
            ? "Nieprawidłowy login lub hasło."
            : "Nie udało się utworzyć konta.",
        );
      }

      setIsAuthenticated(true);
      setError(null);
      await refreshChats();
      await refreshModels();
      await loadCurrentUser();
    },
    [loadCurrentUser, refreshChats, refreshModels],
  );

  const send = useCallback(
    async (rawMessage: string, attachments: string[]) => {
      const message = rawMessage.trim();
      if (!message || sendingRef.current) return false;

      sendingRef.current = true;
      setIsSending(true);
      setError(null);

      if (chatId) {
        setConversation((current) => {
          if (current.chatId !== chatId) return current;

          return {
            ...current,
            messages: [
              ...current.messages,
              {
                role: "user",
                content: message,
                model,
                images: [],
                searchingInternet: false,
              },
              {
                role: "assistant",
                content: "",
                model,
                images: [],
                searchingInternet: false,
              },
            ],
          };
        });
      }

      try {
        const response = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ model, message, chatId, attachments }),
        });
        if (response.status === 403) {
          handleUnauthorized();
          return false;
        }
        if (!response.ok || !response.body)
          throw new Error("Unable to send the message.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let responseChatId = chatId;

        const appendResponse = (content: string) => {
          if (!responseChatId) return;
          setConversation((current) => {
            if (current.chatId !== responseChatId) return current;
            const lastMessage = current.messages.at(-1);
            if (!lastMessage || lastMessage.role !== "assistant")
              return current;
            return {
              ...current,
              messages: [
                ...current.messages.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + content },
              ],
            };
          });
        };

        const handleEvent = (event: StreamEvent) => {
          if (event.kind === "chatId") {
            responseChatId = event.chatId;
            if (!chatId) {
              navigate(`/c/${encodeURIComponent(event.chatId)}`);
              setConversation({
                chatId: event.chatId,
                messages: [
                  {
                    role: "user",
                    content: message,
                    model,
                    images: [],
                    searchingInternet: false,
                  },
                  {
                    role: "assistant",
                    content: "",
                    model,
                    images: [],
                    searchingInternet: false,
                  },
                ],
              });
            }
          } else if (event.kind === "response_final") {
            appendResponse(event.content);
          } else if (event.kind === "title") {
            setChats((current) =>
              current.map((currentChat) =>
                currentChat.id === responseChatId
                  ? { ...currentChat, title: event.title }
                  : currentChat,
              ),
            );
          } else if (event.kind === "tool_call") {
            if (event.tool === "web_search") {
              setConversation((current) => {
                const lastMessage = current.messages.at(-1);
                if (!lastMessage || lastMessage.role !== "assistant")
                  return current;
                return {
                  ...current,
                  messages: [
                    ...current.messages.slice(0, -1),
                    { ...lastMessage, searchingInternet: true },
                  ],
                };
              });
            }
          } else if (event.kind === "attachments") {
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              handleEvent(parseStreamEvent(JSON.parse(line)));
            } catch {
              throw new Error("The server returned an invalid response.");
            }
          }
          if (done) break;
        }

        if (buffer.trim()) handleEvent(parseStreamEvent(JSON.parse(buffer)));
        refreshChats();
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to send the message.",
        );
        return false;
      } finally {
        sendingRef.current = false;
        setIsSending(false);
      }
    },
    [chatId, handleUnauthorized, navigate, refreshChats, model],
  );

  const logout = useCallback(async () => {
    await fetch("/api/v1/logout", { method: "DELETE" });
    location.reload();
  }, []);

  const navigateFromMobileNav = useCallback(
    (nextPathname: string) => {
      setIsMobileNavOpen(false);
      navigate(nextPathname);
    },
    [navigate],
  );

  if (!isAuthenticated) {
    return <AuthScreen onSubmit={authenticate} />;
  }

  return (
    <div className="flex min-h-screen">
      <button
        type="button"
        aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isMobileNavOpen}
        className="fixed left-2 top-2 z-1400 flex size-10 items-center justify-center rounded-lg bg-neutral-800 text-white shadow md:hidden"
        onClick={() => setIsMobileNavOpen((open) => !open)}
      >
        {isMobileNavOpen ? <CloseIcon /> : <MenuIcon />}
      </button>
      <Drawer
        anchor="left"
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: "92vw",
            backgroundColor: "#101010",
            color: "white",
            borderRight: "1px solid #262626",
          },
        }}
      >
        <aside className="flex h-dvh flex-col overflow-y-auto p-3 pt-14">
          <SidebarLinks
            chats={chats}
            isAdmin={me?.role === "admin"}
            onNavigate={navigateFromMobileNav}
            onLogout={() => {
              setIsMobileNavOpen(false);
              void logout();
            }}
          />
        </aside>
      </Drawer>
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 flex-col p-3 md:flex">
        <SidebarLinks
          chats={chats}
          isAdmin={me?.role === "admin"}
          onNavigate={navigate}
          onLogout={() => void logout()}
        />
      </aside>

      <main className="flex min-w-0 flex-1 pt-24 md:ml-64 md:pt-0">
        {error && (
          <p className="fixed right-4 top-4 z-10 rounded bg-red-950 p-3 text-sm">
            {error}
          </p>
        )}
        {!(pathIsAdmin(pathname) || pathIsFiles(pathname)) ? (
          <select
            className="fixed right-2 top-14 z-10 max-w-[calc(100vw-1rem)] p-2 md:right-auto md:top-auto md:max-w-none md:p-4"
            onChange={(e) => {
              setModel(e.target.value);
            }}
            value={model}
          >
            {models.map((m: any) => (
              <option className="text-black" value={`${m.provider}/${m.name}`}>
                {m.name} - {m.provider}
              </option>
            ))}
          </select>
        ) : null}
        {chatId ? (
          <Chat send={send} messages={messages} isSending={isSending} />
        ) : pathIsFiles(pathname) ? (
          <Files />
        ) : pathIsAdmin(pathname) ? (
          <AdminPanel />
        ) : (
          <NewChat send={send} isSending={isSending} />
        )}
      </main>
    </div>
  );
}

function AuthScreen({
  onSubmit,
}: {
  onSubmit: (
    mode: "login" | "register",
    username: string,
    password: string,
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(mode, username, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Operation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">
          {mode === "login" ? "Login" : "Register"}
        </h1>

        <input
          className="w-full rounded bg-neutral-800 p-3"
          placeholder="Login"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <input
          className="w-full rounded bg-neutral-800 p-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          className="w-full rounded bg-blue-600 p-3 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {mode === "login" ? "Login" : "Register"}
        </button>
        <button
          type="button"
          className="w-full p-2 text-sm text-neutral-400 hover:text-white"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login"
            ? "Don't have account? Register now"
            : "Already have account? Login now"}
        </button>
      </form>
    </main>
  );
}
