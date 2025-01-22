// server.js
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Use the port from .env if available, otherwise default to 3000
const PORT = process.env.PORT || 3000;

// Simple routes just for demonstration:

app.get("/", (req, res) => {
  res.send("Hello from Dockerized Pokémon MVP!");
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});

