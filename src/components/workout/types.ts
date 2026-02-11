export type WorkoutType = "easy" | "tempo" | "interval" | "long-run" | "recovery";

export type WorkoutPreviewItem = {
  id: number;
  title: string;
  workoutType: string;
  status: string;
  aiDescription: string | null;
  workoutJson: unknown;
  totalDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  createdAt: string;
};

export type GenerateWorkoutApiSuccess = {
  success: true;
  workoutId: number;
  workout: unknown;
  explanation: string | null;
  status: string;
};

export type GenerateWorkoutApiError = {
  success: false;
  message: string;
};

export type GenerateWorkoutApiResponse =
  | GenerateWorkoutApiSuccess
  | GenerateWorkoutApiError;
