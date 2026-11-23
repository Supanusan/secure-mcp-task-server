import { z } from "zod";
import { createTask, listTasks } from "../../services/task.service.js";

function success(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}

function failure(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}

function getOwnerId(ctx, requiredPermission) {
  const auth = ctx.http?.authInfo;

  if (
    typeof auth?.ownerId !== "string" ||
    !auth.ownerId.startsWith("auth0|") ||
    !auth.scopes?.includes(requiredPermission)
  ) {
    return null;
  }

  return auth.ownerId;
}

export function registerTaskTools(server) {
  // LIST TASKS
  server.registerTool(
    "list_tasks",
    {
      description: "Get tasks belonging to the logged-in user",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },

    async ({ limit = 20 }, ctx) => {
      const ownerId = getOwnerId(ctx, "read:tasks");

      if (!ownerId) {
        return failure("User login and read permission required");
      }

      try {
        const tasks = await listTasks(ownerId, limit);
        return success({ tasks });
      } catch (error) {
        console.error("list_tasks failed:", error);
        return failure("Could not retrieve tasks");
      }
    },
  );

  // CREATE TASK
  server.registerTool(
    "create_task",
    {
      description: "Create a task for the logged-in user",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(120),
      }),
    },

    async ({ title }, ctx) => {
      const ownerId = getOwnerId(ctx, "write:tasks");

      if (!ownerId) {
        return failure("User login and write permission required");
      }

      try {
        const task = await createTask(ownerId, title);
        return success({ task });
      } catch (error) {
        console.error("create_task failed:", error);
        return failure("Could not create task");
      }
    },
  );
}
