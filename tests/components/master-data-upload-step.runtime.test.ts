import { beforeEach, describe, expect, it, vi } from "vitest";

const useStateMock = vi.hoisted(() => vi.fn());
const useRefMock = vi.hoisted(() => vi.fn());
const useIdMock = vi.hoisted(() => vi.fn());
const useRouterMock = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: useStateMock,
    useRef: useRefMock,
    useId: useIdMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

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

import * as React from "react";

import { MasterDataUploadStep } from "@/components/onboarding/master-data-upload-step";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type ReactElementWithProps = React.ReactElement<{
  children?: React.ReactNode;
  type?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void;
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

describe("master data upload step runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    useRefMock.mockReturnValue({ current: null });
    useIdMock.mockReturnValue("buyer-upload-input");
  });

  it("uploads buyers through the shared import route and refreshes readiness when rows are created", async () => {
    const refresh = vi.fn();
    const setSelectedFileName = vi.fn();
    const setUploadMessage = vi.fn();
    const setImportResult = vi.fn();
    const setIsUploading = vi.fn();
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        importType: "buyers",
        summary: {
          created: 2,
          skipped: 1,
          failed: 0,
        },
        results: [],
      }),
    } as unknown as Response);

    useRouterMock.mockReturnValue({
      refresh,
    });
    useStateMock
      .mockReturnValueOnce([null, setSelectedFileName])
      .mockReturnValueOnce([null, setUploadMessage])
      .mockReturnValueOnce([null, setImportResult])
      .mockReturnValueOnce([false, setIsUploading]);

    const tree = MasterDataUploadStep({
      stepNumber: 2,
      entityKey: "buyers",
      status: "current",
      count: 0,
      manualHref: "/saving-cards/new",
    });
    const [fileInput] = collectElements(
      tree,
      (element) =>
        typeof element.type === "string" &&
        element.type === "input" &&
        element.props.type === "file"
    );

    expect(fileInput).toBeDefined();

    const file = new File(["name,email"], "buyers.csv", {
      type: "text/csv",
    });
    const currentTarget = { value: "buyers.csv" } as HTMLInputElement;

    await fileInput.props.onChange?.({
      target: { files: [file] },
      currentTarget,
    } as unknown as React.ChangeEvent<HTMLInputElement>);

    expect(fetchMock).toHaveBeenCalledWith("/api/import", {
      method: "POST",
      body: expect.any(FormData),
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = requestOptions.body as FormData;

    expect(body.get("importType")).toBe("buyers");
    expect(body.get("file")).toBe(file);
    expect(setSelectedFileName).toHaveBeenCalledWith("buyers.csv");
    expect(setUploadMessage).toHaveBeenCalledWith(null);
    expect(setUploadMessage).toHaveBeenCalledWith({
      tone: "success",
      text: "2 created, 1 skipped, 0 failed.",
    });
    expect(setImportResult).toHaveBeenCalledWith(null);
    expect(setImportResult).toHaveBeenCalledWith({
      importType: "buyers",
      summary: {
        created: 2,
        skipped: 1,
        failed: 0,
      },
      results: [],
    });
    expect(setIsUploading).toHaveBeenNthCalledWith(1, true);
    expect(setIsUploading).toHaveBeenLastCalledWith(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(currentTarget.value).toBe("");
  });
});
