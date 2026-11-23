import { Task } from "../models/task.model.js";

// Reject requests without a user ID.
function requireOwner(ownerId) {
  if (typeof ownerId !== "string" || !ownerId.trim()) {
    throw new Error("Authenticated user ID is required");
  }

  return ownerId;
}

// Get only the authenticated user's tasks.
export async function listTasks(ownerId, limit = 20) {
  const userId = requireOwner(ownerId);

  const tasks = await Task.find({ ownerId: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return tasks.map((task) => ({
    id: String(task._id),
    title: task.title,
    completed: task.completed,
    createdAt: task.createdAt.toISOString(),
  }));
}

// Create a task belonging to the authenticated user.
export async function createTask(ownerId, title) {
  const userId = requireOwner(ownerId);

  if (typeof title !== "string" || !title.trim()) {
    throw new Error("Task title is required");
  }

  const task = await Task.create({
    ownerId: userId,
    title,
  });

  return {
    id: String(task._id),
    title: task.title,
    completed: task.completed,
    createdAt: task.createdAt.toISOString(),
  };
}
