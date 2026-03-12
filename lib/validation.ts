import { z } from "zod";
import {
  currencies,
  frequencies,
  implementationComplexities,
  phases,
  qualificationStatuses,
  savingDrivers
} from "@/lib/constants";

const numberField = z.coerce.number().finite();
const masterDataField = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.id && !value.name) {
      ctx.addIssue({
        code: "custom",
        message: "Select an existing item or create a new one."
      });
    }
  });

const optionalMasterDataField = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().optional()
  })
  .default({});

export const savingCardSchema = z
  .object({
    title: z.string().min(3),
    description: z.string().min(10),
    savingType: z.string().min(2),
    phase: z.enum(phases),
    supplier: masterDataField,
    material: masterDataField,
    alternativeSupplier: optionalMasterDataField,
    alternativeMaterial: optionalMasterDataField,
    category: masterDataField,
    plant: masterDataField,
    businessUnit: masterDataField,
    buyer: masterDataField,
    baselinePrice: numberField,
    newPrice: numberField,
    annualVolume: numberField,
    currency: z.enum(currencies),
    fxRate: z.coerce.number().positive(),
    frequency: z.enum(frequencies),
    savingDriver: z.enum(savingDrivers).optional().nullable().or(z.literal("")),
    implementationComplexity: z.enum(implementationComplexities).optional().nullable().or(z.literal("")),
    qualificationStatus: z.enum(qualificationStatuses).optional().nullable().or(z.literal("")),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    impactStartDate: z.coerce.date(),
    impactEndDate: z.coerce.date(),
    cancellationReason: z.string().optional().or(z.literal("")),
    stakeholderIds: z.array(z.string()).default([]),
    evidence: z
      .array(
        z.object({
          id: z.string().optional(),
          fileName: z.string().min(1),
          fileUrl: z.string().min(1),
          fileSize: z.coerce.number().int().positive(),
          fileType: z.string().min(1)
        })
      )
      .default([])
  })
  .superRefine((value, ctx) => {
    if (value.newPrice > value.baselinePrice) {
      ctx.addIssue({
        code: "custom",
        message: "New price must not exceed the baseline price.",
        path: ["newPrice"]
      });
    }

    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be after the start date.",
        path: ["endDate"]
      });
    }

    if (value.impactEndDate < value.impactStartDate) {
      ctx.addIssue({
        code: "custom",
        message: "Impact end date must be after the impact start date.",
        path: ["impactEndDate"]
      });
    }

    if (value.phase === "CANCELLED" && !value.cancellationReason) {
      ctx.addIssue({
        code: "custom",
        message: "Cancellation reason is required when a card is cancelled.",
        path: ["cancellationReason"]
      });
    }
  });

export const approvalSchema = z.object({
  phase: z.enum(phases),
  approved: z.boolean().default(true),
  comment: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email()
});

export const alternativeSupplierSchema = z.object({
  supplier: masterDataField.optional().default({}),
  country: z.string().min(2),
  quotedPrice: numberField,
  currency: z.enum(currencies),
  leadTimeDays: z.coerce.number().int().nonnegative(),
  moq: z.coerce.number().int().nonnegative(),
  paymentTerms: z.string().min(2),
  qualityRating: z.string().min(2),
  riskLevel: z.string().min(2),
  notes: z.string().optional().or(z.literal("")),
  isSelected: z.boolean().default(false)
});

export const alternativeMaterialSchema = z.object({
  material: masterDataField.optional().default({}),
  supplier: masterDataField.optional().default({}),
  specification: z.string().min(2),
  quotedPrice: numberField,
  currency: z.enum(currencies),
  performanceImpact: z.string().min(2),
  qualificationStatus: z.string().min(2),
  riskLevel: z.string().min(2),
  notes: z.string().optional().or(z.literal("")),
  isSelected: z.boolean().default(false)
});
