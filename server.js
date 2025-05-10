// server.js (Conceptual Changes)
const express = require("express");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

const app = express();
dotenv.config();
app.use(express.json());

// Serve static files (index.html, script.js, pokemon-data-gen1.json)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/script.js", (req, res) => {
    res.sendFile(path.join(__dirname, "script.js"));
});
app.get("/pokemon-data-gen1.json", (req, res) => { // Serve the Gen 1 JSON data
    res.sendFile(path.join(__dirname, "pokemon-data-gen1.json"));
});
app.get("/pokemon-data-gen2.json", (req, res) => { // Serve the Gen 2 JSON Data
    res.sendFile(path.join(__dirname, "pokemon-data-gen2.json"));
});

// Generic function to handle caught data for a specific game
function handleCaughtData(game, req, res, isPost = false) {
    const filePath = path.join(__dirname, `save-data/caught-${game}.json`);
    if (isPost) {
        const { id, caught } = req.body;
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}));
        }
        const data = fs.readFileSync(filePath, "utf8");
        const caughtData = JSON.parse(data);
        caughtData[id.toString()] = caught; // Ensure ID is string key
        fs.writeFileSync(filePath, JSON.stringify(caughtData, null, 2));
        res.json({ success: true, message: `Data saved for ${game}` });
    } else {
        if (!fs.existsSync(filePath)) {
            // If file doesn't exist for a GET, return empty object (or 404 as client handles)
            return res.json({}); // Or res.status(404).json({ error: "No data for this game yet." });
        }
        const data = fs.readFileSync(filePath, "utf8");
        res.json(JSON.parse(data));
    }
}

// Define routes for each game
const supportedGames = ["red", "blue", "yellow", "gold", "silver", "crystal"];
supportedGames.forEach(game => {
    app.get(`/caught/${game}`, (req, res) => {
        handleCaughtData(game, req, res, false);
    });
    app.post(`/caught/${game}`, (req, res) => {
        handleCaughtData(game, req, res, true);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
