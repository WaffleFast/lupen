const WEAPON_FAMILIES = {
  heavyLance: {
    id: "heavyLance",
    name: "Heavy Lance",
    shortDescription: "Slow-firing heavy weapon with strong impact.",
    role: "High damage, slow firing",
    image: "assets/weapons/heavy-lance.png",
    projectileColor: "#ff8a47",
    fireStyle: "heavy",
    fireRate: 0.45,
    range: 850,
    accuracy: 88,
    damage: { shield: 14, armor: 16, hull: 18 }
  },
  ionBlaster: {
    id: "ionBlaster",
    name: "Ion Blaster",
    shortDescription: "Specialised shield-breaking energy weapon.",
    role: "Shield-focused weapon",
    image: "assets/weapons/ion-blaster.png",
    projectileColor: "#40c4ff",
    fireStyle: "ion",
    fireRate: 1.1,
    range: 780,
    accuracy: 93,
    damage: { shield: 18, armor: 7, hull: 6 }
  },
  meltCannon: {
    id: "meltCannon",
    name: "Melt Cannon",
    shortDescription: "Armor-melting weapon for hardened targets.",
    role: "Armor-focused weapon",
    image: "assets/weapons/melt-cannon.png",
    projectileColor: "#77dd77",
    fireStyle: "melt",
    fireRate: 0.75,
    range: 760,
    accuracy: 90,
    damage: { shield: 7, armor: 18, hull: 10 }
  },
  pulseLaser: {
    id: "pulseLaser",
    name: "Pulse Laser",
    shortDescription: "Reliable all-round energy weapon.",
    role: "Balanced starter weapon",
    image: "assets/weapons/pulse-laser.png",
    projectileColor: "#7fd6ff",
    fireStyle: "pulse",
    fireRate: 1.0,
    range: 800,
    accuracy: 92,
    damage: { shield: 10, armor: 10, hull: 10 }
  },
  repeater: {
    id: "repeater",
    name: "Repeater",
    shortDescription: "Rapid-fire weapon for constant pressure.",
    role: "Low damage, fast firing",
    image: "assets/weapons/repeater.png",
    projectileColor: "#ffe066",
    fireStyle: "rapid",
    fireRate: 2.8,
    range: 700,
    accuracy: 95,
    damage: { shield: 5, armor: 4, hull: 5 }
  },
  ripperGun: {
    id: "ripperGun",
    name: "Ripper Gun",
    shortDescription: "Finisher weapon for exposed hull damage.",
    role: "Hull-focused weapon",
    image: "assets/weapons/ripper-gun.png",
    projectileColor: "#ff5a5a",
    fireStyle: "ripper",
    fireRate: 0.8,
    range: 740,
    accuracy: 91,
    damage: { shield: 6, armor: 8, hull: 19 }
  },
  voidRail: {
    id: "voidRail",
    name: "Void Rail",
    shortDescription: "Long-range precision weapon with high hull impact.",
    role: "Sniper / precision weapon",
    image: "assets/weapons/void-rail.png",
    projectileColor: "#caa6ff",
    fireStyle: "sniper",
    fireRate: 0.35,
    range: 1100,
    accuracy: 98,
    damage: { shield: 9, armor: 15, hull: 20 }
  }
};

const LEGACY_WEAPON_FAMILY_ALIASES = {
  heavyPulseLaser: "heavyLance",
  pulseRelay: "pulseLaser",
  targetingArray: "voidRail"
};
