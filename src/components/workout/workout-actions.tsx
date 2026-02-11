"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type WorkoutActionsProps = {
  workoutId: number;
  status: string;
};

type WorkoutActionResponse = {
  success: boolean;
  message: string;
  workoutId?: number;
  status?: string;
  garminWorkoutId?: number;
};

export function WorkoutActions({ workoutId, status }: WorkoutActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const normalizedStatus = status.toLowerCase();

  async function submitAction(action: "accept" | "reject") {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/workout/${workoutId}/${action}`, {
        method: "POST",
      });

      const payload = (await response.json()) as WorkoutActionResponse;
      if (!response.ok || !payload.success) {
        setErrorMessage(payload.message || `Workout ${action} failed.`);
        return;
      }

      setStatusMessage(payload.message || `Workout ${action}ed.`);
      router.refresh();
    } catch {
      setErrorMessage(`Workout ${action} failed. Please retry.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (normalizedStatus !== "generated") {
    return (
      <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        This workout is already {status}. Accept and reject actions are only available for
        generated workouts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => submitAction("accept")} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Accept & Upload to Garmin"}
        </Button>
        <Button
          variant="outline"
          onClick={() => submitAction("reject")}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Reject"}
        </Button>
      </div>

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
    </div>
  );
}
