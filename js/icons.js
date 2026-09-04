// ==================== BOOTSTRAP VECTOR ICON ENGINE ====================
// Pure Bootstrap & vector icon mappings for all decentralized .neo sites and services.
// Zero third-party real-world trademark favicons or telemetry calls.

const DOMAIN_BOOTSTRAP_ICONS = {
    "home.neo": "bi-house-door",
    "about.neo": "bi-info-circle",
    "app.neo": "bi-download",
    "pricing.neo": "bi-tag",
    "update.neo": "bi-clock-history",
    "privacy.neo": "bi-shield-check",
    "contact.neo": "bi-envelope",
    "share.neo": "bi-broadcast",
    "2048.neo": "bi-grid-3x3",
    "flappy-bird.neo": "bi-controller",
    "tetris.neo": "bi-bounding-box",
    "crossy-road.neo": "bi-signpost",
    "candy-crush.neo": "bi-gem",
    "fruit-slicer.neo": "bi-slash-circle",
    "minesweeper.neo": "bi-flag",
    "typing-game.neo": "bi-keyboard",
    "the-cube.neo": "bi-box",
    "snake-game.neo": "bi-activity",
    "breakout.neo": "bi-bricks",
    "tic-tac-toe.neo": "bi-x-diamond",
    "ping-pong.neo": "bi-pause-circle",
    "tower-block.neo": "bi-stack",
    "whack-a-mole.neo": "bi-hammer",
    "archery.neo": "bi-bullseye",
    "connect-four.neo": "bi-circle-square",
    "dice-roll.neo": "bi-dice-5",
    "hangman.neo": "bi-alphabet",
    "insect-catch.neo": "bi-bug",
    "keyboard-hero.neo": "bi-music-note",
    "maze.neo": "bi-shuffle",
    "memory-card.neo": "bi-card-heading",
    "menja.neo": "bi-lightning",
    "quiz-game.neo": "bi-question-circle",
    "rock-paper-scissor.neo": "bi-scissors",
    "shape-clicker.neo": "bi-pentagon",
    "simon-says.neo": "bi-palette",
    "speak-no-guess.neo": "bi-mic",
    "chess-master.neo": "bi-suit-spade",
    "threat-map.neo": "bi-shield-exclamation",
    "neural-chat.neo": "bi-chat-dots",
    "crypto-tracker.neo": "bi-graph-up",
    "lofi-beats.neo": "bi-soundwave",
    "solar-system-3d.neo": "bi-globe2",
    "json-formatter.neo": "bi-braces",
    "regex-lab.neo": "bi-code-slash",
    "pomodoro-focus.neo": "bi-stopwatch",
    "sudoku-zen.neo": "bi-grid-9x9",
    "notes-vault.neo": "bi-journal-text",
    "markdown-studio.neo": "bi-markdown",
    "google": "bi-search",
    "github": "bi-github",
    "telegram": "bi-telegram",
    "yahoo": "bi-envelope",
    "vercel": "bi-triangle"
};

/**
 * Resolves appropriate Bootstrap icon class for a .neo domain or service name.
 */
function getBootstrapIconClass(domain) {
    const clean = (domain || "").replace(/^fetch:\/\//, "").replace(/\/$/, "").toLowerCase();
    return DOMAIN_BOOTSTRAP_ICONS[clean] || "bi-globe";
}

/**
 * Returns clean Bootstrap Icon HTML element.
 */
function getFaviconHtml(domain, altName = "") {
    const clean = (domain || "").replace(/^fetch:\/\//, "").replace(/\/$/, "").toLowerCase();
    const iconClass = getBootstrapIconClass(clean);
    return `<i class="bi ${iconClass} favicon-icon" title="${altName || clean}"></i>`;
}

/**
 * Returns external service icon HTML element.
 */
function getServiceFaviconHtml(serviceName) {
    const iconClass = getBootstrapIconClass(serviceName);
    return `<i class="bi ${iconClass} favicon-icon" title="${serviceName}"></i>`;
}

/**
 * Deterministically streams an algorithmic vector SVG badge for any domain.
 */
function generateAvatarSvg(domain) {
    const clean = (domain || "").replace(/^fetch:\/\//, "").replace(/\/$/, "").toLowerCase();
    const iconClass = getBootstrapIconClass(clean);
    return `<i class="bi ${iconClass} favicon-icon"></i>`;
}
