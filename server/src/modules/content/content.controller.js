import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created, noContent } from '../../utils/response.js';
import { contentService } from './content.service.js';
import { logActivity } from '../../utils/activity.js';

export const contentController = {
  list: asyncHandler(async (req, res) => {
    const { rows, meta } = await contentService.list(req.validatedQuery);
    ok(res, rows, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await contentService.getById(req.params.id))),
  create: asyncHandler(async (req, res) => {
    const item = await contentService.create(req.body);
    await logActivity({ userId: req.user.id, action: 'create', entityType: 'content', entityId: item.id, ip: req.ip });
    created(res, item);
  }),
  update: asyncHandler(async (req, res) => ok(res, await contentService.update(req.params.id, req.body))),
  remove: asyncHandler(async (req, res) => {
    await contentService.remove(req.params.id);
    noContent(res);
  }),
};
