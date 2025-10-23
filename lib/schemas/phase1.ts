// lib/schemas/phase1.ts

import { z } from "zod";

export const MAX_PHASE1_FIELD_CHARS = 100_000;
export const MAX_PHASE1_LAB_ATTACHMENTS = 5;

const nonEmptyTrimmedString = z
  .string()
  .max(MAX_PHASE1_FIELD_CHARS)
  .refine((value) => value.trim().length > 0, {
    message: "Field must contain non-whitespace characters.",
  });

// PDF file data schema (base64 encoded)
export const pdfFileSchema = z.object({
  filename: z.string().min(1).describe("Original PDF filename"),
  data: z.string().min(1).describe("Base64 encoded PDF data"),
  mediaType: z.literal("application/pdf").describe("MIME type"),
});

export const phase1SubmissionSchema = z.object({
  questionnaireText: nonEmptyTrimmedString,
  takehomeText: nonEmptyTrimmedString,
  advisorNotesText: nonEmptyTrimmedString,
  daltonsFinalNotes: nonEmptyTrimmedString,
  labPdfs: z
    .array(pdfFileSchema)
    .max(MAX_PHASE1_LAB_ATTACHMENTS)
    .optional()
    .describe("Previous lab result PDFs (base64 encoded)"),
});

export type Phase1Submission = z.infer<typeof phase1SubmissionSchema>;
export type PdfFile = z.infer<typeof pdfFileSchema>;
