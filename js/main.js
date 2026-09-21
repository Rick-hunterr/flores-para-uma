(() => {
  "use strict";

  const giftScreen = document.getElementById("gift-screen");
  const rotateScreen = document.getElementById("rotate-screen");
  const gameScreen = document.getElementById("game-screen");
  const giftBox = document.getElementById("gift-box");
  const music = document.getElementById("bg-music");
  const muteBtn = document.getElementById("mute-btn");
  const giveBtn = document.getElementById("give-btn");
  const bouquet = document.getElementById("bouquet");
  const pablo = document.getElementById("pablo");
  const uma = document.getElementById("uma");
  const hearts = uma.querySelector(".hearts");
  const message = document.getElementById("message");

  const isTouch = matchMedia("(pointer: coarse)").matches;
  music.volume = 0.35;

  let opened = false;
  let given = false;

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
    } catch (e) { /* not fatal, keep going without fullscreen */ }

    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (e) { /* not supported (iOS Safari, desktop) — the rotate hint covers it */ }
  }

  function startMusic() {
    music.play().catch(() => {
      // Some browsers may still block it; try again on next touch.
      const resume = () => { music.play().catch(() => {}); document.removeEventListener("touchend", resume); };
      document.addEventListener("touchend", resume, { once: true });
    });
  }

  function openGift() {
    if (opened) return;
    opened = true;

    giftBox.classList.add("opening");
    startMusic();
    tryFullscreenAndOrientation();

    setTimeout(() => {
      giftScreen.classList.add("hidden");
      updateOrientationGate();
      if (!isPortraitPhone()) gameScreen.classList.remove("hidden");
    }, 480);
  }

  giftBox.addEventListener("click", openGift);

  window.addEventListener("resize", updateOrientationGate);
  if (screen.orientation) {
    screen.orientation.addEventListener("change", updateOrientationGate);
  }

  muteBtn.addEventListener("click", () => {
    music.muted = !music.muted;
    muteBtn.textContent = music.muted ? "🔇" : "🔊";
  });

  function giveFlowers() {
    if (given) return;
    given = true;

    giveBtn.classList.add("done");
    pablo.classList.add("giving");
    bouquet.classList.add("fly");

    setTimeout(() => {
      uma.classList.add("received");
      hearts.classList.add("pop");
      message.textContent = "Uma sonríe ✨";
      message.classList.remove("hidden");
      message.classList.add("show");
    }, 780);
  }

  giveBtn.addEventListener("click", giveFlowers);

  // Auto-suggest the moment shortly after entering the scene, but the
  // player always triggers the actual gift via the button — no forced timers.
})();
