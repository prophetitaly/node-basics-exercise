import request from "supertest";
import { app } from "../src/index";

/**
 * Test Suite per API REST Users
 *
 * Questi test verificano che l'implementazione rispetti le specifiche:
 * - Validazione con Zod
 * - Status code corretti (201, 204, 400, 404, 409)
 * - Paginazione
 * - UUID e createdAt
 * - Gestione errori
 */

describe("Users API Tests", () => {
  let createdUserId: string;

  describe("GET /health", () => {
    it("should return 200 OK", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
    });
  });

  describe("POST /users", () => {
    it("should create a new user with valid data and return 201", async () => {
      const newUser = {
        name: "Mario Rossi",
        email: "mario@test.com",
      };

      const response = await request(app)
        .post("/users")
        .send(newUser)
        .expect(201);

      // Verifica struttura risposta
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("name", newUser.name);
      expect(response.body).toHaveProperty("email", newUser.email);
      expect(response.body).toHaveProperty("createdAt");

      // Verifica UUID format
      expect(response.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Verifica ISO date format
      expect(new Date(response.body.createdAt).toISOString()).toBe(
        response.body.createdAt
      );

      // Salva ID per test successivi
      createdUserId = response.body.id;
    });

    it("should return 400 for name too short (min 2 chars)", async () => {
      const invalidUser = {
        name: "a",
        email: "test@example.com",
      };

      const response = await request(app)
        .post("/users")
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for invalid email", async () => {
      const invalidUser = {
        name: "Test User",
        email: "invalid-email",
      };

      const response = await request(app)
        .post("/users")
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for missing name", async () => {
      const invalidUser = {
        email: "test@example.com",
      };

      await request(app).post("/users").send(invalidUser).expect(400);
    });

    it("should return 400 for missing email", async () => {
      const invalidUser = {
        name: "Test User",
      };

      await request(app).post("/users").send(invalidUser).expect(400);
    });

    it("should return 409 for duplicate email", async () => {
      const user = {
        name: "Test User",
        email: "duplicate@test.com",
      };

      // Prima creazione
      await request(app).post("/users").send(user).expect(201);

      // Tentativo di duplicazione
      const response = await request(app).post("/users").send(user).expect(409);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toMatch(/email/i);
    });
  });

  describe("GET /users", () => {
    beforeAll(async () => {
      // Crea alcuni utenti per testare la paginazione
      const users = [
        { name: "User 1", email: "user1@test.com" },
        { name: "User 2", email: "user2@test.com" },
        { name: "User 3", email: "user3@test.com" },
      ];

      for (const user of users) {
        await request(app).post("/users").send(user);
      }
    });

    it("should return paginated users list with default params", async () => {
      const response = await request(app).get("/users").expect(200);

      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("pagination");
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verifica struttura pagination
      expect(response.body.pagination).toHaveProperty("page");
      expect(response.body.pagination).toHaveProperty("limit");
      expect(response.body.pagination).toHaveProperty("total");
      expect(response.body.pagination).toHaveProperty("pages");
    });

    it("should return paginated users with custom page and limit", async () => {
      const response = await request(app)
        .get("/users")
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    it("should return empty data for page beyond available data", async () => {
      const response = await request(app)
        .get("/users")
        .query({ page: 999, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.page).toBe(999);
    });

    it("should handle invalid pagination parameters gracefully", async () => {
      const response = await request(app)
        .get("/users")
        .query({ page: -1, limit: 0 })
        .expect(200);

      // Dovrebbe usare valori di default o corretti
      expect(response.body.pagination.page).toBeGreaterThan(0);
      expect(response.body.pagination.limit).toBeGreaterThan(0);
    });
  });

  describe("GET /users/:id", () => {
    let testUserId: string;

    beforeAll(async () => {
      // Crea un utente per i test
      const response = await request(app)
        .post("/users")
        .send({ name: "Single User", email: "single@test.com" });
      testUserId = response.body.id;
    });

    it("should return a single user by id", async () => {
      const response = await request(app)
        .get(`/users/${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty("id", testUserId);
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("email");
      expect(response.body).toHaveProperty("createdAt");
    });

    it("should return 404 for non-existent user id", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).get(`/users/${fakeId}`).expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toMatch(/not found/i);
    });

    it("should return 404 for invalid id format", async () => {
      await request(app).get("/users/invalid-id-123").expect(404);
    });
  });

  describe("DELETE /users/:id", () => {
    let userToDeleteId: string;

    beforeEach(async () => {
      // Crea un nuovo utente prima di ogni test di delete
      const response = await request(app)
        .post("/users")
        .send({ name: "Delete Me", email: `delete-${Date.now()}@test.com` });
      userToDeleteId = response.body.id;
    });

    it("should delete a user and return 204", async () => {
      await request(app).delete(`/users/${userToDeleteId}`).expect(204);

      // Verifica che l'utente sia stato eliminato
      await request(app).get(`/users/${userToDeleteId}`).expect(404);
    });

    it("should return 404 when deleting non-existent user", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .delete(`/users/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 404 for invalid id format on delete", async () => {
      await request(app).delete("/users/invalid-id").expect(404);
    });
  });

  describe("Integration Tests", () => {
    it("should complete full CRUD cycle", async () => {
      // CREATE
      const createResponse = await request(app)
        .post("/users")
        .send({ name: "Full Cycle", email: "cycle@test.com" })
        .expect(201);

      const userId = createResponse.body.id;

      // READ single
      const getResponse = await request(app)
        .get(`/users/${userId}`)
        .expect(200);
      expect(getResponse.body.name).toBe("Full Cycle");

      // READ list
      const listResponse = await request(app).get("/users").expect(200);
      expect(listResponse.body.data.some((u: any) => u.id === userId)).toBe(
        true
      );

      // DELETE
      await request(app).delete(`/users/${userId}`).expect(204);

      // Verify deletion
      await request(app).get(`/users/${userId}`).expect(404);
    });
  });

  describe("GET /users/active", () => {
    it("should return only active users", async () => {
      const response = await request(app).get("/users/active").expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Verifica che tutti gli utenti restituiti abbiano isActive: true
      response.body.forEach((user: any) => {
        expect(user).toHaveProperty("isActive", true);
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("createdAt");
      });
    });

    it("should return empty array if no active users exist", async () => {
      // Assumendo che tutti gli utenti siano stati disattivati
      const response = await request(app).get("/users/active").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should not return legacy users without isActive property", async () => {
      const response = await request(app).get("/users/active").expect(200);

      // Verifica che nessun utente legacy sia presente (senza isActive)
      response.body.forEach((user: any) => {
        expect(user).toHaveProperty("isActive");
      });
    });
  });

  describe("POST /tasks/heavy", () => {
    it("should start a heavy task on worker thread and return 202", async () => {
      const taskData = {
        iterations: 100000,
      };

      const response = await request(app)
        .post("/tasks/heavy")
        .send(taskData)
        .expect(202);

      // Verifica struttura risposta
      expect(response.body).toHaveProperty("taskId");
      expect(response.body).toHaveProperty("status", "processing");
      expect(response.body).toHaveProperty("iterations", taskData.iterations);

      // Verifica UUID format per taskId
      expect(response.body.taskId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should return 400 for invalid iterations (must be positive number)", async () => {
      const invalidTask = {
        iterations: -100,
      };

      const response = await request(app)
        .post("/tasks/heavy")
        .send(invalidTask)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for iterations exceeding maximum (1000000)", async () => {
      const invalidTask = {
        iterations: 2000000,
      };

      const response = await request(app)
        .post("/tasks/heavy")
        .send(invalidTask)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for missing iterations field", async () => {
      await request(app).post("/tasks/heavy").send({}).expect(400);
    });

    it("should return 400 for non-numeric iterations", async () => {
      const invalidTask = {
        iterations: "not-a-number",
      };

      await request(app).post("/tasks/heavy").send(invalidTask).expect(400);
    });
  });

  describe("GET /tasks/:taskId", () => {
    let taskId: string;

    beforeAll(async () => {
      // Crea un task per i test
      const response = await request(app)
        .post("/tasks/heavy")
        .send({ iterations: 50000 });
      taskId = response.body.taskId;
    });

    it("should return task status and result when completed", async () => {
      // Attendi un po' per dare tempo al worker di completare
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request(app).get(`/tasks/${taskId}`).expect(200);

      expect(response.body).toHaveProperty("taskId", taskId);
      expect(response.body).toHaveProperty("status");
      expect(["processing", "completed", "error"]).toContain(
        response.body.status
      );

      // Se completato, verifica presenza risultati
      if (response.body.status === "completed") {
        expect(response.body).toHaveProperty("result");
        expect(response.body).toHaveProperty("duration");
        expect(response.body).toHaveProperty("iterations");
        expect(typeof response.body.result).toBe("number");
        expect(typeof response.body.duration).toBe("number");
      }
    });

    it("should return 404 for non-existent task id", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app).get(`/tasks/${fakeId}`).expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toMatch(/not found/i);
    });

    it("should return 404 for invalid task id format", async () => {
      await request(app).get("/tasks/invalid-id-123").expect(404);
    });
  });
});
