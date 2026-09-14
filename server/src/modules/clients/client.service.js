import { clientRepository } from './client.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { query } from '../../db/pool.js';

/** Empty strings from form inputs are stored as NULL. */
const normalise = (payload) =>
  Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v]));

export const clientService = {
  list: (filters) => clientRepository.list(filters),

  async getById(id) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('ক্লায়েন্ট পাওয়া যায়নি');
    return client;
  },

  async getWithCycles(id) {
    const client = await this.getById(id);
    const cycles = await query(
      'SELECT id, name, month_start, weeks_count, status, monthly_budget FROM cycles WHERE client_id = ? ORDER BY month_start DESC',
      [id],
    );
    return { ...client, cycles };
  },

  async create(payload, userId) {
    const id = await clientRepository.insert({ ...normalise(payload), created_by: userId });
    return this.getById(id);
  },

  async update(id, payload) {
    await this.getById(id);
    await clientRepository.update(id, normalise(payload));
    return this.getById(id);
  },

  async remove(id) {
    await this.getById(id);
    await clientRepository.remove(id);
  },

  statusCounts: () => clientRepository.statusCounts(),
};
