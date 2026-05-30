/* Pure combat rule helpers.
   These are intentionally DOM-free so future multiplayer/server-authoritative combat
   can reuse the same calculations without pulling in browser UI code. */

(function registerCombatRules(global) {
  "use strict";

  function getArmorReduction(armor) {
    return Math.min(Number(armor || 0), 75) / 100;
  }

  function normalizeTargetCombatLayers(target = {}, fallbackBaseHp = 1) {
    const fallbackMaxHp = Math.max(1, Number(target.maxHp || target.hp || fallbackBaseHp || 1));
    const shieldMax = Number.isFinite(Number(target.shieldMax))
      ? Number(target.shieldMax)
      : Math.max(0, Number(target.shield || 0));
    const shield = Number.isFinite(Number(target.shield))
      ? Number(target.shield)
      : Math.max(0, Number(shieldMax || 0));
    const hullMax = !Number.isFinite(Number(target.hullMax)) || Number(target.hullMax) <= 0
      ? Math.max(1, fallbackMaxHp - Number(shieldMax || 0))
      : Number(target.hullMax);
    const hull = Number.isFinite(Number(target.hull))
      ? Number(target.hull)
      : Math.min(Number(hullMax), Math.max(0, Number(target.hp || hullMax)));
    const armor = Number.isFinite(Number(target.armor)) ? Number(target.armor) : 0;

    return {
      ...target,
      shieldMax,
      shield,
      hullMax,
      hull,
      armor,
      maxHp: Math.max(1, Number(shieldMax || 0) + Number(hullMax || 0)),
      hp: Math.max(0, Number(shield || 0) + Number(hull || 0))
    };
  }

  function syncTargetHpFromLayers(target = {}) {
    const shield = Math.max(0, Math.round(Number(target.shield || 0)));
    const hull = Math.max(0, Math.round(Number(target.hull || 0)));
    const maxHp = Math.max(1, Math.round(Number(target.shieldMax || 0) + Number(target.hullMax || target.maxHp || 1)));

    return {
      ...target,
      shield,
      hull,
      hp: Math.max(0, shield + hull),
      maxHp
    };
  }

  function resolveWeaponDamageToTarget(target = {}, weapon = {}, hitRoll = 0, fallbackBaseHp = 1) {
    const normalizedTarget = normalizeTargetCombatLayers(target, fallbackBaseHp);
    const accuracy = Number(weapon.accuracy || 100);

    if (hitRoll > accuracy) {
      return {
        target: normalizedTarget,
        result: { hit: false, layer: "miss", amount: 0 }
      };
    }

    const damage = weapon.damageLayers || {
      shield: Number(weapon.damage || 0),
      armor: Number(weapon.damage || 0),
      hull: Number(weapon.damage || 0)
    };

    if (normalizedTarget.shield > 0) {
      const shieldDamage = Math.max(1, Math.round(Number(damage.shield || 1)));
      const applied = Math.min(normalizedTarget.shield, shieldDamage);
      return {
        target: syncTargetHpFromLayers({
          ...normalizedTarget,
          shield: normalizedTarget.shield - applied
        }),
        result: { hit: true, layer: "shield", amount: applied }
      };
    }

    const finalHullDamage = Math.max(1, Math.round(Number(damage.hull || 1) * (1 - getArmorReduction(normalizedTarget.armor))));
    const applied = Math.min(normalizedTarget.hull, finalHullDamage);
    return {
      target: syncTargetHpFromLayers({
        ...normalizedTarget,
        hull: normalizedTarget.hull - applied
      }),
      result: { hit: true, layer: "hull", amount: applied }
    };
  }

  function resolveIncomingPlayerDamage(playerState = {}, mitigatedDamage = 0) {
    const previousHull = Number(playerState.hull || 0);
    let hull = previousHull;
    let shield = Number(playerState.shield || 0);
    let remainingDamage = Number(mitigatedDamage || 0);
    let shieldDamage = 0;
    let hullDamage = 0;

    if (shield > 0) {
      shieldDamage = Math.min(shield, remainingDamage);
      shield = Math.max(0, shield - shieldDamage);
      remainingDamage -= shieldDamage;
    }

    if (remainingDamage > 0) {
      const reducedHullDamage = Math.max(1, Math.round(remainingDamage * (1 - getArmorReduction(playerState.armor))));
      hullDamage = Math.min(hull, reducedHullDamage);
      hull = Math.max(0, hull - reducedHullDamage);
    }

    return {
      hull,
      shield,
      shieldDamage,
      hullDamage,
      destroyed: hull <= 0 && previousHull > 0
    };
  }

  function isDestroyed(target = {}) {
    return Number(target.hp || target.hull || 0) <= 0;
  }

  global.LupenCombatRules = Object.freeze({
    getArmorReduction,
    normalizeTargetCombatLayers,
    syncTargetHpFromLayers,
    resolveWeaponDamageToTarget,
    resolveIncomingPlayerDamage,
    isDestroyed
  });
})(window);
