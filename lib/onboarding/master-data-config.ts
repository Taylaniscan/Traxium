export const MASTER_DATA_ONBOARDING_ENTITY_KEYS = [
  "buyers",
  "suppliers",
  "materials",
  "categories",
  "plants",
  "businessUnits",
] as const;

export type MasterDataOnboardingEntityKey =
  (typeof MASTER_DATA_ONBOARDING_ENTITY_KEYS)[number];

export const MASTER_DATA_IMPORT_ENTITY_KEYS = [
  "buyers",
  "suppliers",
  "materials",
  "categories",
] as const;

export type MasterDataImportEntityKey =
  (typeof MASTER_DATA_IMPORT_ENTITY_KEYS)[number];

export type MasterDataOnboardingColumnDefinition = {
  key: string;
  label: string;
  description: string;
};

export type MasterDataOnboardingStepConfig = {
  entityKey: MasterDataOnboardingEntityKey;
  singularLabel: string;
  pluralLabel: string;
  title: string;
  description: string;
  helper: string;
  uploadEnabled: boolean;
  acceptedFileTypes: string[];
  fileInputAccept: string;
  templateFileName: string;
  requiredColumns: MasterDataOnboardingColumnDefinition[];
  optionalColumns: MasterDataOnboardingColumnDefinition[];
  exampleRow: Record<string, string>;
  templateHeaders: string[];
};

export const MASTER_DATA_ONBOARDING_STEP_CONFIG: Record<
  MasterDataOnboardingEntityKey,
  MasterDataOnboardingStepConfig
