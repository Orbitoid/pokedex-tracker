const express = require("express");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

const app = express();
dotenv.config();
app.use(express.json());

// Serve static files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/script.js", (req, res) => {
    res.sendFile(path.join(__dirname, "script.js"));
});
app.get("/pokemon-data-gen1.json", (req, res) => {
    res.sendFile(path.join(__dirname, "pokemon-data-gen1.json"));
});
app.get("/pokemon-data-gen2.json", (req, res) => {
    res.sendFile(path.join(__dirname, "pokemon-data-gen2.json"));
});

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
        caughtData[id.toString()] = caught;
        fs.writeFileSync(filePath, JSON.stringify(caughtData, null, 2));
        res.json({ success: true, message: `Data saved for ${game}` });
    } else {
        if (!fs.existsSync(filePath)) {
            return res.json({});
        }
        const data = fs.readFileSync(filePath, "utf8");
        res.json(JSON.parse(data));
    }
}

const supportedGames = ["red", "blue", "yellow", "gold", "silver", "crystal"];
supportedGames.forEach(game => {
    app.get(`/caught/${game}`, (req, res) => {
        handleCaughtData(game, req, res, false);
    });
    app.post(`/caught/${game}`, (req, res) => {
        handleCaughtData(game, req, res, true);
    });
});

module.exports = app;
