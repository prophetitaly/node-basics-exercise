import express, { Request, Response, NextFunction } from "express";

const app = express();
app.use(express.json());

const PORT = 3000;

// === IL TUO CODICE QUI ===
// Implementa gli endpoint richiesti:
// - GET /users?page=1&limit=10
// - GET /users/:id
// - POST /users
// - DELETE /users/:id

app.listen(PORT, () => {
  console.log(`🚀 Server on http://localhost:${PORT}`);
  console.log(`🧪 Run tests: npm run test:api`);
});
