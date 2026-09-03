// ==================== CONFIGURATION & GLOBAL STATE ====================
const { ipcRenderer } = require('electron');

let GLOBAL_SERVER_URL = "https://neobrowser-bcknd.vercel.app";
let REGISTRY = {};
let activeQuery = "";
let currentLoadedDomain = null;
let isShowingAll = false;
let currentFeatured4 = [];

// Built-in site icon mapping
const SITE_ICONS = {
    "2048.neo": "🔢",
    "flappy-bird.neo": "🐤",
    "crossy-road.neo": "🐔",
    "snake-game.neo": "🐍",
    "tetris.neo": "🧱",
    "fruit-slicer.neo": "🍉",
    "breakout.neo": "🏓",
    "candy-crush.neo": "🍬",
    "minesweeper.neo": "💣",
    "tic-tac-toe.neo": "❌",
    "ping-pong.neo": "🏓",
    "tower-block.neo": "🏗️",
    "whack-a-mole.neo": "🔨",
    "archery.neo": "🏹",
    "connect-four.neo": "🔴",
    "dice-roll.neo": "🎲",
    "emoji-catch.neo": "🧺",
    "hangman.neo": "🪢",
    "insect-catch.neo": "🦗",
    "keyboard-hero.neo": "🎹",
    "maze.neo": "🌀",
    "memory-card.neo": "🃏",
    "menja.neo": "⚔️",
    "quiz-game.neo": "❓",
    "rock-paper-scissor.neo": "✂️",
    "shape-clicker.neo": "🔺",
    "simon-says.neo": "🎶",
    "speak-number-guess.neo": "🗣️",
    "the-cube.neo": "🧊",
    "typing-game.neo": "⌨️",
    "home.neo": "🏠",
    "pricing.neo": "💎",
    "app.neo": "💻",
    "update.neo": "🚀",
    "privacy.neo": "🛡️",
    "about.neo": "ℹ️",
    "contact.neo": "📬",
    "video.neo": "🎬",
    "audio.neo": "🎵",
    "onlinetest.neo": "📶",
    "powertest.neo": "⚡",
    "allsim.neo": "📺",
    "download-test.neo": "📥",
    "example.neo": "💡",
    "test.neo": "🧪"
};

function getSiteCategory(path) {
    if (!path) return "Games";
    if (path.includes("/official/")) return "Official";
    if (path.includes("/testing/")) return "Testing";
    return "Games";
}

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initRegistry() {
    try {
        REGISTRY = require('./registry.json');
        console.log("✅ Registry loaded from local JSON:", Object.keys(REGISTRY).length, "entries");
    } catch (e) {
        console.warn("Could not require registry.json, initializing empty:", e);
        REGISTRY = {};
    }
}
