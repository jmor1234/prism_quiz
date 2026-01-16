// lib/schemas/bookingWebhook.ts

import { z } from "zod";

/**
 * Schema for YCBM booking webhook payload
 *
 * Updated to match YCBM's actual flat structure where client and rep
 * fields are inside the booking object.
 */
export const bookingWebhookSchema = z.object({
  // Quiz ID from our system (may be empty if user didn't take quiz)
  quizId: z.string().optional().default(""),

  // Booking details from YCBM (includes client and rep info in flat structure)
  booking: z.object({
    startsAt: z.string(),
    endsAt: z.string(),
    timezone: z.string().optional().default("US/Central"),

    // Client info (flat, inside booking)
    firstName: z.string(),
    lastName: z.string(),
    bookerEmail: z.string().email("Invalid client email"),
    phone: z.string().optional().default(""),

    // Rep info (flat, inside booking)
    teamName: z.string(),
    teamEmail: z.string().email("Invalid rep email"),
  }),

  // Appointment type (may be outside booking object)
  appointmentType: z.string().optional().default("Consultation"),
});

export type BookingWebhookPayload = z.infer<typeof bookingWebhookSchema>;

/**
 * Normalized structure for internal use
 */
export interface NormalizedBookingData {
  quizId: string;
  booking: {
    startsAt: string;
    endsAt: string;
    timezone: string;
  };
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  rep: {
    name: string;
    email: string;
  };
  appointmentType: string;
}

/**
 * Transform YCBM's flat structure to our normalized internal structure
 */
export function normalizeBookingPayload(payload: BookingWebhookPayload): NormalizedBookingData {
  return {
    quizId: payload.quizId,
    booking: {
      startsAt: payload.booking.startsAt,
      endsAt: payload.booking.endsAt,
      timezone: payload.booking.timezone,
    },
    client: {
      firstName: payload.booking.firstName,
      lastName: payload.booking.lastName,
      email: payload.booking.bookerEmail,
      phone: payload.booking.phone,
    },
    rep: {
      name: payload.booking.teamName,
      email: payload.booking.teamEmail,
    },
    appointmentType: payload.appointmentType,
  };
}
