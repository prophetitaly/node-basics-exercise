import express from "express";

const app = express();
app.use(express.json());

/**
 * Health Check Endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Users API
 *
 * - POST /users: Create a new user
 * - GET /users: Retrieve paginated list of users
 * - GET /users/:id: Retrieve a single user by ID
 * - DELETE /users/:id: Delete a user by ID
 */

// ...existing user routes code...

export { app };

// Avvia il server solo se questo file viene eseguito direttamente
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
