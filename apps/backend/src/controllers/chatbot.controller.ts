/**
 * BuildFlow — Chatbot controller.
 */
import type { Request, Response } from 'express';
import { handleChatMessage, listHistory } from '../services/chatbot.service';
import { ok } from '../utils/response';
import { ApiError } from '../utils/errors';

export async function message(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const { message, projectId } = req.body as { message: string; projectId?: string };
  if (!message?.trim()) throw ApiError.badRequest('Message is required');
  const data = await handleChatMessage(companyId, userId, message.trim(), projectId);
  return ok(res, data);
}

export async function history(req: Request, res: Response) {
  const { companyId, id: userId } = req.user!;
  const projectId = req.query.projectId as string | undefined;
  const data = await listHistory(companyId, userId, projectId);
  return ok(res, data);
}