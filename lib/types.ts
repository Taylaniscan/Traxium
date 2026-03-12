import type { Prisma } from "@prisma/client";

export type SavingCardWithRelations = Prisma.SavingCardGetPayload<{
  include: {
    supplier: true;
    material: true;
    alternativeSupplier: true;
    alternativeMaterial: true;
    category: true;
    plant: true;
    businessUnit: true;
    buyer: true;
    stakeholders: { include: { user: true } };
    evidence: true;
    alternativeSuppliers: { include: { supplier: true } };
    alternativeMaterials: { include: { material: true; supplier: true } };
    approvals: { include: { approver: true } };
    phaseChangeRequests: { include: { requestedBy: true; approvals: { include: { approver: true } } } };
    phaseHistory: { orderBy: { createdAt: "desc" } };
    comments: { include: { author: true } };
  };
}>;

export type MasterDataOption = {
  id?: string;
  name?: string;
};
