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
  const finalScoreNode = document.querySelector("#finalScore");
  const finalWebsNode = document.querySelector("#finalWebs");
  const newBestNode = document.querySelector("#newBest");

  const BEST_KEY = "web-rush-best";
  const LANES = [-1, 0, 1];
  const state = {
    mode: "menu",
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY)) || 0,
    webs: 0,
    speed: 0.34,
    distance: 0,
    spawnTimer: 0,
    tokenTimer: 0,
    objects: [],
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
    slide: 0,
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
    state.distance = 0;
    state.spawnTimer = 0.9;
    state.tokenTimer = 0.45;
    state.objects = [];
    state.shake = 0;
    state.flash = 0;
    player.lane = 0;
    player.visualLane = 0;
    player.y = 0;
    player.vy = 0;
    player.slide = 0;
    startScreen.hidden = true;
    gameOverScreen.hidden = true;
    pauseButton.hidden = false;
    pauseLabel.hidden = true;
    shell.classList.add("playing");
    scoreNode.textContent = "000000";
    websNode.textContent = "0";
    tone(280, 0.08, "sawtooth", 0.05);
    setTimeout(() => tone(420, 0.12, "sawtooth", 0.04), 70);
  }

  function gameOver() {
    state.mode = "over";
    state.shake = 16;
    state.flash = 1;
    pauseButton.hidden = true;
    shell.classList.remove("playing");
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
    if (state.mode !== "playing" || player.y > 1 || player.slide > 0) return;
    player.vy = 780;
    tone(330, 0.1, "sine", 0.04);
  }

  function slide() {
    if (state.mode !== "playing" || player.y > 16) return;
    player.slide = 0.62;
    tone(170, 0.08, "triangle", 0.035);
  }

  function spawnObstacle() {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const roll = Math.random();
    const type = roll < 0.44 ? "barrier" : roll < 0.75 ? "drone" : "vent";
    state.objects.push({ kind: "obstacle", type, lane, z: 1.08, hit: false });

    if (state.speed > 0.43 && Math.random() > 0.63) {
      const options = LANES.filter((value) => value !== lane);
      state.objects.push({
        kind: "obstacle",
        type: Math.random() > 0.5 ? "barrier" : "vent",
        lane: options[Math.floor(Math.random() * options.length)],
        z: 1.12,
        hit: false,
      });
    }
  }

  function spawnTokens() {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      state.objects.push({
        kind: "token",
        lane,
        z: 1.05 + i * 0.1,
        bob: Math.random() * Math.PI * 2,
        hit: false,
      });
    }
  }

  function update(dt) {
    if (state.mode !== "playing") return;

    state.distance += state.speed * dt * 120;
    state.score += dt * (90 + state.speed * 160);
    state.speed = Math.min(0.7, state.speed + dt * 0.005);
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
    player.slide = Math.max(0, player.slide - dt);

    if (state.spawnTimer <= 0) {
      spawnObstacle();
      state.spawnTimer = Math.max(0.62, 1.22 - state.speed * 0.52) + Math.random() * 0.5;
    }
    if (state.tokenTimer <= 0) {
      spawnTokens();
      state.tokenTimer = 1.5 + Math.random() * 1.8;
    }

    for (const object of state.objects) {
      object.z -= state.speed * dt;
      // Keep the collision window close to the player so the visual timing and
      // the actual hit agree. The slightly narrower lane check also makes a
      // last-second dodge feel fair.
      if (object.hit || object.z > 0.12 || object.z < 0.025) continue;
      const sameLane = Math.abs(object.lane - player.visualLane) < 0.36;
      if (!sameLane) continue;

      if (object.kind === "token") {
        object.hit = true;
        state.webs += 1;
        state.score += 75;
        state.flash = 0.18;
        tone(680 + (state.webs % 4) * 80, 0.07, "sine", 0.045);
      } else {
        const avoided =
          (object.type === "barrier" && player.y > 44) ||
          (object.type === "vent" && player.y > 34) ||
          (object.type === "drone" && player.slide > 0);
        if (!avoided) {
          object.hit = true;
          gameOver();
          break;
        }
      }
    }

    state.objects = state.objects.filter((object) => object.z > -0.08 && !object.hit);
    state.flash = Math.max(0, state.flash - dt * 2.4);
    state.shake = Math.max(0, state.shake - dt * 42);
    scoreNode.textContent = pad(state.score);
    websNode.textContent = state.webs;
  }

  function perspective(z) {
    const horizon = state.height * 0.43;
    const bottom = state.height * 1.03;
    const eased = Math.pow(1 - Math.max(0, Math.min(1, z)), 1.65);
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
    } else {
      ctx.translate(0, -70);
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

  function drawPlayer() {
    const baseY = state.height * 0.88 - player.y;
    const p = perspective(0.08);
    const x = laneX(player.visualLane, p);
    const slideAmount = player.slide > 0 ? 1 : 0;
    const bob = player.y > 0 ? 0 : Math.sin(player.runCycle * 2) * 3;
    const scale = Math.max(0.78, Math.min(1.18, state.height / 780));

    ctx.save();
    ctx.translate(x, baseY + bob);
    ctx.scale(scale, scale);

    ctx.globalAlpha = Math.max(0.08, 0.28 - player.y / 650);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 8 + player.y, 38, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (slideAmount) {
      ctx.rotate(-0.22);
      ctx.translate(0, 5);
    }

    const legSwing = player.y > 0 ? -0.35 : Math.sin(player.runCycle) * 0.62;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#075d9a";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(-8, -44 + slideAmount * 25);
    ctx.lineTo(-12 + legSwing * 17, -9 + slideAmount * 18);
    ctx.lineTo(-22 - legSwing * 11, 13 + slideAmount * 11);
    ctx.moveTo(8, -44 + slideAmount * 25);
    ctx.lineTo(12 - legSwing * 17, -9 + slideAmount * 18);
    ctx.lineTo(22 + legSwing * 11, 13 + slideAmount * 11);
    ctx.stroke();

    ctx.strokeStyle = "#07101f";
    ctx.lineWidth = 21;
    ctx.globalCompositeOperation = "destination-over";
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "#ef233c";
    ctx.strokeStyle = "#07101f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, -88 + slideAmount * 24);
    ctx.quadraticCurveTo(0, -98 + slideAmount * 24, 20, -88 + slideAmount * 24);
    ctx.lineTo(15, -41 + slideAmount * 22);
    ctx.quadraticCurveTo(0, -33 + slideAmount * 22, -15, -41 + slideAmount * 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#075d9a";
    ctx.beginPath();
    ctx.moveTo(-18, -61 + slideAmount * 23);
    ctx.lineTo(18, -61 + slideAmount * 23);
    ctx.lineTo(15, -41 + slideAmount * 22);
    ctx.quadraticCurveTo(0, -33 + slideAmount * 22, -15, -41 + slideAmount * 22);
    ctx.closePath();
    ctx.fill();

    const armSwing = player.y > 0 ? 0.9 : Math.sin(player.runCycle) * 0.7;
    ctx.strokeStyle = "#ef233c";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-16, -82 + slideAmount * 23);
    ctx.lineTo(-28 - armSwing * 13, -58 + slideAmount * 25);
    ctx.lineTo(-20 - armSwing * 19, -34 + slideAmount * 20);
    ctx.moveTo(16, -82 + slideAmount * 23);
    ctx.lineTo(28 + armSwing * 13, -58 + slideAmount * 25);
    ctx.lineTo(20 + armSwing * 19, -34 + slideAmount * 20);
    ctx.stroke();

    ctx.fillStyle = "#ef233c";
    ctx.strokeStyle = "#07101f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -109 + slideAmount * 23, 18, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(10,16,30,.65)";
    ctx.lineWidth = 1.1;
    for (let i = -12; i <= 12; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, -131 + slideAmount * 23);
      ctx.quadraticCurveTo(i * 1.3, -110 + slideAmount * 23, i, -87 + slideAmount * 23);
      ctx.stroke();
    }
    for (let y = -125; y <= -94; y += 8) {
      ctx.beginPath();
      ctx.ellipse(0, y + slideAmount * 23, 16 - Math.abs(y + 109) * 0.22, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#f6f4de";
    ctx.strokeStyle = "#07101f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-13, -116 + slideAmount * 23);
    ctx.quadraticCurveTo(-5, -114 + slideAmount * 23, -3, -103 + slideAmount * 23);
    ctx.quadraticCurveTo(-12, -104 + slideAmount * 23, -13, -116 + slideAmount * 23);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13, -116 + slideAmount * 23);
    ctx.quadraticCurveTo(5, -114 + slideAmount * 23, 3, -103 + slideAmount * 23);
    ctx.quadraticCurveTo(12, -104 + slideAmount * 23, 13, -116 + slideAmount * 23);
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

    const sorted = [...state.objects].sort((a, b) => b.z - a.z);
    for (const object of sorted) {
      if (object.kind === "token") drawToken(object, time);
      else drawObstacle(object);
    }
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
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "a", "d", "w", "s"];
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
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") slide();
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
      slide();
    }
  });

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
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
