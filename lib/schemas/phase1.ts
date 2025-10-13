import { z } from "zod";

export const MAX_PHASE1_FIELD_CHARS = 100_000;
export const MAX_PHASE1_IMAGE_ATTACHMENTS = 8;
export const MAX_PHASE1_LAB_ATTACHMENTS = 5;

const nonEmptyTrimmedString = z
  .string()
  .max(MAX_PHASE1_FIELD_CHARS)
  .refine((value) => value.trim().length > 0, {
    message: "Field must contain non-whitespace characters.",
  });

export const phase1AttachmentIdsSchema = z
  .object({
    images: z.array(z.string().min(1)).max(MAX_PHASE1_IMAGE_ATTACHMENTS).optional(),
    labs: z.array(z.string().min(1)).max(MAX_PHASE1_LAB_ATTACHMENTS).optional(),
  })
  .optional();

export const phase1SubmissionSchema = z.object({
  questionnaireText: nonEmptyTrimmedString,
  takehomeText: nonEmptyTrimmedString,
  advisorNotesText: nonEmptyTrimmedString,
  attachmentIds: phase1AttachmentIdsSchema,
});

export type Phase1Submission = z.infer<typeof phase1SubmissionSchema>;
