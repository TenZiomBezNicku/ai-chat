import { useEffect, useState } from "react";

export default function Settings() {
  const [models, setModels] = useState<
    {
      provider: string;
      name: string;
    }[]
  >([]);

  const [model, setModel] = useState<string | undefined>(undefined);

  useEffect(() => {
    setModel(localStorage.getItem("defaultModel") ?? undefined);

    (async () => {
      const response = await fetch("/api/v1/models", {
        credentials: "include",
      });

      setModels(await response.json());
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-8">
        <h1 className="text-3xl">Settings</h1>
        <div className="flex flex-wrap gap-2 md:block md:gap-0 p-2">
          <label>Default Model</label>
          <br />
          <select
            value={model}
            onChange={(e) => {
              if (e.target.value == "none") {
                localStorage.removeItem("defaultModel");
                setModel(undefined);
              } else {
                localStorage.setItem("defaultModel", e.target.value);
                setModel(e.target.value);
              }
            }}
          >
            <option value={"none"}>none</option>
            {models.map((m) => (
              <option
                className="text-black"
                value={`${m.provider}/${m.name}`}
              >{`${m.name} - ${m.provider}`}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
