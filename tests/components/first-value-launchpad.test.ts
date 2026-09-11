import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const useStateMock = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: useStateMock,
  };
});

vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    default: (props: React.ComponentProps<"a">) =>
      React.createElement("a", props, props.children),
  };
});

vi.mock("@/components/onboarding/load-sample-data-button", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    LoadSampleDataButton: (props: React.ComponentProps<"button">) =>
      React.createElement("button", props, props.children),
  };
});

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

vi.mock("@/components/ui/select", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Select: (props: React.ComponentProps<"select">) =>
      React.createElement("select", props, props.children),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...values: string[]) => values.filter(Boolean).join(" "),
}));

import * as React from "react";

import { FirstValueLaunchpad } from "@/components/onboarding/first-value-launchpad";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type ReactElementWithProps = React.ReactElement<{
  children?: React.ReactNode;
}>;

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

describe("first value launchpad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows first-value actions without duplicating the invitation form", () => {
    const tree = FirstValueLaunchpad({
      viewerMembershipRole: "OWNER",
    });
    const markup = renderToStaticMarkup(tree);
    const forms = collectElements(
      tree,
      (element) => typeof element.type === "string" && element.type === "form"
    );

    expect(forms).toHaveLength(0);
    expect(markup).toContain("Fastest path to first value");
    expect(markup).toContain("Create first saving card");
    expect(markup).toContain("Load sample data");
    expect(markup).toContain("Invite team members in Admin Members");
    expect(markup).toContain('href="/admin/members"');
    expect(markup).toContain(
      "Use sample data only for demo/training. Use real data when preparing a pilot or customer workspace."
    );
  });
});
