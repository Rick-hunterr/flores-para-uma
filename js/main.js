(() => {
  "use strict";

  // ---------- elements ----------
  const giftScreen = document.getElementById("gift-screen");
  const rotateScreen = document.getElementById("rotate-screen");
  const gameScreen = document.getElementById("game-screen");
  const giftBox = document.getElementById("gift-box");

  const map = document.getElementById("map");
  const pabloEl = document.getElementById("pablo");
  const umaEl = document.getElementById("uma");
  const pabloSprite = pabloEl.querySelector(".sprite");
  const umaSprite = umaEl.querySelector(".sprite");
  const flowerFx = document.getElementById("flower-fx");
  const hint = document.getElementById("hint");
  const dpad = document.getElementById("dpad");
  const muteBtn = document.getElementById("mute-btn");

  const dialogBox = document.getElementById("dialog-box");
  const dialogText = document.getElementById("dialog-text");
  const dialogArrow = document.getElementById("dialog-arrow");

  const musicMap = document.getElementById("music-map");
  const musicFlowers = document.getElementById("music-flowers");

  const isTouch = matchMedia("(pointer: coarse)").matches;

  const DIALOG_MESSAGE =
    "Uma, te merecés una flor por ser la más bella de todas. Sos una " +
    "chica grandiosa que me cambió la vida: te extraño y pienso en vos " +
    "todos los días. Nunca dejes de sonreír, porque tu sonrisa y tu " +
    "hermosa locura llenan de amor y de vida cada rincón de mi mundo.";

  // ---------- sprite sheet mapping ----------
  // Pablo.png / CharacterMainHet.png: grilla 3 columnas x 4 filas.
  // Orden real de filas verificado visualmente: 0=abajo 1=izquierda 2=arriba 3=derecha
  const ROW = { down: 0, left: 1, up: 2, right: 3 };
  const IDLE_COL = 1;

  function setFrame(spriteEl, size, dir, col) {
    spriteEl.style.backgroundSize = `${size * 3}px ${size * 4}px`;
    spriteEl.style.backgroundPosition = `-${col * size}px -${ROW[dir] * size}px`;
  }

  // ---------- orientation / fullscreen / rotate gate ----------
  let opened = false;

  function isPortraitPhone() {
    return isTouch && window.innerHeight > window.innerWidth;
  }

  function updateOrientationGate() {
    if (!opened) return;
    if (isPortraitPhone()) {
      rotateScreen.classList.remove("hidden");
      gameScreen.classList.add("hidden");
    } else {
      rotateScreen.classList.add("hidden");
      gameScreen.classList.remove("hidden");
    }
  }

  async function tryFullscreenAndOrientation() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) { /* not fatal */ }
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (e) { /* not supported — rotate-screen covers it */ }
  }

  // ---------- audio ----------
  const TRACK1_VOL = 0.32;
  const TRACK2_VOL = 0.4;

  function startMusic() {
    musicMap.volume = TRACK1_VOL;
    musicMap.play().catch(() => {
      const resume = () => { musicMap.play().catch(() => {}); document.removeEventListener("touchend", resume); };
      document.addEventListener("touchend", resume, { once: true });
    });

    // "Desbloquea" el segundo track en iOS reproduciéndolo silenciado
    // dentro del mismo gesto del usuario, para poder arrancarlo después
    // sin necesitar una nueva interacción.
    musicFlowers.volume = 0;
    musicFlowers.play().then(() => {
      musicFlowers.pause();
      musicFlowers.currentTime = 0;
    }).catch(() => {});
  }

  function crossfadeToFlowers(duration = 1300) {
    musicFlowers.currentTime = 0;
    musicFlowers.volume = 0;
    musicFlowers.play().catch(() => {});

    const startVol1 = musicMap.volume;
    const t0 = performance.now();

    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      musicMap.volume = startVol1 * (1 - t);
      musicFlowers.volume = TRACK2_VOL * t;
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        musicMap.pause();
        musicMap.currentTime = 0;
      }
    }
    requestAnimationFrame(step);
  }

  let muted = false;
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    musicMap.muted = muted;
    musicFlowers.muted = muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
  });

  // ---------- gift opening ----------
  function openGift() {
    if (opened) return;
    opened = true;

    giftBox.classList.add("opening");
    startMusic();
    tryFullscreenAndOrientation();

    setTimeout(() => {
      giftScreen.classList.add("hidden");
      updateOrientationGate();
      if (!isPortraitPhone()) {
        gameScreen.classList.remove("hidden");
        startGame();
      }
    }, 480);
  }

  giftBox.addEventListener("click", openGift);

  window.addEventListener("resize", () => {
    updateOrientationGate();
    cacheMapRect();
  });
  if (screen.orientation) screen.orientation.addEventListener("change", updateOrientationGate);

  // ---------- game state ----------
  const state = {
    map: { w: 0, h: 0 },
    frame: 96,
    uma: { x: 0, y: 0, dir: "down", moving: false },
    pablo: { x: 0, y: 0, dir: "down", moving: true, wp: 0 },
    input: { up: false, down: false, left: false, right: false },
    animT: 0,
    animCol: 0,
    animDir: 1,
    triggered: false,
    running: false,
    lastTime: 0,
  };

  // waypoints como fracción del mapa (recorrido rectangular en loop)
  const PABLO_PATH = [
    { x: 0.26, y: 0.74 },
    { x: 0.26, y: 0.26 },
    { x: 0.64, y: 0.26 },
    { x: 0.64, y: 0.74 },
  ];

  function cacheMapRect() {
    const r = map.getBoundingClientRect();
    state.map.w = r.width;
    state.map.h = r.height;
    state.frame = umaEl.getBoundingClientRect().width || state.frame;

    // clamp posiciones existentes dentro del mapa
    clampToMap(state.uma);
    clampToMap(state.pablo);
  }

  function clampToMap(entity) {
    const margin = state.frame * 0.4;
    entity.x = Math.min(state.map.w - margin, Math.max(margin, entity.x));
    entity.y = Math.min(state.map.h - margin, Math.max(margin * 1.2, entity.y));
  }

  function startGame() {
    if (state.running) return;
    cacheMapRect();

    state.uma.x = state.map.w * 0.82;
    state.uma.y = state.map.h * 0.82;
    const p0 = PABLO_PATH[0];
    state.pablo.x = state.map.w * p0.x;
    state.pablo.y = state.map.h * p0.y;
    state.pablo.wp = 0;

    render();
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // ---------- input: D-pad táctil ----------
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

  // soporte de teclado para probar en escritorio
  const KEY_DIR = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  window.addEventListener("keydown", (e) => { if (KEY_DIR[e.key]) state.input[KEY_DIR[e.key]] = true; });
  window.addEventListener("keyup", (e) => { if (KEY_DIR[e.key]) state.input[KEY_DIR[e.key]] = false; });

  // ---------- loop ----------
  function loop(now) {
    if (!state.running) return;
    const dt = Math.max(0, Math.min(0.05, (now - state.lastTime) / 1000));
    state.lastTime = now;

    updateUma(dt);
    updatePablo(dt);
    updateAnim(dt);
    checkProximity();
    render();

    requestAnimationFrame(loop);
  }

  function updateUma(dt) {
    if (state.triggered) { state.uma.moving = false; return; }

    const inp = state.input;
    let dx = 0, dy = 0;
    let dir = state.uma.dir;
    if (inp.left)  { dx -= 1; dir = "left"; }
    else if (inp.right) { dx += 1; dir = "right"; }
    else if (inp.up)    { dy -= 1; dir = "up"; }
    else if (inp.down)  { dy += 1; dir = "down"; }

    const moving = dx !== 0 || dy !== 0;
    state.uma.moving = moving;
    state.uma.dir = dir;

    if (moving) {
      const speed = state.frame * 1.6;
      state.uma.x += dx * speed * dt;
      state.uma.y += dy * speed * dt;
      clampToMap(state.uma);
    }
  }

  function updatePablo(dt) {
    if (state.triggered) { state.pablo.moving = false; return; }

    const target = PABLO_PATH[state.pablo.wp];
    const tx = state.map.w * target.x;
    const ty = state.map.h * target.y;
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

  function render() {
    umaEl.style.left = `${state.uma.x}px`;
    umaEl.style.top = `${state.uma.y}px`;
    pabloEl.style.left = `${state.pablo.x}px`;
    pabloEl.style.top = `${state.pablo.y}px`;

    const umaCol = state.uma.moving ? state.animCol : IDLE_COL;
    const pabloCol = state.pablo.moving ? state.animCol : IDLE_COL;
    setFrame(umaSprite, state.frame, state.uma.dir, umaCol);
    setFrame(pabloSprite, state.frame, state.pablo.dir, pabloCol);
  }

  // ---------- entrega de flores ----------
  function triggerFlowers(dx) {
    state.triggered = true;
    hint.classList.add("hidden");
    dpad.classList.add("hidden");

    // se encaran
    if (dx >= 0) { state.pablo.dir = "right"; state.uma.dir = "left"; }
    else { state.pablo.dir = "left"; state.uma.dir = "right"; }
    setFrame(umaSprite, state.frame, state.uma.dir, IDLE_COL);
    setFrame(pabloSprite, state.frame, state.pablo.dir, IDLE_COL);

    const midX = (state.uma.x + state.pablo.x) / 2;
    const midY = (state.uma.y + state.pablo.y) / 2 - state.frame * 0.55;
    flowerFx.style.left = `${midX}px`;
    flowerFx.style.top = `${midY}px`;
    flowerFx.classList.add("pop");

    crossfadeToFlowers();

    setTimeout(showDialog, 1300);
  }

  // ---------- dialogo con efecto maquina de escribir ----------
  let typing = false;
  let typeTimer = null;

  function showDialog() {
    dialogBox.classList.remove("hidden");
    dialogArrow.classList.add("hidden");
    dialogText.textContent = "";
    typing = true;

    let i = 0;
    function typeChar() {
      if (!typing) return;
      dialogText.textContent = DIALOG_MESSAGE.slice(0, i + 1);
      i++;
      if (i < DIALOG_MESSAGE.length) {
        typeTimer = setTimeout(typeChar, 26);
      } else {
        typing = false;
        dialogArrow.classList.remove("hidden");
      }
    }
    typeChar();
  }

  dialogBox.addEventListener("click", () => {
    if (typing) {
      typing = false;
      clearTimeout(typeTimer);
      dialogText.textContent = DIALOG_MESSAGE;
      dialogArrow.classList.remove("hidden");
    }
  });
})();
