export const STAGING_SHIP_CONFIG = Object.freeze({
  falcon: Object.freeze({ name: "Azure Striker", cargo: 150, shield: 180, attachmentSlots: 2, gunSlots: 2 }),
  bison: Object.freeze({ name: "Buu Hauler", cargo: 260, shield: 135, attachmentSlots: 4, gunSlots: 1 }),
  monolith: Object.freeze({ name: "Majin Vindicator", cargo: 150, shield: 360, attachmentSlots: 4, gunSlots: 6 }),
  lupenOrigin: Object.freeze({ cargo: 150, shield: 100, attachmentSlots: 3, gunSlots: 2 }),
  lupenHauler: Object.freeze({ cargo: 260, shield: 90, attachmentSlots: 4, gunSlots: 1 }),
  lupenStriker: Object.freeze({ cargo: 100, shield: 130, attachmentSlots: 3, gunSlots: 3 }),
  hermesCourier: Object.freeze({ cargo: 190, shield: 110, attachmentSlots: 3, gunSlots: 2 }),
  athenaSentinel: Object.freeze({ cargo: 140, shield: 240, attachmentSlots: 4, gunSlots: 2 }),
  aresVindicator: Object.freeze({ cargo: 90, shield: 150, attachmentSlots: 3, gunSlots: 4 }),
  hephaestusTrader: Object.freeze({ name: "Champa Carrier", cargo: 360, shield: 180, attachmentSlots: 6, gunSlots: 2 }),
  poseidonAggressor: Object.freeze({ name: "Silver Instinct", cargo: 120, shield: 260, attachmentSlots: 4, gunSlots: 5 }),
  zeusExplorer: Object.freeze({ name: "Nightshade Hawk", cargo: 150, shield: 150, attachmentSlots: 3, gunSlots: 3 })
});

export const STAGING_SHIP_CARGO = Object.freeze(Object.fromEntries(
  Object.entries(STAGING_SHIP_CONFIG).map(([shipId, ship]) => [shipId, ship.cargo])
));
