import { beforeEach, describe, expect, it, vi } from "vitest";

const useStateMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: useStateMock,
    useRef: useRefMock,
  };
});

vi.mock("@/components/ui/button", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    Button: (props: React.ComponentProps<"button">) =>
      React.createElement("button", props, props.children),
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

import * as React from "react";

import { WorkspaceOnboardingForm } from "@/components/onboarding/workspace-onboarding-form";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type ReactElementWithProps = React.ReactElement<{
  children?: React.ReactNode;
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void> | void;
  disabled?: boolean;
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

describe("workspace onboarding form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("window", {
      location: {
        assign: vi.fn(),
      },
    });
  });

  it("disables submit while loading or when the workspace name is blank", () => {
    useRefMock.mockReturnValue({ current: false });
    useStateMock
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()]);

    const tree = WorkspaceOnboardingForm({
      userName: "Test User",
    });
    const [button] = collectElements(
      tree,
      (element) => typeof element.props.disabled !== "undefined"
    );

    expect(button?.props.disabled).toBe(true);
  });

  it("prevents duplicate POST requests when submit is triggered twice before completion", async () => {
    const refState = { current: false };
    const setError = vi.fn();
    const setLoading = vi.fn();
    const preventDefault = vi.fn();
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
    } as Response);

    useRefMock.mockReturnValue(refState);
    useStateMock
      .mockReturnValueOnce(["Atlas Procurement", vi.fn()])
      .mockReturnValueOnce([null, setError])
      .mockReturnValueOnce([false, setLoading]);

    const tree = WorkspaceOnboardingForm({
      userName: "Test User",
    });
    const [form] = collectElements(
      tree,
      (element) => typeof element.type === "string" && element.type === "form"
    );

    expect(form).toBeDefined();

    const firstSubmit = form.props.onSubmit?.({ preventDefault });
    const secondSubmit = form.props.onSubmit?.({ preventDefault });

    await Promise.all([firstSubmit, secondSubmit]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/workspace", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Atlas Procurement" }),
    });
    expect(setError).toHaveBeenCalledWith(null);
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(window.location.assign).toHaveBeenCalledWith("/onboarding");
    expect(refState.current).toBe(true);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it("routes workspace conflicts back into onboarding so the guided setup can continue", async () => {
    const refState = { current: false };
    const setError = vi.fn();
    const setLoading = vi.fn();
    const preventDefault = vi.fn();

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue({
        error: "Workspace already exists.",
      }),
    } as unknown as Response);

    useRefMock.mockReturnValue(refState);
    useStateMock
      .mockReturnValueOnce(["Atlas Procurement", vi.fn()])
      .mockReturnValueOnce([null, setError])
      .mockReturnValueOnce([false, setLoading]);

    const tree = WorkspaceOnboardingForm({
      userName: "Test User",
    });
    const [form] = collectElements(
      tree,
      (element) => typeof element.type === "string" && element.type === "form"
    );

    await form.props.onSubmit?.({ preventDefault });

    expect(window.location.assign).toHaveBeenCalledWith("/onboarding");
    expect(setError).toHaveBeenCalledWith(null);
    expect(setLoading).toHaveBeenCalledWith(true);
  });
});
