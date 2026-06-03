import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeStore = vi.hoisted(() => ({
  hooks: [] as unknown[],
  hookCursor: 0,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  function useState<T>(
    initialState: T | (() => T)
  ): [T, (value: T | ((current: T) => T)) => void] {
    const hookIndex = runtimeStore.hookCursor++;

    if (!(hookIndex in runtimeStore.hooks)) {
      runtimeStore.hooks[hookIndex] =
        typeof initialState === "function"
          ? (initialState as () => T)()
          : initialState;
    }

    const setState = (value: T | ((current: T) => T)) => {
      const current = runtimeStore.hooks[hookIndex] as T;
      runtimeStore.hooks[hookIndex] =
        typeof value === "function" ? (value as (current: T) => T)(current) : value;
    };

    return [runtimeStore.hooks[hookIndex] as T, setState];
  }

  return {
    ...actual,
    useState,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("button", props, children),
  buttonVariants: () => "button-variants",
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("div", props, children),
  CardContent: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("div", props, children),
  CardDescription: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("p", props, children),
  CardHeader: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("div", props, children),
  CardTitle: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("h2", props, children),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("select", props, children),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
}));

import * as React from "react";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import { ImportExportPanel } from "@/components/reports/import-export-panel";

type RuntimeTextNode = string;

type RuntimeElementNode = {
  type: string;
  props: Record<string, unknown>;
  children: RuntimeNode[];
};

type RuntimeNode = RuntimeTextNode | RuntimeElementNode;

function resetRuntimeStore() {
  runtimeStore.hooks.length = 0;
  runtimeStore.hookCursor = 0;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

function resolveRuntimeNode(node: unknown): RuntimeNode[] {
  if (node === null || node === undefined || typeof node === "boolean") {
    return [];
  }

  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap(resolveRuntimeNode);
  }

  if (!React.isValidElement(node)) {
    return [];
  }

  const element = node as React.ReactElement<{
    children?: React.ReactNode;
  }>;

  if (element.type === React.Fragment) {
    return resolveRuntimeNode(element.props.children);
  }

  if (typeof element.type === "string") {
    const { children, ...props } = element.props;

    return [
      {
        type: element.type,
        props,
        children: resolveRuntimeNode(children),
      },
    ];
  }

  if (typeof element.type === "function") {
    return resolveRuntimeNode(
      (element.type as (props: Record<string, unknown>) => unknown)(element.props)
    );
  }

  return [];
}

function collectText(node: RuntimeNode | RuntimeNode[]): string {
  if (Array.isArray(node)) {
    return normalizeText(node.map((child) => collectText(child)).join(" "));
  }

  if (typeof node === "string") {
    return node;
  }

  return normalizeText(node.children.map((child) => collectText(child)).join(" "));
}

function findAllNodes(
  node: RuntimeNode | RuntimeNode[],
  predicate: (current: RuntimeElementNode) => boolean
): RuntimeElementNode[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findAllNodes(child, predicate));
  }

  if (typeof node === "string") {
    return [];
  }

  const matches = predicate(node) ? [node] : [];
  return [...matches, ...node.children.flatMap((child) => findAllNodes(child, predicate))];
}

function createRuntime() {
  let tree: RuntimeNode[] = [];

  function render() {
    runtimeStore.hookCursor = 0;
    tree = resolveRuntimeNode(
      React.createElement(ImportExportPanel, {
        readiness: null,
      })
    );
    return tree;
  }

  function getForms() {
    return findAllNodes(tree, (node) => node.type === "form");
  }

  function getText() {
    return collectText(tree);
  }

  render();

  return {
    getForms,
    getText,
    render,
  };
}

async function submitForm(form: RuntimeElementNode) {
  const action = form.props.action as ((formData: FormData) => Promise<void>) | undefined;

  if (typeof action !== "function") {
    throw new Error("Expected form action.");
  }

  await action(new FormData());
}

describe("import export panel runtime fallbacks", () => {
  beforeEach(() => {
    resetRuntimeStore();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRuntimeStore();
  });

  it("shows an inline error when saving-card import cannot reach the service", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable."));
    const runtime = createRuntime();
    const [savingCardImportForm] = runtime.getForms();

    await submitForm(savingCardImportForm);
    runtime.render();

    expect(runtime.getText()).toContain(
      "Unable to reach the import service. Check your connection and try again."
    );
  });

  it("shows an inline error when master-data import cannot reach the service", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable."));
    const runtime = createRuntime();
    const [, masterDataImportForm] = runtime.getForms();

    await submitForm(masterDataImportForm);
    runtime.render();

    expect(runtime.getText()).toContain(
      "Unable to reach the master-data import service. Check your connection and try again."
    );
  });
});
