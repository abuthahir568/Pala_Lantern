/**
 * Pale Lantern — High-Graphics 2D Atmospheric Puzzle-Platformer Engine
 *
 * Upgraded Features:
 * - High-definition volumetric moonlight shafts, rain, dynamic shadow silhouettes,
 *   water mirror reflections, fireflies, dust motes, and multi-layered parallax scenery.
 * - Articulated IK-style Boy Character with 4 switchable outfits ("Character Boy Change Button"):
 *   0: Hooded Lantern-Keeper (pointed hood + flowing rain cloak + swinging brass lantern)
 *   1: Forest Stray Boy (LIMBO-inspired tousled hair silhouette + glowing eyes + fluttering scarf)
 *   2: Straw-Hat Diver Boy (wide marsh reed hat + rolled trousers + glass orb lantern)
 *   3: Antler Mask Spirit Boy (hollowed stag-horned mask + tattered cape + twin-ringed lantern)
 * - Lantern Flare Pulse ability (repels Bramble Crawlers & Moth Swarms, illuminates hidden stones).
 * - Multi-Level Progression + Higher Level Switcher ("Higher Level Game"):
 *   Level 1: The Marsh (crates, shallow/deep water, gentle snares, Glow Eel, hidden stones)
 *   Level 2: The Rotting Bridge (collapsing planks, multi-rope swings, Bramble Crawler, Hollow Stag silhouette)
 *   Level 3: Drowned Village (rising & falling tidal floodwaters, buoyant timber rafts, Moth Swarm, Glow Eels)
 *   Level 4: The Bell Cave & Clockwork Ruin (resonant stalactite bells, sound-sensitive Crawlers, timed stone crushers)
 */
