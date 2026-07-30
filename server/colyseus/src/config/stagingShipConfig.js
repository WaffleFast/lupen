export const STAGING_SHIP_CONFIG = Object.freeze({
  falcon: Object.freeze({ name: "Pioneer Hunter", cargo: 150, hull: 720, shield: 180, armor: 10, attachmentSlots: 2, gunSlots: 2 }),
  bison: Object.freeze({ name: "Pioneer Freighter", cargo: 300, hull: 1300, shield: 135, armor: 18, attachmentSlots: 4, gunSlots: 2 }),
  monolith: Object.freeze({ name: "Pioneer Behemoth", cargo: 220, hull: 2400, shield: 600, armor: 36, attachmentSlots: 5, gunSlots: 6 }),
  lupenOrigin: Object.freeze({ cargo: 150, hull: 1000, shield: 100, armor: 12, attachmentSlots: 3, gunSlots: 2 }),
  lupenHauler: Object.freeze({ cargo: 260, hull: 1300, shield: 90, armor: 18, attachmentSlots: 4, gunSlots: 1 }),
  lupenStriker: Object.freeze({ cargo: 100, hull: 900, shield: 130, armor: 10, attachmentSlots: 3, gunSlots: 3 }),
  hermesCourier: Object.freeze({ cargo: 190, hull: 850, shield: 115, armor: 8, attachmentSlots: 3, gunSlots: 2 }),
  athenaSentinel: Object.freeze({ cargo: 140, hull: 1450, shield: 240, armor: 20, attachmentSlots: 4, gunSlots: 2 }),
  aresVindicator: Object.freeze({ cargo: 90, hull: 1200, shield: 150, armor: 25, attachmentSlots: 3, gunSlots: 4 }),
  hephaestusTrader: Object.freeze({ name: "Champa Carrier", cargo: 360, hull: 1650, shield: 180, armor: 22, attachmentSlots: 6, gunSlots: 2 }),
  poseidonAggressor: Object.freeze({ name: "Silver Instinct", cargo: 120, hull: 1300, shield: 260, armor: 20, attachmentSlots: 4, gunSlots: 5 }),
  zeusExplorer: Object.freeze({ name: "Pioneer Destroyer", cargo: 120, hull: 1450, shield: 300, armor: 24, attachmentSlots: 3, gunSlots: 4 })
});

export const STAGING_SHIP_CARGO = Object.freeze(Object.fromEntries(
  Object.entries(STAGING_SHIP_CONFIG).map(([shipId, ship]) => [shipId, ship.cargo])
));
