"use client";

import { useEffect } from "react";

import { identifyUser, initializeAnalytics } from "@/lib/analytics";

type AnalyticsSessionIdentifyProps = {
  userId: string;
  organizationId: string;
  appRole: string;
  membershipRole: string;
};

export function AnalyticsSessionIdentify({
  userId,
  organizationId,
  appRole,
  membershipRole,
}: AnalyticsSessionIdentifyProps) {
  useEffect(() => {
    initializeAnalytics("client");
    void identifyUser({
      runtime: "client",
      userId,
      organizationId,
      traits: {
        appRole,
        membershipRole,
      },
    });
  }, [appRole, membershipRole, organizationId, userId]);

  return null;
}
