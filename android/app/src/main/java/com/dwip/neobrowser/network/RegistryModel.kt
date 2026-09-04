package com.dwip.neobrowser.network

data class NeoSite(
    val domain: String,
    val name: String,
    val path: String = "",
    val category: String = "Official",
    val icon: String = ""
)

data class ServerStatus(
    val status: String,
    val server: String,
    val entries: Int = 0,
    val version: String = ""
)
