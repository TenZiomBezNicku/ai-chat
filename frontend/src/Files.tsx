import { useEffect, useState } from "react";

export default function Files() {
  const [files, setFiles] = useState<
    {
      mimeType: string;
      id: string;
      createdAt: Date;
      size: number;
    }[]
  >([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/v1/files");
      const json = await res.json();

      setFiles(json);
    })();
  });

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
                    width: "192px"
                  }}
                />
              );
            } else {
              return <div>{v.id}</div>;
            }
          })}
        </div>
      </div>
    </div>
  );
}
