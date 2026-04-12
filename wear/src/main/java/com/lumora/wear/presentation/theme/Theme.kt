package com.lumora.wear.presentation.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.MaterialTheme

/** Lumora color palette — matches the phone app's COLORS in constants.ts */
object LumoraColors {
    val background = Color(0xFF1A1A2E)
    val surface = Color(0xFF16213E)
    val surfaceLight = Color(0xFF0F3460)
    val primary = Color(0xFFE94560)
    val accent = Color(0xFFF5A623)
    val sunrise = Color(0xFFFF6B35)
    val sunset = Color(0xFFC44569)
    val textPrimary = Color(0xFFFFFFFF)
    val textSecondary = Color(0xFFA0A0B0)
    val textMuted = Color(0xFF6B6B80)
    val border = Color(0xFF2A2A4A)
    val success = Color(0xFF4ADE80)
    val danger = Color(0xFFEF4444)
}

@Composable
fun LumoraWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        content = content,
    )
}
