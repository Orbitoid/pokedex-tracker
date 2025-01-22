// server.js
const express = require("express");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

const app = express();

// Load environment variables from .env files
// This is useful for keeping secrets out of your code
dotenv.config();

// Parse JSON bodies sent by the client
app.use(express.json());

// Serve our static files (index.html, script.js)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/script.js", (req, res) => {
  res.sendFile(path.join(__dirname, "script.js"));
});

// GET route to read caught.json
app.get("/caught", (req, res) => {
  // Ensure the file exists and read it
  if (!fs.existsSync("caught.json")) {
    fs.writeFileSync("caught.json", JSON.stringify({}));
  }
  const data = fs.readFileSync("caught.json", "utf8");
  res.json(JSON.parse(data));
});

// POST route to update caught.json
app.post("/caught", (req, res) => {
  // req.body will contain { id, caught } from the client
  const { id, caught } = req.body;

  // Load the current JSON state
  if (!fs.existsSync("caught.json")) {
    fs.writeFileSync("caught.json", JSON.stringify({}));
  }
  const data = fs.readFileSync("caught.json", "utf8");
  const caughtData = JSON.parse(data);

  // Update or insert the caught state for this Pokémon
  caughtData[id] = caught;

  // Write it back to file
  fs.writeFileSync("caught.json", JSON.stringify(caughtData, null, 2));

  res.json({ success: true });
});

// Start the server on port 3000

app.listen(process.env.port, () => {
  console.log(`Server running at http://localhost:${process.env.port}`);
});

