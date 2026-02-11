"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { GenerateWorkoutApiResponse, WorkoutType } from "@/components/workout/types";

const WORKOUT_TYPE_OPTIONS: Array<{ value: WorkoutType; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "tempo", label: "Tempo" },
  { value: "interval", label: "Interval" },
  { value: "long-run", label: "Long Run" },
  { value: "recovery", label: "Recovery" },
];

function normalizeApiMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("no cookie auth credentials found") ||
    normalized.includes("no auth credentials found")
  ) {
    return "AI provider authentication failed. Set a valid API key in .env.local and retry.";
  }

  return message;
}

export function WorkoutForm() {
  const router = useRouter();

  const [workoutType, setWorkoutType] = useState<WorkoutType>("easy");
  const [distanceKm, setDistanceKm] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setStatusMessage(null);

    let parsedDistance: number | undefined;
    if (distanceKm.trim() !== "") {
      const value = Number(distanceKm);
      if (!Number.isFinite(value) || value <= 0) {
        setErrorMessage("Distance must be a positive number.");
        return;
      }

      parsedDistance = Number(value.toFixed(2));
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/workout/generate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workoutType,
          distanceKm: parsedDistance,
          userPrompt: userPrompt.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as GenerateWorkoutApiResponse;
      if (!response.ok || !payload.success) {
        const message = payload.success
          ? "Workout generation failed."
          : normalizeApiMessage(payload.message || "Workout generation failed.");

        setErrorMessage(
          message,
        );
        return;
      }

      setStatusMessage(`Workout generated (ID: ${payload.workoutId}).`);
      router.refresh();
    } catch {
      setErrorMessage("Workout generation failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Workout</CardTitle>
        <CardDescription>
          Build an AI workout from your latest fitness and health data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="workout-type">Workout Type</Label>
            <Select
              id="workout-type"
              value={workoutType}
              onChange={(event) => setWorkoutType(event.target.value as WorkoutType)}
              disabled={isSubmitting}
            >
              {WORKOUT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="distance-km">Distance (optional, km)</Label>
            <Input
              id="distance-km"
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              placeholder="e.g. 10"
              value={distanceKm}
              onChange={(event) => setDistanceKm(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-prompt">Notes (optional)</Label>
            <Textarea
              id="user-prompt"
              placeholder="e.g. Keep it moderate and include short hill efforts"
              value={userPrompt}
              onChange={(event) => setUserPrompt(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Generate Workout"}
          </Button>

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
        </form>
      </CardContent>
    </Card>
  );
}
