const WEAPON_FAMILIES = {
  pulseLaser: {
    id: "pulseLaser",
    name: "Pulse Laser",
    shortDescription: "Reliable blue pulse laser with steady combat output.",
    role: "Balanced reliable weapon",
    image: "assets/weapons/pulse-laser.png",
    projectileColor: "#4bb7ff",
    fireStyle: "pulse",
    fireRate: 0.8,
    range: 800,
    accuracy: 92,
    damage: { shield: 14, armor: 13, hull: 12 }
  },
  ionBlaster: {
    id: "ionBlaster",
    name: "Ion Blaster",
    shortDescription: "Fast crackling energy weapon that pressures shields.",
    role: "Shield pressure / energy weapon",
    image: "assets/weapons/ion-blaster.png",
    projectileColor: "#bdf4ff",
    fireStyle: "ion",
    fireRate: 1.2,
    range: 780,
    accuracy: 93,
    damage: { shield: 11, armor: 8, hull: 8 }
  },
  heavyLance: {
    id: "heavyLance",
    name: "Heavy Lance",
    shortDescription: "Chunky heavy lance with a decisive amber impact.",
    role: "High damage, heavy hit",
    image: "assets/weapons/heavy-lance.png",
    projectileColor: "#ffbd58",
    fireStyle: "heavy",
    fireRate: 0.5,
    range: 850,
    accuracy: 88,
    damage: { shield: 20, armor: 24, hull: 25 }
  },
  meltCannon: {
    id: "meltCannon",
    name: "Melt Cannon",
    shortDescription: "Hot cannon pulse tuned to melt armor and hull plating.",
    role: "Hull / armor pressure",
    image: "assets/weapons/melt-cannon.png",
    projectileColor: "#ff6248",
    fireStyle: "melt",
    fireRate: 0.56,
    range: 760,
    accuracy: 90,
    damage: { shield: 9, armor: 20, hull: 17 }
  },
  repeater: {
    id: "repeater",
    name: "Repeater",
    shortDescription: "Rapid-fire weapon for constant pressure.",
    role: "Low damage, fast firing",
    image: "assets/weapons/repeater.png",
    projectileColor: "#63e7ff",
    fireStyle: "rapid",
    fireRate: 1.0,
    range: 700,
    accuracy: 95,
    damage: { shield: 7, armor: 6, hull: 7 }
  },
  ripperGun: {
    id: "ripperGun",
    name: "Ripper Gun",
    shortDescription: "Unstable teal arc weapon with erratic utility-style pressure.",
    role: "Unstable utility / status-style weapon",
    image: "assets/weapons/ripper-gun.png",
    projectileColor: "#38f2a6",
    fireStyle: "disruptor",
    fireRate: 0.67,
    range: 740,
    accuracy: 91,
    damage: { shield: 12, armor: 12, hull: 13 }
  },
  voidRail: {
    id: "voidRail",
    name: "Void Rail",
    shortDescription: "Long-range violet rail shot with high precision impact.",
    role: "Sniper / precision weapon",
    image: "assets/weapons/void-rail.png",
    projectileColor: "#b778ff",
    fireStyle: "sniper",
    fireRate: 0.33,
    range: 1100,
    accuracy: 98,
    damage: { shield: 18, armor: 25, hull: 32 }
  }
};

const LEGACY_WEAPON_FAMILY_ALIASES = {
  heavyPulseLaser: "heavyLance",
  pulseRelay: "pulseLaser",
  targetingArray: "voidRail"
};
