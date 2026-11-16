// IRONHOLD — Depot 12. The look plan, in one place: a dusk industrial yard.
// Warm amber sun against cold slate, rusted steel, teal Wardens, amber Raiders.
// The same names are the CSS custom properties in index.html.
export const PALETTE = {
  sky: '#1b222e',
  dusk: '#2a2f3a',
  ground: '#3a3a38',
  concrete: '#565652',
  concreteDark: '#3c3c3a',
  steel: '#4a5560',
  steelDark: '#333d47',
  rust: '#8a4a2b',
  rustLight: '#b06a3a',
  crate: '#6b5a33',
  crateDark: '#4d4126',
  hazard: '#d8a020',
  ink: '#e8e4d8',
  muted: '#9aa0a8',
  accent: '#f0a830',
  raider: '#f0a830',
  warden: '#2fb8a6',
  danger: '#e5484d',
  health: '#58c96b',
};

export const TEAM = {
  raiders: { name: 'Raiders', color: PALETTE.raider, spawn: { x: 0, z: 18 } },
  wardens: { name: 'Wardens', color: PALETTE.warden, spawn: { x: 0, z: -18 } },
};

export const WEAPON_NAMES = {
  p9: 'P9 Vulture',
  vk9: 'VK-9 Rattler',
  ar77: 'AR-77 Longshot',
  dmr12: 'DMR-12 Warden',
  spark: 'Spark grenade',
};
