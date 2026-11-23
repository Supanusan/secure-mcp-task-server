const toolPermissions = {
  list_tasks: "read:tasks",
  create_task: "write:tasks",
};

export function authorizeMcpTool(req, res, next) {
  // Check only MCP tool execution requests.
  if (req.method !== "POST" || req.body?.method !== "tools/call") {
    return next();
  }

  const toolName = req.body?.params?.name;
  const requiredPermission = toolPermissions[toolName];

  // Block tools that are not explicitly authorized.
  if (!requiredPermission) {
    return res.status(403).json({
      error: "Tool not permitted",
    });
  }

  // Read permissions from the verified Auth0 token.
  const permissions = req.auth0?.user?.permissions;

  if (
    !Array.isArray(permissions) ||
    !permissions.includes(requiredPermission)
  ) {
    res.set(
      "WWW-Authenticate",
      `Bearer error="insufficient_scope", scope="${requiredPermission}"`,
    );

    return res.status(403).json({
      error: "insufficient_scope",
      requiredPermission,
    });
  }

  next();
}
