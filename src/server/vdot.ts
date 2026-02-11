export type TrainingPaces = {
  easyPaceLow: number;
  easyPaceHigh: number;
  tempoPace: number;
  thresholdPace: number;
  intervalPace: number;
  repetitionPace: number;
};

export function calculateTrainingPaces(predicted10kSeconds: number): TrainingPaces {
  if (!Number.isFinite(predicted10kSeconds) || predicted10kSeconds <= 0) {
    throw new Error("predicted10kSeconds must be a positive number.");
  }

  const base = predicted10kSeconds / 10;

  return {
    easyPaceLow: Math.floor(base * 1.24),
    easyPaceHigh: Math.floor(base * 1.36),
    tempoPace: Math.floor(base * 1.09),
    thresholdPace: Math.floor(base * 1.03),
    intervalPace: Math.floor(base * 0.95),
    repetitionPace: Math.floor(base * 0.89),
  };
}
