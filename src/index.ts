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
// In un progetto ES module, puoi semplicemente rimuovere questo check
// oppure usare una variabile d'ambiente per controllare l'avvio del server
if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
