// Run only after starting the server. This script CREATES one sample task.
const endpoint = process.env.MCP_URL ?? 'http://127.0.0.1:3000/mcp';

async function readMcpResponse(response, requestId) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const body = await response.text();

  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Unexpected MCP content type "${contentType}": ${body.slice(0, 250)}`);
  }

  // MCP's legacy Streamable HTTP response can contain SSE events:
  // event: message
  // data: {"jsonrpc":"2.0","id":1,"result":{...}}
  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (!data) continue;

    const message = JSON.parse(data);
    if (message.id === requestId) return message;
  }

  throw new Error(`SSE stream did not include a response for request ${requestId}`);
}

async function callMcp(id, method, params) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      ...(params ? { params } : {})
    })
  });

  const data = await readMcpResponse(response, id);
  if (!response.ok || data.error) {
    throw new Error(JSON.stringify(data.error ?? data));
  }
  return data.result;
}

try {
  const tools = await callMcp(1, 'tools/list');
  console.log('Available tools:', tools.tools.map((tool) => tool.name));

  const created = await callMcp(2, 'tools/call', {
    name: 'create_task',
    arguments: { title: `MCP test task ${Date.now()}` }
  });
  if (created.isError) throw new Error(JSON.stringify(created));
  console.log('Created task:', created.content);

  const listed = await callMcp(3, 'tools/call', {
    name: 'list_tasks',
    arguments: { limit: 10 }
  });
  if (listed.isError) throw new Error(JSON.stringify(listed));
  console.log('Task list:', listed.content);
} catch (error) {
  console.error('MCP smoke test failed:', error.message);
  process.exitCode = 1;
}
