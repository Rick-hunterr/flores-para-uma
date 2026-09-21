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
    credits: document.getElementById("credits-screen"),
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
  const worldAmbientLayer = document.getElementById("world-ambient");
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
  const specialMoment = document.getElementById("special-moment");

  const dialogBox = document.getElementById("dialog-box");
  const dialogSpeaker = document.getElementById("dialog-speaker");
  const dialogText = document.getElementById("dialog-text");
  const dialogArrow = document.getElementById("dialog-arrow");

  const wallpaperCanvas = document.getElementById("wallpaper-canvas");
  const wallpaperFrame = document.querySelector(".wallpaper-frame");
  const wallpaperPreview = document.getElementById("wallpaper-preview");
  const downloadBtn = document.getElementById("download-btn");
  const replayBtn = document.getElementById("replay-btn");
  const creditsBtn = document.getElementById("credits-btn");

  const tintOverlay = document.getElementById("tint-overlay");

  const creditsViewport = document.getElementById("credits-viewport");
  const creditsContent = document.getElementById("credits-content");
  const creditsSkip = document.getElementById("credits-skip");

  const musicMap = document.getElementById("music-map");
  const musicFlowers = document.getElementById("music-flowers");
  const musicCredits = document.getElementById("music-credits");

  const isTouch = matchMedia("(pointer: coarse)").matches;

  const STORAGE_KEY = "floresParaUma.completed";
  const VOLUME_KEY = "floresParaUma.volume";

  // Sprite sheets: 3 columnas x 4 filas. Orden real de filas verificado
  // a mano mirando los sheets (no es el orden RPG Maker clásico):
  // 0=abajo 1=izquierda 2=arriba 3=derecha. Columna 1 (del medio) = parado.
  const ROW = { down: 0, left: 1, up: 2, right: 3 };
  const IDLE_COL = 1;
  const NATIVE_FRAME = { pablo: 165, uma: 160 };

  // lineas narrativas sin nombre de personaje, tipo descripcion de escena,
  // que dan una pausa despues del momento especial y antes del dialogo
  const NARRATIVE_LINES = [
    { speaker: "", text: "El viento se calma por un instante." },
    { speaker: "", text: "Uma sostiene las flores amarillas, y por un segundo el bosque entero parece sonreír." },
  ];

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
    crossfaded: false, // guarda para que el crossfade a flores solo dispare una vez
    inCredits: false,
  };

  (function loadVolumePref() {
    const saved = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (!Number.isNaN(saved)) audioState.volume = Math.min(1, Math.max(0, saved));
    volumeSlider.value = Math.round(audioState.volume * 100);
  })();

  function activeTrack() {
    if (audioState.inCredits) return musicCredits;
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

  function silentlyUnlock(track) {
    // Desbloquea un track en iOS reproduciendolo silenciado dentro del
    // mismo gesto del usuario, para poder arrancarlo despues sin pedir
    // una nueva interaccion.
    track.volume = 0;
    track.play().then(() => {
      track.pause();
      track.currentTime = 0;
    }).catch(() => {});
  }

  function startMusic() {
    musicMap.volume = audioState.muted ? 0 : audioState.volume;
    musicMap.play().catch(() => {
      const resume = () => { musicMap.play().catch(() => {}); document.removeEventListener("touchend", resume); };
      document.addEventListener("touchend", resume, { once: true });
    });
    silentlyUnlock(musicFlowers);
    silentlyUnlock(musicCredits);
  }

  // Fundido cruzado generico entre dos tracks: sube "to" mientras baja
  // "from". Se usa tanto para pasar a la musica de las flores como para
  // entrar/salir de los creditos.
  function crossfadeAudio(from, to, { duration = 1300, pauseFrom = true } = {}) {
    return new Promise((resolve) => {
      to.currentTime = 0;
      to.volume = 0;
      to.play().catch(() => {});

      const startVol = from.volume;
      const targetVol = audioState.muted ? 0 : audioState.volume;
      const t0 = performance.now();

      function step(now) {
        const t = Math.max(0, Math.min(1, (now - t0) / duration));
        from.volume = startVol * (1 - t);
        to.volume = targetVol * t;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          if (pauseFrom) { from.pause(); from.currentTime = 0; }
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  function crossfadeToFlowers(duration = 1300) {
    if (audioState.crossfaded) return; // ya se disparo (evento flores o fin del dialogo)
    audioState.crossfaded = true;
    crossfadeAudio(musicMap, musicFlowers, { duration });
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

  creditsBtn.addEventListener("click", () => {
    fadeTransition(() => {
      showScreenImmediate(screens.credits);
      enterCredits();
    });
  });

  creditsSkip.addEventListener("click", () => {
    exitCredits();
    fadeTransition(() => showScreenImmediate(screens.final));
  });

  /* =========================================================
     7) MUNDO: tamaño, decoracion, camara
     ========================================================= */

  const WORLD_W = 3200;
  const WORLD_H = 1700;

  // Recorrido de Pablo: loop amplio y sinuoso dentro del mundo.
  const PABLO_PATH = [
    { x: 0.13, y: 0.80 },
    { x: 0.13, y: 0.50 },
    { x: 0.22, y: 0.20 },
    { x: 0.46, y: 0.12 },
    { x: 0.68, y: 0.22 },
    { x: 0.74, y: 0.48 },
    { x: 0.68, y: 0.78 },
    { x: 0.40, y: 0.88 },
  ];
  const UMA_START = { x: 0.90, y: 0.88 };

  // obstaculos fijos (no aleatorios) para reforzar el camino central
  const LAKE_SPOT = { x: 0.56, y: 0.56 };
  const LOG_SPOT = { x: 0.30, y: 0.66 };

  world.style.width = `${WORLD_W}px`;
  world.style.height = `${WORLD_H}px`;

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* ---- sistema de colisiones: lista generica de obstaculos ---- */
  // cada obstaculo es {type:'circle', x, y, r} o {type:'ellipse', x, y, rx, ry}
  // en coordenadas de mundo. El hitbox es mas chico que el sprite visual.
  const OBSTACLES = [];

  function collidesPoint(x, y, entityR) {
    for (let i = 0; i < OBSTACLES.length; i++) {
      const o = OBSTACLES[i];
      if (o.type === "circle") {
        if (Math.hypot(x - o.x, y - o.y) < o.r + entityR) return true;
      } else if (o.type === "ellipse") {
        const nx = (x - o.x) / (o.rx + entityR);
        const ny = (y - o.y) / (o.ry + entityR);
        if (nx * nx + ny * ny < 1) return true;
      }
    }
    return false;
  }

  function scatterDecor() {
    decorLayer.innerHTML = "";
    OBSTACLES.length = 0;
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
    // zona donde patrulla Pablo — puramente decorativo, reforzado por el
    // tronco y la laguna cerca de esa misma linea.
    const pathPoints = 30;
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

    // Laguna: obstaculo grande y fijo, con hitbox elipse un poco mas chica
    // que el dibujo para que rozar el borde no se sienta injusto.
    (function placeLake() {
      const el = document.createElement("div");
      el.className = "deco lake";
      const w = 320, h = 200;
      const cx = LAKE_SPOT.x * WORLD_W;
      const cy = LAKE_SPOT.y * WORLD_H;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.left = `${cx - w / 2}px`;
      el.style.top = `${cy - h / 2}px`;
      el.style.zIndex = "1";
      frag.appendChild(el);
      OBSTACLES.push({ type: "ellipse", x: cx, y: cy, rx: w * 0.42, ry: h * 0.4 });
    })();

    // Tronco caido: obstaculo chico y fijo cerca del camino.
    (function placeLog() {
      const el = document.createElement("div");
      el.className = "deco log";
      const cx = LOG_SPOT.x * WORLD_W;
      const cy = LOG_SPOT.y * WORLD_H;
      el.style.left = `${cx - 42}px`;
      el.style.top = `${cy - 13}px`;
      el.style.transform = `rotate(${rand(-8, 8)}deg)`;
      frag.appendChild(el);
      OBSTACLES.push({ type: "circle", x: cx, y: cy, r: 34 });
    })();

    // Arboles: mas densos lejos de los claros/camino (bordes del mapa),
    // mas abiertos cerca del recorrido — de N candidatos al azar, se elige
    // el que este mas lejos de cualquier claro.
    const TREE_COUNT = 70;
    for (let i = 0; i < TREE_COUNT; i++) {
      let best = null, bestDist = -1;
      for (let a = 0; a < 5; a++) {
        const x = rand(50, WORLD_W - 50);
        const y = rand(50, WORLD_H - 50);
        let minDist = Infinity;
        for (const p of clearingSpots) {
          minDist = Math.min(minDist, Math.hypot(x - p.x * WORLD_W, y - p.y * WORLD_H));
        }
        if (minDist > bestDist) { bestDist = minDist; best = { x, y }; }
      }
      const scale = rand(0.85, 1.5);
      const el = document.createElement("div");
      el.className = "deco tree";
      el.style.left = `${best.x - 33 * scale}px`;
      el.style.top = `${best.y - 86 * scale}px`;
      el.style.transform = `scale(${scale})`;
      el.style.animationDelay = `${rand(0, 3)}s`;
      frag.appendChild(el);
      // hitbox chica centrada en el tronco (el ancla de escala es 50% 100%,
      // asi que la base del arbol queda siempre en el mismo punto de mundo)
      OBSTACLES.push({ type: "circle", x: best.x, y: best.y, r: 17 * scale });
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

    place("bush", 22);
    place("rock", 14, false);
    place("flowerpatch", 22);

    // Girasoles chicos esparcidos como decoracion extra (reciclando el
    // sprite existente), distintos del ramo principal de la entrega.
    for (let i = 0; i < 14; i++) {
      const img = document.createElement("img");
      img.src = "assets/images/girasolpixel.png";
      img.alt = "";
      img.className = "deco deco-flower";
      img.style.left = `${rand(40, WORLD_W - 40)}px`;
      img.style.top = `${rand(40, WORLD_H - 40)}px`;
      img.style.transform = `scale(${rand(0.6, 1)})`;
      img.style.animationDelay = `${rand(0, 3)}s`;
      frag.appendChild(img);
    }

    decorLayer.appendChild(frag);
  }

  function spawnAmbient() {
    // Luciernagas en espacio de mundo: parejas esparcidas por todo el mapa,
    // mas otro grupo agrupado cerca del recorrido de Pablo especificamente.
    worldAmbientLayer.innerHTML = "";
    const wfrag = document.createDocumentFragment();

    function placeFirefly(x, y) {
      const f = document.createElement("div");
      f.className = "firefly";
      f.style.left = `${x}px`;
      f.style.top = `${y}px`;
      f.style.animationDelay = `${rand(0, 6)}s`;
      f.style.animationDuration = `${rand(5, 8)}s`;
      wfrag.appendChild(f);
    }

    for (let i = 0; i < 16; i++) {
      placeFirefly(rand(80, WORLD_W - 80), rand(80, WORLD_H - 80));
    }
    // grupo denso cerca de donde patrulla Pablo
    const pathCx = PABLO_PATH.reduce((s, p) => s + p.x, 0) / PABLO_PATH.length * WORLD_W;
    const pathCy = PABLO_PATH.reduce((s, p) => s + p.y, 0) / PABLO_PATH.length * WORLD_H;
    for (let i = 0; i < 18; i++) {
      placeFirefly(pathCx + rand(-260, 260), pathCy + rand(-200, 200));
    }

    worldAmbientLayer.appendChild(wfrag);

    // Hojas cayendo: efecto de clima en espacio de pantalla (no de mundo).
    ambientLayer.innerHTML = "";
    const frag = document.createDocumentFragment();
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
    hint.textContent = "Acercate a Pablo";
    hint.classList.remove("hidden");
    dpad.classList.remove("hidden");
    talkBtn.classList.add("hidden");
    dialogBox.classList.add("hidden");
    offscreenIndicator.classList.add("hidden");
    tintOverlay.style.opacity = "0";
    flowerFx.classList.remove("pop", "prompt");
    flowerFx.setAttribute("aria-hidden", "true");
    flowerFx.tabIndex = -1;
    specialMoment.classList.add("hidden");
    specialMoment.classList.remove("show");
    pabloEl.classList.remove("notice");
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
    updateTint();
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
      const entityR = state.frame * 0.22;
      // colisión por eje: permite deslizarse a lo largo de un obstáculo en
      // vez de trabarse en seco cuando el movimiento no es perfectamente recto
      const nx = state.uma.x + dx * speed * dt;
      if (!collidesPoint(nx, state.uma.y, entityR)) state.uma.x = nx;
      const ny = state.uma.y + dy * speed * dt;
      if (!collidesPoint(state.uma.x, ny, entityR)) state.uma.y = ny;
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
    if (dist < threshold) startNoticeSequence(dx);
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

  // Tinte calido tipo "atardecer" que se intensifica a medida que Uma se
  // acerca a Pablo — sin cielo, es solo un filtro sutil sobre toda la escena.
  const TINT_MAX_OPACITY = 0.28;
  const TINT_START_DIST = 1400;
  function updateTint() {
    if (state.triggered) return;
    const dist = Math.hypot(state.uma.x - state.pablo.x, state.uma.y - state.pablo.y);
    const ratio = 1 - clamp(dist / TINT_START_DIST, 0, 1);
    tintOverlay.style.opacity = String(ratio * TINT_MAX_OPACITY);
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
     9) SECUENCIA DE ENTREGA DE FLORES (etapas, con pausas)
     ========================================================= */

  // Etapa 1: Pablo nota que Uma se acerca — se detiene, se encaran, gesto
  // de sorpresa — y despues de una pausa breve muestra la flor.
  function startNoticeSequence(dx) {
    state.triggered = true;
    dpad.classList.add("hidden");
    offscreenIndicator.classList.add("hidden");

    if (dx >= 0) { state.pablo.dir = "right"; state.uma.dir = "left"; }
    else { state.pablo.dir = "left"; state.uma.dir = "right"; }
    setFrame(umaSprite, state.frame, state.uma.dir, IDLE_COL);
    setFrame(pabloSprite, state.frame, state.pablo.dir, IDLE_COL);

    hint.textContent = "Pablo te vio...";
    hint.classList.remove("hidden");
    pabloEl.classList.add("notice");

    setTimeout(() => {
      pabloEl.classList.remove("notice");
      showFlowerPrompt(dx);
    }, 700);
  }

  // Etapa 2: Pablo muestra la flor — Uma tiene que tocarla para recibirla
  // (micro-interaccion: no se entrega sola por cercania).
  function showFlowerPrompt(dx) {
    hint.textContent = "Tocá la flor para recibirla";
    hint.classList.remove("hidden");

    flowerFx.style.left = `${state.pablo.x}px`;
    flowerFx.style.top = `${state.pablo.y - state.frame * 0.62}px`;
    flowerFx.classList.remove("pop");
    flowerFx.classList.add("prompt");
    flowerFx.setAttribute("aria-hidden", "false");
    flowerFx.setAttribute("aria-label", "Recibir las flores");
    flowerFx.tabIndex = 0;

    function receive(e) {
      e.preventDefault();
      flowerFx.removeEventListener("click", receive);
      flowerFx.removeEventListener("touchend", receive);
      receiveFlowers(dx);
    }
    flowerFx.addEventListener("click", receive);
    flowerFx.addEventListener("touchend", receive, { passive: false });
  }

  // Etapa 3: Uma recibe las flores — el momento especial (flor + corazon),
  // el crossfade de musica se dispara justo aca (con el gesto de recibir,
  // no con la sola cercania).
  function receiveFlowers(dx) {
    hint.classList.add("hidden");
    flowerFx.classList.remove("prompt");
    flowerFx.tabIndex = -1;
    flowerFx.setAttribute("aria-hidden", "true");

    const midX = (state.uma.x + state.pablo.x) / 2;
    const midY = (state.uma.y + state.pablo.y) / 2 - state.frame * 0.55;
    flowerFx.style.left = `${midX}px`;
    flowerFx.style.top = `${midY}px`;
    flowerFx.classList.add("pop");

    blipFlower();
    crossfadeToFlowers();

    // momento especial: flor + corazon grandes, centrados, con fundido de
    // entrada/salida.
    const SPECIAL_MOMENT_MS = 3000;
    specialMoment.classList.remove("hidden");
    specialMoment.classList.remove("show");
    void specialMoment.offsetWidth; // fuerza reflow para poder re-disparar la animacion
    specialMoment.classList.add("show");
    setTimeout(() => {
      specialMoment.classList.add("hidden");
      // Etapa 4: una pausa narrativa antes de habilitar la charla.
      playDialogSequence(NARRATIVE_LINES, () => talkBtn.classList.remove("hidden"));
    }, SPECIAL_MOMENT_MS);
  }

  talkBtn.addEventListener("click", () => {
    if (state.talking) return;
    state.talking = true;
    talkBtn.classList.add("hidden");
    blipDialog();
    playDialogSequence(DIALOG_LINES, finishDialog);
  });

  /* =========================================================
     10) DIALOGO RPG generico: varias lineas, maquina de escribir
     ========================================================= */

  let dialogLines = [];
  let dialogIndex = 0;
  let dialogOnComplete = null;
  let typing = false;
  let typeTimer = null;

  function playDialogSequence(lines, onComplete) {
    dialogLines = lines;
    dialogIndex = 0;
    dialogOnComplete = onComplete;
    dialogBox.classList.remove("hidden");
    showDialogLine();
  }

  function showDialogLine() {
    const line = dialogLines[dialogIndex];
    dialogSpeaker.textContent = line.speaker || "";
    dialogText.classList.toggle("narrative", !line.speaker);
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
    const line = dialogLines[dialogIndex];
    if (typing) {
      // tocar de nuevo mientras tipea = completar la linea al instante
      typing = false;
      clearTimeout(typeTimer);
      dialogText.textContent = line.text;
      dialogArrow.classList.remove("hidden");
      return;
    }

    dialogIndex++;
    if (dialogIndex < dialogLines.length) {
      blipDialog();
      showDialogLine();
    } else {
      dialogBox.classList.add("hidden");
      const cb = dialogOnComplete;
      dialogOnComplete = null;
      if (cb) cb();
    }
  });

  function finishDialog() {
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

    const clearing = ctx.createRadialGradient(W / 2, H * 0.68, H * 0.08, W / 2, H * 0.68, H * 0.5);
    clearing.addColorStop(0, "#8fbf63");
    clearing.addColorStop(1, "rgba(143,191,99,0)");
    ctx.fillStyle = clearing;
    ctx.fillRect(0, 0, W, H);

    // siluetas de arboles decorativos (banda inferior)
    ctx.fillStyle = "#2c4522";
    const treeCount = 14;
    for (let i = 0; i < treeCount; i++) {
      const tx = (i / (treeCount - 1)) * W + (i % 2 ? 40 : -40);
      const th = 150 + (i % 3) * 60;
      ctx.beginPath();
      ctx.moveTo(tx, H - 30);
      ctx.lineTo(tx - th * 0.28, H - 30 - th);
      ctx.lineTo(tx + th * 0.28, H - 30 - th);
      ctx.closePath();
      ctx.fill();
    }

    // flores decorativas dispersas en la franja de pasto inferior
    const flowerColors = ["#e3a541", "#e07a9a", "#f5e9c8"];
    for (let i = 0; i < 70; i++) {
      const fx = Math.random() * W;
      const fy = H * 0.66 + Math.random() * H * 0.32;
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(fx, fy, 3 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // personajes, de cuerpo entero, uno junto al otro con espacio para el ramo
    const baseline = H * 0.88;
    const scale = 3.2;
    const drawChar = (img, native, cx) => {
      if (!img) return;
      const size = native * scale;
      ctx.drawImage(img, 1 * native, ROW.down * native, native, native, cx - size / 2, baseline - size, size, size);
    };
    drawChar(pabloImg, NATIVE_FRAME.pablo, W * 0.38);
    drawChar(umaImg, NATIVE_FRAME.uma, W * 0.62);

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
    ctx.font = '58px "Press Start 2P", monospace';
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

  // Imagen estatica para el preview de Open Graph al compartir el link
  // (1200x630), reutilizando la misma composicion/paleta que el fondo.
  // Se genera una vez con un script aparte y se guarda como archivo en el
  // proyecto — esta funcion queda disponible para regenerarla si hace falta.
  const ogCanvas = document.getElementById("og-canvas");
  async function generateOgImage() {
    await imagesReady;
    try { await document.fonts.load('50px "Press Start 2P"'); } catch (e) { /* opcional */ }

    const ctx = ogCanvas.getContext("2d");
    const W = ogCanvas.width;
    const H = ogCanvas.height;
    ctx.imageSmoothingEnabled = false;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#3a5a2c");
    sky.addColorStop(1, "#152110");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const clearing = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.05, W / 2, H * 0.6, H * 0.55);
    clearing.addColorStop(0, "#8fbf63");
    clearing.addColorStop(1, "rgba(143,191,99,0)");
    ctx.fillStyle = clearing;
    ctx.fillRect(0, 0, W, H);

    const baseline = H * 0.92;
    const scale = 2.1;
    const drawChar = (img, native, cx) => {
      if (!img) return;
      const size = native * scale;
      ctx.drawImage(img, 1 * native, ROW.down * native, native, native, cx - size / 2, baseline - size, size, size);
    };
    drawChar(pabloImg, NATIVE_FRAME.pablo, W * 0.36);
    drawChar(umaImg, NATIVE_FRAME.uma, W * 0.64);

    if (flowerImg) {
      const fw = 130;
      const fh = fw * (flowerImg.height / flowerImg.width);
      ctx.drawImage(flowerImg, W * 0.5 - fw / 2, baseline - fh * 1.05, fw, fh);
    }

    ctx.fillStyle = "#f5e9c8";
    ctx.textAlign = "center";
    ctx.font = '50px "Press Start 2P", monospace';
    ctx.save();
    ctx.shadowColor = "#241a10";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText("Para Uma 🌼", W / 2, H * 0.22);
    ctx.restore();

    return new Promise((resolve) => {
      ogCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  // corazon dibujado por codigo (sin asset nuevo), via curvas bezier
  function drawHeart(ctx, cx, cy, size, color) {
    const top = size * 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy + top);
    ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + top);
    ctx.bezierCurveTo(cx - size / 2, cy + (size + top) / 2, cx, cy + (size + top) / 2, cx, cy + size);
    ctx.bezierCurveTo(cx, cy + (size + top) / 2, cx + size / 2, cy + (size + top) / 2, cx + size / 2, cy + top);
    ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + top);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Recuerdo: tarjeta simple con la flor + el corazon sobre un fondo con la
  // paleta del juego (sin la escena completa), mas un textito souvenir.
  const souvenirCanvas = document.getElementById("souvenir-canvas");
  async function generateSouvenir() {
    await imagesReady;
    try {
      await document.fonts.load('40px "Press Start 2P"');
      await document.fonts.load('44px "VT323"');
    } catch (e) { /* opcional */ }

    const ctx = souvenirCanvas.getContext("2d");
    const W = souvenirCanvas.width;
    const H = souvenirCanvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    // fondo simple con la paleta del bosque
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#3a5a2c");
    bg.addColorStop(0.55, "#203a1a");
    bg.addColorStop(1, "#12200e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H * 0.4, H * 0.34);
    glow.addColorStop(0, "rgba(227,165,65,0.35)");
    glow.addColorStop(1, "rgba(227,165,65,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // flor grande + corazon, lado a lado
    if (flowerImg) {
      const fw = W * 0.34;
      const fh = fw * (flowerImg.height / flowerImg.width);
      ctx.drawImage(flowerImg, W * 0.5 - fw * 0.62, H * 0.24, fw, fh);
    }
    drawHeart(ctx, W * 0.66, H * 0.32, W * 0.16, "#e0577a");

    // textito souvenir: nombre + fecha + frase corta
    const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5e9c8";

    ctx.font = '46px "Press Start 2P", monospace';
    ctx.save();
    ctx.shadowColor = "#12200e";
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText("Uma", W / 2, H * 0.62);
    ctx.restore();

    ctx.font = '38px "VT323", monospace';
    ctx.fillStyle = "#e2cd97";
    ctx.fillText(today, W / 2, H * 0.665);

    ctx.font = 'italic 34px "VT323", monospace';
    ctx.fillStyle = "#e3a541";
    ctx.fillText("Con todo mi cariño", W / 2, H * 0.705);

    // marco decorativo simple
    ctx.strokeStyle = "rgba(245,233,200,0.5)";
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    return new Promise((resolve) => {
      souvenirCanvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  /* ---- pestañas: fondo completo vs. recuerdo ---- */
  const wallpapers = {
    scene: { url: null, filename: "pablo-y-uma-fondo.png", label: "Descargar fondo" },
    souvenir: { url: null, filename: "pablo-y-uma-recuerdo.png", label: "Descargar recuerdo" },
  };
  let activeWallpaper = "scene";

  function selectTab(tab) {
    activeWallpaper = tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    wallpaperPreview.src = wallpapers[tab].url || "";
    downloadBtn.textContent = wallpapers[tab].label;
    wallpaperFrame.classList.toggle("landscape", tab === "scene");
    wallpaperFrame.classList.toggle("portrait", tab === "souvenir");
  }
  document.getElementById("tab-scene").addEventListener("click", () => selectTab("scene"));
  document.getElementById("tab-souvenir").addEventListener("click", () => selectTab("souvenir"));

  async function showFinalScreen() {
    const [sceneBlob, souvenirBlob] = await Promise.all([generateWallpaper(), generateSouvenir()]);

    if (wallpapers.scene.url) URL.revokeObjectURL(wallpapers.scene.url);
    if (wallpapers.souvenir.url) URL.revokeObjectURL(wallpapers.souvenir.url);
    wallpapers.scene.url = URL.createObjectURL(sceneBlob);
    wallpapers.souvenir.url = URL.createObjectURL(souvenirBlob);

    selectTab("scene");
  }

  downloadBtn.addEventListener("click", () => {
    const current = wallpapers[activeWallpaper];
    if (!current.url) return;
    const a = document.createElement("a");
    a.href = current.url;
    a.download = current.filename;
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

  /* =========================================================
     12) POST-CREDITOS: la carta, scroll estilo cine
     ========================================================= */

  // Texto completo, un parrafo por elemento (tal cual, sin resumir).
  // Cada tanto se intercala una fila de sprites chicos cerca de los
  // parrafos mas emotivos o de cierre — reciclando el sprite de la flor
  // y los sprites de caminata de Pablo/Uma (crop del frame de "parado").
  const CREDITS_ITEMS = [
    { type: "p", text: `Uma:` },
    { type: "img", kinds: ["uma"] },
    { type: "p", text: `Quería escribirte esto porque sentía que unas flores solas quizás no alcanzaban para decirte todo lo que quería decirte.` },
    { type: "p", text: `Y sí, son flores amarillas. Capaz parece un detalle simple, pero para mí no lo es. Las elegí pensando en vos, en lo que significás para mí y en todas esas cosas que fueron pasando entre nosotros, incluso sin habernos conocido todavía personalmente.` },
    { type: "p", text: `Es raro pensar en cómo alguien puede empezar a formar parte de tu vida sin estar físicamente cerca. Primero son mensajes, después llamadas, videollamadas, conversaciones que se alargan, momentos en los que uno se queda hablando de cualquier cosa y, sin darte cuenta, esa persona empieza a importarte cada vez más.` },
    { type: "p", text: `Y eso me pasó con vos.` },
    { type: "img", kinds: ["heart"] },
    { type: "p", text: `No sé exactamente en qué momento empezaste a ocupar un lugar distinto para mí. No hubo un día puntual en el que dije "bueno, ahora Uma es importante para mí". Creo que simplemente fue pasando.` },
    { type: "p", text: `Fuiste apareciendo en mis días.` },
    { type: "img", kinds: ["flower"] },
    { type: "p", text: `En conversaciones, en llamadas, en videollamadas, en momentos en los que quizás ninguno de los dos tenía demasiado para hacer pero igual terminábamos hablando. En esas pequeñas cosas que quizás parecen normales, pero que con el tiempo terminan significando muchísimo.` },
    { type: "p", text: `Y por eso quería darte estas flores.` },
    { type: "p", text: `Porque aunque todavía no hayamos tenido la posibilidad de vernos personalmente, siento que ya compartimos una parte de nuestras vidas. Te conozco por tu voz, por tu forma de hablar, por tus gestos en una videollamada, por las cosas que me contás, por cómo reaccionás ante determinadas cosas y por todas esas pequeñas partes de vos que fui conociendo de a poco.` },
    { type: "p", text: `Obviamente todavía me falta muchísimo por conocerte.` },
    { type: "p", text: `Y justamente eso también me gusta.` },
    { type: "p", text: `Me gusta pensar que todavía hay un montón de cosas que algún día voy a poder descubrir de vos. Cosas que no entran en una llamada ni en una videollamada. Momentos que todavía no vivimos. Lugares a los que todavía no fuimos. Conversaciones que todavía no tuvimos.` },
    { type: "p", text: `Y no quiero apurar nada.` },
    { type: "p", text: `No quiero que estas flores signifiquen una obligación ni que tengas que responderme algo solamente porque yo te las doy. No quiero que sean una forma de pedirte nada.` },
    { type: "p", text: `Quiero que sean simplemente un regalo.` },
    { type: "img", kinds: ["flower"] },
    { type: "p", text: `Un regalo porque me nació hacerlo.` },
    { type: "p", text: `Porque hay personas a las que uno quiere tener un detalle, y vos sos una de esas personas para mí.` },
    { type: "p", text: `Las flores amarillas tienen algo que me gusta mucho. Son alegres, tienen luz, llaman la atención sin necesitar demasiado. Y no sé por qué, pero cuando pensé en vos sentí que eran las indicadas.` },
    { type: "p", text: `Quizás porque me gusta la alegría que algunas veces me das sin darte cuenta.` },
    { type: "p", text: `Quizás porque hay días en los que hablar con vos simplemente hace que mi día sea un poco diferente.` },
    { type: "p", text: `Y quizás porque quería darte algo que, aunque sea por un momento, te hiciera sentir querida y recordada.` },
    { type: "p", text: `No quiero hacerte una carta perfecta.` },
    { type: "p", text: `Quiero hacerte una carta sincera.` },
    { type: "p", text: `Y la verdad es que me importás.` },
    { type: "p", text: `Me importan nuestras conversaciones. Me importan los momentos que compartimos. Me importa saber cómo estás. Me importa lo que te pasa. Me interesa conocerte, entenderte y seguir descubriendo quién sos.` },
    { type: "p", text: `Y también me gusta que esto no haya empezado de una manera perfecta ni planeada.` },
    { type: "p", text: `Simplemente pasó.` },
    { type: "p", text: `Dos personas que empezaron a hablar y que, con el tiempo, terminaron encontrando algo especial en esas conversaciones.` },
    { type: "p", text: `No sé qué va a pasar con nosotros más adelante.` },
    { type: "p", text: `No quiero inventar un futuro ni hacer promesas que no sé si puedo cumplir.` },
    { type: "p", text: `Pero sí puedo decirte algo que sé ahora:` },
    { type: "p", text: `Me alegra muchísimo haberte conocido.` },
    { type: "img", kinds: ["heart"] },
    { type: "p", text: `Y me alegra que, entre tantas personas que uno puede cruzarse en la vida, hayas aparecido vos.` },
    { type: "p", text: `Ojalá algún día podamos mirar hacia atrás y acordarnos de estas primeras conversaciones, de las llamadas, de las videollamadas y de todas esas cosas que hoy parecen pequeñas.` },
    { type: "p", text: `Y quizás también acordarnos de estas flores amarillas.` },
    { type: "p", text: `Porque para mí no son solamente flores.` },
    { type: "p", text: `Son una forma de decirte:` },
    { type: "p", text: `"Pensé en vos."` },
    { type: "p", text: `"Quería hacerte feliz aunque sea un poquito."` },
    { type: "p", text: `"Me importás."` },
    { type: "p", text: `Y, sobre todo, "me alegra que estés en mi vida".` },
    { type: "img", kinds: ["flower", "heart"] },
    { type: "p", text: `No sé si alguna vez voy a encontrar las palabras exactas para explicar todo lo que significás para mí.` },
    { type: "p", text: `Pero tampoco creo que siempre haga falta explicarlo todo.` },
    { type: "p", text: `A veces alcanza con tener un detalle.` },
    { type: "p", text: `A veces alcanza con decir gracias.` },
    { type: "p", text: `Y a veces alcanza con regalar unas flores amarillas a alguien que uno quiere mucho y dejar que el gesto diga el resto.` },
    { type: "p", text: `Así que estas son para vos, Uma.` },
    { type: "p", text: `Sin condiciones.` },
    { type: "p", text: `Sin expectativas.` },
    { type: "p", text: `Simplemente porque sos vos.` },
    { type: "p", text: `Y porque quería que hoy recibieras algo que te recordara que, desde algún lugar, hay alguien que pensó en vos y quiso regalarte un poquito de alegría.` },
    { type: "p", text: `Pablo.`, className: "signature" },
    { type: "img", kinds: ["pablo"] },
    { type: "p", text: `Espero que te haya gustado y sacado una sonrisa,` },
    { type: "img", kinds: ["flower", "heart"] },
    { type: "p", text: `Gracias por jugar`, className: "credits-end" },
  ];

  function makeCreditsSprite(kind) {
    if (kind === "flower") {
      const img = document.createElement("img");
      img.src = "assets/images/girasolpixel.png";
      img.alt = "";
      return img;
    }
    if (kind === "heart") {
      const div = document.createElement("div");
      div.className = "credits-heart";
      return div;
    }
    const div = document.createElement("div");
    div.className = "credits-portrait";
    div.style.backgroundImage = `url('assets/images/${kind}-walk.png')`;
    div.style.backgroundSize = "132px 176px"; // 44*3, 44*4
    div.style.backgroundPosition = "-44px 0px"; // columna del medio (parado), fila "abajo"
    return div;
  }

  function buildCreditsDOM() {
    creditsContent.innerHTML = "";
    const frag = document.createDocumentFragment();
    CREDITS_ITEMS.forEach((item) => {
      if (item.type === "p") {
        const p = document.createElement("p");
        if (item.className) p.className = item.className;
        p.textContent = item.text;
        frag.appendChild(p);
      } else {
        const row = document.createElement("div");
        row.className = "credits-sprite-row";
        item.kinds.forEach((kind) => row.appendChild(makeCreditsSprite(kind)));
        frag.appendChild(row);
      }
    });
    creditsContent.appendChild(frag);
  }

  const CREDITS_SPEED = 34; // px/s — pausado, da tiempo a leer
  const credits = { running: false, y: 0, manualDelta: 0, contentH: 0, viewportH: 0, lastTime: 0 };

  function applyCreditsTransform() {
    creditsContent.style.transform = `translate(-50%, ${credits.y}px)`;
  }

  function creditsLoop(now) {
    if (!credits.running) return;
    const dt = Math.max(0, Math.min(0.05, (now - credits.lastTime) / 1000));
    credits.lastTime = now;

    credits.y -= CREDITS_SPEED * dt;
    credits.y += credits.manualDelta;
    credits.manualDelta = 0;

    const minY = -credits.contentH;
    const maxY = credits.viewportH;
    credits.y = clamp(credits.y, minY - 60, maxY);
    applyCreditsTransform();

    if (credits.y <= minY) {
      endCredits();
      return;
    }
    requestAnimationFrame(creditsLoop);
  }

  function enterCredits() {
    const fromTrack = activeTrack();
    audioState.inCredits = true;
    crossfadeAudio(fromTrack, musicCredits, { duration: 1200, pauseFrom: false });

    buildCreditsDOM();
    requestAnimationFrame(() => {
      credits.contentH = creditsContent.getBoundingClientRect().height;
      credits.viewportH = creditsViewport.getBoundingClientRect().height;
      credits.y = credits.viewportH;
      applyCreditsTransform();
      credits.running = true;
      credits.lastTime = performance.now();
      requestAnimationFrame(creditsLoop);
    });
  }

  function exitCredits() {
    if (!audioState.inCredits) return;
    credits.running = false;
    audioState.inCredits = false;
    crossfadeAudio(musicCredits, activeTrack(), { duration: 1200, pauseFrom: true });
  }

  function endCredits() {
    exitCredits();
    fadeTransition(() => showScreenImmediate(screens.final));
  }

  // scroll manual: rueda del mouse o arrastre tactil, se suma al auto-scroll
  creditsViewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    credits.manualDelta -= e.deltaY * 0.6;
  }, { passive: false });

  let creditsTouchY = null;
  creditsViewport.addEventListener("touchstart", (e) => { creditsTouchY = e.touches[0].clientY; }, { passive: true });
  creditsViewport.addEventListener("touchmove", (e) => {
    if (creditsTouchY === null) return;
    const y = e.touches[0].clientY;
    credits.manualDelta += y - creditsTouchY;
    creditsTouchY = y;
  }, { passive: true });
  creditsViewport.addEventListener("touchend", () => { creditsTouchY = null; });
})();
