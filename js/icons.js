// ==================== STREAMING FAVICON & VECTOR ICON ENGINE ====================

const PALETTES = [
    ["#38bdf8", "#818cf8"], // Cyan -> Indigo
    ["#f43f5e", "#fb923c"], // Rose -> Orange
    ["#10b981", "#06b6d4"], // Emerald -> Cyan
    ["#8b5cf6", "#d946ef"], // Purple -> Fuchsia
    ["#f59e0b", "#ef4444"], // Amber -> Red
    ["#06b6d4", "#3b82f6"]  // Cyan -> Blue
];

// Upstream live domain stream mapping
const ICON_STREAM_MAP = {
    "2048.neo": "play2048.co",
    "flappy-bird.neo": "flappybird.io",
    "tetris.neo": "tetris.com",
    "crossy-road.neo": "crossyroad.com",
    "candy-crush.neo": "king.com",
    "fruit-slicer.neo": "halfbrick.com",
    "minesweeper.neo": "minesweeper.online",
    "typing-game.neo": "monkeytype.com",
    "the-cube.neo": "rubiks.com",
    "snake-game.neo": "playsnake.org",
    "breakout.neo": "atari.com",
    "tic-tac-toe.neo": "playtictactoe.org",
    "ping-pong.neo": "ponggame.org",
    "tower-block.neo": "ketchappgames.com",
    "whack-a-mole.neo": "arcade.com",
    "archery.neo": "worldarchery.sport",
    "connect-four.neo": "coolmathgames.com",
    "dice-roll.neo": "random.org",
    "emoji-catch.neo": "emojipedia.org",
    "hangman.neo": "thewordsearch.com",
    "insect-catch.neo": "nationalgeographic.com",
    "keyboard-hero.neo": "pianotiles.org",
    "maze.neo": "mazegenerator.net",
    "memory-card.neo": "matchthememory.com",
    "menja.neo": "ninja.com",
    "quiz-game.neo": "quizlet.com",
    "rock-paper-scissor.neo": "wrpsa.com",
    "shape-clicker.neo": "geometrydash.com",
    "simon-says.neo": "hasbro.com",
    "speak-number-guess.neo": "speechify.com",
    "home.neo": "electronjs.org",
    "about.neo": "wikipedia.org",
    "app.neo": "appimage.org",
    "pricing.neo": "stripe.com",
    "update.neo": "semver.org",
    "privacy.neo": "eff.org",
    "contact.neo": "telegram.org",
    "share.neo": "bittorrent.com",
    "video.neo": "youtube.com",
    "audio.neo": "spotify.com",
    "onlinetest.neo": "speedtest.net",
    "powertest.neo": "browserleaks.com",
    "allsim.neo": "twitch.tv",
    "download-test.neo": "archive.org",
    "example.neo": "developer.mozilla.org",
    "test.neo": "w3.org",
    "google": "google.com",
    "github": "github.com",
    "telegram": "telegram.org",
    "yahoo": "yahoo.com",
    "vercel": "vercel.com"
};

/**
 * Streams icons on-demand directly over high-speed global Favicon CDN stream.
 * ZERO local file downloads or disk bloat.
 */
function getStreamingIconUrl(domain) {
    const clean = (domain || "").replace(/^fetch:\/\//, "").replace(/\/$/, "").toLowerCase();
    const streamDomain = ICON_STREAM_MAP[clean] || (clean.endsWith('.neo') ? clean.replace(/\.neo$/, ".com") : clean);
    return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${streamDomain}&size=64`;
}

/**
 * Deterministically streams an algorithmic vector SVG badge for any domain.
 * Guarantees instant icon rendering for infinite sites.
 */
function generateAvatarSvg(domain) {
    const raw = (domain || "").replace(/^fetch:\/\//, "").replace(/\.neo$/, "").replace(/[-_]/g, " ").trim();
    const char = (raw[0] || "N").toUpperCase();
    
    let hash = 0;
    const str = domain || "neo";
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % PALETTES.length;
    const [c1, c2] = PALETTES[idx];
    const gradId = `av_${Math.abs(hash)}_${char.charCodeAt(0)}`;

    return `<svg class="favicon-img avatar-svg" viewBox="0 0 64 64" width="100%" height="100%">
        <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${c1}"/>
                <stop offset="100%" stop-color="${c2}"/>
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#${gradId})"/>
        <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${char}</text>
    </svg>`;
}

/**
 * Returns dynamic streaming favicon <img> element.
 * Streams on demand over the internet with automatic SVG avatar fallback.
 */
function getFaviconHtml(domain, altName = "") {
    const clean = (domain || "").replace(/^fetch:\/\//, "").replace(/\/$/, "");
    const streamUrl = getStreamingIconUrl(clean);
    
    return `<img src="${streamUrl}" class="favicon-img" onerror="this.onerror=null; this.parentElement.innerHTML = generateAvatarSvg('${clean}');" alt="${altName || clean}" loading="lazy">`;
}

/**
 * Streams external service branded favicon
 */
function getServiceFaviconHtml(serviceName) {
    const streamUrl = getStreamingIconUrl(serviceName);
    return `<img src="${streamUrl}" class="favicon-img" onerror="this.onerror=null; this.parentElement.innerHTML = generateAvatarSvg('${serviceName}');" alt="${serviceName}" loading="lazy">`;
}
