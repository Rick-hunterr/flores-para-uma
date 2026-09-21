(() => {
  "use strict";

  /* =========================================================
     1) ELEMENTOS Y CONSTANTES GENERALES
     ========================================================= */

  const screens = {
    gift: document.getElementById("gift-screen"),
    rotate: document.getElementById("rotate-screen"),
    start: document.getElementById("start-screen"),
    options: document.getElementById("options-screen"),
    game: document.getElementById("game-screen"),
    final: document.getElementById("final-screen"),
  };

  const giftBox = document.getElementById("gift-box");
  const fadeOverlay = document.getElementById("fade-overlay");

  const playBtn = document.getElementById("play-btn");
  const optionsBtn = document.getElementById("options-btn");
  const optionsBackBtn = document.getElementById("options-back-btn");
  const rewatchBtn = document.getElementById("rewatch-btn");
  const volumeSlider = document.getElementById("volume-slider");

  const camera = document.getElementById("camera");
  const world = document.getElementById("world");
  const decorLayer = document.getElementById("decor-layer");
  const ambientLayer = document.getElementById("ambient");
  const pabloEl = document.getElementById("pablo");
  const umaEl = document.getElementById("uma");
  const pabloSprite = pabloEl.querySelector(".sprite");
  const umaSprite = umaEl.querySelector(".sprite");
  const flowerFx = document.getElementById("flower-fx");
  const hint = document.getElementById("hint");
  const offscreenIndicator = document.getElementById("offscreen-indicator");
  const dpad = document.getElementById("dpad");
  const muteBtn = document.getElementById("mute-btn");
  const talkBtn = document.getElementById("talk-btn");

  const dialogBox = document.getElementById("dialog-box");
  const dialogSpeaker = document.getElementById("dialog-speaker");
  const dialogText = document.getElementById("dialog-text");
  const dialogArrow = document.getElementById("dialog-arrow");

  const wallpaperCanvas = document.getElementById("wallpaper-canvas");
  const wallpaperPreview = document.getElementById("wallpaper-preview");
  const downloadBtn = document.getElementById("download-btn");
  const replayBtn = document.getElementById("replay-btn");

  const musicMap = document.getElementById("music-map");
  const musicFlowers = document.getElementById("music-flowers");

  const isTouch = matchMedia("(pointer: coarse)").matches;

  const STORAGE_KEY = "floresParaUma.completed";
  const VOLUME_KEY = "floresParaUma.volume";

  // Sprite sheets: 3 columnas x 4 filas. Orden real de filas verificado
  // a mano mirando los sheets (no es el orden RPG Maker clásico):
  // 0=abajo 1=izquierda 2=arriba 3=derecha. Columna 1 (del medio) = parado.
  const ROW = { down: 0, left: 1, up: 2, right: 3 };
  const IDLE_COL = 1;
  const NATIVE_FRAME = { pablo: 165, uma: 160 };

  const DIALOG_LINES = [
    { speaker: "Uma", text: "¿Pablo? ¿Qué hacés acá...?" },
    { speaker: "Pablo", text: "Buscándote, obvio. Tenía que darte esto." },
    { speaker: "Uma", text: "¡Son hermosas! Gracias... me encantan." },
    {
      speaker: "Pablo",
      text:
        "Uma, te merecés una flor por ser la más bella de todas. Sos una " +
        "chica grandiosa que me cambió la vida: te extraño y pienso en vos " +
        "todos los días. Nunca dejes de sonreír, porque tu sonrisa y tu " +
        "hermosa locura llenan de amor y de vida cada rincón de mi mundo.",
    },
  ];

  /* =========================================================
     2) TRANSICIONES DE PANTALLA (fundido a negro)
     ========================================================= */

  let activeScreenEl = screens.gift;

  function showScreenImmediate(el) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    el.classList.remove("hidden");
    activeScreenEl = el;
  }

  // Fundido: tapa en negro, ejecuta swapFn (que cambia qué pantalla se ve),
  // y destapa. Devuelve una promesa que resuelve cuando termina.
  function fadeTransition(swapFn, duration = 400) {
    return new Promise((resolve) => {
      fadeOverlay.classList.add("active");
      setTimeout(() => {
        swapFn();
        requestAnimationFrame(() => {
          fadeOverlay.classList.remove("active");
          setTimeout(resolve, duration);
        });
      }, duration);
    });
  }

  /* =========================================================
     3) ORIENTACION / PANTALLA COMPLETA (gate de portrait)
     ========================================================= */

  let opened = false;

  function isPortraitPhone() {
    return isTouch && window.innerHeight > window.innerWidth;
  }

  function updateOrientationGate() {
    if (!opened) return;
    if (isPortraitPhone()) {
      screens.rotate.classList.remove("hidden");
    } else {
      screens.rotate.classList.add("hidden");
    }
    cacheCameraSize();
  }

  async function tryFullscreenAndOrientation() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) { /* no es fatal */ }
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (e) { /* no soportado — la pantalla de "girá tu telefono" cubre esto */ }
  }

  window.addEventListener("resize", () => {
    updateOrientationGate();
    cacheCameraSize();
  });
  if (screen.orientation) screen.orientation.addEventListener("change", updateOrientationGate);

  /* =========================================================
     4) AUDIO: musica, crossfade y blips sintetizados
     ========================================================= */

  const audioState = {
    volume: 0.7,
    muted: false,
    crossfaded: false, // guarda para que el crossfade solo dispare una vez
  };

  (function loadVolumePref() {
    const saved = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (!Number.isNaN(saved)) audioState.volume = Math.min(1, Math.max(0, saved));
    volumeSlider.value = Math.round(audioState.volume * 100);
  })();

  function activeTrack() {
    return audioState.crossfaded ? musicFlowers : musicMap;
  }

  function applyVolume() {
    const track = activeTrack();
    track.volume = audioState.muted ? 0 : audioState.volume;
  }

  volumeSlider.addEventListener("input", () => {
    audioState.volume = volumeSlider.value / 100;
    localStorage.setItem(VOLUME_KEY, String(audioState.volume));
    applyVolume();
  });

  function startMusic() {
    musicMap.volume = audioState.muted ? 0 : audioState.volume;
    musicMap.play().catch(() => {
      const resume = () => { musicMap.play().catch(() => {}); document.removeEventListener("touchend", resume); };
      document.addEventListener("touchend", resume, { once: true });
    });

    // Desbloquea el segundo track en iOS reproduciendolo silenciado dentro
    // del mismo gesto del usuario, para poder arrancarlo despues sin pedir
    // una nueva interaccion.
    musicFlowers.volume = 0;
    musicFlowers.play().then(() => {
      musicFlowers.pause();
      musicFlowers.currentTime = 0;
    }).catch(() => {});
  }

  function crossfadeToFlowers(duration = 1300) {
    if (audioState.crossfaded) return; // ya se disparo (evento flores o fin del dialogo)
    audioState.crossfaded = true;

    musicFlowers.currentTime = 0;
    musicFlowers.volume = 0;
    musicFlowers.play().catch(() => {});

    const startVol1 = musicMap.volume;
    const targetVol2 = audioState.muted ? 0 : audioState.volume;
    const t0 = performance.now();

    function step(now) {
      const t = Math.max(0, Math.min(1, (now - t0) / duration));
      musicMap.volume = startVol1 * (1 - t);
      musicFlowers.volume = targetVol2 * t;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        musicMap.pause();
        musicMap.currentTime = 0;
      }
    }
    requestAnimationFrame(step);
  }

  muteBtn.addEventListener("click", () => {
    audioState.muted = !audioState.muted;
    applyVolume();
    muteBtn.textContent = audioState.muted ? "🔇" : "🔊";
  });

  // Blips cortos generados con Web Audio (sin depender de assets de sonido).
  let audioCtx = null;
  function blip(freq = 660, duration = 0.09, type = "square") {
    if (audioState.muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18 * audioState.volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* Web Audio no disponible — no es critico */ }
  }
  const blipFlower = () => { blip(880, 0.12, "triangle"); setTimeout(() => blip(1180, 0.14, "triangle"), 90); };
  const blipDialog = () => blip(520, 0.06, "square");

  /* =========================================================
     5) APERTURA DEL REGALO -> MENU PRINCIPAL
     ========================================================= */

  function openGift() {
    if (opened) return;
    opened = true;

    giftBox.classList.add("opening");
    startMusic();
    tryFullscreenAndOrientation();

    setTimeout(() => {
      fadeTransition(() => {
        showScreenImmediate(screens.start);
        if (localStorage.getItem(STORAGE_KEY) === "true") {
          rewatchBtn.classList.remove("hidden");
        }
        updateOrientationGate();
      });
    }, 480);
  }
  giftBox.addEventListener("click", openGift);

  /* =========================================================
     6) MENU: Jugar / Opciones / Ver el final
     ========================================================= */

  optionsBtn.addEventListener("click", () => fadeTransition(() => showScreenImmediate(screens.options)));
  optionsBackBtn.addEventListener("click", () => fadeTransition(() => showScreenImmediate(screens.start)));

  playBtn.addEventListener("click", () => {
    fadeTransition(() => {
      showScreenImmediate(screens.game);
      resetGameState();
      startGame();
    });
  });

  rewatchBtn.addEventListener("click", () => {
    fadeTransition(async () => {
      showScreenImmediate(screens.final);
      await showFinalScreen();
    });
  });

  /* =========================================================
     7) MUNDO: tamaño, decoracion, camara
     ========================================================= */

  const WORLD_W = 2600;
  const WORLD_H = 1400;

  // Recorrido de Pablo: loop hexagonal amplio dentro del mundo.
  const PABLO_PATH = [
    { x: 0.15, y: 0.78 },
    { x: 0.15, y: 0.34 },
    { x: 0.42, y: 0.16 },
    { x: 0.70, y: 0.34 },
    { x: 0.70, y: 0.78 },
    { x: 0.42, y: 0.92 },
  ];
  const UMA_START = { x: 0.88, y: 0.88 };

  world.style.width = `${WORLD_W}px`;
  world.style.height = `${WORLD_H}px`;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function scatterDecor() {
    decorLayer.innerHTML = "";
    const frag = document.createDocumentFragment();

    // Claros de pasto mas claro que marcan la zona caminable, superpuestos
    // a lo largo de todo el recorrido para que no se sienta un piso plano.
    const clearingSpots = [UMA_START, { x: 0.5, y: 0.55 }, ...PABLO_PATH];
    clearingSpots.forEach((p) => {
      const el = document.createElement("div");
      el.className = "deco clearing";
      const size = rand(560, 760);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${p.x * WORLD_W - size / 2}px`;
      el.style.top = `${p.y * WORLD_H - size / 2}px`;
      frag.appendChild(el);
    });

    // Camino punteado orientativo entre el punto de partida de Uma y la
    // zona donde patrulla Pablo — puramente decorativo.
    const pathPoints = 26;
    for (let i = 0; i < pathPoints; i++) {
      const t = i / (pathPoints - 1);
      const el = document.createElement("div");
      el.className = "deco path-tile";
      const w = rand(10, 16);
      el.style.width = `${w}px`;
      el.style.height = `${w * 0.5}px`;
      el.style.left = `${(UMA_START.x + (0.5 - UMA_START.x) * t) * WORLD_W + rand(-30, 30)}px`;
      el.style.top = `${(UMA_START.y + (0.55 - UMA_START.y) * t) * WORLD_H + rand(-20, 20)}px`;
      frag.appendChild(el);
    }

    function place(className, count, sizeJitter = true) {
      for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.className = `deco ${className}`;
        el.style.left = `${rand(40, WORLD_W - 40)}px`;
        el.style.top = `${rand(40, WORLD_H - 40)}px`;
        if (sizeJitter) {
          const scale = rand(0.8, 1.3);
          el.style.transform = `scale(${scale})`;
          el.style.animationDelay = `${rand(0, 3)}s`;
        }
        frag.appendChild(el);
      }
    }

    place("tree", 34);
    place("bush", 16);
    place("rock", 10, false);
    place("flowerpatch", 16);

    decorLayer.appendChild(frag);
  }

  function spawnAmbient() {
    ambientLayer.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (let i = 0; i < 12; i++) {
      const f = document.createElement("div");
      f.className = "firefly";
      f.style.left = `${rand(5, 95)}%`;
      f.style.top = `${rand(20, 85)}%`;
      f.style.animationDelay = `${rand(0, 6)}s`;
      f.style.animationDuration = `${rand(5, 8)}s`;
      frag.appendChild(f);
    }

    for (let i = 0; i < 10; i++) {
      const l = document.createElement("div");
      l.className = "leaf";
      l.style.left = `${rand(0, 100)}%`;
      l.style.animationDelay = `${rand(0, 10)}s`;
      l.style.animationDuration = `${rand(9, 16)}s`;
      frag.appendChild(l);
    }

    ambientLayer.appendChild(frag);
  }

  const cameraState = { w: 0, h: 0, x: 0, y: 0 };

  function cacheCameraSize() {
    const r = camera.getBoundingClientRect();
    cameraState.w = r.width;
    cameraState.h = r.height;
    state.frame = umaEl.getBoundingClientRect().width || state.frame;
  }

  function updateCamera(dt) {
    const targetX = clamp(state.uma.x - cameraState.w / 2, 0, Math.max(0, WORLD_W - cameraState.w));
    const targetY = clamp(state.uma.y - cameraState.h / 2, 0, Math.max(0, WORLD_H - cameraState.h));
    // scroll suave: la camara persigue con inercia (lerp), no salto brusco
    const lerp = 1 - Math.pow(0.001, dt);
    cameraState.x += (targetX - cameraState.x) * lerp;
    cameraState.y += (targetY - cameraState.y) * lerp;
    world.style.transform = `translate(${-cameraState.x}px, ${-cameraState.y}px)`;
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  /* =========================================================
     8) ESTADO DEL JUEGO Y BUCLE PRINCIPAL
     ========================================================= */

  const state = {
    frame: 96,
    uma: { x: 0, y: 0, dir: "down", moving: false },
    pablo: { x: 0, y: 0, dir: "down", moving: true, wp: 0 },
    input: { up: false, down: false, left: false, right: false },
    animT: 0,
    animCol: 0,
    animDir: 1,
    triggered: false,
    talking: false,
    running: false,
    lastTime: 0,
  };

  function resetGameState() {
    state.triggered = false;
    state.talking = false;
    state.running = false;
    state.input = { up: false, down: false, left: false, right: false };
    state.animT = 0;
    state.animCol = 0;
    state.animDir = 1;
    hint.classList.remove("hidden");
    dpad.classList.remove("hidden");
    talkBtn.classList.add("hidden");
    dialogBox.classList.add("hidden");
    offscreenIndicator.classList.add("hidden");
    flowerFx.classList.remove("pop");
    umaSprite.classList.remove("idle-bob");
    pabloSprite.classList.remove("idle-bob");
  }

  function clampToWorld(entity) {
    const margin = state.frame * 0.4;
    entity.x = clamp(entity.x, margin, WORLD_W - margin);
    entity.y = clamp(entity.y, margin * 1.2, WORLD_H - margin);
  }

  function startGame() {
    if (state.running) return;

    scatterDecor();
    spawnAmbient();
    cacheCameraSize();

    state.uma.x = WORLD_W * UMA_START.x;
    state.uma.y = WORLD_H * UMA_START.y;
    const p0 = PABLO_PATH[0];
    state.pablo.x = WORLD_W * p0.x;
    state.pablo.y = WORLD_H * p0.y;
    state.pablo.wp = 0;

    cameraState.x = clamp(state.uma.x - cameraState.w / 2, 0, Math.max(0, WORLD_W - cameraState.w));
    cameraState.y = clamp(state.uma.y - cameraState.h / 2, 0, Math.max(0, WORLD_H - cameraState.h));
    world.style.transform = `translate(${-cameraState.x}px, ${-cameraState.y}px)`;

    render();
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!state.running) return;
    const dt = Math.max(0, Math.min(0.05, (now - state.lastTime) / 1000));
    state.lastTime = now;

    updateUma(dt);
    updatePablo(dt);
    updateAnim(dt);
    updateCamera(dt);
    checkProximity();
    updateOffscreenIndicator();
    render();

    requestAnimationFrame(loop);
  }

  /* ---- input: D-pad tactil + teclado (para probar en escritorio) ---- */
  function bindDir(el, dir) {
    const press = (e) => { e.preventDefault(); state.input[dir] = true; el.classList.add("pressed"); };
    const release = (e) => { if (e) e.preventDefault(); state.input[dir] = false; el.classList.remove("pressed"); };
    el.addEventListener("touchstart", press, { passive: false });
    el.addEventListener("touchend", release);
    el.addEventListener("touchcancel", release);
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup", release);
    el.addEventListener("mouseleave", release);
  }
  dpad.querySelectorAll(".dpad-btn").forEach((btn) => bindDir(btn, btn.dataset.dir));

  const KEY_DIR = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  window.addEventListener("keydown", (e) => { if (KEY_DIR[e.key]) state.input[KEY_DIR[e.key]] = true; });
  window.addEventListener("keyup", (e) => { if (KEY_DIR[e.key]) state.input[KEY_DIR[e.key]] = false; });

  function updateUma(dt) {
    if (state.triggered) { state.uma.moving = false; return; }

    const inp = state.input;
    let dx = 0, dy = 0;
    let dir = state.uma.dir;
    if (inp.left) { dx -= 1; dir = "left"; }
    else if (inp.right) { dx += 1; dir = "right"; }
    else if (inp.up) { dy -= 1; dir = "up"; }
    else if (inp.down) { dy += 1; dir = "down"; }

    const moving = dx !== 0 || dy !== 0;
    state.uma.moving = moving;
    state.uma.dir = dir;

    if (moving) {
      const speed = state.frame * 1.6;
      state.uma.x += dx * speed * dt;
      state.uma.y += dy * speed * dt;
      clampToWorld(state.uma);
    }
  }

  function updatePablo(dt) {
    if (state.triggered) { state.pablo.moving = false; return; }

    const target = PABLO_PATH[state.pablo.wp];
    const tx = WORLD_W * target.x;
    const ty = WORLD_H * target.y;
    const dx = tx - state.pablo.x;
    const dy = ty - state.pablo.y;
    const dist = Math.hypot(dx, dy);

    const speed = state.frame * 1.15;
    if (dist < 0.5 || dist < speed * dt) {
      state.pablo.x = tx;
      state.pablo.y = ty;
      state.pablo.wp = (state.pablo.wp + 1) % PABLO_PATH.length;
    } else {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      state.pablo.dir = dir;
      state.pablo.x += (dx / dist) * speed * dt;
      state.pablo.y += (dy / dist) * speed * dt;
    }
    state.pablo.moving = true;
  }

  function updateAnim(dt) {
    state.animT += dt;
    const stepTime = 0.14;
    if (state.animT >= stepTime) {
      state.animT = 0;
      state.animCol += state.animDir;
      if (state.animCol >= 2 || state.animCol <= 0) state.animDir *= -1;
      state.animCol = Math.max(0, Math.min(2, state.animCol));
    }
  }

  function checkProximity() {
    if (state.triggered) return;
    const dx = state.uma.x - state.pablo.x;
    const dy = state.uma.y - state.pablo.y;
    const dist = Math.hypot(dx, dy);
    const threshold = state.frame * 0.72;
    if (dist < threshold) triggerFlowers(dx);
  }

  // Flecha en el borde de pantalla que apunta hacia Pablo cuando queda
  // fuera de camara (mapa grande, camara siguiendo solo a Uma).
  function updateOffscreenIndicator() {
    if (state.triggered) { offscreenIndicator.classList.add("hidden"); return; }

    const screenX = state.pablo.x - cameraState.x;
    const screenY = state.pablo.y - cameraState.y;
    const margin = 46;
    const visible = screenX > margin && screenX < cameraState.w - margin &&
                     screenY > margin && screenY < cameraState.h - margin;

    if (visible) { offscreenIndicator.classList.add("hidden"); return; }

    offscreenIndicator.classList.remove("hidden");
    const cx = cameraState.w / 2;
    const cy = cameraState.h / 2;
    const dx = screenX - cx;
    const dy = screenY - cy;
    const angle = Math.atan2(dy, dx);

    const halfW = cameraState.w / 2 - margin;
    const halfH = cameraState.h / 2 - margin;
    const scale = Math.min(
      Math.abs(dx) > 1e-3 ? Math.abs(halfW / dx) : Infinity,
      Math.abs(dy) > 1e-3 ? Math.abs(halfH / dy) : Infinity
    );
    const ix = cx + Math.cos(angle) * scale;
    const iy = cy + Math.sin(angle) * scale;

    offscreenIndicator.style.left = `${ix}px`;
    offscreenIndicator.style.top = `${iy}px`;
    offscreenIndicator.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
  }

  function setFrame(spriteEl, size, dir, col) {
    spriteEl.style.backgroundSize = `${size * 3}px ${size * 4}px`;
    spriteEl.style.backgroundPosition = `-${col * size}px -${ROW[dir] * size}px`;
  }

  function render() {
    umaEl.style.left = `${state.uma.x}px`;
    umaEl.style.top = `${state.uma.y}px`;
    pabloEl.style.left = `${state.pablo.x}px`;
    pabloEl.style.top = `${state.pablo.y}px`;

    const umaCol = state.uma.moving ? state.animCol : IDLE_COL;
    const pabloCol = state.pablo.moving ? state.animCol : IDLE_COL;
    setFrame(umaSprite, state.frame, state.uma.dir, umaCol);
    setFrame(pabloSprite, state.frame, state.pablo.dir, pabloCol);

    // idle bob sutil para que no se sientan "congelados" al estar quietos
    umaSprite.classList.toggle("idle-bob", !state.uma.moving && !state.triggered);
    pabloSprite.classList.toggle("idle-bob", !state.pablo.moving);
  }

  /* =========================================================
     9) ENTREGA DE FLORES + BOTON HABLAR
     ========================================================= */

  function triggerFlowers(dx) {
    state.triggered = true;
    hint.classList.add("hidden");
    dpad.classList.add("hidden");
    offscreenIndicator.classList.add("hidden");

    if (dx >= 0) { state.pablo.dir = "right"; state.uma.dir = "left"; }
    else { state.pablo.dir = "left"; state.uma.dir = "right"; }
    setFrame(umaSprite, state.frame, state.uma.dir, IDLE_COL);
    setFrame(pabloSprite, state.frame, state.pablo.dir, IDLE_COL);

    const midX = (state.uma.x + state.pablo.x) / 2;
    const midY = (state.uma.y + state.pablo.y) / 2 - state.frame * 0.55;
    flowerFx.style.left = `${midX}px`;
    flowerFx.style.top = `${midY}px`;
    flowerFx.classList.add("pop");

    blipFlower();
    crossfadeToFlowers();

    setTimeout(() => talkBtn.classList.remove("hidden"), 1000);
  }

  talkBtn.addEventListener("click", () => {
    if (state.talking) return;
    state.talking = true;
    talkBtn.classList.add("hidden");
    blipDialog();
    openDialog();
  });

  /* =========================================================
     10) DIALOGO RPG: varias lineas, maquina de escribir
     ========================================================= */

  let dialogIndex = 0;
  let typing = false;
  let typeTimer = null;

  function openDialog() {
    dialogIndex = 0;
    dialogBox.classList.remove("hidden");
    showDialogLine();
  }

  function showDialogLine() {
    const line = DIALOG_LINES[dialogIndex];
    dialogSpeaker.textContent = line.speaker;
    dialogArrow.classList.add("hidden");
    dialogText.textContent = "";
    typing = true;

    let i = 0;
    function typeChar() {
      if (!typing) return;
      dialogText.textContent = line.text.slice(0, i + 1);
      i++;
      if (i < line.text.length) {
        typeTimer = setTimeout(typeChar, 24);
      } else {
        typing = false;
        dialogArrow.classList.remove("hidden");
      }
    }
    typeChar();
  }

  dialogBox.addEventListener("click", () => {
    const line = DIALOG_LINES[dialogIndex];
    if (typing) {
      // tocar de nuevo mientras tipea = completar la linea al instante
      typing = false;
      clearTimeout(typeTimer);
      dialogText.textContent = line.text;
      dialogArrow.classList.remove("hidden");
      return;
    }

    dialogIndex++;
    if (dialogIndex < DIALOG_LINES.length) {
      blipDialog();
      showDialogLine();
    } else {
      finishDialog();
    }
  });

  function finishDialog() {
    dialogBox.classList.add("hidden");
    crossfadeToFlowers(); // red de seguridad: si por algo no se disparo antes
    localStorage.setItem(STORAGE_KEY, "true");
    state.running = false;

    fadeTransition(async () => {
      showScreenImmediate(screens.final);
      await showFinalScreen();
    });
  }

  /* =========================================================
     11) PANTALLA FINAL: wallpaper descargable
     ========================================================= */

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  let pabloImg = null;
  let umaImg = null;
  let flowerImg = null;
  const imagesReady = Promise.all([
    loadImage("assets/images/pablo-walk.png"),
    loadImage("assets/images/uma-walk.png"),
    loadImage("assets/images/girasolpixel.png"),
  ]).then(([p, u, f]) => { pabloImg = p; umaImg = u; flowerImg = f; });

  async function generateWallpaper() {
    await imagesReady;
    try { await document.fonts.load('64px "Press Start 2P"'); } catch (e) { /* opcional */ }

    const ctx = wallpaperCanvas.getContext("2d");
    const W = wallpaperCanvas.width;
    const H = wallpaperCanvas.height;
    ctx.imageSmoothingEnabled = false;

    // fondo bosque
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#3a5a2c");
    sky.addColorStop(1, "#152110");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const clearing = ctx.createRadialGradient(W / 2, H * 0.72, H * 0.08, W / 2, H * 0.72, H * 0.42);
    clearing.addColorStop(0, "#8fbf63");
    clearing.addColorStop(1, "rgba(143,191,99,0)");
    ctx.fillStyle = clearing;
    ctx.fillRect(0, 0, W, H);

    // siluetas de arboles decorativos (banda inferior)
    ctx.fillStyle = "#2c4522";
    const treeCount = 9;
    for (let i = 0; i < treeCount; i++) {
      const tx = (i / (treeCount - 1)) * W + (i % 2 ? 30 : -30);
      const th = 130 + (i % 3) * 50;
      ctx.beginPath();
      ctx.moveTo(tx, H - 30);
      ctx.lineTo(tx - th * 0.3, H - 30 - th);
      ctx.lineTo(tx + th * 0.3, H - 30 - th);
      ctx.closePath();
      ctx.fill();
    }

    // flores decorativas dispersas por buena parte del alto (para que un
    // formato vertical tan largo no se sienta vacio arriba)
    const flowerColors = ["#e3a541", "#e07a9a", "#f5e9c8"];
    for (let i = 0; i < 90; i++) {
      const fx = Math.random() * W;
      const fy = H * 0.32 + Math.random() * H * 0.62;
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // personajes, de cuerpo entero, uno junto al otro con espacio para el ramo
    const baseline = H * 0.72;
    const scale = 2.8;
    const drawChar = (img, native, cx) => {
      if (!img) return;
      const size = native * scale;
      ctx.drawImage(img, 1 * native, ROW.down * native, native, native, cx - size / 2, baseline - size, size, size);
    };
    drawChar(pabloImg, NATIVE_FRAME.pablo, W * 0.27);
    drawChar(umaImg, NATIVE_FRAME.uma, W * 0.73);

    // el girasol pixel art provisto, como ramo entre los dos (uno grande al
    // frente y dos mas chicos inclinados detras, para que se lea como ramo)
    if (flowerImg) {
      const bx = W * 0.5;
      const by = baseline - NATIVE_FRAME.pablo * scale * 0.5;
      const drawFlower = (w, dx, dy, rotDeg) => {
        const h = w * (flowerImg.height / flowerImg.width);
        ctx.save();
        ctx.translate(bx + dx, by + dy);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.drawImage(flowerImg, -w / 2, -h * 0.28, w, h);
        ctx.restore();
      };
      drawFlower(120, -46, 6, -18);
      drawFlower(120, 46, 6, 18);
      drawFlower(150, 0, -10, 0);
    }

    // titulo pixel
    ctx.fillStyle = "#f5e9c8";
    ctx.textAlign = "center";
    ctx.font = '54px "Press Start 2P", monospace';
    ctx.save();
    ctx.shadowColor = "#241a10";
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillText("Pablo  &  Uma", W / 2, H * 0.14);
    ctx.restore();

    // vineta suave
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    return new Promise((resolve) => {
      wallpaperCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  let lastWallpaperUrl = null;
  async function showFinalScreen() {
    const blob = await generateWallpaper();
    if (lastWallpaperUrl) URL.revokeObjectURL(lastWallpaperUrl);
    lastWallpaperUrl = URL.createObjectURL(blob);
    wallpaperPreview.src = lastWallpaperUrl;
  }

  downloadBtn.addEventListener("click", () => {
    if (!lastWallpaperUrl) return;
    const a = document.createElement("a");
    a.href = lastWallpaperUrl;
    a.download = "pablo-y-uma-fondo.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  replayBtn.addEventListener("click", () => {
    audioState.crossfaded = false;
    musicFlowers.pause();
    musicFlowers.currentTime = 0;
    fadeTransition(() => {
      showScreenImmediate(screens.game);
      resetGameState();
      startGame();
      startMusic();
    });
  });
})();
