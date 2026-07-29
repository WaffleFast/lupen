export const EREBUS_BOT_TYPES = Object.freeze({
  hunter: Object.freeze({
    botType: "hunter",
    displayName: "Erebus Hunter",
    damagePerHit: 20,
    attackCooldownMs: 2300,
    image: "assets/bots/erebus-hunter.png",
    targetCount: 16,
    shield: 60,
    hull: 60,
    xpReward: 75,
    level: 1,
    threat: "Light Threat",
    visualScale: 0.82
  }),
  attacker: Object.freeze({
    botType: "attacker",
    displayName: "Erebus Attacker",
    damagePerHit: 28,
    attackCooldownMs: 2700,
    image: "assets/bots/erebus-attacker.png",
    targetCount: 10,
    shield: 90,
    hull: 90,
    xpReward: 100,
    level: 2,
    threat: "Medium Threat",
    visualScale: 0.94
  }),
  destroyer: Object.freeze({
    botType: "destroyer",
    displayName: "Erebus Destroyer",
    damagePerHit: 38,
    attackCooldownMs: 3300,
    image: "assets/bots/erebus-destroyer.png",
    targetCount: 4,
    shield: 160,
    hull: 160,
    xpReward: 150,
    level: 3,
    threat: "Heavy Threat",
    visualScale: 1.12
  }),
  behemoth: Object.freeze({
    botType: "behemoth",
    displayName: "Erebus Behemoth",
    damagePerHit: 64,
    attackCooldownMs: 4300,
    image: "assets/bots/erebus-behemoth.png",
    targetCount: 3,
    shield: 300,
    hull: 350,
    xpReward: 250,
    level: 5,
    threat: "Extreme Threat",
    visualScale: 1.32
  })
});

export const EREBUS_BOT_TYPE_ORDER = Object.freeze([
  "hunter",
  "attacker",
  "destroyer",
  "behemoth"
]);

export function getErebusBotTypeConfig(botType = "attacker") {
  return EREBUS_BOT_TYPES[String(botType || "").trim().toLowerCase()] || EREBUS_BOT_TYPES.attacker;
}
