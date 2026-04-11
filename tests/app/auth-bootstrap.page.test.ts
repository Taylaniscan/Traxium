import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PostLoginTransitionMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/components/auth/post-login-transition", () => ({
  PostLoginTransition: PostLoginTransitionMock,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import AuthBootstrapPage from "@/app/auth/bootstrap/page";

describe("auth bootstrap page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes invite continuation through to the transition component", async () => {
    const page = await AuthBootstrapPage({
      searchParams: Promise.resolve({
        next: "/invite/token-123?mode=accept",
      }),
    });

    expect(page).toMatchObject({
      type: PostLoginTransitionMock,
      props: {
        nextPath: "/invite/token-123?mode=accept",
      },
    });
  });

  it("drops invalid continuation targets before rendering the transition component", async () => {
    const page = await AuthBootstrapPage({
      searchParams: Promise.resolve({
        next: "//evil.example.com",
      }),
    });

    expect(page).toMatchObject({
      type: PostLoginTransitionMock,
      props: {
        nextPath: null,
      },
    });
  });
});
