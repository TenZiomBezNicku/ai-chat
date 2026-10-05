# ai-chat

Chat with LLMs in your browser using Ollama or any OpenAI-compatible API!

> [!WARNING]
> This project is still in the early stages of development! Do not use it in a production environment.

## Features
- Chat with LLMs via Ollama and OpenAI-compatible APIs
- Streaming responses
- Image attachments (buggy)
- Web search
- Auth system
- Automatic chat title generation
- Model selection
- Automatic admin role assignment for the first user
- Admin panel

## Planned for the future
- Image generation
- Web page access
- Gemini API support
- Tool calling emulation for unsupported models

## Requirements
- Deno
- Node.js
- npm
- Ollama (optional)

## How to run

1. Install frontend dependencies (in `frontend` directory):
```bash
npm install
```

2. Build frontend (in `frontend` directory):
```bash
npm run build
```

3. Set up the database (in `backend` directory):
```bash
deno run -A npm:drizzle-kit generate
deno run -A npm:drizzle-kit migrate
```

4. Run backend (in `backend` directory):
```bash
deno task start
```

5. Open http://localhost:3000 (or the port configured with `PORT`).
After registering, you should see `Admin Panel` button in the bottom-left corner. Here you can add providers, configure web search via Tavily and manage models.

6. Add providers in admin panel
Click the add button (`+` icon), then fill all fields. Note: `API Key` is optional for local Ollama.
Local Ollama base URL is `http://localhost:11434/` but Ollama Cloud base URL is `https://ollama.com/`. OpenAI API base URL is `https://api.openai.com/v1`.

## How to set up web search

1. Go to [Tavily](https://www.tavily.com/) and register/login.
2. Copy generated API key and paste it to `Tavily API Key` field in admin panel, then press `Set` button.

## How to change a backend port/address

1. Open `backend/.env` file in your favorite text editor, e.g. with nano:
```bash
nano backend/.env
```

2. Add `PORT` env var on a new line and set it to the desired port, e.g. `PORT=8080`.

3. Add `HOST` env var on a new line and set it to the desired address, e.g. `HOST=127.0.0.1` (default is 0.0.0.0, which means all addresses).

4. Save and exit.