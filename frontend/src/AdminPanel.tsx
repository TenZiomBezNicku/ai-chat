import { Add } from "@mui/icons-material";
import { useEffect, useState } from "react";
import {
  Checkbox,
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
  const [models, setModels] = useState<
    {
      isPublic: number;
      provider: string;
      name: string;
      maxMonthlyTokens: number;
      maxSessionTokens: number;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const providers = await fetch("/api/v1/admin/providers");

      const json = await providers.json();

      setProviders(json);
    })();

    (async () => {
      const models = await fetch("/api/v1/admin/models");

      const json = await models.json();

      setModels(json);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-8">
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-0">
                <div className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-neutral-800 md:max-h-none md:overflow-visible md:p-6">
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

            <h3 className="text-xl">Models Settings</h3>
            <div className="p-4">
              {models.map((m) => (
                <div className="p-4">
                  <h4 className="text-lg">{`${m.provider}/${m.name}`}</h4>
                  <div>
                    <ThemeProvider
                      theme={createTheme({
                        palette: {
                          mode: "dark",
                        },
                      })}
                    >
                      <label>Is Public:</label>
                      <Checkbox
                        defaultChecked={m.isPublic == 0 ? false : true}
                        onChange={async (e) => {
                          await fetch(`/api/v1/admin/model`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              model: `${m.provider}/${m.name}`,
                              is_public: e.target.checked,
                            }),
                          });
                        }}
                      />

                      <br />

                      <TextField
                        label="Max Monthly Tokens"
                        type="number"
                        className="w-full md:w-55.75"
                        defaultValue={m.maxMonthlyTokens}
                        onBlur={async (e) => {
                          await fetch(`/api/v1/admin/model`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              model: `${m.provider}/${m.name}`,
                              monthlyQuota: Number(e.target.value),
                            }),
                          });
                        }}
                      />

                      <TextField
                        label="Max Session Tokens (5-hour)"
                        type="number"
                        className="w-full md:w-55.75"
                        defaultValue={m.maxSessionTokens}
                        onBlur={async (e) => {
                          await fetch(`/api/v1/admin/model`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              model: `${m.provider}/${m.name}`,
                              sessionQuota: Number(e.target.value),
                            }),
                          });
                        }}
                      />
                    </ThemeProvider>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
