const express = require("express");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();
dotenv.config();
app.use(express.json());

const bypassAuth = process.env.BYPASS_AUTH_FOR_TESTS === 'true';

app.use(session({
    secret: process.env.SESSION_SECRET || 'change_this',
    resave: false,
    saveUninitialized: false
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (!bypassAuth) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
    }, (accessToken, refreshToken, profile, cb) => {
        cb(null, { id: profile.id, displayName: profile.displayName });
    }));
}

app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
    if (bypassAuth || req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
}

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

// Authentication routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ id: req.user.id, displayName: req.user.displayName });
    } else {
        res.status(401).json({ error: 'not authenticated' });
    }
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

function handleCaughtData(game, req, res, isPost = false) {
    const userId = req.user?.id || 'guest';
    const filePath = path.join(__dirname, 'save-data', userId, `caught-${game}.json`);
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
    app.get(`/caught/${game}`, ensureAuthenticated, (req, res) => {
        handleCaughtData(game, req, res, false);
    });
    app.post(`/caught/${game}`, ensureAuthenticated, (req, res) => {
        handleCaughtData(game, req, res, true);
    });
});

module.exports = app;
