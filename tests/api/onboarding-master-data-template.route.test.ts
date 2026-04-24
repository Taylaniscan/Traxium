import { describe, expect, it } from "vitest";

import { GET as getMasterDataTemplateRoute } from "@/app/api/onboarding/master-data-template/[entity]/route";

describe("onboarding master-data template route", () => {
  it("returns a CSV template for a supported onboarding entity", async () => {
    const response = await getMasterDataTemplateRoute(
      new Request("http://localhost/api/onboarding/master-data-template/buyers"),
      {
        params: Promise.resolve({
          entity: "buyers",
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="traxium-buyers-template.csv"'
    );
    await expect(response.text()).resolves.toBe('"name","email","code","department"\n');
  });

  it("returns a CSV template for reporting dimensions used by onboarding", async () => {
    const response = await getMasterDataTemplateRoute(
      new Request("http://localhost/api/onboarding/master-data-template/plants"),
      {
        params: Promise.resolve({
          entity: "plants",
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="traxium-plants-template.csv"'
    );
    await expect(response.text()).resolves.toBe('"name","region","code"\n');
  });

  it("returns 404 for an unsupported template entity", async () => {
    const response = await getMasterDataTemplateRoute(
      new Request("http://localhost/api/onboarding/master-data-template/regions"),
      {
        params: Promise.resolve({
          entity: "regions",
        }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Template not found.",
    });
  });
});
