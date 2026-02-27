pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
        google()
        // Compose 官方极速版仓库
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        google()
        maven("https://maven.pkg.jetbrains.space/public/p/compose/dev")
    }
}

rootProject.name = "LarkSync"

include(":shared")
include(":composeApp")
include(":server")