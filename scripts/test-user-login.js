import "dotenv/config";
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";

// This is a local-only learning script, not a production login server.
const {
  AUTH0_DOMAIN,
  AUTH0_AUDIENCE,
  AUTH0_WEB_CLIENT_ID,
  AUTH0_WEB_CLIENT_SECRET,
} = process.env;

const missing = [
  "AUTH0_DOMAIN",
  "AUTH0_AUDIENCE",
  "AUTH0_WEB_CLIENT_ID",
  "AUTH0_WEB_CLIENT_SECRET",
].filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing .env variables: ${missing.join(", ")}`);
  process.exit(1);
}

const domain = AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/+$/, "");
const redirectUri = "http://localhost:4000/callback";
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(24).toString("base64url");

const authorizeUrl = new URL(`https://${domain}/authorize`);
for (const [key, value] of Object.entries({
  response_type: "code",
  client_id: AUTH0_WEB_CLIENT_ID,
  redirect_uri: redirectUri,
  audience: AUTH0_AUDIENCE,
  scope: "openid profile read:tasks write:tasks",
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
})) {
  authorizeUrl.searchParams.set(key, value);
}

function parseMcpResult(body, contentType) {
  if (contentType.includes("application/json")) return JSON.parse(body);
  if (contentType.includes("text/event-stream")) {
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const message = JSON.parse(line.slice(5).trim());
      if (message.id === 2) return message;
    }
  }
  throw new Error("Unexpected MCP response format");
}

let handled = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", redirectUri);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method !== "GET" || url.pathname !== "/callback") {
    res.writeHead(404).end("Not found");
    return;
  }
  if (handled || url.searchParams.get("state") !== state) {
    res.writeHead(400).end("Invalid login state");
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    console.error(
      "Login rejected by Auth0:",
      url.searchParams.get("error") ?? "No code",
    );
    res.writeHead(400).end("Auth0 login was not completed. Check terminal.");
    server.close();
    return;
  }
  handled = true;

  try {
    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: AUTH0_WEB_CLIENT_ID,
        client_secret: AUTH0_WEB_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(
        `Auth0 token exchange failed: ${tokenData.error ?? tokenResponse.status} (${tokenData.error_description ?? "no details"})`,
      );
    }

    // This is a local diagnostic decode, NOT independent JWT verification.
    // Actual token verification happens in your Auth0-protected MCP backend.
    const payload = JSON.parse(
      Buffer.from(tokenData.access_token.split(".")[1], "base64url").toString(),
    );
    console.log("Auth0 login successful.");
    console.log("User ID:", payload.sub ?? "(missing)");
    console.log(
      "Granted permissions:",
      JSON.stringify(payload.permissions ?? []),
    );

    const createResponse = await fetch("http://127.0.0.1:3000/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "create_task",
          arguments: {
            title: "User A second task",
          },
        },
      }),
    });

    const createBody = await createResponse.text();

    if (!createResponse.ok) {
      throw new Error(`create_task HTTP ${createResponse.status}`);
    }

    const createResult = parseMcpResult(
      createBody,
      createResponse.headers.get("content-type") ?? "",
    );

    if (createResult.error || createResult.result?.isError) {
      throw new Error("create_task returned a tool error");
    }

    console.log("Personal task created successfully.");

    const mcpResponse = await fetch("http://127.0.0.1:3000/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list_tasks", arguments: {} },
      }),
    });
    console.log("MCP list_tasks HTTP status:", mcpResponse.status);

    const raw = await mcpResponse.text();
    if (mcpResponse.ok) {
      const response = parseMcpResult(
        raw,
        mcpResponse.headers.get("content-type") ?? "",
      );
      if (response.error || response.result?.isError) {
        console.error(
          "MCP returned a tool error:",
          response.error?.message ??
            response.result?.content?.[0]?.text ??
            "Unknown",
        );
      } else {
        const content = response.result?.content?.find(
          (item) => item.type === "text",
        )?.text;
        const data = content ? JSON.parse(content) : null;
        console.log(
          "MCP tool succeeded. Your task count:",
          data?.tasks?.length ?? "(not available)",
        );
        console.log(
          "Task titles:",
          data?.tasks?.map((task) => task.title),
        );
      }
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Login finished. Check the VS Code terminal for the results.");
  } catch (error) {
    console.error("Login or MCP test failed:", error.message);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Test failed. Check the VS Code terminal for details.");
  } finally {
    server.close();
  }
});

server.on("error", (error) => {
  console.error("Cannot start local login callback:", error.message);
});

server.listen(4000, "localhost", () => {
  console.log("Open this URL in your browser to sign in:");
  console.log(authorizeUrl.toString());
  console.log(
    "\nDo not share your login URL, passwords, authorization codes, or tokens.",
  );
});
