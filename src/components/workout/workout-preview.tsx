import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { WorkoutStepList } from "@/components/workout/workout-step-list";
import type { WorkoutPreviewItem } from "@/components/workout/types";

type WorkoutPreviewProps = {
  workout: WorkoutPreviewItem | null;
  actions?: React.ReactNode;
};

function badgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = status.toLowerCase();
  if (normalized === "uploaded" || normalized === "accepted") {
    return "default";
  }

  if (normalized === "rejected") {
    return "destructive";
  }

  if (normalized === "generated") {
    return "secondary";
  }

  return "outline";
}

export function WorkoutPreview({ workout, actions }: WorkoutPreviewProps) {
  if (!workout) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workout Preview</CardTitle>
          <CardDescription>
            Generate a workout to see the full Garmin-ready structure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            No workouts yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{workout.title}</CardTitle>
            <CardDescription>
              {workout.workoutType} · Created {formatDateTime(workout.createdAt)}
            </CardDescription>
          </div>
          <Badge variant={badgeVariant(workout.status)}>{workout.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Distance</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {workout.totalDistanceKm !== null ? `${workout.totalDistanceKm} km` : "-"}
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated Duration</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {workout.estimatedDurationMinutes !== null
                ? `${workout.estimatedDurationMinutes} min`
                : "-"}
            </p>
          </div>
        </div>

        {workout.aiDescription && (
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">AI Explanation</p>
            <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-foreground">
              {workout.aiDescription}
            </p>
          </div>
        )}

        {actions && <div>{actions}</div>}

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Workout Steps</p>
          <WorkoutStepList workoutJson={workout.workoutJson} />
        </div>
      </CardContent>
    </Card>
  );
}
