"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type HealthReadingClient = {
  readingDate: string;
  sleepScore: number | null;
  totalSleepSeconds: number | null;
  sleepStress: number | null;
  avgOvernightHrv: number | null;
  hrvStatus: string | null;
  hrv7dayAvg: number | null;
  restingHr: number | null;
  restingHr7dayAvg: number | null;
  bodyBatteryStart: number | null;
  bodyBatteryEnd: number | null;
  dataSyncedAt: string;
};

type HealthMetricsResponse = {
  success: boolean;
  message?: string;
  date?: string;
  reading?: HealthReadingClient | null;
};

type HealthMetricsCardProps = {
  initialDate: string;
  initialReading: HealthReadingClient | null;
};

function formatSleepDuration(totalSeconds: number | null): string {
  if (!totalSeconds || totalSeconds <= 0) {
    return "-";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function shiftDateByDays(dateValue: string, offset: number): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
}

export function HealthMetricsCard({
  initialDate,
  initialReading,
}: HealthMetricsCardProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [reading, setReading] = useState<HealthReadingClient | null>(initialReading);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      if (!selectedDate || !isValidDateOnly(selectedDate)) {
        if (!cancelled) {
          setReading(null);
          setIsLoading(false);
          setErrorMessage("Pick a valid date (YYYY-MM-DD) to load health metrics.");
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/health-metrics?date=${encodeURIComponent(selectedDate)}`,
        );
        const payload = (await response.json()) as HealthMetricsResponse;

        if (!response.ok || !payload.success) {
          if (!cancelled) {
            setErrorMessage(payload.message ?? "Unable to load health metrics.");
          }
          return;
        }

        if (!cancelled) {
          setReading(payload.reading ?? null);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Unable to load health metrics.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const syncedAtLabel = useMemo(() => {
    if (!reading?.dataSyncedAt) {
      return "-";
    }

    const parsed = new Date(reading.dataSyncedAt);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleString();
  }, [reading?.dataSyncedAt]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Metrics</CardTitle>
        <CardDescription>Daily sleep, HRV, and resting HR snapshot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate((current) => shiftDateByDays(current, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-44"
            max={new Date().toISOString().slice(0, 10)}
          />

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate((current) => shiftDateByDays(current, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[75%]" />
            <Skeleton className="h-4 w-[65%]" />
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : !reading ? (
          <p className="text-sm text-muted-foreground">No health metrics for this date.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Sleep score</span>
              <span className="font-medium text-foreground">
                {reading.sleepScore ?? "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Total sleep</span>
              <span className="font-medium text-foreground">
                {formatSleepDuration(reading.totalSleepSeconds)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Avg overnight HRV</span>
              <span className="font-medium text-foreground">
                {reading.avgOvernightHrv !== null ? `${reading.avgOvernightHrv} ms` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Resting HR</span>
              <span className="font-medium text-foreground">
                {reading.restingHr !== null ? `${reading.restingHr} bpm` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Body battery</span>
              <span className="font-medium text-foreground">
                {reading.bodyBatteryStart !== null && reading.bodyBatteryEnd !== null
                  ? `${reading.bodyBatteryStart} -> ${reading.bodyBatteryEnd}`
                  : "-"}
              </span>
            </div>
            <div className="pt-2 text-xs text-muted-foreground">
              Synced at: {syncedAtLabel}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
