# MCP Task Manager — Modular Node.js + MongoDB Starter

This starter exposes two Model Context Protocol (MCP) tools through Express + Streamable HTTP:

- `create_task` — inserts one task into MongoDB.
- `list_tasks` — returns the newest tasks (up to 50).

Built with the MCP TypeScript SDK **v2** from JavaScript ES modules. Local learning use only: **no login or per-user authorization is implemented**. Do not expose this server on the public Internet as written.

## Requirements

- Node.js 22+ (includes native `fetch` for the smoke test)
- npm
- MongoDB Community Server running locally, or a MongoDB Atlas connection string

## Quick start — VS Code / Git Bash

```bash
# 1. Unzip and open a terminal in the project directory.
cd mcp-mongodb-server

# 2. Install packages listed in package.json.
npm install

# 3. Copy example environment variables to a private file.
cp .env.example .env

# 4. Open .env and edit MONGODB_URI if your MongoDB is not local.
code .env

# 5. Run in development mode (auto-restarts when code changes).
npm run dev
```

If using a local MongoDB server, make sure the database service is running before step 5. If using MongoDB Atlas, use the Atlas driver connection string in `.env` and allow your machine's IP in Atlas Network Access (avoid opening access to all IPs).

On a separate terminal:

```bash
# 6. Check the HTTP service.
curl http://127.0.0.1:3000/health

# 7. Run a live MCP smoke test: lists tools, inserts one task, lists tasks.
npm run test:mcp
```

## Manual MCP requests (Git Bash)

```bash
# Discover tools.
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Create a MongoDB task.
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_task","arguments":{"title":"Study MCP"}}}'

# Read the latest 10 tasks.
curl -s -X POST http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_tasks","arguments":{"limit":10}}}'
```

`localhost:3000/mcp` is a protocol endpoint; opening it in your browser as a regular web page is not a valid MCP test. Use the MCP Inspector, the smoke-test script, or an MCP client.

## File responsibilities

| File | Responsibility |
| --- | --- |
| `src/server.js` | Wait for MongoDB, open HTTP port, shut down gracefully |
| `src/app.js` | Express app, health endpoint, MCP HTTP mount |
| `src/config/env.js` | Validate required env vars |
| `src/config/database.js` | Open/close shared MongoDB connection |
| `src/models/task.model.js` | MongoDB schema |
| `src/services/task.service.js` | Task database logic |
| `src/mcp/mcp.server.js` | Creates MCP server instance for each HTTP request |
| `src/mcp/tools/task.tools.js` | Registers MCP tool schemas and callbacks |
| `scripts/test-mcp.js` | Real HTTP smoke test, creates one test task |

## Security before deployment

**Never change HOST to `0.0.0.0` and deploy this starter unchanged.** It has no authentication. For a real, multi-user remote MCP server:

1. Add OAuth 2.0 authorization, bearer-token verification, token audience checks, user identity, and proper OAuth metadata endpoints.
2. Scope all MongoDB reads and writes by authenticated user ID and enforce permissions on each tool.
3. Restrict `allowedHosts`/`allowedOrigins` and use HTTPS behind a trusted proxy.
4. Add rate limits, logging, and safeguards for state-changing actions.
5. Connect a remote client only after the server is secured and tested.

The MCP SDK's `createMcpExpressApp()` enables localhost Host/Origin checks; it does **not** implement user login for you.

## Official references

- https://ts.sdk.modelcontextprotocol.io/v2/serving/express
- https://ts.sdk.modelcontextprotocol.io/v2/serving/http
- https://ts.sdk.modelcontextprotocol.io/v2/servers/tools

## Troubleshooting: `Unexpected token 'e', "event: mes"...`

Older MCP Streamable HTTP requests may receive `Content-Type: text/event-stream` (SSE),
not plain JSON. The included `scripts/test-mcp.js` supports both SSE and JSON responses;
do not replace `readMcpResponse` with `response.json()`.

Keep the MCP backend running with `npm run dev` in terminal 1. Run
`npm run test:mcp` from terminal 2. You can also open the MCP Inspector,
select **Streamable HTTP**, connect to `http://127.0.0.1:3000/mcp`,
then list and call tools. Starting the Inspector does not start this server.
