/**
 * BuildFlow - Chat & Notification validators (shared).
 */
import { z } from 'zod';

export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000),
  projectId: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

/** Razorpay payment link request */
export const createPaymentLinkSchema = z.object({
  invoiceId: z.string().uuid(),
});

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;