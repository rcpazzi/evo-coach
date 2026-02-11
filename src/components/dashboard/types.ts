export type FitnessProfile = {
  predicted5kSeconds: number | null;
  predicted10kSeconds: number | null;
  predictedHalfSeconds: number | null;
  predictedMarathonSeconds: number | null;
  easyPaceLow: number | null;
  easyPaceHigh: number | null;
  tempoPace: number | null;
  thresholdPace: number | null;
  intervalPace: number | null;
  repetitionPace: number | null;
  weeklyVolumeAvgKm: number | null;
  longestRunKm: number | null;
  runningDistanceAvgKm: number | null;
  racePredictionsLastUpdate: Date | null;
};

export type HealthReading = {
  readingDate: Date;
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
  dataSyncedAt: Date;
};

export type ActivityRow = {
  id: number;
  activityDate: Date | null;
  activityName: string | null;
  activityType: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  averagePaceSecondsPerKm: number | null;
  averageHrBpm: number | null;
  maxHrBpm: number | null;
};

export type WorkoutRow = {
  id: number;
  workoutType: string;
  title: string;
  aiDescription: string | null;
  workoutJson: unknown;
  totalDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  status: string;
  scheduledDate: Date | null;
  garminWorkoutId: string | null;
  createdAt: Date;
};
