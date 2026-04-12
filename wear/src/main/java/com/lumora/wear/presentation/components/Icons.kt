package com.lumora.wear.presentation.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.lumora.wear.presentation.theme.LumoraColors

/**
 * Sunrise icon matching the phone app: orange filled circle with horizon line.
 */
@Composable
fun SunriseIcon(size: Dp = 20.dp, color: Color = LumoraColors.sunrise) {
    Canvas(modifier = Modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val r = w * 0.32f

        // Sun circle
        drawCircle(
            color = color,
            radius = r,
            center = Offset(w / 2, h * 0.4f),
        )

        // Horizon line
        drawLine(
            color = color,
            start = Offset(0f, h * 0.85f),
            end = Offset(w, h * 0.85f),
            strokeWidth = w * 0.08f,
            cap = StrokeCap.Round,
        )
    }
}

/**
 * Sunset icon matching the phone app: half circle (top) sinking below horizon line.
 */
@Composable
fun SunsetIcon(size: Dp = 20.dp, color: Color = LumoraColors.sunset) {
    Canvas(modifier = Modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val r = w * 0.32f

        // Half sun (top arc only)
        drawArc(
            color = color,
            startAngle = 180f,
            sweepAngle = 180f,
            useCenter = true,
            topLeft = Offset(w / 2 - r, h * 0.55f - r),
            size = Size(r * 2, r * 2),
        )

        // Horizon line
        drawLine(
            color = color,
            start = Offset(0f, h * 0.85f),
            end = Offset(w, h * 0.85f),
            strokeWidth = w * 0.08f,
            cap = StrokeCap.Round,
        )
    }
}

/**
 * Alarm/clock icon matching the phone app: circle with clock hands.
 */
@Composable
fun AlarmClockIcon(size: Dp = 20.dp, color: Color = LumoraColors.accent) {
    Canvas(modifier = Modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val cx = w / 2
        val cy = h / 2
        val r = w * 0.35f
        val strokeW = w * 0.08f

        // Clock circle
        drawCircle(
            color = color,
            radius = r,
            center = Offset(cx, cy),
            style = Stroke(width = strokeW),
        )

        // Hour hand (pointing up)
        drawLine(
            color = color,
            start = Offset(cx, cy),
            end = Offset(cx, cy - r * 0.55f),
            strokeWidth = strokeW,
            cap = StrokeCap.Round,
        )

        // Minute hand (pointing right)
        drawLine(
            color = color,
            start = Offset(cx, cy),
            end = Offset(cx + r * 0.45f, cy),
            strokeWidth = strokeW,
            cap = StrokeCap.Round,
        )
    }
}
