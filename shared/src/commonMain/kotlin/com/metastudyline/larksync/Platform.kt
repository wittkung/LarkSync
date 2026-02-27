package com.metastudyline.larksync

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform