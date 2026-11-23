import { McpServer } from '@modelcontextprotocol/server';
import { registerTaskTools } from './tools/task.tools.js';

// The HTTP MCP handler calls this factory once per request.
export function createTaskMcpServer() {
  const server = new McpServer({
    name: 'task-manager-mcp',
    version: '1.0.0'
  });

  registerTaskTools(server);
  return server;
}
