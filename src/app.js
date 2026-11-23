import { authorizeMcpTool } from "./middleware/permission.middleware.js";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { env } from "./config/env.js";
import { createTaskMcpServer } from "./mcp/mcp.server.js";

import { auth0Api, authenticateMcp } from "./middleware/auth.middleware.js";

export const app = createMcpExpressApp({ host: env.HOST });

// Public health-check endpoint.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Configure Auth0 token validation.
app.use(auth0Api);

// Create the MCP handler.
export const mcpHandler = createMcpHandler(createTaskMcpServer, {
  responseMode: "json",
});

const nodeHandler = toNodeHandler(mcpHandler);

// Protected MCP endpoint.

app.all(
  "/mcp",
  authenticateMcp,

  // Transfer verified Auth0 claims into MCP context.
  (req, res, next) => {
    const user = req.auth0?.user;

    if (!user?.sub || !user?.exp) {
      return res.status(401).json({
        error: "Invalid authenticated identity",
      });
    }

    // For now, permit personal tasks only for
    // Auth0 database users, not machine clients.
    const isPersonalUser =
      user.sub.startsWith("auth0|") &&
      user.gty !== "client-credentials" &&
      user.gty !== "client_credentials";

    if (
      req.method === "POST" &&
      req.body?.method === "tools/call" &&
      !isPersonalUser
    ) {
      return res.status(403).json({
        error: "Personal user login required",
      });
    }

    req.auth = {
      token: req.get("authorization").replace(/^Bearer\s+/i, ""),
      clientId: user.azp || user.sub,
      scopes: Array.isArray(user.permissions) ? user.permissions : [],
      expiresAt: user.exp,
      ownerId: isPersonalUser ? user.sub : null,
    };

    next();
  },

  authorizeMcpTool,

  (req, res) => {
    void nodeHandler(req, res, req.body).catch((error) => {
      console.error("MCP request failed:", error);

      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
        });
      }
    });
  },
);
