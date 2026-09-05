package com.dwip.neobrowser.data

import com.dwip.neobrowser.network.NeoSite

object BookmarkManager {
    val defaultBookmarks = listOf(
        NeoSite("share.neo", "NeoShare P2P Drop", "sites/official/share/index.html", "Official", "SH"),
        NeoSite("neural-chat.neo", "NeuralChat AI", "sites/ai/neural-chat/index.html", "AI", "AI"),
        NeoSite("crypto-tracker.neo", "Crypto Tracker", "sites/finance/crypto-tracker/index.html", "Finance", "CT"),
        NeoSite("markdown-studio.neo", "Markdown Studio", "sites/productivity/markdown-studio/index.html", "Productivity", "MD"),
        NeoSite("2048.neo", "2048 Arcade", "sites/games/2048/index.html", "Games", "2K"),
        NeoSite("threat-map.neo", "Cyber Threat Map", "sites/security/threat-map/index.html", "Security", "TM"),
        NeoSite("lofi-beats.neo", "Lo-Fi Beats Radio", "sites/media/lofi-beats/index.html", "Media", "LF"),
        NeoSite("neochat.neo", "NeoChat Messenger", "sites/social/neochat/index.html", "Social", "NC"),
        NeoSite("user.neo", "Neo User Directory", "sites/official/user/index.html", "Identity", "ID"),
        NeoSite("solar-system-3d.neo", "3D Cosmos Explorer", "sites/science/solar-system-3d/index.html", "Science", "3D")
    )
}
