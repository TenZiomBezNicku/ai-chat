import { Add } from "@mui/icons-material";
import { useEffect, useState } from "react";
import {
  createTheme,
  MenuItem,
  Select,
  TextField,
  ThemeProvider,
} from "@mui/material";

export default function AdminPanel() {
  const [providers, setProviders] = useState<
    { id: string; providerId: string; baseUrl: string }[]
  >([]);

  const [baseUrl, setBaseUrl] = useState("");
  const [llmApiKey, setLLMApiKey] = useState("");
  const [webApiKey, setWebApiKey] = useState("");
  const [namespace, setNamespace] = useState("");
  const [provider, setProvider] = useState("ollama");
  const [addingProvider, setAddingProvider] = useState(false);

  useEffect(() => {
    (async () => {
      const providers = await fetch("/api/v1/admin/providers");

      const json = await providers.json();

      setProviders(json);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="p-8">
        <h1 className="text-3xl">Admin settings</h1>
        <div>
          <div>
            <h3 className="text-xl">Providers</h3>

            <button
              className="rounded-full hover:bg-neutral-600"
              onClick={() => setAddingProvider(true)}
            >
              <Add />
            </button>

            {addingProvider ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-800">
                  <h2 className="text-lg font-semibold">Add Provider</h2>

                  <br />

                  <ThemeProvider
                    theme={createTheme({
                      palette: {
                        mode: "dark",
                      },
                    })}
                  >
                    <TextField
                      fullWidth={true}
                      label="Provider ID/namespace"
                      onChange={(e) => setNamespace(e.target.value)}
                    />
                    <br />
                    <br />

                    <Select
                      fullWidth={true}
                      defaultValue="ollama"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    >
                      <MenuItem value="ollama">Ollama</MenuItem>
                      <MenuItem value="openai-responses">OpenAI</MenuItem>
                    </Select>
                    <br />
                    <br />

                    <TextField
                      fullWidth={true}
                      label="Base URL"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                    <br />
                    <br />

                    <TextField
                      fullWidth={true}
                      label="API Key (optional)"
                      type="password"
                      value={llmApiKey}
                      onChange={(e) => setLLMApiKey(e.target.value)}
                    />
                  </ThemeProvider>

                  <div className="mt-6 flex justify-end">
                    <button
                      className="rounded-lg bg-neutral-600 px-4 py-2 text-white hover:bg-neutral-500 mr-2"
                      onClick={() => setAddingProvider(false)}
                    >
                      Cancel
                    </button>

                    <button
                      className="rounded-lg bg-neutral-600 px-4 py-2 text-white hover:bg-neutral-500"
                      onClick={async () => {
                        if (baseUrl == "") return;

                        if (namespace == "") return;

                        if (provider == "") return;

                        await fetch("/api/v1/admin/provider", {
                          method: "POST",
                          body: JSON.stringify({
                            baseUrl,
                            apiKey: llmApiKey == "" ? null : llmApiKey,
                            id: namespace,
                            providerId: provider,
                          }),
                        });

                        setAddingProvider(false);
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              {providers.map((p) => (
                <div className="p-4">
                  <div className="text-xl font-medium mb-2">{p.id}</div>

                  <div className="text-sm">
                    <span className="text-gray-500">Provider:</span>{" "}
                    <code>{p.providerId}</code>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Base URL:</span>{" "}
                    <code>{p.baseUrl}</code>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-xl">Web Search</h3>
            <div className="p-4">
              <ThemeProvider
                theme={createTheme({
                  palette: {
                    mode: "dark",
                  },
                })}
              >
                <TextField
                  type="password"
                  label="Tavily API Key"
                  value={webApiKey}
                  onChange={(e) => setWebApiKey(e.target.value)}
                />
                <br />

                <button
                  className="rounded-lg bg-neutral-600 px-4 py-2 text-white hover:bg-neutral-500 mt-2"
                  onClick={async () => {
                    await fetch("/api/v1/admin/websearch", {
                      method: "PUT",
                      body: JSON.stringify({ apiKey: webApiKey }),
                    });
                  }}
                >
                  Set
                </button>
              </ThemeProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
