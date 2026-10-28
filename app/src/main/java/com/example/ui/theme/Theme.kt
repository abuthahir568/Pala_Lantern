package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PaleLanternColorScheme = darkColorScheme(
    primary = LanternAmber,
    onPrimary = MarshDeepNight,
    primaryContainer = Color(0xFF3B280C),
    onPrimaryContainer = LanternAmberGlow,
    secondary = MarshFogLight,
    onSecondary = MarshDeepNight,
    tertiary = LanternAmberGlow,
    background = MarshDeepNight,
    onBackground = MarshFogLight,
    surface = MarshSlateDark,
    onSurface = MarshFogLight,
    surfaceVariant = MarshSlateMid,
    onSurfaceVariant = MarshFogLight,
    outline = MarshMist
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = PaleLanternColorScheme,
        typography = Typography,
        content = content
    )
}
