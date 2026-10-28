import type { Bed, ImportGardenRequest, Planting, SowingBatch } from '@hochbeet/contracts';
import { describe, expect, it, vi } from 'vitest';
import { importGarden, type ImportStore, planGardenImport } from './import';
import type { ImportRecord } from './repository';

const bed = (id: string): Bed => ({
  id,
  name: `Beet ${id.slice(-3)}`,
  widthCm: 200,
  depthCm: 100,
  mainRowDirection: 'V',
  soilRenewals: [],
});
const planting = (id: string, bedId: string): Planting => ({
  id,
  bedId,
  kind: 'SINGLE',
  plantId: '01M49THV00SZ6Q8R32BYJM5P2S',
  x: 20,
  y: 20,
  origin: 'TRANSPLANT',
  startDate: '2026-05-04',
  endDate: null,
  removedDate: null,
});
const sowing = (id: string): SowingBatch => ({
  id,
  plantId: '01M49THV00SZ6Q8R32BYJM5P2S',
  sowDate: '2026-03-09',
  sownCount: 6,
  aliveCount: 6,
  stage: 'SOWN',
});
const BED_A = '01J9ZQ3W8D6V2K5M7N8P9R0BDA';
const BED_B = '01J9ZQ3W8D6V2K5M7N8P9R0BDB';
const request: ImportGardenRequest = {
  importId: '01J9ZQ3W8D6V2K5M7N8P9R0MP1',
  beds: [bed(BED_A), bed(BED_B)],
  plantings: [planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', BED_B)],
  sowings: [],
};
const counter = () => {
  let n = 0;
  return () => `NEW${String(++n).padStart(23, '0')}`;
};

describe('planGardenImport', () => {
  it('gives beds and plantings new ids and maps plantings to the new beds', () => {
    const { beds, plantings } = planGardenImport(request, {}, counter());
    expect(beds.map((b) => b.id)).toEqual([
      'NEW00000000000000000000001',
      'NEW00000000000000000000002',
    ]);
    expect(plantings).toEqual([
      expect.objectContaining({ id: 'NEW00000000000000000000003', bedId: beds[1]?.id }),
    ]);
  });

  it('gives batches new ids and points plantings to them', () => {
    const SOWING = '01J9ZQ3W8D6V2K5M7N8P9R0SW1';
    const withSowings: ImportGardenRequest = {
      ...request,
      sowings: [sowing(SOWING)],
      plantings: [
        { ...planting('01J9ZQ3W8D6V2K5M7N8P9R0PA1', BED_A), sowingId: SOWING },
        // A batch the guest deleted: the id leads nowhere and is dropped.
        { ...planting('01J9ZQ3W8D6V2K5M7N8P9R0PA2', BED_A), sowingId: BED_B },
      ],
    };
    const { sowings, plantings, ids } = planGardenImport(withSowings, {}, counter());
    expect(sowings).toEqual([{ ...sowing(SOWING), id: 'NEW00000000000000000000003' }]);
    expect(plantings[0]?.sowingId).toBe('NEW00000000000000000000003');
    expect(plantings[1]).not.toHaveProperty('sowingId');
    // Bed and batch ids are kept apart even if they were equal.
    expect(ids[BED_B]).toBe('NEW00000000000000000000002');
  });

  it('keeps ids chosen by an earlier attempt', () => {
    const first = planGardenImport(request, {}, counter());
    const again = planGardenImport(request, first.ids, () => 'NEVER');
    expect(again.beds).toEqual(first.beds);
    expect(again.plantings).toEqual(first.plantings);
  });
});

describe('importGarden', () => {
  function memoryStore() {
    const records = new Map<string, ImportRecord>();
    const store = {
      records,
      writes: 0,
      getImport: vi.fn((_user: string, id: string) => Promise.resolve(records.get(id))),
      putImport: vi.fn((_user: string, id: string, record: ImportRecord) => {
        records.set(id, record);
        return Promise.resolve();
      }),
      putImported: vi.fn<ImportStore['putImported']>(() => {
        store.writes += 1;
        return Promise.resolve();
      }),
    };
    return store satisfies ImportStore;
  }

  it('returns the stored response for a repeated import and writes nothing again', async () => {
    const store = memoryStore();
    const first = await importGarden(store, 'user', request, counter());
    const second = await importGarden(store, 'user', request, counter());
    expect(second).toEqual(first);
    expect(store.writes).toBe(1);
  });

  it('finishes an interrupted import with the same ids', async () => {
    const store = memoryStore();
    store.putImported.mockRejectedValueOnce(new Error('timeout'));
    await expect(importGarden(store, 'user', request, counter())).rejects.toThrow('timeout');
    const retried = await importGarden(store, 'user', request, () => 'OTHER');
    expect(retried.bedIds).toEqual({
      [BED_A]: 'NEW00000000000000000000001',
      [BED_B]: 'NEW00000000000000000000002',
    });
  });
});
