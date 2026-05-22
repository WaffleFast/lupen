/* WAV audio asset layer with generated WebAudio fallbacks. */

const LUPEN_AUDIO_ASSETS = {
  jumpArrive: "assets/audio/hyper.wav",
  planetLaunch: "assets/audio/burner.wav",
  planetLand: "assets/audio/planet/land.wav",
  enemyDestroyed: "assets/audio/explosion.wav",
  shipDestroyed: "assets/audio/boom.wav",
  laserLight: [
    "assets/audio/gun.wav",
    "assets/audio/guns/MK1 Fury.wav",
    "assets/audio/guns/V1 Blaster.wav"
  ],
  laserHeavy: [
    "assets/audio/guns/Xen Silenus.wav",
    "assets/audio/guns/K14 Cannon.wav",
    "assets/audio/guns/MK1 Sunburst.wav"
  ],
  enemyWeapon: [
    "assets/audio/efire/g0.wav",
    "assets/audio/efire/g1.wav"
  ],
  shieldHit: "assets/audio/shield.wav",
  hullHit: [
    "assets/audio/impacts/i3.wav",
    "assets/audio/impacts/i4.wav"
  ],
  hitMarker: [
    "assets/audio/impacts/i1.wav",
    "assets/audio/impacts/i2.wav",
    "assets/audio/impacts/i5.wav"
  ],
  rewardClaim: "assets/audio/namepress.wav",
  uiConfirm: "assets/audio/namepress.wav",
  uiDeny: "assets/audio/planet/back.wav"
};

const lupenAudioLastPlayed = {};
const lupenAudioSingleInstances = {};

function playAudioAsset(name, options = {}) {
  const entry = LUPEN_AUDIO_ASSETS[name];
  const src = Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;
  const {
    volume = 0.35,
    cooldownMs = 0,
    allowOverlap = true,
    fallback = null
  } = options;

  if (!src || typeof Audio === "undefined") {
    if (typeof fallback === "function") fallback();
    return false;
  }

  const now = Date.now();
  if (cooldownMs > 0 && now - (lupenAudioLastPlayed[name] || 0) < cooldownMs) {
    return true;
  }
  lupenAudioLastPlayed[name] = now;

  let audio;
  if (allowOverlap) {
    audio = new Audio(src);
  } else {
    audio = lupenAudioSingleInstances[name] || new Audio(src);
    lupenAudioSingleInstances[name] = audio;
    audio.pause();
    audio.currentTime = 0;
  }

  audio.volume = Math.max(0, Math.min(1, volume));

  const playback = audio.play();
  if (playback && typeof playback.catch === "function") {
    playback.catch(error => {
      console.warn(`Audio asset failed: ${name}`, error);
      if (typeof fallback === "function") fallback();
    });
  }

  return true;
}

(function installLupenAudioAssets() {
  const fallbackJumpSound = window.playJumpSound;
  const fallbackPlayerLaserPulse = window.playPlayerLaserPulse;
  const fallbackEnemyLaserPulse = window.playEnemyLaserPulse;
  const fallbackShieldRegenSound = window.playShieldRegenSound;

  function getCurrentWeaponAudioAsset() {
    const weapon = typeof getEquippedWeapon === "function" ? getEquippedWeapon() : null;
    const name = String(weapon?.name || "").toLowerCase();
    const damage = Number(weapon?.damage || 0);
    const style = String(weapon?.fireStyle || "").toLowerCase();
    return name.includes("heavy") || style === "heavy" || style === "sniper" || damage >= 16 ? "laserHeavy" : "laserLight";
  }

  window.playAudioAsset = playAudioAsset;

  window.playJumpSound = function playJumpSoundAsset() {
    playAudioAsset("jumpArrive", {
      volume: 0.5,
      cooldownMs: 650,
      allowOverlap: false,
      fallback: fallbackJumpSound
    });
  };

  window.playLandingSound = function playLandingSound() {
    playAudioAsset("planetLand", {
      volume: 0.5,
      cooldownMs: 800,
      allowOverlap: false
    });
  };

  window.playPlanetLaunchSound = function playPlanetLaunchSound() {
    playAudioAsset("planetLaunch", {
      volume: 0.54,
      cooldownMs: 1200,
      allowOverlap: false
    });
  };

  window.playPlayerLaserPulse = function playPlayerLaserPulseAsset() {
    playAudioAsset(getCurrentWeaponAudioAsset(), {
      volume: 0.46,
      cooldownMs: 70,
      allowOverlap: true,
      fallback: fallbackPlayerLaserPulse
    });
  };

  window.playEnemyLaserPulse = function playEnemyLaserPulseAsset() {
    playAudioAsset("enemyWeapon", {
      volume: 0.4,
      cooldownMs: 70,
      allowOverlap: true,
      fallback: fallbackEnemyLaserPulse
    });
  };

  window.playWeaponHitMarkerSound = function playWeaponHitMarkerSound() {
    playAudioAsset("hitMarker", {
      volume: 0.44,
      cooldownMs: 90,
      allowOverlap: true
    });
  };

  window.playShieldHitSound = function playShieldHitSound() {
    playAudioAsset("shieldHit", {
      volume: 0.4,
      cooldownMs: 90,
      allowOverlap: true
    });
  };

  window.playHullHitSound = function playHullHitSound() {
    playAudioAsset("hullHit", {
      volume: 0.42,
      cooldownMs: 120,
      allowOverlap: true
    });
  };

  window.playEnemyShipDestroyedSound = function playEnemyShipDestroyedSound() {
    playAudioAsset("enemyDestroyed", {
      volume: 0.55,
      cooldownMs: 420,
      allowOverlap: false
    });
  };

  window.playPlayerShipDestroyedSound = function playPlayerShipDestroyedSound() {
    playAudioAsset("shipDestroyed", {
      volume: 0.66,
      cooldownMs: 1000,
      allowOverlap: false
    });
  };

  window.playRewardClaimSound = function playRewardClaimSound() {
    playAudioAsset("rewardClaim", {
      volume: 0.44,
      cooldownMs: 500,
      allowOverlap: false
    });
  };

  window.playUiConfirmSound = function playUiConfirmSound() {
    playAudioAsset("uiConfirm", {
      volume: 0.16,
      cooldownMs: 40,
      allowOverlap: true
    });
  };

  window.playUiDenySound = function playUiDenySound() {
    playAudioAsset("uiDeny", {
      volume: 0.17,
      cooldownMs: 120,
      allowOverlap: true
    });
  };

  window.playShieldRegenSound = function playShieldRegenSoundAsset() {
    if (typeof fallbackShieldRegenSound === "function") fallbackShieldRegenSound();
  };

  document.addEventListener("pointerdown", event => {
    const button = event.target?.closest?.("button");
    if (!button) return;

    if (button.disabled || button.getAttribute("aria-disabled") === "true") {
      window.playUiDenySound();
      return;
    }

    window.playUiConfirmSound();
  });
})();
