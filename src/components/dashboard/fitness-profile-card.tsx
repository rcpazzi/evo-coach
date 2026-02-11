import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatPaceSecondsPerKm } from "@/lib/utils";
import type { FitnessProfile } from "@/components/dashboard/types";

type FitnessProfileCardProps = {
  fitness: FitnessProfile | null;
};

function formatRaceTime(totalSeconds: number | null): string {
  if (!totalSeconds || totalSeconds <= 0) {
    return "-";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function metric(label: string, value: string) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function FitnessProfileCard({ fitness }: FitnessProfileCardProps) {
  if (!fitness) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Running Fitness</CardTitle>
          <CardDescription>
            Sync Garmin data to populate race predictions and training paces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No running fitness data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Running Fitness</CardTitle>
        <CardDescription>
          Last updated {formatDate(fitness.racePredictionsLastUpdate)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Race Predictions
          </p>
          <div className="space-y-1">
            {metric("5K", formatRaceTime(fitness.predicted5kSeconds))}
            {metric("10K", formatRaceTime(fitness.predicted10kSeconds))}
            {metric("Half marathon", formatRaceTime(fitness.predictedHalfSeconds))}
            {metric("Marathon", formatRaceTime(fitness.predictedMarathonSeconds))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Training Paces
          </p>
          <div className="space-y-1">
            {metric(
              "Easy",
              `${formatPaceSecondsPerKm(fitness.easyPaceLow)} - ${formatPaceSecondsPerKm(
                fitness.easyPaceHigh,
              )}`,
            )}
            {metric("Tempo", formatPaceSecondsPerKm(fitness.tempoPace))}
            {metric("Threshold", formatPaceSecondsPerKm(fitness.thresholdPace))}
            {metric("Interval", formatPaceSecondsPerKm(fitness.intervalPace))}
            {metric("Repetition", formatPaceSecondsPerKm(fitness.repetitionPace))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Volume
          </p>
          <div className="space-y-1">
            {metric(
              "4-week avg",
              fitness.weeklyVolumeAvgKm !== null
                ? `${fitness.weeklyVolumeAvgKm.toFixed(2)} km/week`
                : "-",
            )}
            {metric(
              "Longest run",
              fitness.longestRunKm !== null ? `${fitness.longestRunKm.toFixed(2)} km` : "-",
            )}
            {metric(
              "Avg run distance",
              fitness.runningDistanceAvgKm !== null
                ? `${fitness.runningDistanceAvgKm.toFixed(2)} km`
                : "-",
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
