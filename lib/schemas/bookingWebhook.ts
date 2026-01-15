// lib/schemas/bookingWebhook.ts

import { z } from "zod";

/**
 * Schema for YCBM booking webhook payload
 *
 * Fields are optional/defaulted where YCBM might not send them.
 * Core fields (client email, rep email, booking times) are required.
 */
export const bookingWebhookSchema = z.object({
  // Quiz ID from our system (may be empty if user didn't take quiz)
  quizId: z.string().optional().default(""),

  // Booking details from YCBM
  booking: z.object({
    id: z.string().optional(),
    startsAt: z.string(),
    endsAt: z.string(),
    timezone: z.string().optional().default("America/New_York"),
  }),

  // Client info from YCBM booking form
  client: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email("Invalid client email"),
    phone: z.string().optional().default(""),
  }),

  // Assigned rep from YCBM
  rep: z.object({
    name: z.string(),
    email: z.string().email("Invalid rep email"),
  }),

  // Appointment type
  appointmentType: z.string().optional().default("Consultation"),
});

export type BookingWebhookPayload = z.infer<typeof bookingWebhookSchema>;
