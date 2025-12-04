import express from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { Worker } from "worker_threads";

const app = express();
app.use(express.json());

// Zod schemas
const UserSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
});

const TaskSchema = z.object({
  iterations: z.number().int().positive().max(1000000),
});

// User interface
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive?: boolean;
}

// Task interface
interface Task {
  taskId: string;
  status: "processing" | "completed" | "error";
  iterations: number;
  result?: number;
  duration?: number;
  error?: string;
}

// In-memory task storage
const tasks = new Map<string, Task>();

// Helper functions
const getUsersFilePath = () => join(process.cwd(), "data/users.json");

async function readUsers(): Promise<User[]> {
  try {
    const data = await readFile(getUsersFilePath(), "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  await writeFile(getUsersFilePath(), JSON.stringify(users, null, 2), "utf-8");
}

/**
 * Health Check Endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * GET /users/active - must be before /users/:id to avoid route conflict
 */
app.get("/users/active", async (req, res) => {
  try {
    const users = await readUsers();
    const activeUsers = users.filter((user) => user.isActive === true);
    res.json(activeUsers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /users - Create a new user
 */
app.post("/users", async (req, res) => {
  try {
    // Validate input
    const validatedData = UserSchema.parse(req.body);

    // Read existing users
    const users = await readUsers();

    // Check for duplicate email
    const emailExists = users.some(
      (user) => user.email === validatedData.email
    );
    if (emailExists) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Create new user
    const newUser: User = {
      id: randomUUID(),
      name: validatedData.name,
      email: validatedData.email,
      createdAt: new Date().toISOString(),
    };

    // Add to users array and save
    users.push(newUser);
    await writeUsers(users);

    res.status(201).json(newUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /users - Retrieve paginated list of users
 */
app.get("/users", async (req, res) => {
  try {
    const users = await readUsers();

    // Parse pagination parameters with defaults
    let page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 10;

    // Ensure positive values
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    // Reverse to show newest first
    const reversedUsers = [...users].reverse();

    const total = reversedUsers.length;
    const pages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedUsers = reversedUsers.slice(startIndex, endIndex);

    res.json({
      data: paginatedUsers,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /users/:id - Retrieve a single user by ID
 */
app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const users = await readUsers();
    const user = users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /users/:id - Delete a user by ID
 */
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(404).json({ error: "User not found" });
    }

    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove user and save
    users.splice(userIndex, 1);
    await writeUsers(users);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /tasks/heavy - Start a heavy task on worker thread
 */
app.post("/tasks/heavy", async (req, res) => {
  try {
    // Validate input
    const validatedData = TaskSchema.parse(req.body);

    const taskId = randomUUID();
    const task: Task = {
      taskId,
      status: "processing",
      iterations: validatedData.iterations,
    };

    // Store task
    tasks.set(taskId, task);

    // Start worker thread
    // Check if running from dist or src
    const isProduction = process.env.NODE_ENV === "production";
    const workerPath = isProduction
      ? join(process.cwd(), "dist/src/worker.js")
      : join(process.cwd(), "src/worker.js");
    const worker = new Worker(workerPath, {
      workerData: { iterations: validatedData.iterations },
    });

    const startTime = Date.now();

    worker.on("message", (result) => {
      const duration = Date.now() - startTime;
      task.status = "completed";
      task.result = result;
      task.duration = duration;
      tasks.set(taskId, task);
    });

    worker.on("error", (error) => {
      task.status = "error";
      task.error = error.message;
      tasks.set(taskId, task);
    });

    res.status(202).json({
      taskId,
      status: "processing",
      iterations: validatedData.iterations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /tasks/:taskId - Get task status and result
 */
app.get("/tasks/:taskId", (req, res) => {
  const { taskId } = req.params;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(taskId)) {
    return res.status(404).json({ error: "Task not found" });
  }

  const task = tasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.json(task);
});

export { app };

// Avvia il server solo se questo file viene eseguito direttamente
// In un progetto ES module, puoi semplicemente rimuovere questo check
// oppure usare una variabile d'ambiente per controllare l'avvio del server
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