> = {
  buyers: {
    entityKey: "buyers",
    singularLabel: "buyer",
    pluralLabel: "buyers",
    title: "Set up buyers",
    description:
      "Upload buyers first so commercial ownership is ready before the first live saving card is created.",
    helper:
      "Manual fallback stays available from the first saving card form if you only need one or two buyers right now.",
    uploadEnabled: true,
    acceptedFileTypes: ["CSV (.csv)", "Excel workbook (.xlsx)"],
    fileInputAccept:
      ".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    templateFileName: "traxium-buyers-template.csv",
    requiredColumns: [
      {
        key: "name",
        label: "name",
        description: "The buyer name people should recognize in Traxium.",
      },
    ],
    optionalColumns: [
      {
        key: "email",
        label: "email",
        description: "Work email for the buyer, if you want it available from day one.",
      },
      {
        key: "code",
        label: "code",
        description: "Internal buyer code, if your team already uses one.",
      },
      {
        key: "department",
        label: "department",
        description: "Department or team the buyer belongs to.",
      },
    ],
    exampleRow: {
      name: "Taylor Buyer",
      email: "taylor.buyer@company.com",
      code: "BUY-001",
      department: "Procurement",
    },
    templateHeaders: ["name", "email", "code", "department"],
  },
  suppliers: {
    entityKey: "suppliers",
    singularLabel: "supplier",
    pluralLabel: "suppliers",
    title: "Set up suppliers",
    description:
      "Upload suppliers first so baseline and negotiated savings records can be created against real counterparties.",
    helper:
      "If you need to move faster than bulk setup, suppliers can still be created inline while starting the first saving card.",
    uploadEnabled: true,
    acceptedFileTypes: ["CSV (.csv)", "Excel workbook (.xlsx)"],
    fileInputAccept:
      ".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    templateFileName: "traxium-suppliers-template.csv",
    requiredColumns: [
      {
        key: "name",
        label: "name",
        description: "Supplier name as it should appear across Traxium.",
      },
    ],
    optionalColumns: [
      {
        key: "code",
        label: "code",
        description: "Internal supplier code, if your business uses one.",
      },
      {
        key: "country",
        label: "country",
        description: "Country where the supplier is based or managed from.",
      },
      {
        key: "contactEmail",
        label: "contactEmail",
        description: "Main supplier contact email, if you want to keep it with the record.",
      },
    ],
    exampleRow: {
      name: "Atlas Chemicals",
      code: "SUP-100",
      country: "Netherlands",
      contactEmail: "sales@atlaschemicals.com",
    },
    templateHeaders: ["name", "code", "country", "contactEmail"],
  },
  materials: {
    entityKey: "materials",
    singularLabel: "material",
    pluralLabel: "materials",
    title: "Set up materials",
    description:
      "Upload materials first so sourcing scope, volume assumptions, and savings calculations can reference the right items.",
    helper:
      "Manual inline creation remains available from the first saving card when you only need a single material to get started.",
    uploadEnabled: true,
    acceptedFileTypes: ["CSV (.csv)", "Excel workbook (.xlsx)"],
    fileInputAccept:
      ".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    templateFileName: "traxium-materials-template.csv",
    requiredColumns: [
      {
        key: "name",
        label: "name",
        description: "Material or part name used to anchor the sourcing case.",
      },
    ],
    optionalColumns: [
      {
        key: "code",
        label: "code",
        description: "Internal material code or SKU, if you already track one.",
      },
      {
        key: "description",
        label: "description",
        description: "Short plain-language description to help people recognize the item.",
      },
      {
        key: "unitOfMeasure",
        label: "unitOfMeasure",
        description: "Unit used to track the material, such as kg, pcs, or liters.",
      },
    ],
    exampleRow: {
      name: "PET Resin",
      code: "MAT-100",
      description: "Food-grade PET resin",
      unitOfMeasure: "kg",
    },
    templateHeaders: ["name", "code", "description", "unitOfMeasure"],
  },
  categories: {
    entityKey: "categories",
    singularLabel: "category",
    pluralLabel: "categories",
    title: "Set up categories",
    description:
      "Upload categories first so reporting, accountability, and savings governance are structured from the beginning.",
    helper:
      "If needed, create a category inline from the first saving card as a secondary fallback.",
    uploadEnabled: true,
    acceptedFileTypes: ["CSV (.csv)", "Excel workbook (.xlsx)"],
    fileInputAccept:
      ".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    templateFileName: "traxium-categories-template.csv",
    requiredColumns: [
      {
        key: "name",
        label: "name",
        description: "Category name used for reporting and ownership.",
      },
    ],
    optionalColumns: [
      {
        key: "code",
        label: "code",
        description: "Internal category code, if your team uses one.",
      },
      {
        key: "owner",
        label: "owner",
        description: "Person or team that owns the category.",
      },
    ],
    exampleRow: {
      name: "Packaging",
      code: "CAT-100",
      owner: "Direct Procurement",
    },
    templateHeaders: ["name", "code", "owner"],
  },
  plants: {
    entityKey: "plants",
    singularLabel: "plant",
    pluralLabel: "plants",
    title: "Set up plants",
    description:
      "Add plants when you want savings cards and reports to show which operational locations are affected.",
    helper:
      "Plants improve reporting and accountability, but you can start first value without perfect plant coverage.",
    uploadEnabled: false,
    acceptedFileTypes: ["CSV (.csv)"],
    fileInputAccept: ".csv,text/csv",
    templateFileName: "traxium-plants-template.csv",
    requiredColumns: [
      {
        key: "name",
        label: "name",
        description: "Plant or site name used in saving card reporting.",
      },
      {
        key: "region",
        label: "region",
        description: "Region or country grouping for the plant.",
      },
    ],
    optionalColumns: [
      {
        key: "code",
        label: "code",
        description: "Internal plant code, if your business uses one.",
      },
    ],
    exampleRow: {
      name: "Amsterdam Plant",
      region: "Benelux",
      code: "PLT-AMS",
    },
    templateHeaders: ["name", "region", "code"],
  },
  businessUnits: {
    entityKey: "businessUnits",
    singularLabel: "business unit",
    pluralLabel: "business units",
    title: "Set up business units",
    description:
      "Add business units when teams need savings performance split by division or operating group.",
    helper:
      "Business units are recommended for cleaner portfolio reporting, not required to create the first saving card.",
    uploadEnabled: false,
    acceptedFileTypes: ["CSV (.csv)"],
    fileInputAccept: ".csv,text/csv",
    templateFileName: "traxium-business-units-template.csv",
    requiredColumns: [
      {
        key: "name",
        label: "name",
        description: "Business unit name used in dashboards and reports.",
      },
    ],
    optionalColumns: [
      {
        key: "code",
        label: "code",
        description: "Internal business unit code, if available.",
      },
    ],
    exampleRow: {
      name: "Beverages",
      code: "BU-BEV",
    },
    templateHeaders: ["name", "code"],
  },
};

export function getMasterDataOnboardingStepConfig(
  entityKey: MasterDataOnboardingEntityKey
) {
  return MASTER_DATA_ONBOARDING_STEP_CONFIG[entityKey];
}

export function isMasterDataOnboardingEntityKey(
  value: string
): value is MasterDataOnboardingEntityKey {
  return value in MASTER_DATA_ONBOARDING_STEP_CONFIG;
}

export function isMasterDataImportEntityKey(
  value: string
): value is MasterDataImportEntityKey {
  return (MASTER_DATA_IMPORT_ENTITY_KEYS as readonly string[]).includes(value);
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildMasterDataTemplateCsv(
  entityKey: MasterDataOnboardingEntityKey
) {
  const config = getMasterDataOnboardingStepConfig(entityKey);

  return `${config.templateHeaders.map(escapeCsvValue).join(",")}\n`;
}

export function getMasterDataTemplateDownloadHref(
  entityKey: MasterDataOnboardingEntityKey
) {
  return `/api/onboarding/master-data-template/${entityKey}`;
}
