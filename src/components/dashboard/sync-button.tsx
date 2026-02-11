"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SyncButtonProps = {
  garminConnected: boolean;
};

type SyncResponse = {
  success: boolean;
  message: string;
  activitiesSynced?: number;
  healthDaysSynced?: number;
  fitnessSynced?: boolean;
};

export function SyncButton({ garminConnected }: SyncButtonProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!garminConnected) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button asChild>
          <Link href="/connect-garmin">Connect Garmin to Sync</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Garmin sync is disabled until an account is connected.
        </p>
      </div>
    );
  }

  async function handleSync() {
    setStatusMessage(null);
    setErrorMessage(null);

    setIsSyncing(true);

    try {
      const response = await fetch("/api/garmin/sync", {
        method: "POST",
      });

      const payload = (await response.json()) as SyncResponse;
      if (!response.ok || !payload.success) {
        setErrorMessage(payload.message || "Sync failed.");
        return;
      }

      setStatusMessage(
        `${payload.message} Activities: ${payload.activitiesSynced ?? 0}, Health days: ${payload.healthDaysSynced ?? 0}, Fitness synced: ${payload.fitnessSynced ? "yes" : "no"}.`,
      );

      router.refresh();
    } catch {
      setErrorMessage("Sync failed. Please retry.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={handleSync} disabled={isSyncing || !garminConnected}>
        {isSyncing ? "Syncing..." : "Sync Garmin Data"}
      </Button>

      {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
