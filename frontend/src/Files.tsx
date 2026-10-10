import { useEffect, useState } from "react";

export default function Files() {
  const [files, setFiles] = useState<
    {
      mimeType: string;
      id: string;
      createdAt: Date;
      size: number;
      name: string;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/files");
      const json = await res.json();

      setFiles(json);
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-8">
        <h1 className="text-3xl">User files</h1>
        <div className="flex flex-wrap gap-2 md:block md:gap-0">
          {files.map((v) => {
            if (v.mimeType.startsWith("image/")) {
              return (
                <img
                  src={`/api/v1/attachment/${v.id}`}
                  style={{
                    borderRadius: "8px",
                    objectFit: "cover",
                    aspectRatio: "1 / 1",
                    width: "128px",
                  }}
                />
              );
            } else {
              return (
                <div
                  style={{
                    width: "min(256px, 100%)",
                    height: "128px",
                    borderWidth: "1px",
                    borderRadius: "8px",
                  }}
                >
                  {v.name}
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
