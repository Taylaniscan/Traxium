import { describe, expect, it } from "vitest";

import {
  validateSupabasePublicApiKey,
  validateSupabaseSecretApiKey,
} from "@/lib/supabase/api-key";

function createJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${header}.${body}.signature`;
}

describe("Supabase public API key validation", () => {
  it("accepts the current publishable-key format", () => {
    expect(
      validateSupabasePublicApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: "sb_publishable_previewkey_123",
      })
    ).toEqual({
      kind: "publishable",
    });
  });

  it("keeps legacy anon JWTs compatible when their project matches", () => {
    expect(
      validateSupabasePublicApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: createJwt({ role: "anon", ref: "previewproj" }),
      })
    ).toMatchObject({
      kind: "legacy-anon",
      claims: {
        ref: "previewproj",
        role: "anon",
      },
    });
  });

  it("rejects malformed publishable keys and privileged legacy JWTs", () => {
    expect(() =>
      validateSupabasePublicApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: "sb_publishable_invalid$key",
      })
    ).toThrow("not a valid Supabase publishable key");
    expect(() =>
      validateSupabasePublicApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: createJwt({ role: "service_role", ref: "previewproj" }),
      })
    ).toThrow('has role "service_role"');
  });

  it("rejects a legacy anon key from another project", () => {
    expect(() =>
      validateSupabasePublicApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: createJwt({ role: "anon", ref: "differentproj" }),
      })
    ).toThrow("Supabase public key project mismatch");
  });

  it("accepts current secret keys and matching legacy service-role JWTs", () => {
    expect(
      validateSupabaseSecretApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: "sb_secret_previewkey_123",
      })
    ).toEqual({
      kind: "secret",
    });
    expect(
      validateSupabaseSecretApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: createJwt({ role: "service_role", ref: "previewproj" }),
      })
    ).toMatchObject({
      kind: "legacy-service-role",
    });
  });

  it("rejects malformed or mismatched Supabase server keys", () => {
    expect(() =>
      validateSupabaseSecretApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: "sb_secret_invalid$key",
      })
    ).toThrow("not a valid Supabase secret key");
    expect(() =>
      validateSupabaseSecretApiKey({
        expectedUrl: "https://previewproj.supabase.co",
        key: createJwt({ role: "service_role", ref: "differentproj" }),
      })
    ).toThrow("Supabase server key project mismatch");
  });
});
