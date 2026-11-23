import { Router } from "express";
import { env } from "../config/env.js";

export const oauthRoutes = Router();

function getProtectedResourceMetadata(req, res) {
  if (!env.MCP_PUBLIC_URL) {
    return res.status(503).json({
      error: "MCP_PUBLIC_URL is not configured",
    });
  }

  res.json({
    resource: env.MCP_PUBLIC_URL,

    authorization_servers: [`https://${env.AUTH0_DOMAIN}/`],

    scopes_supported: ["read:tasks", "write:tasks"],

    bearer_methods_supported: ["header"],
  });
}

// Path-specific discovery
oauthRoutes.get(
  "/.well-known/oauth-protected-resource/mcp",
  getProtectedResourceMetadata,
);

// Root-level discovery fallback
oauthRoutes.get(
  "/.well-known/oauth-protected-resource",
  getProtectedResourceMetadata,
);
