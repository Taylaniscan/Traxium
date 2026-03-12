import { ApprovalStatus, PrismaClient, Currency, Frequency, Phase, Role } from "@prisma/client";
import { calculateSavings } from "../lib/calculations";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.phaseChangeRequestApproval.deleteMany();
  await prisma.phaseChangeRequest.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.phaseHistory.deleteMany();
  await prisma.savingCardComment.deleteMany();
  await prisma.savingCardEvidence.deleteMany();
  await prisma.savingCardAlternativeMaterial.deleteMany();
  await prisma.savingCardAlternativeSupplier.deleteMany();
  await prisma.savingCardStakeholder.deleteMany();
  await prisma.savingCard.deleteMany();
  await prisma.annualTarget.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.businessUnit.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Sophie Laurent",
        email: "sophie@traxium.local",
        role: Role.HEAD_OF_GLOBAL_PROCUREMENT
      }
    }),
    prisma.user.create({
      data: {
        name: "Marco Stein",
        email: "marco@traxium.local",
        role: Role.FINANCIAL_CONTROLLER
      }
    }),
    prisma.user.create({
      data: {
        name: "Jana Ortiz",
        email: "jana@traxium.local",
        role: Role.GLOBAL_CATEGORY_LEADER
      }
    }),
    prisma.user.create({
      data: {
        name: "Luca Voss",
        email: "luca@traxium.local",
        role: Role.TACTICAL_BUYER
      }
    }),
    prisma.user.create({
      data: {
        name: "Elena Novak",
        email: "elena@traxium.local",
        role: Role.PROCUREMENT_ANALYST
      }
    })
  ]);

  const [steelCo, smartParts, logisticFlow] = await Promise.all([
    prisma.supplier.create({ data: { name: "SteelCo Europe" } }),
    prisma.supplier.create({ data: { name: "SmartParts Inc." } }),
    prisma.supplier.create({ data: { name: "LogisticFlow GmbH" } })
  ]);

  const [sheetSteel, pcbAssembly, freightLane] = await Promise.all([
    prisma.material.create({ data: { name: "Sheet Steel" } }),
    prisma.material.create({ data: { name: "PCB Assembly" } }),
    prisma.material.create({ data: { name: "Freight Lane NL-DE" } })
  ]);

  const [metals, electronics, logistics] = await Promise.all([
    prisma.category.create({ data: { name: "Metals", annualTarget: 320000 } }),
    prisma.category.create({ data: { name: "Electronics", annualTarget: 410000 } }),
    prisma.category.create({ data: { name: "Logistics", annualTarget: 250000 } })
  ]);

  const [eindhoven, detroit] = await Promise.all([
    prisma.plant.create({ data: { name: "Eindhoven Plant", region: "EMEA" } }),
    prisma.plant.create({ data: { name: "Detroit Plant", region: "NA" } })
  ]);

  const [mobility, industrial] = await Promise.all([
    prisma.businessUnit.create({ data: { name: "Mobility" } }),
    prisma.businessUnit.create({ data: { name: "Industrial Systems" } })
  ]);

  await prisma.fxRate.createMany({
    data: [
      { currency: Currency.EUR, rateToEUR: 1, validFrom: new Date("2026-01-01") },
      { currency: Currency.USD, rateToEUR: 0.92, validFrom: new Date("2026-01-01") }
    ]
  });

  await prisma.annualTarget.createMany({
    data: [
      { year: 2026, targetValue: 900000 },
      { year: 2026, targetValue: 320000, categoryId: metals.id },
      { year: 2026, targetValue: 410000, categoryId: electronics.id },
      { year: 2026, targetValue: 250000, categoryId: logistics.id }
    ]
  });

  const cards = [
    {
      title: "Sheet steel frame renegotiation",
      description: "Renegotiate annual framework agreement for sheet steel coils across EMEA plants.",
      savingType: "Price renegotiation",
      phase: Phase.VALIDATED,
      supplierId: steelCo.id,
      materialId: sheetSteel.id,
      categoryId: metals.id,
      plantId: eindhoven.id,
      businessUnitId: mobility.id,
      buyerId: users[3].id,
      baselinePrice: 1180,
      newPrice: 1090,
      annualVolume: 2400,
      currency: Currency.EUR,
      fxRate: 1,
      frequency: Frequency.RECURRING,
      savingDriver: "Negotiation",
      implementationComplexity: "Medium",
      qualificationStatus: "Approved",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-12-31"),
      impactStartDate: new Date("2026-02-01"),
      impactEndDate: new Date("2026-12-31"),
      stakeholders: [users[0].id, users[1].id]
    },
    {
      title: "PCB dual-source qualification",
      description: "Shift 40 percent of spend to qualified backup supplier with improved USD pricing.",
      savingType: "Supplier switch",
      phase: Phase.REALISED,
      supplierId: smartParts.id,
      materialId: pcbAssembly.id,
      categoryId: electronics.id,
      plantId: detroit.id,
      businessUnitId: industrial.id,
      buyerId: users[2].id,
      baselinePrice: 48,
      newPrice: 41,
      annualVolume: 180000,
      currency: Currency.USD,
      fxRate: 0.92,
      frequency: Frequency.MULTI_YEAR,
      savingDriver: "Supplier Change",
      implementationComplexity: "High",
      qualificationStatus: "Plant Trial",
      startDate: new Date("2025-11-01"),
      endDate: new Date("2027-10-31"),
      impactStartDate: new Date("2026-01-01"),
      impactEndDate: new Date("2027-10-31"),
      stakeholders: [users[1].id, users[4].id]
    },
    {
      title: "Lane consolidation for DE inbound freight",
      description: "Bundle lower-volume lanes into a consolidated annual tender for Dutch to German freight.",
      savingType: "Logistics optimization",
      phase: Phase.IDEA,
      supplierId: logisticFlow.id,
      materialId: freightLane.id,
      categoryId: logistics.id,
      plantId: eindhoven.id,
      businessUnitId: industrial.id,
      buyerId: users[3].id,
      baselinePrice: 820,
      newPrice: 730,
      annualVolume: 520,
      currency: Currency.EUR,
      fxRate: 1,
      frequency: Frequency.ONE_TIME,
      savingDriver: "Logistics Optimization",
      implementationComplexity: "Low",
      qualificationStatus: "Not Started",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-06-30"),
      impactStartDate: new Date("2026-05-01"),
      impactEndDate: new Date("2026-12-31"),
      stakeholders: [users[0].id]
    },
    {
      title: "Commodity indexing reset",
      description: "Reset alloy surcharge formula to current market index with signed customer confirmation.",
      savingType: "Contract reset",
      phase: Phase.ACHIEVED,
      supplierId: steelCo.id,
      materialId: sheetSteel.id,
      categoryId: metals.id,
      plantId: detroit.id,
      businessUnitId: mobility.id,
      buyerId: users[2].id,
      baselinePrice: 1260,
      newPrice: 1145,
      annualVolume: 1700,
      currency: Currency.EUR,
      fxRate: 1,
      frequency: Frequency.RECURRING,
      savingDriver: "Index Reduction",
      implementationComplexity: "Strategic",
      qualificationStatus: "Approved",
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-12-31"),
      impactStartDate: new Date("2026-01-01"),
      impactEndDate: new Date("2026-12-31"),
      stakeholders: [users[1].id, users[4].id]
    }
  ];

  for (const card of cards) {
    const savings = calculateSavings({
      baselinePrice: card.baselinePrice,
      newPrice: card.newPrice,
      annualVolume: card.annualVolume,
      currency: card.currency,
      fxRate: card.fxRate
    });

    const created = await prisma.savingCard.create({
      data: {
        ...card,
        calculatedSavings: savings.savingsEUR,
        calculatedSavingsUSD: savings.savingsUSD,
        financeLocked: card.phase === Phase.VALIDATED,
        stakeholders: {
          create: card.stakeholders.map((userId) => ({ userId }))
        },
        evidence: {
          create: [
            {
              fileName: `${card.title} quote.pdf`,
              fileUrl: `/demo/${card.title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
              fileSize: 245760,
              fileType: "supplier_quote",
              uploadedById: users[0].id
            }
          ]
        },
        phaseHistory: {
          create: {
            fromPhase: null,
            toPhase: card.phase,
            changedById: users[0].id
          }
        }
      }
    });

    if (card.phase !== Phase.IDEA) {
      await prisma.approval.create({
        data: {
          savingCardId: created.id,
          approverId: users[0].id,
          phase: Phase.IDEA,
          approved: true,
          status: ApprovalStatus.APPROVED,
          comment: "Approved during leadership review."
        }
      });
    }

    if (card.phase === Phase.VALIDATED || card.phase === Phase.REALISED || card.phase === Phase.ACHIEVED) {
      await prisma.approval.createMany({
        data: [
          {
            savingCardId: created.id,
            approverId: users[0].id,
            phase: Phase.VALIDATED,
            approved: true,
            status: ApprovalStatus.APPROVED,
            comment: "Leadership approved."
          },
          {
            savingCardId: created.id,
            approverId: users[1].id,
            phase: Phase.VALIDATED,
            approved: true,
            status: ApprovalStatus.APPROVED,
            comment: "Finance validated."
          }
        ]
      });
    }

    if (card.phase === Phase.REALISED || card.phase === Phase.ACHIEVED) {
      await prisma.approval.create({
        data: {
          savingCardId: created.id,
          approverId: users[1].id,
          phase: Phase.REALISED,
          approved: true,
          status: ApprovalStatus.APPROVED,
          comment: "Savings realised in P&L."
        }
      });
    }

    if (card.phase === Phase.ACHIEVED) {
      await prisma.approval.create({
        data: {
          savingCardId: created.id,
          approverId: users[1].id,
          phase: Phase.ACHIEVED,
          approved: true,
          status: ApprovalStatus.APPROVED,
          comment: "Savings achieved and closed."
        }
      });
    }

    if (created.title === "Sheet steel frame renegotiation") {
      await prisma.savingCardAlternativeSupplier.createMany({
        data: [
          {
            savingCardId: created.id,
            supplierId: steelCo.id,
            country: "Germany",
            quotedPrice: 1090,
            currency: Currency.EUR,
            leadTimeDays: 21,
            moq: 120,
            paymentTerms: "Net 60",
            qualityRating: "A",
            riskLevel: "Low",
            notes: "Current awarded negotiation result.",
            isSelected: true
          },
          {
            savingCardId: created.id,
            supplierNameManual: "Baltic Steel Works",
            country: "Poland",
            quotedPrice: 1115,
            currency: Currency.EUR,
            leadTimeDays: 18,
            moq: 80,
            paymentTerms: "Net 45",
            qualityRating: "B+",
            riskLevel: "Medium",
            notes: "Competitive fallback source.",
            isSelected: false
          }
        ]
      });

      await prisma.savingCardAlternativeMaterial.createMany({
        data: [
          {
            savingCardId: created.id,
            materialId: sheetSteel.id,
            supplierId: steelCo.id,
            specification: "2.0mm galvanized",
            quotedPrice: 1090,
            currency: Currency.EUR,
            performanceImpact: "No change",
            qualificationStatus: "Qualified",
            riskLevel: "Low",
            notes: "Existing approved gauge.",
            isSelected: false
          },
          {
            savingCardId: created.id,
            materialNameManual: "Sheet Steel Lite",
            supplierNameManual: "Baltic Steel Works",
            specification: "1.8mm galvanized",
            quotedPrice: 1045,
            currency: Currency.EUR,
            performanceImpact: "Minor weight reduction",
            qualificationStatus: "Pilot approved",
            riskLevel: "Medium",
            notes: "Promising substitution candidate.",
            isSelected: false
          }
        ]
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
