import { beforeEach, describe, expect, it, vi } from "vitest";

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
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void> | void;
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
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a queued delivery confirmation without exposing an unusable fallback link", async () => {
    const setEmail = vi.fn();
    const setRole = vi.fn();
    const setInviteError = vi.fn();
    const setInviteLink = vi.fn();
    const setInviteSuccess = vi.fn();
    const setInviteLoading = vi.fn();
    const setCopyState = vi.fn();
    const preventDefault = vi.fn();
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        invitation: {
          token: "token-123",
        },
        delivery: {
          transport: "job-queued",
          state: "queued",
          jobId: "job-1",
        },
      }),
    } as unknown as Response);

    useStateMock
      .mockReturnValueOnce(["teammate@example.com", setEmail])
      .mockReturnValueOnce(["ADMIN", setRole])
      .mockReturnValueOnce([null, setInviteError])
      .mockReturnValueOnce([null, setInviteLink])
      .mockReturnValueOnce([null, setInviteSuccess])
      .mockReturnValueOnce([false, setInviteLoading])
      .mockReturnValueOnce(["idle", setCopyState]);

    const tree = FirstValueLaunchpad({
      viewerMembershipRole: "OWNER",
    });
    const [form] = collectElements(
      tree,
      (element) => typeof element.type === "string" && element.type === "form"
    );

    expect(form).toBeDefined();

    await form.props.onSubmit?.({ preventDefault });

    expect(fetchMock).toHaveBeenCalledWith("/api/invitations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "teammate@example.com",
        role: "ADMIN",
      }),
    });
    expect(setInviteLink).toHaveBeenCalledWith(null);
    expect(setInviteSuccess).toHaveBeenCalledWith(
      "Invitation queued. The teammate will receive an email shortly."
    );
  });
});
