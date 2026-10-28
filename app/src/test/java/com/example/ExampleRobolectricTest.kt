package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    @Test
    fun `verify app name, boy skin switcher, and multi-level assets`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("Pale Lantern", appName)

        val jsContent = context.assets.open("game.js").bufferedReader().use { it.readText() }
        assertTrue(jsContent.contains("cycleBoySkin"))
        assertTrue(jsContent.contains("nextHigherLevel"))
        assertTrue(jsContent.contains("the_rotting_bridge"))
        assertTrue(jsContent.contains("drowned_village"))
        assertTrue(jsContent.contains("the_bell_cave"))

        val viewModel = GameViewModel()
        assertEquals(0, viewModel.hudState.value.boySkinIndex)
        viewModel.cycleBoySkin()
        assertEquals(1, viewModel.hudState.value.boySkinIndex)

        assertEquals(1, viewModel.hudState.value.levelIndex)
        viewModel.advanceHigherLevel()
        assertEquals(2, viewModel.hudState.value.levelIndex)
    }
}