(function () {
  "use strict";

  const STORAGE_KEY = "pale_lantern_save_v2";
  const TOTAL_LEVELS = 4;
  const TOTAL_SKINS = 4;

  // ============================================================================
  // 1. PROCEDURAL WEB AUDIO ENGINE
  // ============================================================================
  class ProceduralAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.started = false;
      this.masterGain = null;
      this.windGain = null;
      this.windFilter = null;
      this.nextDripTime = 1.2;
      this.nextBellTime = 6.0;
    }

    init() {
      if (this.started) {
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
        return;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.7;
      this.masterGain.connect(this.ctx.destination);

      const bufferSize = this.ctx.sampleRate * 3;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const out = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }

      const windSource = this.ctx.createBufferSource();
      windSource.buffer = this.noiseBuffer;
      windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = "bandpass";
      this.windFilter.frequency.value = 250;
      this.windFilter.Q.value = 2.0;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.18;

      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      windSource.start(0);

      this.started = true;
    }

    setMuted(muted) {
      this.muted = !!muted;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.08);
      }
    }

    updateAmbience(dt, elapsed, levelId) {
      if (!this.started || !this.ctx || this.muted || this.ctx.state === "suspended") return;

      const baseFreq = levelId === 2 ? 320 : levelId === 4 ? 165 : 225;
      const gust = baseFreq + Math.sin(elapsed * 0.42) * 80 + Math.sin(elapsed * 0.17) * 45;
      this.windFilter.frequency.setTargetAtTime(gust, this.ctx.currentTime, 0.2);
      const gainMod = 0.14 + (Math.sin(elapsed * 0.31) * 0.5 + 0.5) * 0.11;
      this.windGain.gain.setTargetAtTime(gainMod, this.ctx.currentTime, 0.2);

      this.nextDripTime -= dt;
      if (this.nextDripTime <= 0) {
        this.nextDripTime = (levelId === 4 ? 0.9 : 1.7) + Math.random() * 2.8;
        this.playDrip();
      }

      this.nextBellTime -= dt;
      if (this.nextBellTime <= 0) {
        this.nextBellTime = (levelId === 4 ? 7 : 13) + Math.random() * 12;
        this.playDistantBell(1.0);
      }
    }

    playDrip() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const base = 760 + Math.random() * 520;
      osc.type = "sine";
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.065);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    playDistantBell(intensity) {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const notes = [293.66, 329.63, 392.0, 440.0, 523.25];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const scale = intensity || 1.0;

      [1, 2.01, 2.99].forEach((mult, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * mult, now);
        const amp = (0.036 * scale) / (idx + 1);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(amp, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4 - idx * 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3.6);
      });
    }

    playFootstep(inWater, onWood) {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      if (inWater) {
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(640 + Math.random() * 240, now);
        filter.Q.value = 1.8;
        gain.gain.setValueAtTime(0.095, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      } else if (onWood) {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(360 + Math.random() * 90, now);
        gain.gain.setValueAtTime(0.115, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      } else {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(220 + Math.random() * 80, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      }
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(now, Math.random() * 1.5, 0.16);
    }

    playWoodCrack() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(190 + Math.random() * 60, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    playWoodScrape() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      const f = 94 + Math.random() * 28;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.84, now + 0.11);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
    }

    playLanternFlare() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(580, now + 0.28);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.48);
    }

    playSkinSwitch() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      [392.0, 523.25].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        gain.gain.setValueAtTime(0.06, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.28);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.3);
      });
    }

    playSplash(heavy) {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(heavy ? 480 : 780, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + (heavy ? 0.38 : 0.22));
      filter.Q.value = 1.4;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(heavy ? 0.22 : 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.4 : 0.24));
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(now, Math.random(), heavy ? 0.42 : 0.26);
    }

    playTrapSnap() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.09);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playCrusherSlam() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.26);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.32);
    }

    playCheckpointIgnite() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      [329.63, 493.88, 659.25].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.001, now + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.06, now + i * 0.06 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 1.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 1.25);
      });
    }

    playDeathThud() {
      if (!this.started || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.38);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.44);
    }
  }

  // ============================================================================
  // 2. SAVE & CHECKPOINT SYSTEM
  // ============================================================================
  class SaveSystem {
    static load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    static save(data) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_) {}
    }

    static clear() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
  }

  // ============================================================================
  // 3. MULTI-LEVEL JSON DATA (Levels 1 - 4 with escalating higher-level mechanics)
  // ============================================================================
  const LEVELS_JSON = {
    // --------------------------------------------------------------------------
    // LEVEL 1: THE MARSH (Movement, Crates, Shallow/Deep Water, Snare Traps, Eel)
    // --------------------------------------------------------------------------
    1: {
      id: 1,
      key: "the_marsh",
      backdrop: "marsh_backdrop.jpg",
      rainIntensity: 38,
      worldWidth: 4600,
      worldHeight: 760,
      spawn: { x: 130, y: 460 },
      solids: [
        { x: -120, y: 0, w: 120, h: 800, kind: "wall" },
        { x: 0, y: 520, w: 540, h: 260, kind: "earth" },
        { x: 350, y: 472, w: 190, h: 50, kind: "earth" },
        { x: 625, y: 510, w: 455, h: 270, kind: "earth" },
        { x: 1080, y: 405, w: 320, h: 375, kind: "wood_cliff" },
        { x: 1400, y: 558, w: 520, h: 222, kind: "mud" },
        { x: 1580, y: 492, w: 150, h: 70, kind: "earth" },
        { x: 1920, y: 485, w: 590, h: 295, kind: "earth" },
        { x: 2510, y: 392, w: 290, h: 388, kind: "earth" },
        { x: 2800, y: 470, w: 230, h: 310, kind: "earth" },
        { x: 3030, y: 690, w: 530, h: 90, kind: "mud" },
        { x: 3560, y: 470, w: 280, h: 310, kind: "earth" },
        { x: 3840, y: 710, w: 410, h: 70, kind: "abyss" },
        { x: 4250, y: 450, w: 420, h: 330, kind: "pier_end" }
      ],
      waters: [
        { x: 540, y: 548, w: 85, h: 210, deep: false },
        { x: 1400, y: 518, w: 520, h: 55, deep: false },
        { x: 3030, y: 492, w: 530, h: 205, deep: true },
        { x: 3840, y: 555, w: 410, h: 165, deep: true }
      ],
      crates: [
        { id: "c1", x: 830, y: 462, w: 46, h: 46 },
        { id: "c2", x: 2040, y: 437, w: 46, h: 46 },
        { id: "c3", x: 2910, y: 422, w: 52, h: 50 }
      ],
      checkpoints: [
        { id: 0, x: 130, y: 520 },
        { id: 1, x: 700, y: 510 },
        { id: 2, x: 1320, y: 405 },
        { id: 3, x: 1965, y: 485 },
        { id: 4, x: 2740, y: 392 },
        { id: 5, x: 3610, y: 470 }
      ],
      traps: [
        { id: "t1", x: 2255, y: 485, w: 42, h: 16 },
        { id: "t2", x: 2395, y: 485, w: 42, h: 16 }
      ],
      ropes: [{ id: "r1", anchorX: 3365, anchorY: 165, length: 245 }],
      hiddenPlatforms: [
        { id: "hp1", x: 3905, y: 448, w: 86, h: 18 },
        { id: "hp2", x: 4035, y: 418, w: 86, h: 18 },
        { id: "hp3", x: 4155, y: 442, w: 72, h: 18 }
      ],
      collapsingPlanks: [],
      crawlers: [],
      mothSwarms: [],
      crushers: [],
      bells: [],
      eels: [{ id: "eel1", minX: 3060, maxX: 3525, y: 575 }],
      stagSighting: null,
      goal: { x: 4440, y: 450 }
    },

    // --------------------------------------------------------------------------
    // LEVEL 2: THE ROTTING BRIDGE (Collapsing Planks, Multi-Rope Swings, Bramble Crawler, Hollow Stag)
    // --------------------------------------------------------------------------
    2: {
      id: 2,
      key: "the_rotting_bridge",
      backdrop: "bridge_backdrop.jpg",
      rainIntensity: 68,
      worldWidth: 4550,
      worldHeight: 780,
      spawn: { x: 120, y: 380 },
      solids: [
        { x: -120, y: 0, w: 120, h: 800, kind: "wall" },
        { x: 0, y: 430, w: 480, h: 350, kind: "wood_cliff" },
        // Mid tower pier 1
        { x: 890, y: 430, w: 280, h: 350, kind: "wood_cliff" },
        // Rope chasm pier 2
        { x: 1680, y: 410, w: 620, h: 370, kind: "earth" },
        // Elevated bridge abutment requiring crate + lantern repel of Bramble Crawler
        { x: 2300, y: 325, w: 270, h: 455, kind: "wood_cliff" },
        // Broken high span pilings
        { x: 2980, y: 395, w: 250, h: 385, kind: "wood_cliff" },
        // Final cliff & bridge gatehouse
        { x: 3980, y: 395, w: 620, h: 385, kind: "pier_end" }
      ],
      waters: [
        { x: 480, y: 635, w: 3500, h: 155, deep: true }
      ],
      crates: [
        { id: "l2_c1", x: 1790, y: 360, w: 46, h: 46 }
      ],
      checkpoints: [
        { id: 0, x: 120, y: 430 },
        { id: 1, x: 960, y: 430 },
        { id: 2, x: 1730, y: 410 },
        { id: 3, x: 2490, y: 325 },
        { id: 4, x: 3060, y: 395 },
        { id: 5, x: 4040, y: 395 }
      ],
      traps: [
        { id: "l2_t1", x: 1050, y: 430, w: 42, h: 16 }
      ],
      ropes: [
        { id: "l2_r1", anchorX: 1320, anchorY: 110, length: 240 },
        { id: "l2_r2", anchorX: 1525, anchorY: 105, length: 240 },
        { id: "l2_r3", anchorX: 3480, anchorY: 110, length: 225 },
        { id: "l2_r4", anchorX: 3785, anchorY: 115, length: 225 }
      ],
      collapsingPlanks: [
        { id: "cp1", x: 505, y: 432, w: 105, h: 16, delay: 0.48 },
        { id: "cp2", x: 640, y: 432, w: 105, h: 16, delay: 0.45 },
        { id: "cp3", x: 770, y: 432, w: 100, h: 16, delay: 0.45 },
        { id: "cp4", x: 2600, y: 345, w: 105, h: 16, delay: 0.42 },
        { id: "cp5", x: 2735, y: 365, w: 105, h: 16, delay: 0.42 },
        { id: "cp6", x: 2865, y: 382, w: 95, h: 16, delay: 0.42 },
        { id: "cp7", x: 3255, y: 398, w: 105, h: 16, delay: 0.40 },
        { id: "cp8", x: 3600, y: 398, w: 95, h: 16, delay: 0.40 }
      ],
      hiddenPlatforms: [
        { id: "l2_hp1", x: 3875, y: 396, w: 82, h: 18 }
      ],
      // Bramble Crawler: slow thorny creature blocking path, afraid of lantern flare!
      crawlers: [
        { id: "cr1", minX: 1940, maxX: 2240, y: 410 }
      ],
      mothSwarms: [],
      crushers: [],
      bells: [],
      eels: [],
      // Atmospheric Hollow Stag silhouette stalks the background cliff and bounds away
      stagSighting: { triggerX: 2350, x: 2680, y: 325 },
      goal: { x: 4380, y: 395 }
    },

    // --------------------------------------------------------------------------
    // LEVEL 3: DROWNED VILLAGE (Rising/Falling Tidal Water, Floating Rooftops, Moth Swarm)
    // --------------------------------------------------------------------------
    3: {
      id: 3,
      key: "drowned_village",
      backdrop: "village_backdrop.jpg",
      rainIntensity: 52,
      worldWidth: 4500,
      worldHeight: 780,
      spawn: { x: 130, y: 365 },
      tidalWater: { baseY: 520, amplitude: 64, speed: 0.95 },
      solids: [
        { x: -120, y: 0, w: 120, h: 800, kind: "wall" },
        // Sunken gable roof 1
        { x: 0, y: 420, w: 460, h: 360, kind: "wood_cliff" },
        // Flooded street basin floor (safe when tide drops, submerged when tide rises!)
        { x: 460, y: 548, w: 680, h: 232, kind: "mud" },
        // Mid-street chimney stack refuge
        { x: 755, y: 438, w: 115, h: 120, kind: "wood_cliff" },
        // Bell-house rooftop
        { x: 1140, y: 405, w: 460, h: 375, kind: "wood_cliff" },
        // Deep flooded town square (requires pushing floating crate raft & riding tide!)
        { x: 1600, y: 690, w: 720, h: 90, kind: "mud" },
        { x: 1910, y: 430, w: 130, h: 260, kind: "wood_cliff" },
        // Market hall roof
        { x: 2320, y: 410, w: 580, h: 370, kind: "wood_cliff" },
        // Second tidal canal with collapsing eaves & Moth Swarm
        { x: 2900, y: 690, w: 940, h: 90, kind: "mud" },
        { x: 3320, y: 390, w: 170, h: 300, kind: "wood_cliff" },
        // Sanctuary chapel dock
        { x: 3840, y: 395, w: 700, h: 385, kind: "pier_end" }
      ],
      waters: [
        { x: 460, y: 520, w: 3380, h: 260, deep: true, tidal: true }
      ],
      crates: [
        { id: "l3_c1", x: 1470, y: 355, w: 56, h: 50 },
        { id: "l3_c2", x: 2790, y: 360, w: 56, h: 50 }
      ],
      checkpoints: [
        { id: 0, x: 130, y: 420 },
        { id: 1, x: 1200, y: 405 },
        { id: 2, x: 2380, y: 410 },
        { id: 3, x: 3380, y: 390 },
        { id: 4, x: 3910, y: 395 }
      ],
      traps: [
        { id: "l3_t1", x: 2560, y: 410, w: 42, h: 16 }
      ],
      ropes: [
        { id: "l3_r1", anchorX: 1765, anchorY: 120, length: 235 },
        { id: "l3_r2", anchorX: 2165, anchorY: 120, length: 235 },
        { id: "l3_r3", anchorX: 3120, anchorY: 115, length: 225 }
      ],
      collapsingPlanks: [
        { id: "l3_cp1", x: 3530, y: 395, w: 105, h: 16, delay: 0.46 }
      ],
      hiddenPlatforms: [
        { id: "l3_hp1", x: 3685, y: 395, w: 110, h: 18 }
      ],
      crawlers: [],
      // Moth Swarm: follows the lantern and dims its radius unless scattered with Lantern Flare!
      mothSwarms: [
        { id: "ms1", homeX: 2620, homeY: 310 },
        { id: "ms2", homeX: 3620, homeY: 300 }
      ],
      crushers: [],
      bells: [],
      eels: [
        { id: "l3_eel1", minX: 1640, maxX: 2280, y: 580 }
      ],
      stagSighting: null,
      goal: { x: 4320, y: 395 }
    },

    // --------------------------------------------------------------------------
    // LEVEL 4: THE BELL CAVE & MILL RUIN (Resonant Bells, Sound Lures, Timed Crushers)
    // --------------------------------------------------------------------------
    4: {
      id: 4,
      key: "the_bell_cave",
      backdrop: "bridge_backdrop.jpg",
      rainIntensity: 12,
      worldWidth: 4500,
      worldHeight: 780,
      spawn: { x: 130, y: 420 },
      solids: [
        { x: -120, y: 0, w: 120, h: 800, kind: "wall" },
        // Cavern ceiling stalactite shelf
        { x: 0, y: 0, w: 4500, h: 75, kind: "earth" },
        { x: 0, y: 475, w: 760, h: 305, kind: "earth" },
        // Bell gallery ledge
        { x: 850, y: 475, w: 920, h: 305, kind: "earth" },
        // Crusher gauntlet stone floor
        { x: 1860, y: 485, w: 1080, h: 295, kind: "wood_cliff" },
        // Chasm with ropes + hidden spirit stones + Moth Swarm
        { x: 2940, y: 700, w: 860, h: 80, kind: "abyss" },
        // Final subterranean lighthouse stair
        { x: 3800, y: 440, w: 740, h: 340, kind: "pier_end" }
      ],
      waters: [
        { x: 760, y: 530, w: 90, h: 250, deep: false },
        { x: 2940, y: 580, w: 860, h: 130, deep: true }
      ],
      crates: [
        { id: "l4_c1", x: 520, y: 425, w: 46, h: 46 },
        { id: "l4_c2", x: 1960, y: 435, w: 48, h: 48 }
      ],
      checkpoints: [
        { id: 0, x: 130, y: 475 },
        { id: 1, x: 900, y: 475 },
        { id: 2, x: 1900, y: 485 },
        { id: 3, x: 2880, y: 485 },
        { id: 4, x: 3860, y: 440 }
      ],
      traps: [
        { id: "l4_t1", x: 1480, y: 475, w: 42, h: 16 }
      ],
      ropes: [
        { id: "l4_r1", anchorX: 3130, anchorY: 110, length: 270 },
        { id: "l4_r2", anchorX: 3560, anchorY: 110, length: 265 }
      ],
      collapsingPlanks: [
        { id: "l4_cp1", x: 3290, y: 455, w: 110, h: 16, delay: 0.45 }
      ],
      hiddenPlatforms: [
        { id: "l4_hp1", x: 3680, y: 445, w: 92, h: 18 }
      ],
      // Hanging bronze cave bells: ring when touched or flared, luring Bramble Crawlers away!
      bells: [
        { id: "b1", x: 980, y: 340 },
        { id: "b2", x: 1660, y: 340 }
      ],
      crawlers: [
        { id: "l4_cr1", minX: 1020, maxX: 1640, y: 475 }
      ],
      mothSwarms: [
        { id: "l4_ms1", homeX: 3340, homeY: 340 }
      ],
      // Timed heavy stone mill crushers!
      crushers: [
        { id: "crsh1", x: 2190, topY: 115, groundY: 485, w: 74, h: 120, period: 2.8, phase: 0.0 },
        { id: "crsh2", x: 2430, topY: 115, groundY: 485, w: 74, h: 120, period: 2.8, phase: 1.4 },
        { id: "crsh3", x: 2670, topY: 115, groundY: 485, w: 74, h: 120, period: 2.5, phase: 0.7 }
      ],
      eels: [],
      stagSighting: { triggerX: 3720, x: 4050, y: 440 },
      goal: { x: 4320, y: 440 }
    }
  };

  // ============================================================================
  // 4. ENTITY CLASSES
  // ============================================================================
  class Player {
    constructor(x, y, skinIndex) {
      this.x = x;
      this.y = y;
      this.w = 24;
      this.h = 48;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.skin = skinIndex || 0;

      this.onGround = false;
      this.onWood = false;
      this.inShallowWater = false;
      this.coyoteTimer = 0;
      this.jumpBuffer = 0;
      this.landSquash = 0;

      this.grabbedCrate = null;
      this.attachedRope = null;
      this.ropeProgress = 0.85;
      this.ropeCooldown = 0;

      // Dynamic Lantern + Flare + Moth Drain
      this.baseLanternRadius = 235;
      this.lanternDrain = 0; // 0..0.55 when Moth Swarm clings
      this.flareBoost = 0; // 0..1 burst when player activates Lantern Flare
      this.flareCooldown = 0;
      this.lanternFlicker = 0;
      this.lanternSwingAngle = 0;
      this.lanternSwingVel = 0;

      // Flowing scarf / cloak tail physics nodes
      this.scarfNodes = [];
      for (let i = 0; i < 6; i++) {
        this.scarfNodes.push({ x: x, y: y + 16 });
      }

      this.skinSwapFlash = 0;
      this.walkCycle = 0;
      this.stepAccum = 0;
      this.dead = false;
      this.deathTimer = 0;
      this.deathReason = "";
    }

    get centerX() {
      return this.x + this.w * 0.5;
    }

    get centerY() {
      return this.y + this.h * 0.5;
    }

    get effectiveLanternRadius() {
      const drained = this.baseLanternRadius * (1 - this.lanternDrain);
      return drained + this.flareBoost * 155 + this.lanternFlicker;
    }

    get lanternPos() {
      const handOffsetX = this.facing * 16 + Math.sin(this.lanternSwingAngle) * 7;
      const bob = Math.sin(this.walkCycle * 2) * (Math.abs(this.vx) > 15 ? 2.6 : 0.8);
      return {
        x: this.centerX + handOffsetX,
        y: this.y + 24 + bob
      };
    }
  }

  class Crate {
    constructor(cfg) {
      this.id = cfg.id;
      this.spawnX = cfg.x;
      this.spawnY = cfg.y;
      this.x = cfg.x;
      this.y = cfg.y;
      this.w = cfg.w || 46;
      this.h = cfg.h || 46;
      this.vx = 0;
      this.vy = 0;
      this.onGround = false;
      this.inWater = false;
      this.wasInWater = false;
      this.tilt = 0;
      this.scrapeCooldown = 0;
    }

    reset() {
      this.x = this.spawnX;
      this.y = this.spawnY;
      this.vx = 0;
      this.vy = 0;
      this.inWater = false;
      this.wasInWater = false;
      this.tilt = 0;
    }
  }

  class SnareTrap {
    constructor(cfg) {
      this.id = cfg.id;
      this.x = cfg.x;
      this.y = cfg.y - cfg.h;
      this.groundY = cfg.y;
      this.w = cfg.w;
      this.h = cfg.h;
      this.triggered = false;
      this.jawAngle = 0;
    }

    reset() {
      this.triggered = false;
      this.jawAngle = 0;
    }
  }

  class CollapsingPlank {
    constructor(cfg) {
      this.id = cfg.id;
      this.x = cfg.x;
      this.spawnY = cfg.y;
      this.y = cfg.y;
      this.w = cfg.w;
      this.h = cfg.h || 16;
      this.delay = cfg.delay || 0.45;
      this.state = "idle"; // idle | shaking | falling | gone
      this.timer = 0;
      this.vy = 0;
      this.rot = 0;
    }

    reset() {
      this.y = this.spawnY;
      this.state = "idle";
      this.timer = 0;
      this.vy = 0;
      this.rot = 0;
    }

    get isSolid() {
      return this.state === "idle" || this.state === "shaking";
    }
  }

  class RopeVine {
    constructor(cfg) {
      this.id = cfg.id;
      this.anchorX = cfg.anchorX;
      this.anchorY = cfg.anchorY;
      this.length = cfg.length;
      this.angle = 0.06;
      this.angularVel = 0;
    }

    getPointAt(t) {
      const dist = this.length * t;
      return {
        x: this.anchorX + Math.sin(this.angle) * dist,
        y: this.anchorY + Math.cos(this.angle) * dist
      };
    }
  }

  class HiddenPlatform {
    constructor(cfg) {
      this.id = cfg.id;
      this.x = cfg.x;
      this.y = cfg.y;
      this.w = cfg.w;
      this.h = cfg.h;
      this.visibility = 0;
    }

    get isSolid() {
      return this.visibility > 0.3;
    }
  }

  class GlowEel {
    constructor(cfg) {
      this.id = cfg.id;
      this.minX = cfg.minX;
      this.maxX = cfg.maxX;
      this.baseY = cfg.y;
      this.x = (cfg.minX + cfg.maxX) * 0.5;
      this.y = cfg.y;
      this.dir = 1;
      this.phase = Math.random() * Math.PI * 2;
      this.attracted = false;
    }

    update(dt, lanternPos, waterSurfaceY) {
      this.phase += dt * 5.2;
      const dx = lanternPos.x - this.x;
      const dy = lanternPos.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 260 && lanternPos.x > this.minX - 40 && lanternPos.x < this.maxX + 40) {
        this.attracted = true;
        this.dir = dx >= 0 ? 1 : -1;
        this.x += this.dir * 86 * dt;
        const targetY = Math.max(waterSurfaceY + 24, Math.min(this.baseY + 25, lanternPos.y + 42));
        this.y += (targetY - this.y) * Math.min(1, dt * 2.8);
      } else {
        this.attracted = false;
        this.x += this.dir * 48 * dt;
        if (this.x < this.minX) {
          this.x = this.minX;
          this.dir = 1;
        } else if (this.x > this.maxX) {
          this.x = this.maxX;
          this.dir = -1;
        }
        const idleY = Math.max(waterSurfaceY + 28, this.baseY + Math.sin(this.phase * 0.5) * 14);
        this.y += (idleY - this.y) * Math.min(1, dt * 2.0);
      }
    }
  }

  // Bramble Crawler: thorny multi-legged silhouette blocking paths; retreats from Lantern Flare or lured by bells!
  class BrambleCrawler {
    constructor(cfg) {
      this.id = cfg.id;
      this.minX = cfg.minX;
      this.maxX = cfg.maxX;
      this.x = (cfg.minX + cfg.maxX) * 0.5;
      this.y = cfg.y;
      this.w = 54;
      this.h = 34;
      this.dir = -1;
      this.legPhase = 0;
      this.fearTimer = 0;
      this.lureTargetX = null;
      this.lureTimer = 0;
    }

    reset() {
      this.x = (this.minX + this.maxX) * 0.5;
      this.fearTimer = 0;
      this.lureTimer = 0;
    }

    update(dt, player) {
      const lp = player.lanternPos;
      const dist = Math.hypot(lp.x - this.x, lp.y - (this.y - 16));
      const flareActive = player.flareBoost > 0.35 && dist < 240;

      if (flareActive || dist < 95) {
        // Recoils away from intense lantern fire!
        this.fearTimer = flareActive ? 2.4 : 0.4;
        const awayDir = this.x >= lp.x ? 1 : -1;
        const speed = flareActive ? 145 : 72;
        this.x = Math.max(this.minX, Math.min(this.maxX, this.x + awayDir * speed * dt));
        this.legPhase += dt * 11;
        return;
      }

      if (this.fearTimer > 0) {
        this.fearTimer -= dt;
        return;
      }

      if (this.lureTimer > 0 && this.lureTargetX !== null) {
        this.lureTimer -= dt;
        const dx = this.lureTargetX - this.x;
        if (Math.abs(dx) > 10) {
          this.dir = Math.sign(dx);
          this.x = Math.max(this.minX, Math.min(this.maxX, this.x + this.dir * 92 * dt));
          this.legPhase += dt * 8;
        }
        return;
      }

      this.x += this.dir * 34 * dt;
      this.legPhase += dt * 4.2;
      if (this.x <= this.minX) {
        this.x = this.minX;
        this.dir = 1;
      } else if (this.x >= this.maxX) {
        this.x = this.maxX;
        this.dir = -1;
      }
    }
  }

  // Moth Swarm: flutters around the lantern and dims its light unless scattered by Flare!
  class MothSwarm {
    constructor(cfg) {
      this.id = cfg.id;
      this.homeX = cfg.homeX;
      this.homeY = cfg.homeY;
      this.x = cfg.homeX;
      this.y = cfg.homeY;
      this.scatteredTimer = 0;
      this.moths = [];
      for (let i = 0; i < 14; i++) {
        this.moths.push({
          angle: (i / 14) * Math.PI * 2,
          dist: 8 + (i % 4) * 7,
          speed: 4.5 + (i % 3) * 1.6,
          wingPhase: i * 1.1
        });
      }
    }

    update(dt, player) {
      const lp = player.lanternPos;
      const dist = Math.hypot(lp.x - this.x, lp.y - this.y);

      if (player.flareBoost > 0.4 && dist < 210) {
        this.scatteredTimer = 4.2;
      }

      if (this.scatteredTimer > 0) {
        this.scatteredTimer -= dt;
        this.x += (this.homeX - this.x) * Math.min(1, dt * 2.4);
        this.y += (this.homeY - 65 - this.y) * Math.min(1, dt * 2.4);
      } else if (dist < 290) {
        this.x += (lp.x - this.x) * Math.min(1, dt * 2.1);
        this.y += (lp.y - this.y) * Math.min(1, dt * 2.1);
        if (dist < 48) {
          player.lanternDrain = Math.min(0.55, player.lanternDrain + dt * 0.28);
        }
      } else {
        this.x += (this.homeX - this.x) * Math.min(1, dt * 1.2);
        this.y += (this.homeY - this.y) * Math.min(1, dt * 1.2);
      }

      for (const m of this.moths) {
        m.angle += m.speed * dt;
        m.wingPhase += 26 * dt;
      }
    }
  }

  class TimedCrusher {
    constructor(cfg) {
      this.id = cfg.id;
      this.x = cfg.x;
      this.topY = cfg.topY;
      this.groundY = cfg.groundY;
      this.w = cfg.w;
      this.h = cfg.h;
      this.y = cfg.topY;
      this.period = cfg.period || 2.8;
      this.phase = cfg.phase || 0;
      this.slammed = false;
    }

    update(elapsed, audio, cameraX, viewW) {
      const cycle = ((elapsed + this.phase) % this.period) / this.period;
      const maxDropY = this.groundY - this.h;
      if (cycle < 0.18) {
        // Fast slam down!
        const t = cycle / 0.18;
        this.y = this.topY + (maxDropY - this.topY) * (t * t);
        if (t > 0.92 && !this.slammed) {
          this.slammed = true;
          if (this.x > cameraX - 120 && this.x < cameraX + viewW + 120) {
            audio.playCrusherSlam();
          }
        }
      } else if (cycle < 0.36) {
        this.y = maxDropY;
      } else {
        this.slammed = false;
        const t = (cycle - 0.36) / 0.64;
        this.y = maxDropY - (maxDropY - this.topY) * t;
      }
    }
  }

  // ============================================================================
  // 5. MAIN GAME ENGINE
  // ============================================================================
  class PaleLanternGame {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.audio = new ProceduralAudio();

      this.viewHeight = 520;
      this.viewWidth = 960;

      this.keys = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        jumpJustPressed: false,
        grab: false
      };

      // Preload high-detail atmospheric backdrops
      this.backdrops = {};
      ["marsh_backdrop.jpg", "bridge_backdrop.jpg", "village_backdrop.jpg"].forEach((src) => {
        const img = new Image();
        img.loaded = false;
        img.onload = () => {
          img.loaded = true;
        };
        img.src = src;
        this.backdrops[src] = img;
      });

      this.currentLevelId = 1;
      this.activeCheckpointId = 0;
      this.boySkin = 0;
      this.elapsed = 0;
      this.fadeAlpha = 1.0;
      this.fadeTarget = 0.0;
      this.levelTransitioning = false;
      this.transitionTimer = 0;
      this.screenShake = 0;

      this.mistParticles = [];
      this.rainDrops = [];
      this.fireflies = [];
      this.ripples = [];
      this.embers = [];
      this.splinters = [];
      this.soundWaves = [];
      this.treesFar = [];
      this.treesMid = [];
      this.reeds = [];
      this.moonShafts = [];

      const saved = SaveSystem.load();
      if (saved) {
        if (saved.levelId >= 1 && saved.levelId <= TOTAL_LEVELS) {
          this.currentLevelId = saved.levelId;
        }
        if (typeof saved.checkpointId === "number") {
          this.activeCheckpointId = saved.checkpointId;
        }
        if (typeof saved.boySkin === "number") {
          this.boySkin = saved.boySkin % TOTAL_SKINS;
        }
      }

      this.loadLevel(this.currentLevelId, this.activeCheckpointId);
      this.bindEvents();
      this.resize();

      this.lastTimestamp = performance.now();
      this.accumulator = 0;
      requestAnimationFrame((ts) => this.loop(ts));
    }

    bindEvents() {
      window.addEventListener("resize", () => this.resize());
      const unlockAudio = () => this.audio.init();
      window.addEventListener("pointerdown", unlockAudio, { passive: true });
      window.addEventListener("keydown", unlockAudio);

      window.addEventListener("keydown", (e) => {
        if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = true;
        if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = true;
        if (e.code === "ArrowUp" || e.code === "KeyW") this.keys.up = true;
        if (e.code === "ArrowDown" || e.code === "KeyS") this.keys.down = true;
        if (e.code === "Space") {
          if (!this.keys.jump) this.keys.jumpJustPressed = true;
          this.keys.jump = true;
          e.preventDefault();
        }
        if (e.code === "KeyE" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
          this.keys.grab = true;
        }
        if (e.code === "KeyF") this.triggerLanternFlare();
        if (e.code === "KeyC") this.cycleBoyCharacter();
        if (e.code === "KeyN") this.nextHigherLevel();
        if (e.code === "KeyR") this.respawnAtCheckpoint();
      });

      window.addEventListener("keyup", (e) => {
        if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false;
        if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false;
        if (e.code === "ArrowUp" || e.code === "KeyW") this.keys.up = false;
        if (e.code === "ArrowDown" || e.code === "KeyS") this.keys.down = false;
        if (e.code === "Space") this.keys.jump = false;
        if (e.code === "KeyE" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
          this.keys.grab = false;
        }
      });
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
      const w = window.innerWidth || 960;
      const h = window.innerHeight || 540;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.viewHeight = 520;
      this.viewWidth = Math.max(640, (w / Math.max(1, h)) * this.viewHeight);
    }

    persistProgress() {
      SaveSystem.save({
        levelId: this.currentLevelId,
        checkpointId: this.activeCheckpointId,
        boySkin: this.boySkin
      });
    }

    cycleBoyCharacter() {
      this.boySkin = (this.boySkin + 1) % TOTAL_SKINS;
      if (this.player) {
        this.player.skin = this.boySkin;
        this.player.skinSwapFlash = 1.0;
        const lp = this.player.lanternPos;
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          this.embers.push({
            x: this.player.centerX,
            y: this.player.centerY,
            vx: Math.cos(ang) * (35 + Math.random() * 40),
            vy: Math.sin(ang) * (35 + Math.random() * 40) - 15,
            life: 1.0,
            r: 1.8 + Math.random() * 1.6
          });
        }
        void lp;
      }
      this.audio.playSkinSwitch();
      this.persistProgress();
      return this.boySkin;
    }

    nextHigherLevel() {
      const nextId = (this.currentLevelId % TOTAL_LEVELS) + 1;
      this.currentLevelId = nextId;
      this.activeCheckpointId = 0;
      this.audio.playCheckpointIgnite();
      this.loadLevel(this.currentLevelId, 0);
      this.persistProgress();
      return this.currentLevelId;
    }

    triggerLanternFlare() {
      if (!this.player || this.player.dead || this.player.flareCooldown > 0) return;
      this.player.flareBoost = 1.0;
      this.player.flareCooldown = 1.4;
      this.player.lanternDrain = 0;
      this.audio.playLanternFlare();

      const lp = this.player.lanternPos;
      this.soundWaves.push({ x: lp.x, y: lp.y, r: 8, maxR: 210, alpha: 0.65, amber: true });

      // Ring any nearby cave bells!
      for (const b of this.bells) {
        if (Math.hypot(lp.x - b.x, lp.y - b.y) < 220) {
          this.ringBell(b);
        }
      }
    }

    ringBell(bell) {
      bell.swing = 0.45;
      this.audio.playDistantBell(1.6);
      this.soundWaves.push({ x: bell.x, y: bell.y + 18, r: 10, maxR: 320, alpha: 0.75, amber: false });
      for (const cr of this.crawlers) {
        if (Math.abs(cr.x - bell.x) < 700) {
          cr.lureTargetX = bell.x;
          cr.lureTimer = 6.5;
        }
      }
    }

    loadLevel(levelId, checkpointId) {
      const data = LEVELS_JSON[levelId] || LEVELS_JSON[1];
      this.level = data;
      this.solids = data.solids.map((s) => ({ ...s }));
      this.waters = data.waters.map((w) => ({ ...w, initialY: w.y }));
      this.crates = data.crates.map((c) => new Crate(c));
      this.traps = data.traps.map((t) => new SnareTrap(t));
      this.ropes = data.ropes.map((r) => new RopeVine(r));
      this.collapsingPlanks = (data.collapsingPlanks || []).map((cp) => new CollapsingPlank(cp));
      this.hiddenPlatforms = data.hiddenPlatforms.map((hp) => new HiddenPlatform(hp));
      this.crawlers = (data.crawlers || []).map((cr) => new BrambleCrawler(cr));
      this.mothSwarms = (data.mothSwarms || []).map((ms) => new MothSwarm(ms));
      this.crushers = (data.crushers || []).map((cs) => new TimedCrusher(cs));
      this.bells = (data.bells || []).map((b) => ({ ...b, swing: 0, swingVel: 0 }));
      this.eels = data.eels.map((e) => new GlowEel(e));
      this.stag = data.stagSighting
        ? { ...data.stagSighting, active: true, fleeProgress: 0, triggered: false }
        : null;

      this.checkpoints = data.checkpoints.map((cp) => ({
        ...cp,
        lit: cp.id <= checkpointId,
        glow: cp.id <= checkpointId ? 1 : 0
      }));

      const cp = this.checkpoints.find((c) => c.id === checkpointId) || this.checkpoints[0];
      const spawnX = cp ? cp.x : data.spawn.x;
      const spawnY = cp ? cp.y - 50 : data.spawn.y;

      this.player = new Player(spawnX, spawnY, this.boySkin);
      this.camera = {
        x: Math.max(0, spawnX - this.viewWidth * 0.35),
        y: Math.max(0, spawnY - this.viewHeight * 0.55)
      };

      this.generateHighGraphicsScenery();
      this.fadeAlpha = 1.0;
      this.fadeTarget = 0.0;
      this.levelTransitioning = false;
      this.transitionTimer = 0;
    }

    generateHighGraphicsScenery() {
      this.treesFar = [];
      this.treesMid = [];
      this.reeds = [];
      this.mistParticles = [];
      this.rainDrops = [];
      this.fireflies = [];
      this.moonShafts = [];
      this.splinters = [];
      this.soundWaves = [];

      let seed = 4219 + this.level.id * 977;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };

      // Volumetric diagonal moonlight god-rays
      for (let x = 180; x < this.level.worldWidth; x += 380 + rand() * 340) {
        this.moonShafts.push({
          x,
          width: 75 + rand() * 115,
          alpha: 0.035 + rand() * 0.045,
          slant: 120 + rand() * 60
        });
      }

      for (let x = -100; x < this.level.worldWidth + 300; x += 125 + rand() * 105) {
        this.treesFar.push({
          x,
          trunkW: 18 + rand() * 28,
          height: 290 + rand() * 230,
          lean: (rand() - 0.5) * 38
        });
      }

      for (let x = -60; x < this.level.worldWidth + 200; x += 185 + rand() * 165) {
        this.treesMid.push({
          x,
          trunkW: 26 + rand() * 36,
          height: 350 + rand() * 210,
          lean: (rand() - 0.5) * 48
        });
      }

      for (let x = 30; x < this.level.worldWidth - 100; x += 20 + rand() * 26) {
        const groundY = this.findSurfaceY(x);
        if (groundY !== null && groundY < 620 && groundY > 120) {
          this.reeds.push({
            x,
            y: groundY,
            h: 15 + rand() * 26,
            tilt: (rand() - 0.5) * 0.35,
            phase: rand() * Math.PI * 2,
            hasCattail: rand() > 0.6
          });
        }
      }

      for (let i = 0; i < 75; i++) {
        this.mistParticles.push({
          x: rand() * this.level.worldWidth,
          y: 120 + rand() * 480,
          r: 1.4 + rand() * 3.2,
          vx: -7 - rand() * 13,
          alpha: 0.06 + rand() * 0.17,
          phase: rand() * Math.PI * 2
        });
      }

      // Warm bioluminescent fireflies
      for (let i = 0; i < 34; i++) {
        this.fireflies.push({
          x: rand() * this.level.worldWidth,
          y: 220 + rand() * 320,
          phase: rand() * Math.PI * 2,
          speed: 12 + rand() * 18
        });
      }

      // Atmospheric slanted rain streaks
      const rainCount = this.level.rainIntensity || 35;
      for (let i = 0; i < rainCount; i++) {
        this.rainDrops.push({
          x: rand() * 1200,
          y: rand() * 560,
          len: 11 + rand() * 14,
          speed: 520 + rand() * 240
        });
      }
    }

    findSurfaceY(x) {
      let bestY = null;
      for (const s of this.solids) {
        if (s.kind === "wall" || s.kind === "abyss" || s.y < 90) continue;
        if (x >= s.x && x <= s.x + s.w) {
          if (bestY === null || s.y < bestY) bestY = s.y;
        }
      }
      return bestY;
    }

    killPlayer(reason) {
      if (this.player.dead || this.levelTransitioning) return;
      this.player.dead = true;
      this.player.deathReason = reason;
      this.player.deathTimer = 1.0;
      this.player.grabbedCrate = null;
      this.player.attachedRope = null;
      this.screenShake = 7.0;

      if (reason === "trap") {
        this.audio.playTrapSnap();
      } else if (reason === "drown" || reason === "eel") {
        this.audio.playSplash(true);
      } else if (reason === "crush") {
        this.audio.playCrusherSlam();
      } else {
        this.audio.playDeathThud();
      }
    }

    respawnAtCheckpoint() {
      const cp =
        this.checkpoints.find((c) => c.id === this.activeCheckpointId) || this.checkpoints[0];

      for (const crate of this.crates) {
        if (crate.spawnX >= cp.x - 180) {
          crate.reset();
        }
      }
      for (const plank of this.collapsingPlanks) {
        plank.reset();
      }
      for (const cr of this.crawlers) {
        cr.reset();
      }
      for (const trap of this.traps) {
        const jammed = this.crates.some((c) => this.rectsOverlap(c, trap));
        if (!jammed) trap.reset();
      }

      this.player = new Player(cp.x, cp.y - 50, this.boySkin);
      this.fadeAlpha = 1.0;
      this.fadeTarget = 0.0;
    }

    resetFullLevel() {
      this.activeCheckpointId = 0;
      this.loadLevel(this.currentLevelId, 0);
      this.persistProgress();
    }

    rectsOverlap(a, b) {
      return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );
    }

    getSolidColliders(includeCrates, excludeCrate) {
      const list = [];
      for (const s of this.solids) {
        list.push(s);
      }
      for (const plank of this.collapsingPlanks) {
        if (plank.isSolid) {
          list.push({
            x: plank.x,
            y: plank.y,
            w: plank.w,
            h: plank.h,
            kind: "plank",
            ref: plank
          });
        }
      }
      for (const hp of this.hiddenPlatforms) {
        if (hp.isSolid) {
          list.push({ x: hp.x, y: hp.y, w: hp.w, h: hp.h, kind: "spirit" });
        }
      }
      if (includeCrates) {
        for (const c of this.crates) {
          if (c !== excludeCrate) {
            list.push({ x: c.x, y: c.y, w: c.w, h: c.h, kind: "crate", ref: c });
          }
        }
      }
      return list;
    }

    // ==========================================================================
    // FIXED-TIMESTEP UPDATE
    // ==========================================================================
    update(dt) {
      this.elapsed += dt;
      this.screenShake = Math.max(0, this.screenShake - dt * 22);
      this.audio.updateAmbience(dt, this.elapsed, this.currentLevelId);

      // Tidal rising/falling water in Level 3 (Drowned Village)
      if (this.level.tidalWater) {
        const tw = this.level.tidalWater;
        const offset = Math.sin(this.elapsed * tw.speed) * tw.amplitude;
        for (const w of this.waters) {
          if (w.tidal) {
            w.y = tw.baseY + offset;
          }
        }
      }

      if (this.fadeAlpha !== this.fadeTarget) {
        const speed = this.player.dead ? 1.9 : 1.5;
        if (this.fadeAlpha < this.fadeTarget) {
          this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + dt * speed);
        } else {
          this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - dt * speed);
        }
      }

      // Seamless progression into the next Higher Level upon reaching the Beacon Arch!
      if (this.levelTransitioning) {
        this.transitionTimer += dt;
        this.player.vx = 36;
        this.player.x += this.player.vx * dt;
        this.player.walkCycle += dt * 2.2;
        this.updateScarfPhysics(dt);
        if (this.transitionTimer > 1.1) {
          this.fadeTarget = 1.0;
        }
        if (this.transitionTimer > 2.15) {
          this.nextHigherLevel();
        }
        this.updateAtmosphere(dt);
        this.updateCamera(dt);
        this.keys.jumpJustPressed = false;
        return;
      }

      if (this.player.dead) {
        this.player.deathTimer -= dt;
        if (this.player.deathReason === "drown" || this.player.deathReason === "eel") {
          this.player.y += 30 * dt;
        }
        if (this.player.deathTimer < 0.5) {
          this.fadeTarget = 1.0;
        }
        if (this.player.deathTimer <= 0) {
          this.respawnAtCheckpoint();
        }
        this.updateAtmosphere(dt);
        this.keys.jumpJustPressed = false;
        return;
      }

      this.updateCollapsingPlanks(dt);
      this.updateHiddenPlatforms(dt);
      this.updateRopes(dt);
      this.updateCrates(dt);
      this.updatePlayer(dt);
      this.updateScarfPhysics(dt);
      this.updateTraps(dt);
      this.updateCrawlers(dt);
      this.updateMothSwarms(dt);
      this.updateCrushers(dt);
      this.updateBells(dt);
      this.updateEels(dt);
      this.updateStag(dt);
      this.updateCheckpoints(dt);
      this.updateAtmosphere(dt);
      this.updateCamera(dt);

      if (this.player.centerX >= this.level.goal.x && this.player.y <= this.level.goal.y + 18) {
        this.levelTransitioning = true;
        this.transitionTimer = 0;
        this.audio.playCheckpointIgnite();
      }

      this.keys.jumpJustPressed = false;
    }

    updateCollapsingPlanks(dt) {
      for (const plank of this.collapsingPlanks) {
        if (plank.state === "shaking") {
          plank.timer -= dt;
          if (plank.timer <= 0) {
            plank.state = "falling";
            this.audio.playWoodCrack();
            for (let i = 0; i < 7; i++) {
              this.splinters.push({
                x: plank.x + Math.random() * plank.w,
                y: plank.y + 6,
                vx: (Math.random() - 0.5) * 90,
                vy: -40 - Math.random() * 60,
                rot: Math.random() * 3,
                life: 1.0
              });
            }
          }
        } else if (plank.state === "falling") {
          plank.vy += 880 * dt;
          plank.y += plank.vy * dt;
          plank.rot += 1.8 * dt;
          if (plank.y > this.level.worldHeight + 80) {
            plank.state = "gone";
          }
        }
      }
    }

    updateHiddenPlatforms(dt) {
      const lp = this.player.lanternPos;
      const rad = this.player.effectiveLanternRadius;
      for (const hp of this.hiddenPlatforms) {
        const cx = hp.x + hp.w * 0.5;
        const cy = hp.y + hp.h * 0.5;
        const dist = Math.hypot(lp.x - cx, lp.y - cy);
        const target = dist < rad * 0.96 ? 1.0 : 0.0;
        const rate = target > hp.visibility ? 3.8 : 1.5;
        hp.visibility += (target - hp.visibility) * Math.min(1, dt * rate);
      }
    }

    updateRopes(dt) {
      for (const rope of this.ropes) {
        const windForce = Math.sin(this.elapsed * 1.45 + rope.anchorX * 0.01) * 0.15;
        const gravityRestoring = -3.9 * Math.sin(rope.angle);
        rope.angularVel += (gravityRestoring + windForce) * dt;
        rope.angularVel *= Math.pow(0.985, dt * 60);
        rope.angle += rope.angularVel * dt;
      }
    }

    updateCrates(dt) {
      const gravity = 980;
      for (const crate of this.crates) {
        crate.scrapeCooldown = Math.max(0, crate.scrapeCooldown - dt);

        let submergedWater = null;
        for (const w of this.waters) {
          if (this.rectsOverlap(crate, w)) {
            submergedWater = w;
            break;
          }
        }

        crate.wasInWater = crate.inWater;
        crate.inWater = !!submergedWater;

        if (crate.inWater && !crate.wasInWater && crate.vy > 85) {
          this.audio.playSplash(true);
          this.spawnRipple(crate.x + crate.w * 0.5, submergedWater.y, 32);
        }

        if (submergedWater) {
          const targetFloatY = submergedWater.y - 16;
          const depth = crate.y - targetFloatY;
          crate.vy += gravity * dt;
          crate.vy -= depth * 28 * dt;
          crate.vy *= Math.pow(0.86, dt * 60);
          crate.vx *= Math.pow(0.92, dt * 60);
          crate.tilt = Math.sin(this.elapsed * 2.4 + crate.x * 0.03) * 0.055;
        } else {
          crate.vy = Math.min(680, crate.vy + gravity * dt);
          crate.vx *= crate.onGround ? Math.pow(0.72, dt * 60) : Math.pow(0.98, dt * 60);
          crate.tilt *= 0.85;
        }

        crate.x += crate.vx * dt;
        const colliders = this.getSolidColliders(true, crate);
        for (const col of colliders) {
          if (this.rectsOverlap(crate, col)) {
            if (crate.vx > 0) crate.x = col.x - crate.w;
            else if (crate.vx < 0) crate.x = col.x + col.w;
            crate.vx = 0;
          }
        }

        crate.y += crate.vy * dt;
        crate.onGround = false;
        for (const col of colliders) {
          if (this.rectsOverlap(crate, col)) {
            if (crate.vy > 0) {
              crate.y = col.y - crate.h;
              crate.vy = 0;
              crate.onGround = true;
            } else if (crate.vy < 0) {
              crate.y = col.y + col.h;
              crate.vy = 0;
            }
          }
        }
      }
    }

    updatePlayer(dt) {
      const p = this.player;
      p.ropeCooldown = Math.max(0, p.ropeCooldown - dt);
      p.flareCooldown = Math.max(0, p.flareCooldown - dt);
      p.flareBoost = Math.max(0, p.flareBoost - dt * 1.45);
      p.lanternDrain = Math.max(0, p.lanternDrain - dt * 0.09);
      p.skinSwapFlash = Math.max(0, p.skinSwapFlash - dt * 2.4);
      p.landSquash = Math.max(0, p.landSquash - dt * 5.0);
      p.lanternFlicker =
        Math.sin(this.elapsed * 7.5) * 4 + Math.cos(this.elapsed * 13.3) * 2.5;

      // Lantern pendulum swing inertia
      const accelTilt = -p.vx * 0.0022;
      p.lanternSwingVel += (-8.5 * p.lanternSwingAngle + accelTilt * 9.0) * dt;
      p.lanternSwingVel *= Math.pow(0.9, dt * 60);
      p.lanternSwingAngle += p.lanternSwingVel * dt;

      if (p.attachedRope) {
        const rope = p.attachedRope;
        if (this.keys.left) {
          rope.angularVel -= 2.55 * dt;
          p.facing = -1;
        }
        if (this.keys.right) {
          rope.angularVel += 2.55 * dt;
          p.facing = 1;
        }
        if (this.keys.up) {
          p.ropeProgress = Math.max(0.2, p.ropeProgress - 0.58 * dt);
        }
        if (this.keys.down) {
          p.ropeProgress = Math.min(0.98, p.ropeProgress + 0.65 * dt);
        }

        const attachPt = rope.getPointAt(p.ropeProgress);
        p.x = attachPt.x - p.w * 0.5;
        p.y = attachPt.y - 12;
        p.vx = Math.cos(rope.angle) * rope.angularVel * (rope.length * p.ropeProgress);
        p.vy = -Math.sin(rope.angle) * rope.angularVel * (rope.length * p.ropeProgress);

        if (this.keys.jumpJustPressed) {
          p.attachedRope = null;
          p.ropeCooldown = 0.32;
          p.vy = -385;
          p.vx = p.vx * 1.2 + (this.keys.right ? 120 : this.keys.left ? -120 : p.facing * 70);
          this.audio.playFootstep(false, true);
        }
        return;
      }

      // Water check
      let inShallow = false;
      let inDeep = false;
      let waterSurfaceY = 0;
      for (const w of this.waters) {
        if (this.rectsOverlap(p, w)) {
          const submergeDepth = p.y + p.h - w.y;
          if (w.deep && submergeDepth > 32) {
            inDeep = true;
            waterSurfaceY = w.y;
          } else if (submergeDepth > 8) {
            inShallow = true;
            waterSurfaceY = w.y;
          }
        }
      }

      if (inDeep) {
        this.spawnRipple(p.centerX, waterSurfaceY, 36);
        this.killPlayer("drown");
        return;
      }

      if (inShallow && !p.inShallowWater) {
        this.audio.playSplash(false);
        this.spawnRipple(p.centerX, waterSurfaceY, 22);
      }
      p.inShallowWater = inShallow;

      // Crate grab
      if (this.keys.grab && p.onGround) {
        if (!p.grabbedCrate) {
          for (const crate of this.crates) {
            const vertAligned = Math.abs(p.y + p.h - (crate.y + crate.h)) < 28;
            const distLeft = Math.abs(p.x + p.w - crate.x);
            const distRight = Math.abs(p.x - (crate.x + crate.w));
            if (vertAligned && (distLeft < 15 || distRight < 15)) {
              p.grabbedCrate = crate;
              p.facing = crate.x > p.x ? 1 : -1;
              break;
            }
          }
        }
      } else {
        p.grabbedCrate = null;
      }

      if (p.grabbedCrate) {
        const c = p.grabbedCrate;
        const horizGap = p.facing > 0 ? c.x - (p.x + p.w) : p.x - (c.x + c.w);
        if (Math.abs(horizGap) > 24 || Math.abs(p.y + p.h - (c.y + c.h)) > 34) {
          p.grabbedCrate = null;
        }
      }

      const moveDir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      let maxSpeed = 175;
      if (p.inShallowWater) maxSpeed = 115;
      if (p.grabbedCrate) maxSpeed = 92;

      if (moveDir !== 0) {
        if (!p.grabbedCrate) p.facing = moveDir;
        const accel = p.onGround ? 1300 : 820;
        p.vx += moveDir * accel * dt;
        if (Math.abs(p.vx) > maxSpeed) {
          p.vx = Math.sign(p.vx) * maxSpeed;
        }
      } else {
        const decel = p.onGround ? 1400 : 340;
        if (Math.abs(p.vx) <= decel * dt) p.vx = 0;
        else p.vx -= Math.sign(p.vx) * decel * dt;
      }

      if (p.grabbedCrate && moveDir !== 0) {
        const c = p.grabbedCrate;
        c.vx = p.vx;
        if (c.scrapeCooldown <= 0 && c.onGround) {
          this.audio.playWoodScrape();
          c.scrapeCooldown = 0.22;
        }
      }

      if (p.onGround) p.coyoteTimer = 0.12;
      else p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);

      if (this.keys.jumpJustPressed) p.jumpBuffer = 0.13;
      else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

      if (p.jumpBuffer > 0 && p.coyoteTimer > 0 && !p.grabbedCrate) {
        p.vy = p.inShallowWater ? -365 : -422;
        p.onGround = false;
        p.coyoteTimer = 0;
        p.jumpBuffer = 0;
        this.audio.playFootstep(p.inShallowWater, p.onWood);
      }

      if (!this.keys.jump && p.vy < -160) {
        p.vy *= Math.pow(0.55, dt * 12);
      }

      p.vy = Math.min(660, p.vy + 980 * dt);

      // X integration
      p.x += p.vx * dt;
      const colliders = this.getSolidColliders(true, null);
      for (const col of colliders) {
        if (this.rectsOverlap(p, col)) {
          if (col.kind === "crate" && p.onGround && Math.abs(p.vx) > 10) {
            col.ref.vx = p.vx * 0.6;
            if (col.ref.scrapeCooldown <= 0 && col.ref.onGround) {
              this.audio.playWoodScrape();
              col.ref.scrapeCooldown = 0.24;
            }
          }
          if (p.vx > 0) p.x = col.x - p.w;
          else if (p.vx < 0) p.x = col.x + col.w;
          p.vx = 0;
        }
      }

      // Y integration
      const wasOnGround = p.onGround;
      const preLandVy = p.vy;
      p.y += p.vy * dt;
      p.onGround = false;
      p.onWood = false;

      for (const col of colliders) {
        if (this.rectsOverlap(p, col)) {
          if (p.vy > 0) {
            p.y = col.y - p.h;
            p.vy = 0;
            p.onGround = true;
            p.onWood =
              col.kind === "wood_cliff" ||
              col.kind === "crate" ||
              col.kind === "pier_end" ||
              col.kind === "plank";

            // Trigger collapsing plank when stepped on!
            if (col.kind === "plank" && col.ref.state === "idle") {
              col.ref.state = "shaking";
              col.ref.timer = col.ref.delay;
              this.audio.playWoodScrape();
            }

            if (col.kind === "crate" && col.ref.inWater) {
              col.ref.vy += 18 * dt;
              p.x += col.ref.vx * dt;
            }
          } else if (p.vy < 0) {
            p.y = col.y + col.h;
            p.vy = 0;
          }
        }
      }

      if (!wasOnGround && p.onGround) {
        p.landSquash = Math.min(1, preLandVy / 450);
        this.audio.playFootstep(p.inShallowWater, p.onWood);
      }

      if (p.onGround && Math.abs(p.vx) > 12) {
        const stepSpeed = Math.abs(p.vx) * 0.056;
        p.walkCycle += dt * stepSpeed;
        p.stepAccum += dt * Math.abs(p.vx);
        if (p.stepAccum > 44) {
          p.stepAccum = 0;
          this.audio.playFootstep(p.inShallowWater, p.onWood);
          if (p.inShallowWater) {
            this.spawnRipple(p.centerX, waterSurfaceY || p.y + p.h - 4, 15);
          }
        }
      } else {
        p.stepAccum = 25;
      }

      // Rope grab check
      if (p.ropeCooldown <= 0) {
        for (const rope of this.ropes) {
          for (let t = 0.22; t <= 1.0; t += 0.11) {
            const pt = rope.getPointAt(t);
            const dist = Math.hypot(p.centerX - pt.x, p.centerY - pt.y);
            if (dist < 26 && (!p.onGround || this.keys.up || this.keys.grab)) {
              p.attachedRope = rope;
              p.ropeProgress = Math.min(0.95, Math.max(0.24, t));
              rope.angularVel += p.vx * 0.0046;
              p.grabbedCrate = null;
              this.audio.playWoodScrape();
              break;
            }
          }
          if (p.attachedRope) break;
        }
      }

      if (p.y > this.level.worldHeight + 45) {
        this.killPlayer("fall");
      }
    }

    updateScarfPhysics(dt) {
      const p = this.player;
      const neckX = p.centerX - p.facing * 2;
      const neckY = p.y + 15;
      p.scarfNodes[0].x = neckX;
      p.scarfNodes[0].y = neckY;

      const windX = -p.facing * 18 - p.vx * 0.16 + Math.sin(this.elapsed * 4.5) * 8;
      for (let i = 1; i < p.scarfNodes.length; i++) {
        const prev = p.scarfNodes[i - 1];
        const cur = p.scarfNodes[i];
        cur.x += windX * dt;
        cur.y += (24 + Math.sin(this.elapsed * 6 + i) * 10) * dt;

        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const segLen = 4.6;
        if (dist > segLen) {
          cur.x = prev.x + (dx / dist) * segLen;
          cur.y = prev.y + (dy / dist) * segLen;
        }
      }
    }

    updateTraps(dt) {
      for (const trap of this.traps) {
        if (trap.triggered) {
          trap.jawAngle = Math.min(1, trap.jawAngle + dt * 14);
          continue;
        }
        for (const crate of this.crates) {
          const box = { x: trap.x + 4, y: trap.y - 4, w: trap.w - 8, h: trap.h + 6 };
          if (this.rectsOverlap(crate, box)) {
            trap.triggered = true;
            this.audio.playTrapSnap();
            break;
          }
        }
        if (trap.triggered) continue;

        const lethal = { x: trap.x + 8, y: trap.y + 2, w: trap.w - 16, h: trap.h };
        if (this.rectsOverlap(this.player, lethal)) {
          trap.triggered = true;
          this.killPlayer("trap");
        }
      }
    }

    updateCrawlers(dt) {
      for (const cr of this.crawlers) {
        cr.update(dt, this.player);
        const hitBox = { x: cr.x - 20, y: cr.y - 26, w: 40, h: 26 };
        if (this.rectsOverlap(this.player, hitBox)) {
          this.killPlayer("crawler");
        }
      }
    }

    updateMothSwarms(dt) {
      for (const ms of this.mothSwarms) {
        ms.update(dt, this.player);
      }
    }

    updateCrushers(dt) {
      void dt;
      for (const cs of this.crushers) {
        cs.update(this.elapsed, this.audio, this.camera.x, this.viewWidth);

        // Stop crusher early if a sturdy crate is wedged underneath!
        for (const crate of this.crates) {
          if (crate.x + crate.w > cs.x + 6 && crate.x < cs.x + cs.w - 6) {
            if (cs.y + cs.h > crate.y) {
              cs.y = crate.y - cs.h;
            }
          }
        }

        const hazard = { x: cs.x + 6, y: cs.y + 8, w: cs.w - 12, h: cs.h - 8 };
        if (this.rectsOverlap(this.player, hazard)) {
          this.killPlayer("crush");
        }
      }
    }

    updateBells(dt) {
      for (const b of this.bells) {
        b.swingVel += -12 * b.swing * dt;
        b.swingVel *= Math.pow(0.95, dt * 60);
        b.swing += b.swingVel * dt;

        const dist = Math.hypot(this.player.centerX - b.x, this.player.y - (b.y + 20));
        if (dist < 32 && Math.abs(b.swing) < 0.08) {
          this.ringBell(b);
        }
      }
    }

    updateEels(dt) {
      const lp = this.player.lanternPos;
      const waterY = this.waters.length > 0 ? this.waters[this.waters.length - 1].y : 520;
      for (const eel of this.eels) {
        eel.update(dt, lp, waterY);
        const dist = Math.hypot(this.player.centerX - eel.x, this.player.centerY - eel.y);
        if (dist < 28 && !this.player.onGround) {
          this.killPlayer("eel");
        }
      }
    }

    updateStag(dt) {
      if (!this.stag || !this.stag.active) return;
      if (!this.stag.triggered && this.player.centerX > this.stag.triggerX) {
        this.stag.triggered = true;
      }
      if (this.stag.triggered) {
        this.stag.fleeProgress += dt * 1.15;
        this.stag.x += 210 * dt;
        if (this.stag.fleeProgress > 3.2) {
          this.stag.active = false;
        }
      }
    }

    updateCheckpoints(dt) {
      for (const cp of this.checkpoints) {
        if (cp.lit) {
          cp.glow = Math.min(1, cp.glow + dt * 2.4);
          continue;
        }
        const dist = Math.hypot(this.player.centerX - cp.x, this.player.y + this.player.h - cp.y);
        if (dist < 58) {
          cp.lit = true;
          if (cp.id >= this.activeCheckpointId) {
            this.activeCheckpointId = cp.id;
            this.audio.playCheckpointIgnite();
            this.persistProgress();
          }
        }
      }
    }

    spawnRipple(x, y, maxR) {
      if (this.ripples.length > 28) return;
      this.ripples.push({ x, y, r: 3, maxR, alpha: 0.48 });
    }

    updateAtmosphere(dt) {
      for (const m of this.mistParticles) {
        m.x += m.vx * dt;
        m.y += Math.sin(this.elapsed * 0.8 + m.phase) * 4 * dt;
        if (m.x < -40) m.x = this.level.worldWidth + 40;
      }

      for (const r of this.rainDrops) {
        r.x -= r.speed * 0.22 * dt;
        r.y += r.speed * dt;
        if (r.y > 560) {
          r.y = -20;
          r.x = Math.random() * (this.viewWidth + 200);
        }
      }

      for (const f of this.fireflies) {
        f.phase += dt * 2.2;
        f.x += Math.cos(f.phase * 0.7) * f.speed * dt;
        f.y += Math.sin(f.phase * 1.1) * (f.speed * 0.6) * dt;
      }

      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.r += 30 * dt;
        r.alpha -= 0.36 * dt;
        if (r.alpha <= 0 || r.r >= r.maxR) this.ripples.splice(i, 1);
      }

      for (let i = this.splinters.length - 1; i >= 0; i--) {
        const s = this.splinters[i];
        s.x += s.vx * dt;
        s.vy += 520 * dt;
        s.y += s.vy * dt;
        s.rot += 5 * dt;
        s.life -= dt * 0.9;
        if (s.life <= 0) this.splinters.splice(i, 1);
      }

      for (let i = this.soundWaves.length - 1; i >= 0; i--) {
        const sw = this.soundWaves[i];
        sw.r += 240 * dt;
        sw.alpha -= 0.75 * dt;
        if (sw.alpha <= 0 || sw.r >= sw.maxR) this.soundWaves.splice(i, 1);
      }

      if (Math.random() < dt * 11) {
        const lp = this.player.lanternPos;
        this.embers.push({
          x: lp.x + (Math.random() - 0.5) * 8,
          y: lp.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 16,
          vy: -16 - Math.random() * 20,
          life: 1.0,
          r: 1.1 + Math.random() * 1.5
        });
      }
      for (let i = this.embers.length - 1; i >= 0; i--) {
        const e = this.embers[i];
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.life -= dt * 0.78;
        if (e.life <= 0) this.embers.splice(i, 1);
      }
    }

    updateCamera(dt) {
      const lookAhead = this.player.facing * 82;
      const targetX = Math.max(
        0,
        Math.min(
          this.level.worldWidth - this.viewWidth,
          this.player.centerX + lookAhead - this.viewWidth * 0.44
        )
      );
      const targetY = Math.max(
        20,
        Math.min(
          this.level.worldHeight - this.viewHeight - 10,
          this.player.centerY - this.viewHeight * 0.58
        )
      );

      this.camera.x += (targetX - this.camera.x) * Math.min(1, dt * 4.8);
      this.camera.y += (targetY - this.camera.y) * Math.min(1, dt * 4.0);
    }

    // ==========================================================================
    // 6. HIGH-GRAPHICS RENDERER (Volumetric Rays, Boy Outfits, Reflections, Zero Text)
    // ==========================================================================
    render() {
      const ctx = this.ctx;
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const scale = ch / this.viewHeight;

      ctx.save();
      ctx.scale(scale, scale);

      const vw = cw / scale;
      const vh = this.viewHeight;
      this.viewWidth = vw;

      const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
      const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
      ctx.translate(shakeX, shakeY);

      // 1. Deep Atmospheric Gradient Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, vh);
      if (this.currentLevelId === 4) {
        skyGrad.addColorStop(0, "#04070d");
        skyGrad.addColorStop(0.55, "#0d1624");
        skyGrad.addColorStop(1, "#080d16");
      } else {
        skyGrad.addColorStop(0, "#060b13");
        skyGrad.addColorStop(0.48, "#121d2d");
        skyGrad.addColorStop(0.82, "#1d2d42");
        skyGrad.addColorStop(1, "#0b121d");
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, vw, vh);

      // High-resolution generated backdrop parallax
      const bgImg = this.backdrops[this.level.backdrop];
      if (bgImg && bgImg.loaded) {
        ctx.save();
        ctx.globalAlpha = 0.34;
        const imgAspect = bgImg.width / Math.max(1, bgImg.height);
        const drawH = vh;
        const drawW = drawH * imgAspect;
        const parallaxX = -(this.camera.x * 0.14) % drawW;
        for (let ox = parallaxX - drawW; ox < vw + drawW; ox += drawW) {
          ctx.drawImage(bgImg, ox, 0, drawW, drawH);
        }
        ctx.restore();
      }

      // Pale misty moon + distant amber lighthouse beacon
      const moonX = vw * 0.26 - this.camera.x * 0.02;
      const moonY = vh * 0.19;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 130);
      moonGlow.addColorStop(0, "rgba(226, 232, 240, 0.30)");
      moonGlow.addColorStop(0.35, "rgba(148, 163, 184, 0.10)");
      moonGlow.addColorStop(1, "rgba(148, 163, 184, 0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 130, 0, Math.PI * 2);
      ctx.fill();

      const horizonX = vw * 0.84 - this.camera.x * 0.04;
      const horizonY = vh * 0.42;
      const beaconGrad = ctx.createRadialGradient(horizonX, horizonY, 1, horizonX, horizonY, 105);
      beaconGrad.addColorStop(0, "rgba(251, 191, 36, 0.62)");
      beaconGrad.addColorStop(0.25, "rgba(245, 158, 11, 0.18)");
      beaconGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = beaconGrad;
      ctx.beginPath();
      ctx.arc(horizonX, horizonY, 105, 0, Math.PI * 2);
      ctx.fill();

      // Parallax Layers + Volumetric Moonlight Shafts
      this.drawParallaxTrees(ctx, this.treesFar, 0.24, "#0f1826", vw, vh);
      this.drawMoonShafts(ctx, vw, vh);
      this.drawFogBand(ctx, vw, vh, 0.48, 0.15, 0.18);
      this.drawParallaxTrees(ctx, this.treesMid, 0.5, "#0a111b", vw, vh);
      this.drawFogBand(ctx, vw, vh, 0.68, 0.19, 0.35);

      // World Space
      ctx.save();
      ctx.translate(-this.camera.x, -this.camera.y);

      this.drawStagSilhouette(ctx);
      this.drawCheckpoints(ctx);
      this.drawGoalPier(ctx);
      this.drawBells(ctx);
      this.drawRopes(ctx);
      this.drawHiddenPlatforms(ctx);
      this.drawCollapsingPlanks(ctx);
      this.drawWatersBack(ctx);
      this.drawWaterReflections(ctx);
      this.drawEels(ctx);
      this.drawCrates(ctx);
      this.drawCrushers(ctx);
      this.drawTraps(ctx);
      this.drawCrawlers(ctx);
      this.drawHighDetailBoy(ctx);
      this.drawMothSwarms(ctx);
      this.drawSolids(ctx);
      this.drawReeds(ctx);
      this.drawWatersFront(ctx);
      this.drawParticlesAndSoundWaves(ctx);
      this.drawLanternLighting(ctx);

      ctx.restore();

      // Rain, Foreground Mist, Vignette & Silent Level Constellation Dots
      this.drawRain(ctx, vw, vh);
      this.drawFogBand(ctx, vw, vh, 0.87, 0.13, 0.72);
      this.drawVignette(ctx, vw, vh);
      this.drawLevelConstellationDots(ctx, vw);

      if (this.fadeAlpha > 0.005) {
        ctx.fillStyle = `rgba(4, 7, 12, ${this.fadeAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, vw, vh);
      }

      ctx.restore();
    }

    drawMoonShafts(ctx, vw, vh) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ms of this.moonShafts) {
        const sx = ms.x - this.camera.x * 0.35;
        if (sx < -220 || sx > vw + 220) continue;
        const grad = ctx.createLinearGradient(sx, 0, sx - ms.slant, vh);
        grad.addColorStop(0, `rgba(186, 208, 235, ${ms.alpha.toFixed(3)})`);
        grad.addColorStop(0.75, `rgba(148, 163, 184, ${(ms.alpha * 0.4).toFixed(3)})`);
        grad.addColorStop(1, "rgba(148, 163, 184, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + ms.width, 0);
        ctx.lineTo(sx + ms.width - ms.slant, vh);
        ctx.lineTo(sx - ms.slant, vh);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawParallaxTrees(ctx, trees, factor, color, vw, vh) {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      for (const t of trees) {
        const sx = t.x - this.camera.x * factor;
        if (sx < -150 || sx > vw + 150) continue;

        ctx.beginPath();
        ctx.moveTo(sx - t.trunkW * 0.6, vh);
        ctx.quadraticCurveTo(
          sx + t.lean * 0.4,
          vh - t.height * 0.5,
          sx + t.lean - t.trunkW * 0.22,
          vh - t.height
        );
        ctx.lineTo(sx + t.lean + t.trunkW * 0.22, vh - t.height);
        ctx.quadraticCurveTo(
          sx + t.lean * 0.4 + t.trunkW * 0.3,
          vh - t.height * 0.5,
          sx + t.trunkW * 0.6,
          vh
        );
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 2.8;
        const topX = sx + t.lean;
        const topY = vh - t.height * 0.78;
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(topX - 44, topY - 22, topX - 72, topY + 30);
        ctx.moveTo(topX, topY + 26);
        ctx.quadraticCurveTo(topX + 46, topY + 4, topX + 76, topY + 52);
        ctx.stroke();
      }
    }

    drawFogBand(ctx, vw, vh, yRatio, alpha, speedFactor) {
      const baseY = vh * yRatio;
      const grad = ctx.createLinearGradient(0, baseY - 95, 0, baseY + 95);
      grad.addColorStop(0, "rgba(148, 163, 184, 0)");
      grad.addColorStop(0.5, `rgba(148, 163, 184, ${alpha})`);
      grad.addColorStop(1, "rgba(148, 163, 184, 0)");
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, baseY + 95);
      for (let x = 0; x <= vw + 40; x += 40) {
        const wave =
          Math.sin((x + this.camera.x * speedFactor + this.elapsed * 18) * 0.008) * 18 +
          Math.cos((x - this.elapsed * 11) * 0.015) * 10;
        ctx.lineTo(x, baseY - 25 + wave);
      }
      ctx.lineTo(vw, baseY + 95);
      ctx.closePath();
      ctx.fill();
    }

    // ==========================================================================
    // HIGH-DETAIL ARTICULATED BOY RENDERER (4 Switchable Boy Character Designs)
    // ==========================================================================
    drawHighDetailBoy(ctx) {
      const p = this.player;
      ctx.save();

      const cx = p.centerX;
      const feetY = p.y + p.h;
      const squashY = p.landSquash * 4.5;
      const headY = p.y + 10 + squashY;
      const hipY = feetY - 17 + squashY * 0.5;
      const moving = p.onGround && Math.abs(p.vx) > 12;
      const phase = p.walkCycle * 2.3;

      // Flowing multi-segment scarf / cloak ribbon behind boy
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = p.skin === 1 ? "#1e293b" : "#09101a";
      ctx.lineWidth = p.skin === 1 ? 4.2 : 5.5;
      ctx.beginPath();
      for (let i = 0; i < p.scarfNodes.length; i++) {
        const n = p.scarfNodes[i];
        if (i === 0) ctx.moveTo(n.x, n.y);
        else ctx.lineTo(n.x, n.y);
      }
      ctx.stroke();
      ctx.restore();

      // Articulated Two-Bone IK-style Legs (thigh -> knee -> boot)
      ctx.strokeStyle = "#04070d";
      ctx.fillStyle = "#04070d";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const legIdx of [-1, 1]) {
        const legPhase = phase + (legIdx === 1 ? 0 : Math.PI);
        const strideX = moving
          ? Math.sin(legPhase) * 8.5
          : !p.onGround
          ? legIdx * 4.5
          : legIdx * 2.2;
        const liftY = moving
          ? Math.max(0, -Math.cos(legPhase) * 5.5)
          : !p.onGround
          ? 4.0
          : 0;

        const footX = cx + strideX;
        const footY = feetY - 1.5 - liftY;
        const kneeX = (cx + footX) * 0.5 + p.facing * 2.8;
        const kneeY = (hipY + footY) * 0.5 - 1.5;

        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(cx + legIdx * 1.5, hipY);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();

        // Small boot silhouette
        ctx.beginPath();
        ctx.ellipse(footX + p.facing * 1.6, footY, 3.4, 2.0, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rim-lit silhouette torso & outfit details per boySkin (0..3)
      const lean = p.vx * 0.016;
      ctx.fillStyle = "#04070d";

      if (p.skin === 0) {
        // OUTFIT 0: Hooded Lantern-Keeper Boy (pointed hood + flared rain cloak + amber rim)
        ctx.beginPath();
        ctx.moveTo(cx + lean, headY + 4);
        ctx.lineTo(cx + 12 - lean, feetY - 12);
        ctx.lineTo(cx + 3 - lean * 0.5, feetY - 9);
        ctx.lineTo(cx - 4 - lean * 0.5, feetY - 12);
        ctx.lineTo(cx - 12 - lean, feetY - 10);
        ctx.closePath();
        ctx.fill();

        // Rim light along front of cloak from lantern
        ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx + p.facing * 4, headY + 6);
        ctx.lineTo(cx + p.facing * 10 - lean, feetY - 11);
        ctx.stroke();

        // Pointed rain hood + head
        ctx.beginPath();
        ctx.arc(cx + p.facing * 1.5, headY, 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - p.facing * 5, headY - 7);
        ctx.lineTo(cx - p.facing * 16, headY - 2);
        ctx.lineTo(cx - p.facing * 5, headY + 4);
        ctx.closePath();
        ctx.fill();
      } else if (p.skin === 1) {
        // OUTFIT 1: Forest Stray Boy (LIMBO-inspired tousled hair + slim tunic + twin glowing eyes)
        ctx.beginPath();
        ctx.roundRect(cx - 6.5 + lean * 0.5, headY + 6, 13, 19, 4);
        ctx.fill();

        // Boy head with detailed windswept hair tufts
        ctx.beginPath();
        ctx.arc(cx + p.facing * 1.2, headY, 9.2, 0, Math.PI * 2);
        ctx.fill();

        //Tousled hair spikes
        ctx.beginPath();
        ctx.moveTo(cx - 7, headY - 5);
        ctx.lineTo(cx - 11 - p.facing * 2, headY - 9);
        ctx.lineTo(cx - 3, headY - 8);
        ctx.lineTo(cx, headY - 13);
        ctx.lineTo(cx + 4, headY - 9);
        ctx.lineTo(cx + 9, headY - 11);
        ctx.lineTo(cx + 8, headY - 4);
        ctx.closePath();
        ctx.fill();
      } else if (p.skin === 2) {
        // OUTFIT 2: Marsh Reed-Hat Boy (wide conical weaver hat + poncho)
        ctx.beginPath();
        ctx.moveTo(cx, headY + 5);
        ctx.lineTo(cx + 13 - lean, feetY - 14);
        ctx.lineTo(cx - 13 - lean, feetY - 14);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + p.facing, headY + 1, 8.2, 0, Math.PI * 2);
        ctx.fill();

        // Wide woven marsh hat silhouette with moonlight rim
        ctx.beginPath();
        ctx.moveTo(cx - 18, headY - 2);
        ctx.quadraticCurveTo(cx, headY - 17, cx + 18, headY - 2);
        ctx.quadraticCurveTo(cx, headY - 5, cx - 18, headY - 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(186, 208, 235, 0.35)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // OUTFIT 3: Spirit Antler-Mask Boy (pale horned mask + tattered feather mantle)
        ctx.beginPath();
        ctx.moveTo(cx, headY + 5);
        ctx.lineTo(cx + 11 - lean, feetY - 11);
        ctx.lineTo(cx, feetY - 14);
        ctx.lineTo(cx - 11 - lean, feetY - 11);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx + p.facing, headY, 8.8, 0, Math.PI * 2);
        ctx.fill();

        // Delicate stag antlers rising from mask
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - 3, headY - 7);
        ctx.lineTo(cx - 9, headY - 18);
        ctx.moveTo(cx - 6, headY - 13);
        ctx.lineTo(cx - 12, headY - 14);

        ctx.moveTo(cx + 3, headY - 7);
        ctx.lineTo(cx + 9, headY - 18);
        ctx.moveTo(cx + 6, headY - 13);
        ctx.lineTo(cx + 12, headY - 14);
        ctx.stroke();
      }

      // Luminous expressive eyes inside silhouette
      if (!p.dead) {
        ctx.fillStyle = p.skin === 1 ? "#ffffff" : "#fef3c7";
        const eyeBaseX = cx + p.facing * 4.4;
        ctx.beginPath();
        ctx.arc(eyeBaseX, headY + 0.5, 1.6, 0, Math.PI * 2);
        if (p.skin === 1) {
          ctx.arc(eyeBaseX - p.facing * 3.4, headY + 0.8, 1.35, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Articulated Shoulder -> Elbow -> Hand holding swinging Lantern
      const lp = p.lanternPos;
      const shoulderX = cx + p.facing * 2.5;
      const shoulderY = headY + 9;
      const elbowX = (shoulderX + lp.x) * 0.5 - p.facing * 2;
      const elbowY = (shoulderY + (lp.y - 6)) * 0.5 + 3;

      ctx.strokeStyle = "#04070d";
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(lp.x, lp.y - 6);
      ctx.stroke();

      // Detailed swinging wrought-iron lantern cage + glowing core
      ctx.save();
      ctx.translate(lp.x, lp.y - 5);
      ctx.rotate(p.lanternSwingAngle);

      // Handle bail
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 2, 3.2, Math.PI, 0);
      ctx.stroke();

      // Lantern cap & base
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-4.2, 2, 8.4, 2.2);
      ctx.fillRect(-3.8, 11, 7.6, 2.2);

      // Warm amber glass chamber
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.roundRect(-3.2, 4, 6.4, 7.2, 1.5);
      ctx.fill();

      // White-hot flame wick center
      ctx.fillStyle = "#fffbeb";
      ctx.beginPath();
      ctx.arc(0, 7.6, 2.0 + p.flareBoost * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Golden aura ring when switching boy character skin
      if (p.skinSwapFlash > 0.02) {
        ctx.strokeStyle = `rgba(251, 191, 36, ${p.skinSwapFlash.toFixed(3)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(cx, p.centerY, 26 + (1 - p.skinSwapFlash) * 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawStagSilhouette(ctx) {
      if (!this.stag || !this.stag.active) return;
      const sx = this.stag.x;
      const sy = this.stag.y - Math.abs(Math.sin(this.stag.fleeProgress * 7)) * 18;
      const alpha = Math.max(0, 1 - this.stag.fleeProgress * 0.35);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#070d16";
      ctx.strokeStyle = "#070d16";
      ctx.lineCap = "round";

      // Tall mythical Hollow Stag torso & slender legs
      ctx.beginPath();
      ctx.ellipse(sx, sy - 46, 28, 13, -0.08, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 3.5;
      for (const lx of [-18, -8, 10, 20]) {
        const stride = this.stag.triggered ? Math.sin(this.stag.fleeProgress * 12 + lx) * 12 : 0;
        ctx.beginPath();
        ctx.moveTo(sx + lx, sy - 38);
        ctx.lineTo(sx + lx + stride, sy);
        ctx.stroke();
      }

      // Long arched neck & head
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(sx + 18, sy - 50);
      ctx.lineTo(sx + 26, sy - 82);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(sx + 32, sy - 85, 11, 5.5, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Grand crown of antlers
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sx + 25, sy - 88);
      ctx.quadraticCurveTo(sx + 10, sy - 115, sx + 22, sy - 128);
      ctx.moveTo(sx + 17, sy - 106);
      ctx.lineTo(sx + 4, sy - 114);
      ctx.moveTo(sx + 28, sy - 88);
      ctx.quadraticCurveTo(sx + 38, sy - 114, sx + 48, sy - 124);
      ctx.stroke();

      // Glowing pale eye
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.arc(sx + 34, sy - 86, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawCollapsingPlanks(ctx) {
      for (const plank of this.collapsingPlanks) {
        if (plank.state === "gone") continue;
        ctx.save();
        const shakeX = plank.state === "shaking" ? (Math.random() - 0.5) * 4.5 : 0;
        const shakeY = plank.state === "shaking" ? (Math.random() - 0.5) * 2.5 : 0;
        ctx.translate(plank.x + plank.w * 0.5 + shakeX, plank.y + plank.h * 0.5 + shakeY);
        ctx.rotate(plank.rot);

        ctx.fillStyle = "#0e1724";
        ctx.fillRect(-plank.w * 0.5, -plank.h * 0.5, plank.w, plank.h);
        ctx.strokeStyle = plank.state === "shaking" ? "#f59e0b" : "#293a50";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-plank.w * 0.5, -plank.h * 0.5, plank.w, plank.h);

        // Cracked wood grain notches
        ctx.beginPath();
        ctx.moveTo(-12, -plank.h * 0.5);
        ctx.lineTo(-4, plank.h * 0.5);
        ctx.moveTo(14, -plank.h * 0.5);
        ctx.lineTo(8, plank.h * 0.5);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawCrawlers(ctx) {
      for (const cr of this.crawlers) {
        ctx.save();
        ctx.translate(cr.x, cr.y);

        // Spiky bramble carapace
        ctx.fillStyle = "#060a11";
        ctx.beginPath();
        ctx.arc(0, -14, 19, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // Thorns on back
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2;
        for (let a = -2.6; a <= -0.5; a += 0.42) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 16, -14 + Math.sin(a) * 16);
          ctx.lineTo(Math.cos(a) * 25, -14 + Math.sin(a) * 25);
          ctx.stroke();
        }

        // Articulated spider-like legs
        ctx.strokeStyle = "#04070d";
        ctx.lineWidth = 2.6;
        for (let i = -3; i <= 3; i++) {
          if (i === 0) continue;
          const step = Math.sin(cr.legPhase + i * 1.1) * 4;
          ctx.beginPath();
          ctx.moveTo(i * 4.5, -12);
          ctx.lineTo(i * 8.5, -20 - Math.abs(step) * 0.5);
          ctx.lineTo(i * 10.5 + step, 0);
          ctx.stroke();
        }

        // Tiny amber-red eyes
        ctx.fillStyle = cr.fearTimer > 0 ? "#fde68a" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(cr.dir * 11, -13, 1.8, 0, Math.PI * 2);
        ctx.arc(cr.dir * 7, -15, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    drawMothSwarms(ctx) {
      for (const ms of this.mothSwarms) {
        for (const m of ms.moths) {
          const mx = ms.x + Math.cos(m.angle) * m.dist;
          const my = ms.y + Math.sin(m.angle * 1.3) * (m.dist * 0.7);
          const wing = Math.sin(m.wingPhase) * 4.5;

          ctx.strokeStyle = ms.scatteredTimer > 0 ? "#64748b" : "#fde68a";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(mx - 3.5, my - wing);
          ctx.lineTo(mx, my);
          ctx.lineTo(mx + 3.5, my - wing);
          ctx.stroke();
        }
      }
    }

    drawCrushers(ctx) {
      for (const cs of this.crushers) {
        if (cs.x + cs.w < this.camera.x - 80 || cs.x > this.camera.x + this.viewWidth + 80) {
          continue;
        }
        // Iron chain from cavern ceiling
        ctx.strokeStyle = "#162233";
        ctx.lineWidth = 5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(cs.x + cs.w * 0.5, 65);
        ctx.lineTo(cs.x + cs.w * 0.5, cs.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Heavy carved stone block
        ctx.fillStyle = "#080e17";
        ctx.fillRect(cs.x, cs.y, cs.w, cs.h);
        ctx.strokeStyle = "#26364a";
        ctx.lineWidth = 2;
        ctx.strokeRect(cs.x + 1, cs.y + 1, cs.w - 2, cs.h - 2);

        // Serrated bottom teeth
        ctx.fillStyle = "#131e2e";
        for (let tx = cs.x + 6; tx < cs.x + cs.w - 10; tx += 14) {
          ctx.beginPath();
          ctx.moveTo(tx, cs.y + cs.h);
          ctx.lineTo(tx + 5, cs.y + cs.h + 7);
          ctx.lineTo(tx + 10, cs.y + cs.h);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    drawBells(ctx) {
      for (const b of this.bells) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -265);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.rotate(b.swing);
        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.quadraticCurveTo(-12, 18, -18, 28);
        ctx.lineTo(18, 28);
        ctx.quadraticCurveTo(12, 18, 9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(0, 30, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    drawWaterReflections(ctx) {
      const lp = this.player.lanternPos;
      for (const w of this.waters) {
        if (lp.x >= w.x - 80 && lp.x <= w.x + w.w + 80 && lp.y < w.y + 10) {
          const distY = w.y - lp.y;
          if (distY < 240) {
            ctx.save();
            const alpha = Math.max(0, (1 - distY / 240) * 0.28);
            const shimmerX = Math.sin(this.elapsed * 6) * 4;
            const reflGrad = ctx.createRadialGradient(
              lp.x + shimmerX,
              w.y + 18,
              2,
              lp.x + shimmerX,
              w.y + 28,
              75
            );
            reflGrad.addColorStop(0, `rgba(251, 191, 36, ${alpha.toFixed(3)})`);
            reflGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
            ctx.fillStyle = reflGrad;
            ctx.fillRect(w.x, w.y, w.w, Math.min(w.h, 85));
            ctx.restore();
          }
        }
      }
    }

    drawSolids(ctx) {
      for (const s of this.solids) {
        if (s.x + s.w < this.camera.x - 60 || s.x > this.camera.x + this.viewWidth + 60) {
          continue;
        }
        if (s.kind === "abyss") continue;

        if (s.kind === "wood_cliff" || s.kind === "pier_end") {
          ctx.fillStyle = "#080d14";
          ctx.fillRect(s.x, s.y, s.w, 22);
          ctx.fillStyle = "#050910";
          ctx.fillRect(s.x + 8, s.y + 22, s.w - 16, s.h - 22);

          ctx.strokeStyle = "#243449";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 1);
          ctx.lineTo(s.x + s.w, s.y + 1);
          ctx.stroke();

          for (let px = s.x + 18; px < s.x + s.w - 12; px += 58) {
            ctx.fillStyle = "#04070c";
            ctx.fillRect(px, s.y, 12, s.h);
          }
        } else {
          ctx.fillStyle = "#05080e";
          ctx.fillRect(s.x, s.y + 4, s.w, s.h);

          if (s.y > 90) {
            ctx.fillStyle = "#1a273b";
            ctx.fillRect(s.x, s.y, s.w, 4);

            ctx.fillStyle = "#05080e";
            for (let bx = s.x + 10; bx < s.x + s.w - 14; bx += 26) {
              const bumpH = 3 + ((bx * 17) % 5);
              ctx.beginPath();
              ctx.arc(bx, s.y + 4, bumpH + 4, Math.PI, 0);
              ctx.fill();
            }
          }
        }
      }
    }

    drawReeds(ctx) {
      ctx.strokeStyle = "#0b121c";
      ctx.fillStyle = "#0b121c";
      for (const r of this.reeds) {
        if (r.x < this.camera.x - 30 || r.x > this.camera.x + this.viewWidth + 30) continue;
        const sway = Math.sin(this.elapsed * 2.0 + r.phase) * 4.5 + r.tilt * 10;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + 2);
        ctx.quadraticCurveTo(r.x + sway * 0.5, r.y - r.h * 0.5, r.x + sway, r.y - r.h);
        ctx.stroke();

        if (r.hasCattail) {
          ctx.beginPath();
          ctx.ellipse(
            r.x + sway * 0.88,
            r.y - r.h * 0.78,
            2.4,
            5.5,
            sway * 0.03,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }

    drawWatersBack(ctx) {
      for (const w of this.waters) {
        if (w.x + w.w < this.camera.x - 50 || w.x > this.camera.x + this.viewWidth + 50) continue;
        const grad = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
        if (w.deep) {
          grad.addColorStop(0, "rgba(18, 32, 49, 0.74)");
          grad.addColorStop(1, "rgba(4, 8, 14, 0.97)");
        } else {
          grad.addColorStop(0, "rgba(26, 43, 64, 0.56)");
          grad.addColorStop(1, "rgba(8, 14, 23, 0.86)");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(w.x, w.y, w.w, w.h);
      }
    }

    drawWatersFront(ctx) {
      for (const w of this.waters) {
        if (w.x + w.w < this.camera.x - 50 || w.x > this.camera.x + this.viewWidth + 50) continue;
        ctx.strokeStyle = "rgba(186, 208, 235, 0.38)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let x = w.x; x <= w.x + w.w; x += 14) {
          const wy = w.y + Math.sin(x * 0.06 + this.elapsed * 2.9) * 2.0;
          if (x === w.x) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }

      for (const r of this.ripples) {
        ctx.strokeStyle = `rgba(186, 208, 235, ${r.alpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawEels(ctx) {
      for (const eel of this.eels) {
        ctx.save();
        const segments = 12;
        const segLen = 8.5;
        for (let i = segments - 1; i >= 0; i--) {
          const wave = Math.sin(eel.phase - i * 0.55) * (3 + i * 0.45);
          const sx = eel.x - eel.dir * i * segLen;
          const sy = eel.y + wave;
          const radius = Math.max(2.0, 7.4 - i * 0.5);
          ctx.fillStyle = "#040810";
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        const headX = eel.x + eel.dir * 8;
        const headY = eel.y + Math.sin(eel.phase) * 2.5 - 5;
        const glowR = eel.attracted ? 36 : 24;
        const lureGrad = ctx.createRadialGradient(headX, headY, 1, headX, headY, glowR);
        lureGrad.addColorStop(0, "rgba(251, 191, 36, 0.88)");
        lureGrad.addColorStop(0.35, "rgba(245, 158, 11, 0.26)");
        lureGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.fillStyle = lureGrad;
        ctx.beginPath();
        ctx.arc(headX, headY, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fde68a";
        ctx.beginPath();
        ctx.arc(headX, headY, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    drawCrates(ctx) {
      for (const c of this.crates) {
        ctx.save();
        ctx.translate(c.x + c.w * 0.5, c.y + c.h * 0.5);
        ctx.rotate(c.tilt);

        const hw = c.w * 0.5;
        const hh = c.h * 0.5;
        ctx.fillStyle = "#0c1522";
        ctx.fillRect(-hw, -hh, c.w, c.h);

        ctx.strokeStyle = "#2b3d54";
        ctx.lineWidth = 2.2;
        ctx.strokeRect(-hw + 1, -hh + 1, c.w - 2, c.h - 2);

        ctx.beginPath();
        ctx.moveTo(-hw + 5, -hh + 5);
        ctx.lineTo(hw - 5, hh - 5);
        ctx.moveTo(hw - 5, -hh + 5);
        ctx.lineTo(-hw + 5, hh - 5);
        ctx.stroke();

        // Corner iron rivets
        ctx.fillStyle = "#475569";
        for (const rx of [-hw + 4, hw - 4]) {
          for (const ry of [-hh + 4, hh - 4]) {
            ctx.beginPath();
            ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (this.player.grabbedCrate === c) {
          ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
          ctx.lineWidth = 2;
          ctx.strokeRect(-hw, -hh, c.w, c.h);
        }
        ctx.restore();
      }
    }

    drawTraps(ctx) {
      const lp = this.player.lanternPos;
      for (const t of this.traps) {
        const cx = t.x + t.w * 0.5;
        const cy = t.groundY;
        const distToLantern = Math.hypot(lp.x - cx, lp.y - cy);
        const glint = Math.max(0, 1 - distToLantern / 260);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = "#090f17";
        ctx.fillRect(-t.w * 0.46, -4, t.w * 0.92, 5);

        const angleSpread = (1 - t.jawAngle) * 1.28 + 0.12;
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.rotate(side * angleSpread);
          ctx.fillStyle = "#111b29";
          ctx.strokeStyle =
            glint > 0.05
              ? `rgba(245, 180, 75, ${(0.24 + glint * 0.52).toFixed(2)})`
              : "#29384d";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(side * 4, -t.w * 0.44);
          ctx.lineTo(0, -t.w * 0.48);
          ctx.lineTo(-side * 2, -t.w * 0.25);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        if (!t.triggered) {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(-6, -6, 12, 3);
        }
        ctx.restore();
      }
    }

    drawRopes(ctx) {
      for (const rope of this.ropes) {
        const tip = rope.getPointAt(1.0);
        const mid = rope.getPointAt(0.5);

        ctx.strokeStyle = "#0b131e";
        ctx.lineWidth = 4.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(rope.anchorX, rope.anchorY);
        ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
        ctx.stroke();

        ctx.strokeStyle = "#2b3e56";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = "#182538";
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 4.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawHiddenPlatforms(ctx) {
      for (const hp of this.hiddenPlatforms) {
        const v = hp.visibility;
        ctx.save();
        if (v > 0.04) {
          ctx.fillStyle = `rgba(17, 26, 39, ${(v * 0.95).toFixed(3)})`;
          ctx.fillRect(hp.x, hp.y, hp.w, hp.h);

          ctx.strokeStyle = `rgba(245, 158, 11, ${(0.2 + v * 0.7).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(hp.x + 1, hp.y + 1, hp.w - 2, hp.h - 2);

          ctx.fillStyle = `rgba(251, 191, 36, ${(v * 0.8).toFixed(3)})`;
          for (let rx = hp.x + 16; rx < hp.x + hp.w - 12; rx += 22) {
            ctx.beginPath();
            ctx.arc(rx, hp.y + hp.h * 0.5, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          const pulse = 0.09 + Math.sin(this.elapsed * 2.5 + hp.x) * 0.04;
          ctx.strokeStyle = `rgba(148, 163, 184, ${pulse.toFixed(3)})`;
          ctx.setLineDash([5, 7]);
          ctx.lineWidth = 1.2;
          ctx.strokeRect(hp.x, hp.y, hp.w, hp.h);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    drawCheckpoints(ctx) {
      for (const cp of this.checkpoints) {
        if (cp.x < this.camera.x - 80 || cp.x > this.camera.x + this.viewWidth + 80) continue;
        const postTop = cp.y - 56;
        ctx.strokeStyle = "#0d1520";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cp.x, cp.y);
        ctx.lineTo(cp.x, postTop);
        ctx.lineTo(cp.x + 15, postTop);
        ctx.stroke();

        const lx = cp.x + 15;
        const ly = postTop + 10;
        ctx.fillStyle = "#131e2e";
        ctx.fillRect(lx - 5, ly - 4, 10, 13);

        if (cp.lit) {
          const r = 50 * cp.glow + Math.sin(this.elapsed * 5 + cp.id) * 3;
          const g = ctx.createRadialGradient(lx, ly + 2, 1, lx, ly + 2, Math.max(4, r));
          g.addColorStop(0, "rgba(254, 243, 199, 0.96)");
          g.addColorStop(0.25, "rgba(245, 158, 11, 0.48)");
          g.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(lx, ly + 2, Math.max(4, r), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawGoalPier(ctx) {
      const gx = this.level.goal.x;
      const gy = this.level.goal.y;

      ctx.strokeStyle = "#0b121c";
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(gx - 30, gy);
      ctx.lineTo(gx - 23, gy - 118);
      ctx.quadraticCurveTo(gx, gy - 142, gx + 23, gy - 118);
      ctx.lineTo(gx + 30, gy);
      ctx.stroke();

      const by = gy - 98 + Math.sin(this.elapsed * 2.1) * 2.5;
      const grad = ctx.createRadialGradient(gx, by, 2, gx, by, 145);
      grad.addColorStop(0, "rgba(254, 243, 199, 1)");
      grad.addColorStop(0.2, "rgba(245, 158, 11, 0.58)");
      grad.addColorStop(0.55, "rgba(245, 158, 11, 0.16)");
      grad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, by, 145, 0, Math.PI * 2);
      ctx.fill();
    }

    drawParticlesAndSoundWaves(ctx) {
      for (const m of this.mistParticles) {
        if (m.x < this.camera.x - 20 || m.x > this.camera.x + this.viewWidth + 20) continue;
        ctx.fillStyle = `rgba(186, 208, 235, ${m.alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const f of this.fireflies) {
        if (f.x < this.camera.x - 20 || f.x > this.camera.x + this.viewWidth + 20) continue;
        const pulse = 0.35 + Math.sin(f.phase * 2) * 0.35;
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const s of this.splinters) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = `rgba(30, 41, 59, ${s.life.toFixed(2)})`;
        ctx.fillRect(-5, -1.5, 10, 3);
        ctx.restore();
      }

      for (const sw of this.soundWaves) {
        ctx.strokeStyle = sw.amber
          ? `rgba(251, 191, 36, ${sw.alpha.toFixed(3)})`
          : `rgba(186, 208, 235, ${sw.alpha.toFixed(3)})`;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const e of this.embers) {
        ctx.fillStyle = `rgba(251, 191, 36, ${(e.life * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawLanternLighting(ctx) {
      const lp = this.player.lanternPos;
      const radius = Math.max(40, this.player.effectiveLanternRadius);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(lp.x, lp.y, 2, lp.x, lp.y, radius);
      glow.addColorStop(0, `rgba(254, 243, 199, ${(0.38 + this.player.flareBoost * 0.25).toFixed(2)})`);
      glow.addColorStop(0.22, `rgba(245, 158, 11, ${(0.24 + this.player.flareBoost * 0.2).toFixed(2)})`);
      glow.addColorStop(0.62, "rgba(217, 119, 6, 0.08)");
      glow.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawRain(ctx, vw, vh) {
      if (!this.rainDrops.length) return;
      ctx.strokeStyle = "rgba(186, 208, 235, 0.16)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const r of this.rainDrops) {
        if (r.x > vw + 30) continue;
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.22, r.y + r.len);
      }
      ctx.stroke();
    }

    // Silent visual-only constellation dots at top-left showing which Level (1..4) is active (Zero text!)
    drawLevelConstellationDots(ctx, vw) {
      void vw;
      const startX = 28;
      const y = 26;
      for (let i = 1; i <= TOTAL_LEVELS; i++) {
        const cx = startX + (i - 1) * 18;
        const active = i === this.currentLevelId;
        const passed = i < this.currentLevelId;

        if (active) {
          const g = ctx.createRadialGradient(cx, y, 1, cx, y, 11);
          g.addColorStop(0, "rgba(254, 243, 199, 0.95)");
          g.addColorStop(0.5, "rgba(245, 158, 11, 0.45)");
          g.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, y, 11, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = active
          ? "#fbbf24"
          : passed
          ? "rgba(245, 158, 11, 0.55)"
          : "rgba(148, 163, 184, 0.28)";
        ctx.beginPath();
        ctx.arc(cx, y, active ? 3.6 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawVignette(ctx, vw, vh) {
      const cx = vw * 0.5;
      const cy = vh * 0.5;
      const outerR = Math.hypot(cx, cy);
      const vig = ctx.createRadialGradient(cx, cy, outerR * 0.38, cx, cy, outerR);
      vig.addColorStop(0, "rgba(4, 7, 12, 0)");
      vig.addColorStop(0.72, "rgba(4, 7, 12, 0.36)");
      vig.addColorStop(1, "rgba(2, 4, 8, 0.84)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, vw, vh);
    }

    loop(timestamp) {
      const frameDt = Math.min(0.05, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
      this.lastTimestamp = timestamp;
      this.accumulator += frameDt;

      const fixedStep = 1 / 60;
      while (this.accumulator >= fixedStep) {
        this.update(fixedStep);
        this.accumulator -= fixedStep;
      }

      this.render();
      requestAnimationFrame((ts) => this.loop(ts));
    }
  }

  // ============================================================================
  // 7. BRIDGE FOR ANDROID COMPOSE CONTROLS
  // ============================================================================
  const canvas = document.getElementById("gameCanvas");
  const game = new PaleLanternGame(canvas);

  window.PaleLanternBridge = {
    setControl(action, pressed) {
      game.audio.init();
      const isDown = !!pressed;
      switch (action) {
        case "left":
          game.keys.left = isDown;
          break;
        case "right":
          game.keys.right = isDown;
          break;
        case "up":
          game.keys.up = isDown;
          break;
        case "down":
          game.keys.down = isDown;
          break;
        case "jump":
          if (isDown && !game.keys.jump) {
            game.keys.jumpJustPressed = true;
          }
          game.keys.jump = isDown;
          break;
        case "grab":
          game.keys.grab = isDown;
          break;
      }
    },
    flareLantern() {
      game.audio.init();
      game.triggerLanternFlare();
    },
    cycleBoySkin() {
      game.audio.init();
      return game.cycleBoyCharacter();
    },
    nextHigherLevel() {
      game.audio.init();
      return game.nextHigherLevel();
    },
    restartCheckpoint() {
      game.audio.init();
      game.respawnAtCheckpoint();
    },
    resetLevel() {
      game.audio.init();
      game.resetFullLevel();
    },
    setMuted(muted) {
      game.audio.init();
      game.audio.setMuted(muted);
    }
  };
})();
