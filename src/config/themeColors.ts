/**
 * Cross-platform Theme Color Tokens (Web Tailwind v4 + Android Jetpack Compose Color.kt)
 */
export const THEME_COLORS = {
  // Primary Brand Colors
  BrandIndigo: '#2731F1',
  AccentPink: '#C84353',
  DeepRed: '#C6172A',

  // Backgrounds & Surfaces
  BackgroundWhite: '#FFFFFF',
  SurfaceOffWhite: '#F4F6F9',
  SurfaceLightPastelBlue: '#EFEFFE', // For subtle timeline backgrounds
  SurfaceLightPastelYellow: '#FFF8EB',
  SurfaceLightPastelGreen: '#ECF9F5',

  // Typography Colors
  TextPrimaryDark: '#1A1A24', // Headers, main titles
  TextSecondaryMuted: '#685858', // Timestamps, inactive tabs, labels

  // Functional/Semantic overrides
  WhiteTransparent20: 'rgba(255, 255, 255, 0.2)', // 0x33FFFFFF - For glassmorphism badges on colored cards
  IndigoTransparent30: 'rgba(39, 49, 241, 0.3)', // 0x4D2731F1 - For custom glowing shadows
} as const;

export const ANDROID_COMPOSE_COLOR_KT = `package com.yourpackage.ui.theme

import androidx.compose.ui.graphics.Color

// Primary Brand Colors
val BrandIndigo = Color(0xFF2731F1)
val AccentPink = Color(0xFFC84353)
val DeepRed = Color(0xFFC6172A)

// Backgrounds & Surfaces
val BackgroundWhite = Color(0xFFFFFFFF)
val SurfaceOffWhite = Color(0xFFF4F6F9)
val SurfaceLightPastelBlue = Color(0xFFEFEFFE) // For subtle timeline backgrounds
val SurfaceLightPastelYellow = Color(0xFFFFF8EB)
val SurfaceLightPastelGreen = Color(0xFFECF9F5)

// Typography Colors
val TextPrimaryDark = Color(0xFF1A1A24) // Headers, main titles
val TextSecondaryMuted = Color(0xFF685858) // Timestamps, inactive tabs, labels

// Functional/Semantic overrides
val WhiteTransparent20 = Color(0x33FFFFFF) // For glassmorphism badges on colored cards
val IndigoTransparent30 = Color(0x4D2731F1) // For custom glowing shadows
`;

export interface ColoredGlowParams {
  hexColor: string;
  alpha?: number;
  borderRadiusPx?: number;
  blurRadiusPx?: number;
  offsetYPx?: number;
  offsetXPx?: number;
}

/**
 * Web equivalent of Jetpack Compose `Modifier.coloredGlow(...)`:
 * Default: alpha = 0.3, borderRadius = 28px, blurRadius = 20px, offsetY = 10px, offsetX = 0px.
 */
export function buildColoredGlowShadow({
  hexColor,
  alpha = 0.3,
  blurRadiusPx = 20,
  offsetYPx = 10,
  offsetXPx = 0,
}: ColoredGlowParams): string {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
  const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
  const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
  return `${offsetXPx}px ${offsetYPx}px ${blurRadiusPx}px rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const ANDROID_COMPOSE_COLORED_GLOW_KT = `package com.yourpackage.ui.theme

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Creates a custom colored glowing drop-shadow for modern UI designs.
 */
fun Modifier.coloredGlow(
    color: Color,
    alpha: Float = 0.3f,
    borderRadius: Dp = 28.dp,
    blurRadius: Dp = 20.dp,
    offsetY: Dp = 10.dp,
    offsetX: Dp = 0.dp
): Modifier = this.drawBehind {
    val shadowColor = color.copy(alpha = alpha).toArgb()
    val transparentColor = color.copy(alpha = 0f).toArgb()

    drawIntoCanvas { canvas ->
        val paint = Paint()
        val frameworkPaint = paint.asFrameworkPaint()
        frameworkPaint.color = transparentColor
        frameworkPaint.setShadowLayer(
            blurRadius.toPx(),
            offsetX.toPx(),
            offsetY.toPx(),
            shadowColor
        )
        canvas.drawRoundRect(
            left = 0f,
            top = 0f,
            right = size.width,
            bottom = size.height,
            radiusX = borderRadius.toPx(),
            radiusY = borderRadius.toPx(),
            paint = paint
        )
    }
}
`;

