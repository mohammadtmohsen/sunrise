plugins {
    id("com.android.application") version "8.7.3"
    id("org.jetbrains.kotlin.android") version "2.2.0"
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0"
}

android {
    namespace = "com.lumora.wear"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lumora.wear"
        minSdk = 30        // Wear OS 3+ (Galaxy Watch 4+)
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    // Compose for Wear OS
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.wear.compose:compose-material3:1.6.1")
    implementation("androidx.wear.compose:compose-foundation:1.6.1")
    implementation("androidx.wear.compose:compose-navigation:1.6.1")

    // Compose core
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Wear OS Tiles
    implementation("androidx.wear.tiles:tiles:1.6.0")
    implementation("androidx.wear.tiles:tiles-material:1.6.0")

    // Guava (required for Tiles ListenableFuture)
    implementation("com.google.guava:guava:33.3.1-android")

    // Wearable Data Layer API
    implementation("com.google.android.gms:play-services-wearable:18.2.0")

    // Horologist - Data Layer helpers
    implementation("com.google.android.horologist:horologist-datalayer:0.7.15")
    implementation("com.google.android.horologist:horologist-compose-layout:0.7.15")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")

    // JSON parsing
    implementation("com.google.code.gson:gson:2.11.0")

    // Wear Input (for RemoteInput / voice text input)
    implementation("androidx.wear:wear-input:1.2.0-alpha02")

    // Core
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.core:core-splashscreen:1.0.1")

    // Debug tooling
    debugImplementation("androidx.compose.ui:ui-tooling")
}
