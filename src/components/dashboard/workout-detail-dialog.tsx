"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

type WorkoutDialogData = {
  id: number;
  title: string;
  workoutType: string;
  status: string;
  createdAt: string;
  scheduledDate: string | null;
  aiDescription: string | null;
  workoutJson: unknown;
};

type WorkoutDetailDialogProps = {
  workout: WorkoutDialogData;
};

function parseSegments(workoutJson: unknown): Array<Record<string, unknown>> {
  if (typeof workoutJson !== "object" || workoutJson === null || Array.isArray(workoutJson)) {
    return [];
  }

  const candidate = (workoutJson as { workoutSegments?: unknown }).workoutSegments;
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.filter(
    (segment): segment is Record<string, unknown> =>
      typeof segment === "object" && segment !== null && !Array.isArray(segment),
  );
}

export function WorkoutDetailDialog({ workout }: WorkoutDetailDialogProps) {
  const segments = parseSegments(workout.workoutJson);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workout.title}</DialogTitle>
          <DialogDescription>
            {workout.workoutType} · {workout.status}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
              <p className="font-medium text-foreground">{formatDateTime(workout.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled</p>
              <p className="font-medium text-foreground">
                {workout.scheduledDate ? formatDateTime(workout.scheduledDate) : "-"}
              </p>
            </div>
          </div>

          {workout.aiDescription && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                AI Explanation
              </p>
              <p className="rounded-md border border-border bg-muted/30 p-3 text-foreground">
                {workout.aiDescription}
              </p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              Workout Steps
            </p>

            {segments.length > 0 ? (
              <ol className="space-y-2 rounded-md border border-border p-3">
                {segments.map((segment, index) => {
                  const stepType =
                    typeof segment.stepType === "string"
                      ? segment.stepType
                      : typeof segment.type === "string"
                        ? segment.type
                        : "segment";
                  const description =
                    typeof segment.description === "string"
                      ? segment.description
                      : typeof segment.targetDescription === "string"
                        ? segment.targetDescription
                        : null;

                  return (
                    <li key={`${workout.id}-segment-${index}`} className="text-foreground">
                      <span className="mr-2 font-medium">{index + 1}.</span>
                      <span className="font-medium capitalize">{stepType}</span>
                      {description && <span className="text-muted-foreground"> · {description}</span>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground">
                {JSON.stringify(workout.workoutJson, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
