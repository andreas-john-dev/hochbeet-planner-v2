import {
  type ApprovePublicationRequest,
  type Plant,
  type PlantFields,
  PlantSchema,
  type PublicationQueueResponse,
} from '@hochbeet/contracts';
import { ulid } from 'ulid';
import { ConflictError, NotFoundError } from '../errors';
import {
  type CatalogStore,
  checkNeighbors,
  fieldsOf,
  GLOBAL_NEIGHBORS_ONLY,
  PLANT_NOT_FOUND,
} from './service';

const NO_REQUEST = 'Für diese Sorte gibt es keine offene Anfrage.';

/** Admin use cases: the publication queue and the maintenance of global plants. */
export class AdminService {
  constructor(
    private readonly store: CatalogStore,
    private readonly newId: () => string = () => ulid(),
  ) {}

  async queue(): Promise<PublicationQueueResponse> {
    const pending = await this.store.listPendingPublications();
    return {
      requests: pending.map(({ userId, plant }) => ({
        plant: PlantSchema.parse(plant),
        requestedBy: userId,
        // The contract uses the date; the index sorts by the full timestamp.
        requestedAt: (plant.requestedAt ?? '').slice(0, 10),
      })),
    };
  }

  /**
   * Publishes a pending own plant, optionally with corrections. The global plant keeps the
   * id, so plantings that reference it keep working without any migration.
   */
  async approve(plantId: string, request: ApprovePublicationRequest): Promise<Plant> {
    const pending = (await this.store.listPendingPublications()).find(
      (p) => p.plant.id === plantId,
    );
    if (!pending) throw new NotFoundError(NO_REQUEST);
    const plant: Plant = { ...fieldsOf(pending.plant), ...request.corrections, id: plantId };
    await this.checkGlobalNeighbors(plant);
    if (!(await this.store.approvePublication(pending.userId, plant))) {
      throw new ConflictError('Die Anfrage wurde bereits bearbeitet.');
    }
    return plant;
  }

  async reject(plantId: string, comment: string): Promise<void> {
    const pending = (await this.store.listPendingPublications()).find(
      (p) => p.plant.id === plantId,
    );
    if (!pending) throw new NotFoundError(NO_REQUEST);
    if (!(await this.store.rejectPublication(pending.userId, plantId, comment))) {
      throw new ConflictError('Die Anfrage wurde bereits bearbeitet.');
    }
  }

  async createGlobalPlant(fields: PlantFields): Promise<Plant> {
    const plant: Plant = { ...fields, id: this.newId() };
    await this.checkGlobalNeighbors(plant);
    await this.store.putGlobalPlant(plant, 'create');
    return plant;
  }

  async updateGlobalPlant(id: string, fields: PlantFields): Promise<Plant> {
    const plant: Plant = { ...fields, id };
    await this.checkGlobalNeighbors(plant);
    if (!(await this.store.putGlobalPlant(plant, 'replace'))) {
      throw new NotFoundError(PLANT_NOT_FOUND);
    }
    return plant;
  }

  private async checkGlobalNeighbors(plant: Plant) {
    const globalIds = new Set((await this.store.listGlobalPlants()).map((p) => p.id));
    checkNeighbors(plant, plant.id, globalIds, GLOBAL_NEIGHBORS_ONLY);
  }
}
