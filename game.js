(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const shell = document.querySelector(".game-shell");
  const startScreen = document.querySelector("#startScreen");
  const gameOverScreen = document.querySelector("#gameOverScreen");
  const startButton = document.querySelector("#startButton");
  const restartButton = document.querySelector("#restartButton");
  const pauseButton = document.querySelector("#pauseButton");
  const pauseLabel = document.querySelector("#pauseLabel");
  const soundButton = document.querySelector("#soundButton");
  const soundIcon = document.querySelector("#soundIcon");
  const scoreNode = document.querySelector("#score");
  const bestNode = document.querySelector("#best");
  const websNode = document.querySelector("#webs");
  const threatLevelNode = document.querySelector("#threatLevel");
  const bossHud = document.querySelector("#bossHud");
  const bossName = document.querySelector("#bossName");
  const bossHealthFill = document.querySelector("#bossHealthFill");
  const bossAnnouncement = document.querySelector("#bossAnnouncement");
  const webShotButton = document.querySelector("#webShotButton");
  const finalScoreNode = document.querySelector("#finalScore");
  const finalWebsNode = document.querySelector("#finalWebs");
  const newBestNode = document.querySelector("#newBest");

  const BEST_KEY = "web-rush-best";
  const LANES = [-1, 0, 1];
  const usesTouchControls = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const state = {
    mode: "menu",
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY)) || 0,
    webs: 0,
    speed: 0.34,
    difficulty: 0,
    level: 1,
    distance: 0,
    spawnTimer: 0,
    tokenTimer: 0,
    objects: [],
    webShots: [],
    boss: {
      active: false,
      type: null,
      goblinDefeated: false,
      octopusDefeated: false,
      health: 6,
      maxHealth: 6,
      lane: 0,
      visualLane: 0,
      moveTimer: 0,
      attackTimer: 0,
      introTimer: 0,
      messageTimer: 0,
      shotCooldown: 0,
    },
    skyline: [],
    stars: [],
    shake: 0,
    flash: 0,
    muted: false,
    lastTime: 0,
    width: 0,
    height: 0,
    dpr: 1,
    touchStart: null,
    audio: null,
  };

  const player = {
    lane: 0,
    visualLane: 0,
    y: 0,
    vy: 0,
    runCycle: 0,
  };

  bestNode.textContent = pad(state.best);

  function pad(value) {
    return Math.floor(value).toString().padStart(6, "0");
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = state.width * state.dpr;
    canvas.height = state.height * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    buildSkyline();
  }

  function buildSkyline() {
    const rng = mulberry32(90210);
    state.skyline = [];
    let x = -30;
    while (x < state.width + 80) {
      const w = 48 + rng() * 100;
      const h = state.height * (0.11 + rng() * 0.25);
      state.skyline.push({ x, w, h, antenna: rng() > 0.72, glow: rng() });
      x += w - 3;
    }
    state.stars = Array.from({ length: Math.max(30, state.width / 18) }, () => ({
      x: rng() * state.width,
      y: rng() * state.height * 0.45,
      r: rng() * 1.3 + 0.3,
      a: rng() * 0.55 + 0.2,
    }));
  }

  function mulberry32(seed) {
    return function random() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initAudio() {
    if (!state.audio) {
      state.audio = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audio.state === "suspended") state.audio.resume();
  }

  function tone(frequency, duration = 0.08, type = "square", volume = 0.04) {
    if (state.muted) return;
    initAudio();
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, state.audio.currentTime);
    gain.gain.setValueAtTime(volume, state.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audio.currentTime + duration);
    osc.connect(gain).connect(state.audio.destination);
    osc.start();
    osc.stop(state.audio.currentTime + duration);
  }

  function startGame() {
    initAudio();
    state.mode = "playing";
    state.score = 0;
    state.webs = 0;
    state.speed = 0.34;
    state.difficulty = 0;
    state.level = 1;
    state.distance = 0;
    state.spawnTimer = 0.9;
    state.tokenTimer = 0.45;
    state.objects = [];
    state.webShots = [];
    Object.assign(state.boss, {
      active: false,
      type: null,
      goblinDefeated: false,
      octopusDefeated: false,
      health: 6,
      maxHealth: 6,
      lane: 0,
      visualLane: 0,
      moveTimer: 0,
      attackTimer: 0,
      introTimer: 0,
      messageTimer: 0,
      shotCooldown: 0,
    });
    state.shake = 0;
    state.flash = 0;
    player.lane = 0;
    player.visualLane = 0;
    player.y = 0;
    player.vy = 0;
    startScreen.hidden = true;
    gameOverScreen.hidden = true;
    pauseButton.hidden = false;
    pauseLabel.hidden = true;
    shell.classList.add("playing");
    scoreNode.textContent = "000000";
    websNode.textContent = "0";
    threatLevelNode.textContent = "1";
    bossHud.hidden = true;
    bossAnnouncement.hidden = true;
    webShotButton.hidden = true;
    bossHealthFill.style.width = "100%";
    tone(280, 0.08, "sawtooth", 0.05);
    setTimeout(() => tone(420, 0.12, "sawtooth", 0.04), 70);
  }

  function gameOver() {
    state.mode = "over";
    state.shake = 16;
    state.flash = 1;
    pauseButton.hidden = true;
    shell.classList.remove("playing");
    bossHud.hidden = true;
    bossAnnouncement.hidden = true;
    webShotButton.hidden = true;
    const final = Math.floor(state.score);
    const isBest = final > state.best;
    if (isBest) {
      state.best = final;
      localStorage.setItem(BEST_KEY, String(final));
      bestNode.textContent = pad(final);
    }
    finalScoreNode.textContent = final.toLocaleString();
    finalWebsNode.textContent = state.webs;
    newBestNode.hidden = !isBest;
    gameOverScreen.hidden = false;
    tone(120, 0.25, "sawtooth", 0.07);
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
      pauseLabel.hidden = false;
      pauseButton.textContent = "▶";
    } else if (state.mode === "paused") {
      state.mode = "playing";
      pauseLabel.hidden = true;
      pauseButton.textContent = "Ⅱ";
      state.lastTime = performance.now();
    }
  }

  function move(direction) {
    if (state.mode !== "playing") return;
    const next = Math.max(-1, Math.min(1, player.lane + direction));
    if (next !== player.lane) {
      player.lane = next;
      tone(210 + next * 25, 0.045, "triangle", 0.025);
    }
  }

  function jump() {
    if (state.mode !== "playing" || player.y > 1) return;
    player.vy = 780;
    tone(330, 0.1, "sine", 0.04);
  }

  function startBossFight(type) {
    if (state.boss.active) return;
    const isOctopus = type === "octopus";
    Object.assign(state.boss, {
      active: true,
      type,
      health: isOctopus ? 8 : 6,
      maxHealth: isOctopus ? 8 : 6,
      lane: 0,
      visualLane: 0,
      moveTimer: isOctopus ? 1.35 : 1.1,
      attackTimer: 2.2,
      introTimer: 2.4,
      messageTimer: 0,
      shotCooldown: 0,
    });
    state.objects = [];
    state.webShots = [];
    bossHealthFill.style.width = "100%";
    bossHud.hidden = false;
    bossAnnouncement.hidden = false;
    bossName.textContent = isOctopus ? "DOCTOR OCTOPUS" : "GREEN GOBLIN";
    bossAnnouncement.querySelector("span").textContent = isOctopus ? "THREAT LEVEL 10" : "THREAT LEVEL 5";
    bossAnnouncement.querySelector("strong").textContent = isOctopus ? "DOCTOR OCTOPUS!" : "GREEN GOBLIN!";
    const attackInstruction = usesTouchControls ? "SWIPE DOWN TO FIRE WEBS" : "PRESS F TO FIRE WEBS";
    bossAnnouncement.querySelector("small").textContent = isOctopus
      ? `DODGE TENTACLES · ${attackInstruction}`
      : `DODGE BOMBS · ${attackInstruction}`;
    webShotButton.hidden = false;
    state.flash = 0.9;
    tone(150, 0.35, "sawtooth", 0.065);
    setTimeout(() => tone(108, 0.48, "sawtooth", 0.055), 180);
  }

  function fireWeb() {
    if (
      state.mode !== "playing" ||
      !state.boss.active ||
      state.boss.introTimer > 0 ||
      state.boss.shotCooldown > 0
    ) {
      return;
    }
    state.boss.shotCooldown = 0.48;
    state.webShots.push({ lane: player.lane, progress: 0 });
    webShotButton.classList.add("cooldown");
    tone(560, 0.08, "triangle", 0.045);
  }

  function throwPumpkinBomb() {
    const firstLane = Math.random() < 0.6 ? player.lane : LANES[Math.floor(Math.random() * LANES.length)];
    state.objects.push({
      kind: "obstacle",
      type: "pumpkin",
      lane: firstLane,
      z: 0.82,
      hit: false,
    });

    if (state.boss.health <= 3 && Math.random() < 0.42) {
      const otherLanes = LANES.filter((lane) => lane !== firstLane);
      state.objects.push({
        kind: "obstacle",
        type: "pumpkin",
        lane: otherLanes[Math.floor(Math.random() * otherLanes.length)],
        z: 0.88,
        hit: false,
      });
    }
    tone(135, 0.12, "square", 0.035);
  }

  function strikeWithTentacle() {
    const firstLane = Math.random() < 0.7 ? player.lane : LANES[Math.floor(Math.random() * LANES.length)];
    state.objects.push({
      kind: "obstacle",
      type: "tentacle",
      lane: firstLane,
      z: 0.84,
      hit: false,
    });

    if (state.boss.health <= 4 && Math.random() < 0.5) {
      const otherLanes = LANES.filter((lane) => lane !== firstLane);
      state.objects.push({
        kind: "obstacle",
        type: "tentacle",
        lane: otherLanes[Math.floor(Math.random() * otherLanes.length)],
        z: 0.91,
        hit: false,
      });
    }
    tone(95, 0.16, "sawtooth", 0.045);
  }

  function defeatBoss() {
    const wasOctopus = state.boss.type === "octopus";
    state.boss.active = false;
    if (wasOctopus) state.boss.octopusDefeated = true;
    else state.boss.goblinDefeated = true;
    state.boss.messageTimer = 2.2;
    state.webShots = [];
    state.objects = [];
    state.score += wasOctopus ? 5000 : 3000;
    state.flash = 1;
    state.shake = 10;
    state.spawnTimer = 1.4;
    state.tokenTimer = 0.4;
    bossHud.hidden = true;
    webShotButton.hidden = true;
    bossAnnouncement.hidden = false;
    bossAnnouncement.querySelector("span").textContent = "CITY SAVED";
    bossAnnouncement.querySelector("strong").textContent = wasOctopus
      ? "DOC OCK DEFEATED!"
      : "GOBLIN DEFEATED!";
    bossAnnouncement.querySelector("small").textContent = wasOctopus ? "+5,000 BONUS" : "+3,000 BONUS";
    tone(420, 0.13, "sawtooth", 0.05);
    setTimeout(() => tone(560, 0.16, "sawtooth", 0.05), 110);
    setTimeout(() => tone(720, 0.22, "sawtooth", 0.045), 230);
  }

  function updateBoss(dt) {
    const boss = state.boss;
    boss.introTimer = Math.max(0, boss.introTimer - dt);
    boss.shotCooldown = Math.max(0, boss.shotCooldown - dt);
    boss.visualLane += (boss.lane - boss.visualLane) * Math.min(1, dt * 4.5);
    webShotButton.classList.toggle("cooldown", boss.shotCooldown > 0);

    if (boss.introTimer > 0) return;
    bossAnnouncement.hidden = true;
    boss.moveTimer -= dt;
    boss.attackTimer -= dt;

    if (boss.moveTimer <= 0) {
      const choices = LANES.filter((lane) => lane !== boss.lane);
      boss.lane = choices[Math.floor(Math.random() * choices.length)];
      boss.moveTimer = 0.85 + Math.random() * 0.65;
    }
    if (boss.attackTimer <= 0) {
      if (boss.type === "octopus") strikeWithTentacle();
      else throwPumpkinBomb();
      boss.attackTimer =
        boss.type === "octopus" ? 0.62 + Math.random() * 0.34 : 0.72 + Math.random() * 0.42;
    }

    for (const shot of state.webShots) {
      shot.progress += dt * 1.75;
      if (shot.progress < 1) continue;
      shot.done = true;
      if (Math.abs(shot.lane - boss.visualLane) < 0.5) {
        boss.health -= 1;
        bossHealthFill.style.width = `${(boss.health / boss.maxHealth) * 100}%`;
        state.score += 350;
        state.flash = 0.5;
        state.shake = 5;
        tone(240, 0.1, "square", 0.05);
        if (boss.health <= 0) {
          defeatBoss();
          return;
        }
      }
    }
    state.webShots = state.webShots.filter((shot) => !shot.done);
  }

  function spawnObstacle() {
    // Never place a new hazard through an existing token trail at the same
    // depth. Since objects move at the same speed, that overlap would remain
    // impossible for the entire approach.
    const protectedTokenLanes = new Set(
      state.objects
        .filter((object) => object.kind === "token" && !object.hit && object.z > 0.8 && object.z < 1.4)
        .map((object) => object.lane),
    );
    const availableLanes = LANES.filter((lane) => !protectedTokenLanes.has(lane));
    if (availableLanes.length === 0) return false;

    const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
    const roll = Math.random();
    const barrierCutoff = 0.5 - state.difficulty * 0.18;
    const droneCutoff = barrierCutoff + 0.22 + state.difficulty * 0.18;
    const type = roll < barrierCutoff ? "barrier" : roll < droneCutoff ? "drone" : "vent";
    state.objects.push({ kind: "obstacle", type, lane, z: 1.08, hit: false });

    const doubleObstacleChance = 0.06 + state.difficulty * 0.56;
    if (Math.random() < doubleObstacleChance) {
      const options = availableLanes.filter((value) => value !== lane);
      if (options.length > 0) {
        state.objects.push({
          kind: "obstacle",
          type:
            state.difficulty > 0.55 && Math.random() > 0.62
              ? "drone"
              : Math.random() > 0.5
                ? "barrier"
                : "vent",
          lane: options[Math.floor(Math.random() * options.length)],
          z: 1.12,
          hit: false,
        });
      }
    }
    return true;
  }

  function spawnTokens() {
    const count = 3 + Math.floor(Math.random() * 4);
    const tokenDepths = Array.from({ length: count }, (_, index) => 1.05 + index * 0.1);
    const safeLanes = LANES.filter((lane) =>
      tokenDepths.every(
        (z) =>
          !state.objects.some(
            (object) =>
              object.kind === "obstacle" &&
              !object.hit &&
              object.lane === lane &&
              Math.abs(object.z - z) < 0.24,
          ),
      ),
    );

    // If every lane is temporarily occupied, wait for a cleaner opening
    // instead of spawning bait that cannot be collected safely.
    if (safeLanes.length === 0) return false;

    const lane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
    for (let i = 0; i < count; i += 1) {
      state.objects.push({
        kind: "token",
        lane,
        z: 1.05 + i * 0.1,
        bob: Math.random() * Math.PI * 2,
        hit: false,
      });
    }
    return true;
  }

  function update(dt) {
    if (state.mode !== "playing") return;

    state.distance += state.speed * dt * 120;
    state.difficulty = Math.min(1.35, state.distance / 2500);
    state.speed = 0.34 + state.difficulty * 0.34;
    state.score += dt * (90 + state.speed * 160) * (1 + state.difficulty * 0.45);

    const nextLevel = 1 + Math.floor(state.distance / 500);
    if (nextLevel > state.level) {
      state.level = nextLevel;
      state.flash = 0.65;
      threatLevelNode.textContent = String(state.level);
      tone(390 + state.level * 55, 0.13, "sawtooth", 0.045);
      setTimeout(() => tone(480 + state.level * 60, 0.1, "sawtooth", 0.035), 90);
    }
    if (
      state.level >= 5 &&
      !state.boss.goblinDefeated &&
      !state.boss.active &&
      state.boss.messageTimer === 0
    ) {
      startBossFight("goblin");
    } else if (
      state.level >= 10 &&
      state.boss.goblinDefeated &&
      !state.boss.octopusDefeated &&
      !state.boss.active &&
      state.boss.messageTimer === 0
    ) {
      startBossFight("octopus");
    }
    state.spawnTimer -= dt;
    state.tokenTimer -= dt;
    player.runCycle += dt * (10 + state.speed * 9);
    player.visualLane += (player.lane - player.visualLane) * Math.min(1, dt * 13);

    if (player.y > 0 || player.vy > 0) {
      player.y += player.vy * dt;
      player.vy -= 1850 * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
      }
    }
    if (state.boss.active) {
      updateBoss(dt);
    } else {
      if (state.spawnTimer <= 0) {
        spawnObstacle();
        const baseGap = Math.max(0.58, 1.18 - state.difficulty * 0.48);
        const randomGap = Math.max(0.18, 0.46 - state.difficulty * 0.2);
        state.spawnTimer = baseGap + Math.random() * randomGap;
      }
      if (state.tokenTimer <= 0) {
        const spawned = spawnTokens();
        state.tokenTimer = spawned ? 1.5 + Math.random() * 1.8 : 0.3;
      }
    }

    if (state.boss.messageTimer > 0) {
      state.boss.messageTimer = Math.max(0, state.boss.messageTimer - dt);
      if (state.boss.messageTimer === 0) bossAnnouncement.hidden = true;
    }

    for (const object of state.objects) {
      object.z -= state.speed * dt;
      if (object.hit) continue;

      if (object.kind === "token") {
        // Tokens use a wide collection area so moving through their visible
        // edge still feels rewarding.
        if (object.z > 0.23 || object.z < 0.09) continue;
        const collected = Math.abs(object.lane - player.visualLane) < 0.48;
        if (!collected) continue;
        object.hit = true;
        state.webs += 1;
        state.score += 75;
        state.flash = 0.18;
        tone(680 + (state.webs % 4) * 80, 0.07, "sine", 0.045);
      } else {
        // The danger zone is intentionally smaller than the obstacle artwork.
        // It is centered where the hazard crosses the runner's feet and ends
        // before the object appears to have passed.
        if (object.z > 0.185 || object.z < 0.15) continue;
        const sameLane = Math.abs(object.lane - player.lane) < 0.28;
        if (!sameLane) continue;
        const avoided =
          (object.type === "barrier" && player.y > 28) ||
          (object.type === "vent" && player.y > 20) ||
          (object.type === "drone" && player.y > 26) ||
          (object.type === "pumpkin" && player.y > 24) ||
          (object.type === "tentacle" && player.y > 30);
        if (!avoided) {
          object.hit = true;
          gameOver();
          break;
        }
      }
    }

    state.objects = state.objects.filter((object) => {
      if (object.hit) return false;
      // All hazards now share a ground-aligned exit point.
      return object.z > 0.035;
    });
    state.flash = Math.max(0, state.flash - dt * 2.4);
    state.shake = Math.max(0, state.shake - dt * 42);
    scoreNode.textContent = pad(state.score);
    websNode.textContent = state.webs;
  }

  function perspective(z) {
    const horizon = state.height * 0.43;
    const bottom = state.height * 1.03;
    const depth = Math.max(0, Math.min(1, z));
    const eased = Math.pow(1 - depth, 1.65);
    return {
      y: horizon + (bottom - horizon) * eased,
      scale: 0.12 + eased * 1.18,
      roadHalf: state.width * (0.08 + eased * 0.45),
    };
  }

  function laneX(lane, p) {
    return state.width / 2 + lane * p.roadHalf * 0.55;
  }

  function drawBackground(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, state.height);
    sky.addColorStop(0, "#061126");
    sky.addColorStop(0.46, "#164b7a");
    sky.addColorStop(0.72, "#ed5260");
    sky.addColorStop(1, "#151728");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, state.width, state.height);

    const moonX = state.width * 0.78;
    const moonY = state.height * 0.18;
    const moonR = Math.min(state.width, state.height) * 0.075;
    const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 2.3);
    glow.addColorStop(0, "rgba(255,245,205,.72)");
    glow.addColorStop(0.4, "rgba(255,210,125,.15)");
    glow.addColorStop(1, "rgba(255,210,125,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe9ae";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();

    for (const star of state.stars) {
      ctx.globalAlpha = star.a * (0.75 + Math.sin(time * 0.0015 + star.x) * 0.25);
      ctx.fillStyle = "#fff";
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    ctx.globalAlpha = 1;

    drawWebCorner(state.width, 0, Math.min(230, state.width * 0.24));

    const horizon = state.height * 0.43;
    for (let layer = 0; layer < 2; layer += 1) {
      ctx.fillStyle = layer === 0 ? "#14243a" : "#091421";
      for (let i = 0; i < state.skyline.length; i += 1) {
        const b = state.skyline[i];
        const offset = layer * 28;
        const h = b.h * (layer ? 0.82 : 1);
        const x = b.x + offset;
        ctx.fillRect(x, horizon - h + layer * 18, b.w, h + 30);
        if (b.antenna) {
          ctx.fillRect(x + b.w * 0.55, horizon - h - 25 + layer * 18, 3, 28);
        }
        if (layer === 1) {
          ctx.fillStyle = b.glow > 0.5 ? "rgba(255,210,63,.55)" : "rgba(64,157,210,.35)";
          for (let wy = horizon - h + 14; wy < horizon - 18; wy += 23) {
            for (let wx = x + 10; wx < x + b.w - 8; wx += 19) {
              if ((i + Math.floor(wy / 20) + Math.floor(wx / 18)) % 3 !== 0) {
                ctx.fillRect(wx, wy, 7, 9);
              }
            }
          }
          ctx.fillStyle = "#091421";
        }
      }
    }
  }

  function drawWebCorner(x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i += 1) {
      const angle = Math.PI * 0.5 + (Math.PI * 0.5 * i) / 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.stroke();
    }
    for (let ring = 1; ring < 6; ring += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, (radius * ring) / 5, Math.PI / 2, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoad() {
    const horizon = state.height * 0.43;
    const bottom = state.height * 1.04;
    const topHalf = state.width * 0.08;
    const bottomHalf = state.width * 0.53;

    ctx.fillStyle = "#111722";
    ctx.beginPath();
    ctx.moveTo(state.width / 2 - topHalf, horizon);
    ctx.lineTo(state.width / 2 + topHalf, horizon);
    ctx.lineTo(state.width / 2 + bottomHalf, bottom);
    ctx.lineTo(state.width / 2 - bottomHalf, bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ef233c";
    ctx.lineWidth = 5;
    ctx.stroke();

    const scroll = (state.distance * 0.018) % 1;
    for (let i = 0; i < 22; i += 1) {
      const z = (i / 22 + scroll) % 1;
      const p = perspective(z);
      const alpha = 0.05 + (1 - z) * 0.16;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = Math.max(1, p.scale * 2);
      ctx.beginPath();
      ctx.moveTo(state.width / 2 - p.roadHalf, p.y);
      ctx.lineTo(state.width / 2 + p.roadHalf, p.y);
      ctx.stroke();
    }

    ctx.setLineDash([18, 22]);
    ctx.lineDashOffset = state.distance * 2.2;
    ctx.strokeStyle = "rgba(255,255,255,.3)";
    ctx.lineWidth = 2;
    for (const laneEdge of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(state.width / 2 + laneEdge * topHalf * 1.1, horizon);
      ctx.lineTo(state.width / 2 + laneEdge * bottomHalf * 1.1, bottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawToken(object, time) {
    const p = perspective(object.z);
    const x = laneX(object.lane, p);
    const y = p.y - p.scale * 48 + Math.sin(time * 0.006 + object.bob) * p.scale * 8;
    const r = 18 * p.scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.45 + Math.abs(Math.sin(time * 0.004 + object.bob)) * 0.55, 1);
    ctx.shadowColor = "#ffd23f";
    ctx.shadowBlur = 20 * p.scale;
    ctx.fillStyle = "#ffd23f";
    ctx.strokeStyle = "#fff1a6";
    ctx.lineWidth = Math.max(1, p.scale * 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#8b5a00";
    ctx.lineWidth = Math.max(1, p.scale * 1.5);
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * r * 0.7, Math.sin(angle) * r * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(angle) * r * 0.7, -Math.sin(angle) * r * 0.7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacle(object) {
    const p = perspective(object.z);
    const x = laneX(object.lane, p);
    const ground = p.y;
    ctx.save();
    ctx.translate(x, ground);
    // Hazards are intentionally oversized for readability at rooftop speed.
    ctx.scale(p.scale * 1.3, p.scale * 1.3);

    if (object.type === "barrier") {
      ctx.fillStyle = "#e8383f";
      ctx.strokeStyle = "#070d18";
      ctx.lineWidth = 4;
      ctx.fillRect(-34, -48, 68, 48);
      ctx.strokeRect(-34, -48, 68, 48);
      ctx.fillStyle = "#ffd23f";
      for (let i = -42; i < 60; i += 22) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-32, -44, 64, 38);
        ctx.clip();
        ctx.translate(i, -35);
        ctx.rotate(-0.7);
        ctx.fillRect(0, -8, 12, 75);
        ctx.restore();
      }
      ctx.fillStyle = "#10151e";
      ctx.fillRect(-29, 0, 8, 13);
      ctx.fillRect(21, 0, 8, 13);
    } else if (object.type === "vent") {
      ctx.fillStyle = "#647587";
      ctx.strokeStyle = "#09101b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-30, 0);
      ctx.lineTo(-24, -34);
      ctx.lineTo(24, -34);
      ctx.lineTo(30, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#263747";
      ctx.lineWidth = 3;
      for (let y = -27; y < -5; y += 7) {
        ctx.beginPath();
        ctx.moveTo(-18, y);
        ctx.lineTo(18, y);
        ctx.stroke();
      }
    } else if (object.type === "pumpkin") {
      ctx.translate(0, -24);
      ctx.shadowColor = "#ff7a18";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#ff7a18";
      ctx.strokeStyle = "#321309";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#bd3d0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 20, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffe342";
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.lineTo(-5, -3);
      ctx.lineTo(-13, 2);
      ctx.closePath();
      ctx.moveTo(14, -6);
      ctx.lineTo(5, -3);
      ctx.lineTo(13, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffe342";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 3, 13, 0.25, Math.PI - 0.25);
      ctx.stroke();
      ctx.fillStyle = "#4d7d20";
      ctx.fillRect(-3, -29, 6, 10);
    } else if (object.type === "tentacle") {
      ctx.strokeStyle = "#111722";
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(-30, 2);
      ctx.quadraticCurveTo(-25, -28, -4, -27);
      ctx.quadraticCurveTo(20, -27, 27, -50);
      ctx.stroke();
      ctx.strokeStyle = "#8c98a4";
      ctx.lineWidth = 13;
      ctx.stroke();
      ctx.strokeStyle = "#d4dde3";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const x = -27 + i * 11;
        const y = -7 - Math.sin((i / 4) * Math.PI) * 21;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(28, -52);
      ctx.rotate(-0.2);
      ctx.fillStyle = "#505b66";
      ctx.strokeStyle = "#10151e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, 5);
      ctx.lineTo(-21, -9);
      ctx.lineTo(-16, 10);
      ctx.lineTo(-3, 13);
      ctx.lineTo(9, 24);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      // The drone is a low rooftop hazard now and is cleared by jumping.
      ctx.translate(0, -22);
      ctx.fillStyle = "#273342";
      ctx.strokeStyle = "#07101f";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 29, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ef233c";
      ctx.beginPath();
      ctx.arc(0, 1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8997a6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-25, -4);
      ctx.lineTo(-51, -14);
      ctx.moveTo(25, -4);
      ctx.lineTo(51, -14);
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.fillRect(-61, -17, 21, 5);
      ctx.fillRect(40, -17, 21, 5);
    }
    ctx.restore();
  }

  function bossScreenPosition() {
    const laneSpread = Math.min(state.width * 0.2, 155);
    return {
      x: state.width / 2 + state.boss.visualLane * laneSpread,
      y: Math.max(185, state.height * 0.31),
    };
  }

  function drawGreenGoblin(time) {
    if (!state.boss.active) return;
    const position = bossScreenPosition();
    const scale = Math.max(0.72, Math.min(1.12, state.height / 760));
    const bob = Math.sin(time * 0.004) * 7;
    const hurt = state.flash > 0.25;

    ctx.save();
    ctx.translate(position.x, position.y + bob);
    ctx.scale(scale, scale);

    // Purple bat glider.
    ctx.fillStyle = "#48206d";
    ctx.strokeStyle = "#080b15";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-78, 26);
    ctx.quadraticCurveTo(-42, 7, -9, 20);
    ctx.quadraticCurveTo(0, 28, 9, 20);
    ctx.quadraticCurveTo(42, 7, 78, 26);
    ctx.lineTo(45, 43);
    ctx.quadraticCurveTo(0, 34, -45, 43);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9c5bd1";
    ctx.beginPath();
    ctx.moveTo(-65, 26);
    ctx.lineTo(-18, 24);
    ctx.lineTo(-42, 35);
    ctx.closePath();
    ctx.moveTo(65, 26);
    ctx.lineTo(18, 24);
    ctx.lineTo(42, 35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff9d22";
    ctx.beginPath();
    ctx.moveTo(-43, 42);
    ctx.lineTo(-31, 61 + Math.sin(time * 0.02) * 5);
    ctx.lineTo(-20, 40);
    ctx.moveTo(43, 42);
    ctx.lineTo(31, 61 + Math.cos(time * 0.02) * 5);
    ctx.lineTo(20, 40);
    ctx.fill();

    // Goblin body, boots, and tunic.
    ctx.strokeStyle = "#080b15";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-23, 29);
    ctx.moveTo(10, 2);
    ctx.lineTo(23, 29);
    ctx.stroke();
    ctx.strokeStyle = "#6d3a94";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.fillStyle = hurt ? "#caff78" : "#73bd3d";
    ctx.strokeStyle = "#080b15";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -39);
    ctx.quadraticCurveTo(0, -49, 20, -39);
    ctx.lineTo(16, 8);
    ctx.quadraticCurveTo(0, 17, -16, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#743d9c";
    ctx.beginPath();
    ctx.moveTo(-20, -28);
    ctx.lineTo(20, -28);
    ctx.lineTo(16, 8);
    ctx.quadraticCurveTo(0, 17, -16, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Arms and clawed gloves.
    ctx.strokeStyle = "#080b15";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-16, -34);
    ctx.lineTo(-36, -8);
    ctx.lineTo(-49, 8);
    ctx.moveTo(16, -34);
    ctx.lineTo(36, -8);
    ctx.lineTo(49, 8);
    ctx.stroke();
    ctx.strokeStyle = "#78c645";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = "#78c645";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 49, 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#080b15";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Pointed hood and green face.
    ctx.fillStyle = "#6f3795";
    ctx.strokeStyle = "#080b15";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-17, -62);
    ctx.quadraticCurveTo(-3, -92, 18, -106);
    ctx.quadraticCurveTo(8, -78, 17, -61);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hurt ? "#dcff8c" : "#86d64b";
    ctx.beginPath();
    ctx.ellipse(0, -57, 19, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, -60);
    ctx.lineTo(-29, -54);
    ctx.lineTo(-16, -48);
    ctx.moveTo(16, -60);
    ctx.lineTo(29, -54);
    ctx.lineTo(16, -48);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe33f";
    ctx.beginPath();
    ctx.moveTo(-13, -65);
    ctx.lineTo(-4, -62);
    ctx.lineTo(-12, -57);
    ctx.moveTo(13, -65);
    ctx.lineTo(4, -62);
    ctx.lineTo(12, -57);
    ctx.fill();
    ctx.strokeStyle = "#32114e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -46);
    ctx.quadraticCurveTo(0, -39, 9, -47);
    ctx.stroke();
    ctx.restore();
  }

  function drawDoctorOctopus(time) {
    const position = bossScreenPosition();
    const scale = Math.max(0.72, Math.min(1.12, state.height / 760));
    const bob = Math.sin(time * 0.0035) * 5;
    const hurt = state.flash > 0.25;
    ctx.save();
    ctx.translate(position.x, position.y + bob);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Four articulated mechanical arms reach out behind him.
    const armPaths = [
      [[-18, -21], [-58, -48], [-82, -32], [-96, -57]],
      [[18, -21], [58, -48], [82, -32], [96, -57]],
      [[-17, 2], [-56, 28], [-76, 55], [-101, 45]],
      [[17, 2], [56, 28], [76, 55], [101, 45]],
    ];
    for (let armIndex = 0; armIndex < armPaths.length; armIndex += 1) {
      const points = armPaths[armIndex].map(([x, y], index) => [
        x,
        y + Math.sin(time * 0.004 + armIndex * 1.4 + index) * 6,
      ]);
      ctx.strokeStyle = "#101722";
      ctx.lineWidth = 17;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
      ctx.strokeStyle = "#8996a2";
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = "#d6dee4";
      ctx.lineWidth = 2;
      for (let i = 1; i < points.length; i += 1) {
        ctx.beginPath();
        ctx.arc(points[i][0], points[i][1], 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      const claw = points[points.length - 1];
      ctx.save();
      ctx.translate(claw[0], claw[1]);
      ctx.rotate(armIndex % 2 ? -0.35 : 0.35);
      ctx.fillStyle = "#58636e";
      ctx.strokeStyle = "#101722";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-19, -12);
      ctx.lineTo(-13, 7);
      ctx.lineTo(0, 11);
      ctx.lineTo(14, 21);
      ctx.lineTo(13, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Dark green coat and harness.
    ctx.fillStyle = "#2c5d45";
    ctx.strokeStyle = "#0a1018";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-25, -43);
    ctx.quadraticCurveTo(0, -54, 25, -43);
    ctx.lineTo(31, 22);
    ctx.lineTo(13, 13);
    ctx.lineTo(0, 27);
    ctx.lineTo(-13, 13);
    ctx.lineTo(-31, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hurt ? "#9effb5" : "#4f9b69";
    ctx.beginPath();
    ctx.moveTo(-17, -39);
    ctx.lineTo(17, -39);
    ctx.lineTo(13, 12);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#b3bec7";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-20, -31);
    ctx.lineTo(20, 4);
    ctx.moveTo(20, -31);
    ctx.lineTo(-20, 4);
    ctx.stroke();
    ctx.fillStyle = "#4a555f";
    ctx.beginPath();
    ctx.arc(0, -13, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head, swept hair, goggles, and determined expression.
    ctx.fillStyle = hurt ? "#ffe0ca" : "#d9a77e";
    ctx.strokeStyle = "#0a1018";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -62, 20, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4b392f";
    ctx.beginPath();
    ctx.moveTo(-19, -69);
    ctx.quadraticCurveTo(-10, -91, 1, -81);
    ctx.quadraticCurveTo(12, -92, 20, -69);
    ctx.quadraticCurveTo(8, -79, -19, -69);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#151b22";
    ctx.beginPath();
    ctx.roundRect(-18, -69, 15, 10, 3);
    ctx.roundRect(3, -69, 15, 10, 3);
    ctx.fill();
    ctx.strokeStyle = "#a8e7e8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#151b22";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-3, -64);
    ctx.lineTo(3, -64);
    ctx.moveTo(-10, -51);
    ctx.quadraticCurveTo(0, -45, 11, -52);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoss(time) {
    if (!state.boss.active) return;
    if (state.boss.type === "octopus") drawDoctorOctopus(time);
    else drawGreenGoblin(time);
  }

  function drawWebShots() {
    if (!state.boss.active) return;
    const bossPosition = bossScreenPosition();
    const startY = state.height * 0.82;
    for (const shot of state.webShots) {
      const t = Math.min(1, shot.progress);
      const startP = perspective(0.08);
      const startX = laneX(shot.lane, startP);
      const endX = state.width / 2 + shot.lane * Math.min(state.width * 0.2, 155);
      const x = startX + (endX - startX) * t;
      const y = startY + (bossPosition.y - startY) * t;
      const radius = 5 + t * 10;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.75)";
      ctx.lineWidth = 2 + t * 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(x + Math.sin(t * 22) * 15, y + 35, x, y);
      ctx.stroke();
      ctx.fillStyle = "#f7fff4";
      ctx.strokeStyle = "#8ed9ef";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        const angle = (Math.PI * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(angle) * radius, y - Math.sin(angle) * radius);
        ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPlayer() {
    const baseY = state.height * 0.88 - player.y;
    const p = perspective(0.08);
    const x = laneX(player.visualLane, p);
    const bob = player.y > 0 ? 0 : Math.sin(player.runCycle * 2) * 3;
    const scale = Math.max(0.78, Math.min(1.18, state.height / 780));
    const suitRed = "#ed1b2f";
    const suitRedDark = "#9f1023";
    const suitBlue = "#075f9f";
    const suitBlueDark = "#063b6b";
    const ink = "#050b14";
    const webInk = "rgba(7, 13, 24, 0.7)";
    const bodyLift = 0;

    function strokeLimb(points, width, color) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = width + 7;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    function drawForearmWeb(x1, y1, x2, y2) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const length = Math.hypot(x2 - x1, y2 - y1);
      ctx.save();
      ctx.translate(x1, y1);
      ctx.rotate(angle);
      ctx.strokeStyle = webInk;
      ctx.lineWidth = 1;
      for (let xPos = 5; xPos < length; xPos += 7) {
        ctx.beginPath();
        ctx.moveTo(xPos, -5);
        ctx.quadraticCurveTo(xPos + 2, 0, xPos, 5);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      ctx.restore();
    }

    function drawChestSpider(y) {
      ctx.save();
      ctx.translate(0, y);
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      ctx.lineCap = "round";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.2, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 2, -4);
        ctx.lineTo(side * 8, -9);
        ctx.lineTo(side * 10, -5);
        ctx.moveTo(side * 3, -1);
        ctx.lineTo(side * 10, -2);
        ctx.lineTo(side * 12, 2);
        ctx.moveTo(side * 3, 2);
        ctx.lineTo(side * 9, 6);
        ctx.lineTo(side * 10, 11);
        ctx.moveTo(side * 2, 4);
        ctx.lineTo(side * 6, 10);
        ctx.lineTo(side * 5, 14);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, baseY + bob);
    ctx.scale(scale, scale);

    ctx.globalAlpha = Math.max(0.08, 0.28 - player.y / 650);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 8 + player.y, 38, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const legSwing = player.y > 0 ? -0.35 : Math.sin(player.runCycle) * 0.62;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const leftHip = [-9, -43 + bodyLift];
    const leftKnee = [-13 + legSwing * 17, -10];
    const leftFoot = [-23 - legSwing * 11, 14];
    const rightHip = [9, -43 + bodyLift];
    const rightKnee = [13 - legSwing * 17, -10];
    const rightFoot = [23 + legSwing * 11, 14];

    strokeLimb([leftHip, leftKnee, leftFoot], 17, suitBlue);
    strokeLimb([rightHip, rightKnee, rightFoot], 17, suitBlue);

    // Red boots, soles, and small blue suit highlights give the legs readable
    // structure even when the runner is moving quickly.
    strokeLimb([leftKnee, leftFoot], 13, suitRed);
    strokeLimb([rightKnee, rightFoot], 13, suitRed);
    ctx.strokeStyle = "rgba(91, 190, 241, 0.5)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(leftHip[0] + 4, leftHip[1] + 2);
    ctx.lineTo(leftKnee[0] + 5, leftKnee[1] - 2);
    ctx.moveTo(rightHip[0] - 4, rightHip[1] + 2);
    ctx.lineTo(rightKnee[0] - 5, rightKnee[1] - 2);
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftFoot[0] - 8, leftFoot[1] + 3);
    ctx.lineTo(leftFoot[0] + 8, leftFoot[1] + 3);
    ctx.moveTo(rightFoot[0] - 8, rightFoot[1] + 3);
    ctx.lineTo(rightFoot[0] + 8, rightFoot[1] + 3);
    ctx.stroke();

    // Athletic torso with dark side panels and a red center panel.
    const torsoGradient = ctx.createLinearGradient(-22, 0, 22, 0);
    torsoGradient.addColorStop(0, suitRedDark);
    torsoGradient.addColorStop(0.25, suitRed);
    torsoGradient.addColorStop(0.72, "#f12a38");
    torsoGradient.addColorStop(1, suitRedDark);
    ctx.fillStyle = torsoGradient;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-21, -88 + bodyLift);
    ctx.quadraticCurveTo(0, -99 + bodyLift, 21, -88 + bodyLift);
    ctx.quadraticCurveTo(20, -64 + bodyLift, 15, -41 + bodyLift);
    ctx.quadraticCurveTo(0, -33 + bodyLift, -15, -41 + bodyLift);
    ctx.quadraticCurveTo(-20, -64 + bodyLift, -21, -88 + bodyLift);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = suitBlue;
    ctx.beginPath();
    ctx.moveTo(-18, -64 + bodyLift);
    ctx.quadraticCurveTo(-12, -58 + bodyLift, -13, -42 + bodyLift);
    ctx.quadraticCurveTo(0, -34 + bodyLift, 13, -42 + bodyLift);
    ctx.quadraticCurveTo(12, -58 + bodyLift, 18, -64 + bodyLift);
    ctx.lineTo(13, -41 + bodyLift);
    ctx.quadraticCurveTo(0, -32 + bodyLift, -13, -41 + bodyLift);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = suitBlueDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Torso webbing follows the body instead of reading as a flat grid.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-19, -88 + bodyLift);
    ctx.quadraticCurveTo(0, -96 + bodyLift, 19, -88 + bodyLift);
    ctx.lineTo(17, -62 + bodyLift);
    ctx.quadraticCurveTo(0, -55 + bodyLift, -17, -62 + bodyLift);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = webInk;
    ctx.lineWidth = 1;
    for (const ribY of [-85, -77, -69, -61]) {
      ctx.beginPath();
      ctx.ellipse(0, ribY + bodyLift, 19, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const endX of [-17, -9, 9, 17]) {
      ctx.beginPath();
      ctx.moveTo(0, -94 + bodyLift);
      ctx.quadraticCurveTo(endX * 0.7, -76 + bodyLift, endX, -57 + bodyLift);
      ctx.stroke();
    }
    ctx.restore();
    drawChestSpider(-74 + bodyLift);

    // Collar and shoulder seams add depth around the neck.
    ctx.fillStyle = suitRedDark;
    ctx.beginPath();
    ctx.ellipse(0, -91 + bodyLift, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 119, 126, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, -87 + bodyLift);
    ctx.quadraticCurveTo(0, -95 + bodyLift, 18, -87 + bodyLift);
    ctx.stroke();

    const armSwing = player.y > 0 ? 0.9 : Math.sin(player.runCycle) * 0.7;
    const leftShoulder = [-17, -84 + bodyLift];
    const leftElbow = [-29 - armSwing * 13, -59];
    const leftHand = [-21 - armSwing * 19, -33];
    const rightShoulder = [17, -84 + bodyLift];
    const rightElbow = [29 + armSwing * 13, -59];
    const rightHand = [21 + armSwing * 19, -33];
    strokeLimb([leftShoulder, leftElbow], 14, suitBlue);
    strokeLimb([rightShoulder, rightElbow], 14, suitBlue);
    strokeLimb([leftElbow, leftHand], 12, suitRed);
    strokeLimb([rightElbow, rightHand], 12, suitRed);
    drawForearmWeb(leftElbow[0], leftElbow[1], leftHand[0], leftHand[1]);
    drawForearmWeb(rightElbow[0], rightElbow[1], rightHand[0], rightHand[1]);

    // Gloves use a compact clenched-fist shape rather than a rounded line cap.
    for (const hand of [leftHand, rightHand]) {
      ctx.fillStyle = suitRed;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(hand[0], hand[1], 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = webInk;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hand[0] - 4, hand[1]);
      ctx.lineTo(hand[0] + 4, hand[1]);
      ctx.moveTo(hand[0], hand[1] - 4);
      ctx.lineTo(hand[0], hand[1] + 4);
      ctx.stroke();
    }

    // Mask with a subtle shaded edge, raised center seam, and expressive
    // layered lenses.
    const maskGradient = ctx.createLinearGradient(-18, 0, 18, 0);
    maskGradient.addColorStop(0, suitRedDark);
    maskGradient.addColorStop(0.38, suitRed);
    maskGradient.addColorStop(0.72, "#ff3443");
    maskGradient.addColorStop(1, suitRedDark);
    ctx.fillStyle = maskGradient;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -110 + bodyLift, 18.5, 23.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = webInk;
    ctx.lineWidth = 1.1;
    for (let i = -12; i <= 12; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, -133 + bodyLift);
      ctx.quadraticCurveTo(i * 1.3, -111 + bodyLift, i, -87 + bodyLift);
      ctx.stroke();
    }
    for (let y = -126; y <= -94; y += 8) {
      ctx.beginPath();
      ctx.ellipse(0, y + bodyLift, 16 - Math.abs(y + 110) * 0.22, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 110, 118, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, -130 + bodyLift);
    ctx.quadraticCurveTo(8, -119 + bodyLift, 7, -99 + bodyLift);
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-14, -118 + bodyLift);
    ctx.quadraticCurveTo(-6, -118 + bodyLift, -3, -103 + bodyLift);
    ctx.quadraticCurveTo(-13, -105 + bodyLift, -14, -118 + bodyLift);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, -118 + bodyLift);
    ctx.quadraticCurveTo(6, -118 + bodyLift, 3, -103 + bodyLift);
    ctx.quadraticCurveTo(13, -105 + bodyLift, 14, -118 + bodyLift);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fbf4";
    ctx.strokeStyle = "#9ddcf0";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-12.5, -116.5 + bodyLift);
    ctx.quadraticCurveTo(-6.5, -115.8 + bodyLift, -4.3, -105.5 + bodyLift);
    ctx.quadraticCurveTo(-11.3, -107 + bodyLift, -12.5, -116.5 + bodyLift);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12.5, -116.5 + bodyLift);
    ctx.quadraticCurveTo(6.5, -115.8 + bodyLift, 4.3, -105.5 + bodyLift);
    ctx.quadraticCurveTo(11.3, -107 + bodyLift, 12.5, -116.5 + bodyLift);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawSpeedLines() {
    if (state.mode !== "playing" || state.speed < 0.42) return;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${(state.speed - 0.4) * 0.35})`;
    ctx.lineWidth = 2;
    const count = 9;
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 ? 1 : -1;
      const y = ((i * 103 + state.distance * 9) % state.height) | 0;
      const x = side > 0 ? state.width * 0.83 + (i % 3) * 25 : state.width * 0.17 - (i % 3) * 25;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * 34, y + 90);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render(time) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(time);
    drawRoad();
    drawBoss(time);

    const sorted = [...state.objects].sort((a, b) => b.z - a.z);
    for (const object of sorted) {
      if (object.kind === "token") drawToken(object, time);
      else drawObstacle(object);
    }
    drawWebShots();
    drawPlayer();
    drawSpeedLines();

    if (state.mode === "menu") {
      const shade = ctx.createLinearGradient(0, 0, state.width, 0);
      shade.addColorStop(0, "rgba(4,8,18,.78)");
      shade.addColorStop(0.55, "rgba(4,8,18,.18)");
      shade.addColorStop(1, "rgba(4,8,18,.12)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, state.width, state.height);
    } else if (state.mode === "over") {
      ctx.fillStyle = "rgba(4,8,18,.55)";
      ctx.fillRect(0, 0, state.width, state.height);
    }

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,237,112,${state.flash * 0.28})`;
      ctx.fillRect(0, 0, state.width, state.height);
    }
    ctx.restore();
  }

  function loop(time) {
    const dt = Math.min(0.034, Math.max(0, (time - state.lastTime) / 1000 || 0));
    state.lastTime = time;
    update(dt);
    render(time);
    requestAnimationFrame(loop);
  }

  function handleKey(event) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "d", "w", "f", "x"];
    if (keys.includes(event.key)) event.preventDefault();
    if ((state.mode === "menu" || state.mode === "over") && (event.key === " " || event.key === "Enter")) {
      startGame();
      return;
    }
    if (event.key === "Escape" || event.key.toLowerCase() === "p") {
      togglePause();
      return;
    }
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") move(-1);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") move(1);
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w" || event.key === " ") jump();
    if (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "x") fireWeb();
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.touchStart = { x: event.clientX, y: event.clientY };
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!state.touchStart) return;
    const dx = event.clientX - state.touchStart.x;
    const dy = event.clientY - state.touchStart.y;
    state.touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      jump();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      jump();
    } else {
      fireWeb();
    }
  });

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  webShotButton.addEventListener("click", fireWeb);
  soundButton.addEventListener("click", () => {
    state.muted = !state.muted;
    soundIcon.textContent = state.muted ? "×" : "♪";
    soundButton.setAttribute("aria-label", state.muted ? "Enable sound" : "Mute sound");
    if (!state.muted) tone(520, 0.06, "sine", 0.035);
  });
  window.addEventListener("keydown", handleKey, { passive: false });
  window.addEventListener("resize", resize);
  window.addEventListener("blur", () => {
    if (state.mode === "playing") togglePause();
  });

  resize();
  requestAnimationFrame(loop);
})();
