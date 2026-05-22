/* WAV audio asset layer with generated WebAudio fallbacks. */

const LUPEN_AUDIO_ASSETS = {
  jumpArrive: "assets/audio/lupen_jump_hyper_arrive_low_extended.wav",
  planetLand: "assets/audio/lupen_planet_land_low_heavy_extended.wav",
  enemyDestroyed: "assets/audio/lupen_enemy_ship_destroyed_low_explosion.wav",
  shipDestroyed: "assets/audio/lupen_ship_destroyed_low_boom_extended.wav",
  laserLight: "assets/audio/lupen_laser_light_low_plasma_extended.wav",
  laserHeavy: "assets/audio/lupen_laser_heavy_low_cannon_extended.wav",
  shieldHit: "assets/audio/lupen_shield_hit_low_extended.wav",
  hullHit: "assets/audio/lupen_hull_hit_low_metal_extended.wav",
  hitMarker: "assets/audio/lupen_weapon_hit_marker_low_extended.wav",
  rewardClaim: "assets/audio/lupen_reward_claim_low_dark_extended.wav",
  uiConfirm: "assets/audio/lupen_ui_confirm_low_click.wav",
  uiDeny: "assets/audio/lupen_ui_deny_low_click.wav"
};

const lupenAudioLastPlayed = {};
const lupenAudioSingleInstances = {};

function playAudioAsset(name, options = {}) {
  const src = LUPEN_AUDIO_ASSETS[name];
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
    return name.includes("heavy") || damage >= 60 ? "laserHeavy" : "laserLight";
  }

  window.playAudioAsset = playAudioAsset;

  window.playJumpSound = function playJumpSoundAsset() {
    playAudioAsset("jumpArrive", {
      volume: 0.48,
      cooldownMs: 650,
      allowOverlap: false,
      fallback: fallbackJumpSound
    });
  };

  window.playLandingSound = function playLandingSound() {
    playAudioAsset("planetLand", {
      volume: 0.46,
      cooldownMs: 800,
      allowOverlap: false
    });
  };

  window.playPlayerLaserPulse = function playPlayerLaserPulseAsset() {
    playAudioAsset(getCurrentWeaponAudioAsset(), {
      volume: 0.34,
      cooldownMs: 45,
      allowOverlap: true,
      fallback: fallbackPlayerLaserPulse
    });
  };

  window.playEnemyLaserPulse = function playEnemyLaserPulseAsset() {
    playAudioAsset("laserLight", {
      volume: 0.3,
      cooldownMs: 55,
      allowOverlap: true,
      fallback: fallbackEnemyLaserPulse
    });
  };

  window.playWeaponHitMarkerSound = function playWeaponHitMarkerSound() {
    playAudioAsset("hitMarker", {
      volume: 0.23,
      cooldownMs: 55,
      allowOverlap: true
    });
  };

  window.playShieldHitSound = function playShieldHitSound() {
    playAudioAsset("shieldHit", {
      volume: 0.36,
      cooldownMs: 90,
      allowOverlap: true
    });
  };

  window.playHullHitSound = function playHullHitSound() {
    playAudioAsset("hullHit", {
      volume: 0.38,
      cooldownMs: 120,
      allowOverlap: true
    });
  };

  window.playEnemyShipDestroyedSound = function playEnemyShipDestroyedSound() {
    playAudioAsset("enemyDestroyed", {
      volume: 0.5,
      cooldownMs: 420,
      allowOverlap: false
    });
  };

  window.playPlayerShipDestroyedSound = function playPlayerShipDestroyedSound() {
    playAudioAsset("shipDestroyed", {
      volume: 0.62,
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
