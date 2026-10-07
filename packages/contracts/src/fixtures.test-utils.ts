// Shared valid examples for the contract tests.
export const ID = {
  bed: '01J9ZQ3W8D6V2K5M7N8P9R0S1T',
  planting: '01J9ZQ3W8D6V2K5M7N8P9R0S1V',
  tomato: '01J9ZQ3W8D6V2K5M7N8P9R0S1W',
  basil: '01J9ZQ3W8D6V2K5M7N8P9R0S1X',
} as const;

export const bed = {
  id: ID.bed,
  name: 'Hochbeet Süd',
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: ['2026-03-01'],
} as const;

export const singlePlanting = {
  id: ID.planting,
  bedId: ID.bed,
  plantId: ID.tomato,
  kind: 'SINGLE',
  x: 30,
  y: 45,
  startDate: '2026-05-11',
  endDate: '2026-08-31',
  removedDate: null,
} as const;

export const rowPlanting = {
  ...singlePlanting,
  kind: 'ROW',
  orientation: 'V',
  lengthCm: 100,
} as const;

export const tomato = {
  id: ID.tomato,
  name: 'Tomate',
  category: 'GEMUESE',
  family: 'Nachtschattengewächse',
  feeder: 'STARK',
  spacingInRowCm: 60,
  rowSpacingCm: 80,
  lifecycle: { type: 'ANNUAL', cultureWeeks: 20 },
  goodNeighbors: [ID.basil],
  badNeighbors: [],
  color: '#d64541',
  icon: 'tomate',
} as const;
