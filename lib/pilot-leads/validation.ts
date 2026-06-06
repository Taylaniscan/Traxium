import { z } from "zod";

export const pilotLeadSuccessMessage =
  "Thanks - we received your request. Traxium is currently offered through guided paid pilots for qualified manufacturing teams. We'll review your request and follow up if there is a strong fit.";

export const pilotCompanySizeOptions = [
  { value: "1-49", label: "1-49 employees" },
  { value: "50-99", label: "50-99 employees" },
  { value: "100-249", label: "100-249 employees" },
  { value: "250-500", label: "250-500 employees" },
  { value: "501-1000", label: "501-1,000 employees" },
  { value: "1000+", label: "More than 1,000 employees" },
] as const;

export const pilotIndustryOptions = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "industrial_distribution", label: "Industrial distribution" },
  { value: "chemicals_materials", label: "Chemicals and materials" },
  { value: "plastics_packaging", label: "Plastics and packaging" },
  { value: "metal_fabrication", label: "Metal fabrication" },
  { value: "food_beverage", label: "Food and beverage manufacturing" },
  { value: "other_industrial", label: "Other industrial business" },
] as const;

export const pilotTrackingOptions = [
  { value: "excel", label: "Excel or spreadsheets" },
  { value: "email", label: "Email and shared folders" },
  { value: "powerpoint", label: "PowerPoint or review decks" },
  { value: "erp_manual", label: "ERP exports plus manual tracking" },
  { value: "other", label: "Another manual process" },
] as const;

export const pilotTimelineOptions = [
  { value: "0-30_days", label: "Within 30 days" },
  { value: "31-60_days", label: "Within 31-60 days" },
  { value: "61-90_days", label: "Within 61-90 days" },
  { value: "evaluating", label: "Evaluating for later" },
] as const;

const companySizeValues = pilotCompanySizeOptions.map(
  (option) => option.value
) as [
  (typeof pilotCompanySizeOptions)[number]["value"],
  ...(typeof pilotCompanySizeOptions)[number]["value"][],
];
const industryValues = pilotIndustryOptions.map((option) => option.value) as [
  (typeof pilotIndustryOptions)[number]["value"],
  ...(typeof pilotIndustryOptions)[number]["value"][],
];
const trackingValues = pilotTrackingOptions.map((option) => option.value) as [
  (typeof pilotTrackingOptions)[number]["value"],
  ...(typeof pilotTrackingOptions)[number]["value"][],
];
const timelineValues = pilotTimelineOptions.map((option) => option.value) as [
  (typeof pilotTimelineOptions)[number]["value"],
  ...(typeof pilotTimelineOptions)[number]["value"][],
];

function optionalText(maxLength: number, message: string) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(maxLength, message).optional()
  );
}

function optionalEnum<T extends [string, ...string[]]>(
  values: T,
  message: string
) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.enum(values, { errorMap: () => ({ message }) }).optional()
  );
}

export const pilotLeadSubmissionSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100, "Full name must be 100 characters or fewer."),
    workEmail: z
      .string()
      .trim()
      .min(1, "Enter your work email.")
      .max(254, "Work email must be 254 characters or fewer.")
      .email("Enter a valid work email.")
      .transform((value) => value.toLowerCase()),
    companyName: z
      .string()
      .trim()
      .min(2, "Enter your company name.")
      .max(160, "Company name must be 160 characters or fewer."),
    jobTitle: optionalText(
      120,
      "Job title must be 120 characters or fewer."
    ),
    companySize: optionalEnum(
      companySizeValues,
      "Choose a valid company size."
    ),
    industry: optionalEnum(industryValues, "Choose a valid industry."),
    currentTracking: optionalEnum(
      trackingValues,
      "Choose a valid tracking method."
    ),
    savingsPain: optionalText(
      1_000,
      "Savings reporting pain must be 1,000 characters or fewer."
    ),
    hasSavingsTracker: z.boolean().default(false),
    timeline: optionalEnum(timelineValues, "Choose a valid pilot timeline."),
    message: optionalText(
      1_500,
      "Additional context must be 1,500 characters or fewer."
    ),
    websiteUrl: z
      .string()
      .max(200, "Website URL must be 200 characters or fewer.")
      .optional()
      .default(""),
  })
  .strict("Unexpected form field.");

export const pilotLeadHoneypotSchema = z
  .object({
    websiteUrl: z.unknown().optional(),
  })
  .passthrough();

export type PilotLeadSubmission = z.infer<typeof pilotLeadSubmissionSchema>;
