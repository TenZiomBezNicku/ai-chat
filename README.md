# ai-chat

Chat with LLMs in your browser using Ollama or any OpenAI-compatible API!

> [!WARNING]
> This project is still in the early stages of development! Do not use it in a production environment.

## Requirements
- Deno
- Node.js
- npm
- Ollama (optional)


## How to run

1. Rename `backend/.env.example` to `backend/.env`:
```bash
mv backend/.env.example backend/.env
```
2. Fill in the `backend/.env` file - Open this file in your favorite text editor and fill in theA PI keys. If you want to disable any backend, for now you have to comment (or remove) it from the code. [How to disable a backend](#how-to-disable-a-backend)
3. Install frontend dependencies (in `frontend` directory):

```bash
npm install
```
4. Build frontend (in `frontend` directory):

```bash
npm run build
```
5. Create database (in `backend` directory)

```bash
deno run -A npm:drizzle-kit generate
deno run -A npm:drizzle-kit migrate
```
5. Run backend (in `backend` directory):

```bash
deno task start
```
6. Go to the [http://localhost:3333/](http://localhost:3333/)

### How to disable a backend

First, open `backend/main.ts` file in your favorite editor. Then find lines starting with `registerProvider`. You can comment out or remove the corresponding call. For example:

If you want to disable the OpenAI API, change this:
```ts
registerProvider(
  "ollama",
  new OllamaProvider(new Ollama()),
);

registerProvider(
  "ollama_cloud",
  new OllamaProvider(
    new Ollama({
      host: "https://ollama.com/",
    }),
  ),
);

registerProvider("openai", new OpenAIProvider(new OpenAI()));
```

to this:

```ts
registerProvider(
  "ollama",
  new OllamaProvider(new Ollama()),
);

registerProvider(
  "ollama_cloud",
  new OllamaProvider(
    new Ollama({
      host: "https://ollama.com/",
    }),
  ),
);

// registerProvider("openai", new OpenAIProvider(new OpenAI()));
```

Or if you want to disable Ollama Cloud, change to this:

```ts
registerProvider(
  "ollama",
  new OllamaProvider(new Ollama()),
);

//registerProvider(
//  "ollama_cloud",
//  new OllamaProvider(
//    new Ollama({
//      host: "https://ollama.com/",
//    }),
//  ),
//);

registerProvider("openai", new OpenAIProvider(new OpenAI()));
```