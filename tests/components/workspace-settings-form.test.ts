import { beforeEach, describe, expect, it, vi } from "vitest";

const useEffectMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useStateMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: useEffectMock,
    useRef: useRefMock,
    useState: useStateMock,
  };
});

vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    default: ({
      children,
      href,
      ...props
    }: React.ComponentProps<"a"> & { href: string }) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/ui/button", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Button: (props: React.ComponentProps<"button">) =>
      React.createElement("button", props, props.children),
    buttonVariants: () => "button",
  };
});

vi.mock("@/components/ui/card", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Card: (props: React.ComponentProps<"div">) =>
      React.createElement("div", props, props.children),
    CardContent: (props: React.ComponentProps<"div">) =>
      React.createElement("div", props, props.children),
    CardDescription: (props: React.ComponentProps<"p">) =>
      React.createElement("p", props, props.children),
    CardHeader: (props: React.ComponentProps<"div">) =>
      React.createElement("div", props, props.children),
    CardTitle: (props: React.ComponentProps<"h2">) =>
      React.createElement("h2", props, props.children),
  };
});

vi.mock("@/components/ui/input", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Input: (props: React.ComponentProps<"input">) => React.createElement("input", props),
  };
});

vi.mock("@/components/ui/label", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Label: (props: React.ComponentProps<"label">) =>
      React.createElement("label", props, props.children),
  };
});

vi.mock("@/components/ui/textarea", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Textarea: (props: React.ComponentProps<"textarea">) =>
      React.createElement("textarea", props),
  };
});

vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
  trackClientEvent: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: string[]) => values.filter(Boolean).join(" "),
}));

import * as React from "react";

import { WorkspaceSettingsForm } from "@/components/admin/workspace-settings-form";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type ReactElementWithProps = React.ReactElement<{
  children?: React.ReactNode;
  href?: string;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void> | void;
}>;

const organization = {
  id: "org-1",
  name: "Atlas Procurement",
  description: "Global procurement savings governance workspace.",
  slug: "atlas-procurement",
  createdAt: new Date("2026-03-20T09:00:00.000Z"),
  updatedAt: new Date("2026-03-26T12:00:00.000Z"),
};

function collectElements(
  node: React.ReactNode,
  predicate: (element: ReactElementWithProps) => boolean,
  acc: ReactElementWithProps[] = []
) {
  if (!React.isValidElement(node)) {
    return acc;
  }

  const element = node as ReactElementWithProps;

  if (predicate(element)) {
    acc.push(element);
  }

  React.Children.forEach(element.props.children, (child) => {
    collectElements(child, predicate, acc);
  });

  return acc;
}

function mockFormState(input: {
  name?: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  notice?: string | null;
  ref?: { current: boolean };
}) {
  useEffectMock.mockImplementation(() => undefined);
  useRefMock.mockReturnValue(input.ref ?? { current: false });
  useStateMock
    .mockReturnValueOnce([input.name ?? organization.name, vi.fn()])
    .mockReturnValueOnce([input.description ?? organization.description ?? "", vi.fn()])
    .mockReturnValueOnce([input.loading ?? false, vi.fn()])
    .mockReturnValueOnce([input.error ?? null, vi.fn()])
    .mockReturnValueOnce([input.notice ?? null, vi.fn()]);
}

describe("workspace settings form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders a return to onboarding wizard link below workspace identity", () => {
    mockFormState({});

    const tree = WorkspaceSettingsForm({ organization });
    const links = collectElements(
      tree,
      (element) => element.props.href === "/onboarding"
    );

    expect(links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          props: expect.objectContaining({
            href: "/onboarding",
            children: "Return to onboarding wizard",
          }),
        }),
      ])
    );
  });

  it("keeps the existing settings form submit behavior", async () => {
    const preventDefault = vi.fn();
    const ref = { current: false };
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        message: "Workspace settings saved.",
        organization: {
          ...organization,
          name: "Atlas Savings",
          description: "Updated pilot scope.",
        },
      }),
    } as unknown as Response);

    mockFormState({
      name: "Atlas Savings",
      description: "Updated pilot scope.",
      ref,
    });

    const tree = WorkspaceSettingsForm({ organization });
    const [form] = collectElements(
      tree,
      (element) => typeof element.type === "string" && element.type === "form"
    );

    await form.props.onSubmit?.({ preventDefault });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Atlas Savings",
        description: "Updated pilot scope.",
      }),
    });
    expect(refreshMock).toHaveBeenCalled();
    expect(ref.current).toBe(false);
  });
});
