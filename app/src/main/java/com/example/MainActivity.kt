package com.example

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.VolumeOff
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.KeyboardDoubleArrowRight
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.PanTool
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private var gameWebView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.statusBars())
        }

        setContent {
            MyApplicationTheme {
                PaleLanternScreen(
                    onWebViewReady = { webView -> gameWebView = webView }
                )
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val isDown = event.action == KeyEvent.ACTION_DOWN
        val isUp = event.action == KeyEvent.ACTION_UP
        if (isDown || isUp) {
            val actionName = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_A -> "left"
                KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_D -> "right"
                KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_W -> "up"
                KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_S -> "down"
                KeyEvent.KEYCODE_SPACE -> "jump"
                KeyEvent.KEYCODE_E, KeyEvent.KEYCODE_SHIFT_LEFT, KeyEvent.KEYCODE_SHIFT_RIGHT -> "grab"
                else -> null
            }
            if (actionName != null) {
                gameWebView?.evaluateJavascript(
                    "window.PaleLanternBridge && window.PaleLanternBridge.setControl('$actionName', $isDown);",
                    null
                )
                return true
            }
            if (isDown) {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_F -> {
                        gameWebView?.evaluateJavascript(
                            "window.PaleLanternBridge && window.PaleLanternBridge.flareLantern();",
                            null
                        )
                        return true
                    }
                    KeyEvent.KEYCODE_C -> {
                        gameWebView?.evaluateJavascript(
                            "window.PaleLanternBridge && window.PaleLanternBridge.cycleBoySkin();",
                            null
                        )
                        return true
                    }
                    KeyEvent.KEYCODE_N -> {
                        gameWebView?.evaluateJavascript(
                            "window.PaleLanternBridge && window.PaleLanternBridge.nextHigherLevel();",
                            null
                        )
                        return true
                    }
                    KeyEvent.KEYCODE_R -> {
                        gameWebView?.evaluateJavascript(
                            "window.PaleLanternBridge && window.PaleLanternBridge.restartCheckpoint();",
                            null
                        )
                        return true
                    }
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PaleLanternScreen(
    viewModel: GameViewModel = viewModel(),
    onWebViewReady: (WebView) -> Unit = {}
) {
    val hudState by viewModel.hudState.collectAsStateWithLifecycle()
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    val lifecycleOwner = LocalLifecycleOwner.current

    fun sendControl(action: String, pressed: Boolean) {
        viewModel.setControlActive(action, pressed)
        webViewRef?.evaluateJavascript(
            "window.PaleLanternBridge && window.PaleLanternBridge.setControl('$action', $pressed);",
            null
        )
    }

    DisposableEffect(lifecycleOwner, webViewRef) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.setMuted(true);",
                        null
                    )
                    webViewRef?.onPause()
                }
                Lifecycle.Event.ON_RESUME -> {
                    webViewRef?.onResume()
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.setMuted(${hudState.isMuted});",
                        null
                    )
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    val canvasCd = stringResource(R.string.cd_game_canvas)

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        val isCompactWidth = maxWidth < 500.dp
        val mainBtnSize = if (isCompactWidth) 54.dp else 62.dp
        val secondaryBtnSize = if (isCompactWidth) 48.dp else 50.dp

        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .testTag("game_canvas_webview")
                .semantics { contentDescription = canvasCd },
            factory = { context ->
                WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(AndroidColor.rgb(6, 10, 16))
                    isFocusable = true
                    isFocusableInTouchMode = true
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        mediaPlaybackRequiresUserGesture = false
                        allowFileAccess = true
                        cacheMode = WebSettings.LOAD_NO_CACHE
                    }
                    webViewClient = WebViewClient()
                    webChromeClient = WebChromeClient()
                    loadUrl("file:///android_asset/index.html")
                    webViewRef = this
                    onWebViewReady(this)
                    requestFocus()
                }
            }
        )

        // Top-right silent icon-only HUD:
        // [Change Boy Character Button] [Higher Level Button] [Restart Checkpoint] [Reset Level] [Mute]
        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Character Boy Change Button (cycles through 4 detailed boy silhouettes with golden aura)
            SilentUtilityIconButton(
                icon = Icons.Filled.Face,
                contentDesc = stringResource(R.string.cd_change_boy),
                testTag = "change_boy_button",
                isActive = true,
                onClick = {
                    viewModel.cycleBoySkin()
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.cycleBoySkin();",
                        null
                    )
                }
            )

            // Higher Level Game Switcher Button (advances through Levels 1..4)
            SilentUtilityIconButton(
                icon = Icons.Filled.KeyboardDoubleArrowRight,
                contentDesc = stringResource(R.string.cd_next_level),
                testTag = "next_higher_level_button",
                isActive = true,
                onClick = {
                    viewModel.advanceHigherLevel()
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.nextHigherLevel();",
                        null
                    )
                }
            )

            SilentUtilityIconButton(
                icon = Icons.Outlined.Replay,
                contentDesc = stringResource(R.string.cd_restart_checkpoint),
                testTag = "restart_checkpoint_button",
                onClick = {
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.restartCheckpoint();",
                        null
                    )
                }
            )

            SilentUtilityIconButton(
                icon = Icons.Outlined.Refresh,
                contentDesc = stringResource(R.string.cd_reset_level),
                testTag = "reset_level_button",
                onClick = {
                    viewModel.setGrabHeld(false)
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.resetLevel();",
                        null
                    )
                }
            )

            SilentUtilityIconButton(
                icon = if (hudState.isMuted) {
                    Icons.AutoMirrored.Outlined.VolumeOff
                } else {
                    Icons.AutoMirrored.Outlined.VolumeUp
                },
                contentDesc = stringResource(R.string.cd_toggle_audio),
                testTag = "toggle_audio_button",
                isActive = !hudState.isMuted,
                onClick = {
                    val muted = viewModel.toggleMute()
                    webViewRef?.evaluateJavascript(
                        "window.PaleLanternBridge && window.PaleLanternBridge.setMuted($muted);",
                        null
                    )
                }
            )
        }

        // Bottom atmospheric translucent touch controls (Zero text)
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.navigationBars)
                .padding(horizontal = 18.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            // Left cluster: Left / Right + Rope Climb Up / Down
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                HoldControlButton(
                    icon = Icons.Filled.KeyboardArrowUp,
                    contentDesc = stringResource(R.string.cd_climb_up),
                    testTag = "control_up_button",
                    size = secondaryBtnSize,
                    isActive = hudState.activeUp,
                    isAmberAccent = false,
                    onPressChanged = { sendControl("up", it) }
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    HoldControlButton(
                        icon = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                        contentDesc = stringResource(R.string.cd_move_left),
                        testTag = "control_left_button",
                        size = mainBtnSize,
                        isActive = hudState.activeLeft,
                        isAmberAccent = false,
                        onPressChanged = { sendControl("left", it) }
                    )

                    HoldControlButton(
                        icon = Icons.Filled.KeyboardArrowDown,
                        contentDesc = stringResource(R.string.cd_climb_down),
                        testTag = "control_down_button",
                        size = secondaryBtnSize,
                        isActive = hudState.activeDown,
                        isAmberAccent = false,
                        onPressChanged = { sendControl("down", it) }
                    )

                    HoldControlButton(
                        icon = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDesc = stringResource(R.string.cd_move_right),
                        testTag = "control_right_button",
                        size = mainBtnSize,
                        isActive = hudState.activeRight,
                        isAmberAccent = false,
                        onPressChanged = { sendControl("right", it) }
                    )
                }
            }

            // Right cluster: Lantern Flare Pulse + Grab/Push/Pull + Jump
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Lantern Flare button (repels Bramble Crawlers, scatters Moths, rings cave bells)
                HoldControlButton(
                    icon = if (hudState.activeFlare) Icons.Filled.LightMode else Icons.Outlined.LightMode,
                    contentDesc = stringResource(R.string.cd_flare_lantern),
                    testTag = "control_flare_button",
                    size = secondaryBtnSize,
                    isActive = hudState.activeFlare,
                    isAmberAccent = true,
                    onPressChanged = { pressed ->
                        viewModel.setFlareActive(pressed)
                        if (pressed) {
                            webViewRef?.evaluateJavascript(
                                "window.PaleLanternBridge && window.PaleLanternBridge.flareLantern();",
                                null
                            )
                        }
                    }
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        HoldControlButton(
                            icon = if (hudState.isGrabToggled) Icons.Filled.PanTool else Icons.Outlined.PanTool,
                            contentDesc = stringResource(R.string.cd_grab),
                            testTag = "control_grab_button",
                            size = mainBtnSize,
                            isActive = hudState.isGrabToggled,
                            isAmberAccent = true,
                            onPressChanged = { pressed ->
                                if (pressed) {
                                    val next = !hudState.isGrabToggled
                                    viewModel.setGrabHeld(next)
                                    webViewRef?.evaluateJavascript(
                                        "window.PaleLanternBridge && window.PaleLanternBridge.setControl('grab', $next);",
                                        null
                                    )
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    HoldControlButton(
                        icon = Icons.Filled.KeyboardArrowUp,
                        contentDesc = stringResource(R.string.cd_jump),
                        testTag = "control_jump_button",
                        size = mainBtnSize + 8.dp,
                        isActive = hudState.activeJump,
                        isAmberAccent = true,
                        onPressChanged = { sendControl("jump", it) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SilentUtilityIconButton(
    icon: ImageVector,
    contentDesc: String,
    testTag: String,
    isActive: Boolean = false,
    onClick: () -> Unit
) {
    val containerColor = if (isActive) {
        Color(0x401E293B)
    } else {
        Color(0x280F172A)
    }
    val tintColor = if (isActive) {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.92f)
    } else {
        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f)
    }

    IconButton(
        onClick = onClick,
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(48.dp)
            .border(
                width = 1.dp,
                color = if (isActive) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
                } else {
                    MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
                },
                shape = CircleShape
            )
            .testTag(testTag),
        colors = IconButtonDefaults.iconButtonColors(
            containerColor = containerColor,
            contentColor = tintColor
        )
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDesc,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun HoldControlButton(
    icon: ImageVector,
    contentDesc: String,
    testTag: String,
    size: Dp,
    isActive: Boolean,
    isAmberAccent: Boolean,
    onPressChanged: (Boolean) -> Unit
) {
    val bgColor by animateColorAsState(
        targetValue = when {
            isActive && isAmberAccent -> Color(0x55F59E0B)
            isActive -> Color(0x55475569)
            else -> Color(0x240F172A)
        },
        animationSpec = spring(),
        label = "control_bg"
    )

    val borderColor by animateColorAsState(
        targetValue = when {
            isActive && isAmberAccent -> MaterialTheme.colorScheme.primary.copy(alpha = 0.92f)
            isActive -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.78f)
            isAmberAccent -> MaterialTheme.colorScheme.primary.copy(alpha = 0.36f)
            else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.32f)
        },
        animationSpec = spring(),
        label = "control_border"
    )

    val iconTint = when {
        isActive && isAmberAccent -> Color(0xFFFEF3C7)
        isActive -> Color(0xFFE2E8F0)
        isAmberAccent -> MaterialTheme.colorScheme.primary.copy(alpha = 0.76f)
        else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(size)
            .clip(CircleShape)
            .background(bgColor)
            .border(width = 1.2.dp, color = borderColor, shape = CircleShape)
            .semantics {
                contentDescription = contentDesc
                role = Role.Button
            }
            .pointerInput(testTag) {
                detectTapGestures(
                    onPress = {
                        onPressChanged(true)
                        try {
                            awaitRelease()
                        } finally {
                            onPressChanged(false)
                        }
                    }
                )
            }
            .testTag(testTag)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(size * 0.46f)
        )
    }
}
