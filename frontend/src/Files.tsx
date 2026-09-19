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
      <div className="p-8">
        <h1 className="text-3xl">User files</h1>
        <div>
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
                    width: "256px",
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
