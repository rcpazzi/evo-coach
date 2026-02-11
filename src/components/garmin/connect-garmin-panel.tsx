"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConnectGarminPanelProps = {
  initialConnected: boolean;
  initialUserEmail: string;
  initialLastSyncAt: string | null;
};

type ApiResponse = {
  success: boolean;
  message: string;
  activitiesSynced?: number;
  healthDaysSynced?: number;
  fitnessSynced?: boolean;
};

function toLocalDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ConnectGarminPanel({
  initialConnected,
  initialUserEmail,
  initialLastSyncAt,
}: ConnectGarminPanelProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [garminEmail, setGarminEmail] = useState(initialUserEmail);
  const [garminPassword, setGarminPassword] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialLastSyncAt);

  const [startDate, setStartDate] = useState(() =>
    toLocalDateInputValue(new Date(Date.now() - 30 * 86400000)),
  );
  const [endDate, setEndDate] = useState(() => toLocalDateInputValue(new Date()));

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const lastSyncLabel = useMemo(() => {
    if (!lastSyncAt) {
      return "Never";
    }

    const parsed = new Date(lastSyncAt);
    if (Number.isNaN(parsed.getTime())) {
      return "Unknown";
    }

    return parsed.toLocaleString();
  }, [lastSyncAt]);

  async function parseResponse(response: Response): Promise<ApiResponse> {
    try {
      return (await response.json()) as ApiResponse;
    } catch {
      return {
        success: false,
        message: "Unexpected response from server.",
      };
    }
  }

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!garminEmail || !garminPassword) {
      setErrorMessage("Garmin email and password are required.");
      return;
    }

    setIsConnecting(true);

    try {
      const response = await fetch("/api/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: garminEmail.trim(), password: garminPassword }),
      });

      const data = await parseResponse(response);
      if (!response.ok || !data.success) {
        setErrorMessage(data.message || "Unable to connect Garmin.");
        return;
      }

      setConnected(true);
      setGarminPassword("");
      setStatusMessage(data.message || "Garmin connected.");
    } catch {
      setErrorMessage("Unable to connect Garmin right now.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/garmin/disconnect", { method: "POST" });
      const data = await parseResponse(response);

      if (!response.ok || !data.success) {
        setErrorMessage(data.message || "Unable to disconnect Garmin.");
        return;
      }

      setConnected(false);
      setLastSyncAt(null);
      setStatusMessage(data.message || "Garmin disconnected.");
    } catch {
      setErrorMessage("Unable to disconnect Garmin right now.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleSync() {
    setErrorMessage(null);
    setStatusMessage(null);

    if (startDate && endDate && startDate > endDate) {
      setErrorMessage("Start date must be before or equal to end date.");
      return;
    }

    setIsSyncing(true);

    try {
      const response = await fetch("/api/garmin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await parseResponse(response);

      if (!response.ok || !data.success) {
        setErrorMessage(data.message || "Garmin sync failed.");
        return;
      }

      setLastSyncAt(new Date().toISOString());
      setStatusMessage(
        `${data.message} Activities: ${data.activitiesSynced ?? 0}, Health days: ${data.healthDaysSynced ?? 0}, Fitness: ${data.fitnessSynced ? "yes" : "no"}.`,
      );
    } catch {
      setErrorMessage("Garmin sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Garmin Connection</CardTitle>
        <CardDescription>
          Connect your Garmin account and trigger on-demand sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <p>
            Status: <span className="font-medium">{connected ? "Connected" : "Disconnected"}</span>
          </p>
          <p className="mt-1">
            Last sync: <span className="font-medium">{lastSyncLabel}</span>
          </p>
        </div>

        {!connected && (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="garmin-email">Garmin Email</Label>
              <Input
                id="garmin-email"
                type="email"
                autoComplete="email"
                value={garminEmail}
                onChange={(event) => setGarminEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garmin-password">Garmin Password</Label>
              <Input
                id="garmin-password"
                type="password"
                autoComplete="current-password"
                value={garminPassword}
                onChange={(event) => setGarminPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Connect Garmin"}
            </Button>
          </form>
        )}

        {connected && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sync-start-date">Start Date</Label>
                <Input
                  id="sync-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-end-date">End Date</Label>
                <Input
                  id="sync-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? "Syncing..." : "Sync Garmin Data"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect Garmin"}
              </Button>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        {statusMessage && (
          <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
            {statusMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
