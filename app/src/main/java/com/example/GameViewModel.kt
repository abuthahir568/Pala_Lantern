package com.example

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class GameHudState(
    val isMuted: Boolean = false,
    val isGrabToggled: Boolean = false,
    val boySkinIndex: Int = 0,
    val levelIndex: Int = 1,
    val activeLeft: Boolean = false,
    val activeRight: Boolean = false,
    val activeUp: Boolean = false,
    val activeDown: Boolean = false,
    val activeJump: Boolean = false,
    val activeFlare: Boolean = false
)

class GameViewModel : ViewModel() {
    private val _hudState = MutableStateFlow(GameHudState())
    val hudState: StateFlow<GameHudState> = _hudState.asStateFlow()

    fun toggleMute(): Boolean {
        var nextMuted = false
        _hudState.update { state ->
            nextMuted = !state.isMuted
            state.copy(isMuted = nextMuted)
        }
        return nextMuted
    }

    fun setGrabHeld(held: Boolean) {
        _hudState.update { it.copy(isGrabToggled = held) }
    }

    fun cycleBoySkin() {
        _hudState.update { state ->
            state.copy(boySkinIndex = (state.boySkinIndex + 1) % 4)
        }
    }

    fun advanceHigherLevel() {
        _hudState.update { state ->
            state.copy(
                levelIndex = (state.levelIndex % 4) + 1,
                isGrabToggled = false
            )
        }
    }

    fun setFlareActive(active: Boolean) {
        _hudState.update { it.copy(activeFlare = active) }
    }

    fun setControlActive(action: String, pressed: Boolean) {
        _hudState.update { state ->
            when (action) {
                "left" -> state.copy(activeLeft = pressed)
                "right" -> state.copy(activeRight = pressed)
                "up" -> state.copy(activeUp = pressed)
                "down" -> state.copy(activeDown = pressed)
                "jump" -> state.copy(activeJump = pressed)
                "grab" -> state.copy(isGrabToggled = pressed)
                else -> state
            }
        }
    }
}
