import type { Prisma } from "../../prisma/generated/prisma/client";

type JsonObject = Record<string, unknown>;

type DailyHealthInput = {
  sleep?: unknown;
  hrv?: unknown;
  restingHeartRate?: unknown;
  date: string;
};

const ACTIVITY_FIELD_MAP: Record<string, keyof Prisma.ActivityUncheckedCreateInput> = {
  activityId: "garminActivityId",
  startTimeLocal: "activityDate",
  activityName: "activityName",
  distance: "distanceMeters",
  duration: "durationSeconds",
  averageHR: "averageHrBpm",
  maxHR: "maxHrBpm",
  hrTimeInZone_1: "hrTimeInZone1",
  hrTimeInZone_2: "hrTimeInZone2",
  hrTimeInZone_3: "hrTimeInZone3",
  hrTimeInZone_4: "hrTimeInZone4",
  hrTimeInZone_5: "hrTimeInZone5",
  aerobicTrainingEffect: "aerobicTrainingEffect",
  anaerobicTrainingEffect: "anaerobicTrainingEffect",
  trainingEffectLabel: "trainingEffectLabel",
  elevationGain: "elevationGain",
  elevationLoss: "elevationLoss",
  locationName: "locationName",
};

const RACE_PREDICTION_MAP: Record<
  string,
  keyof Prisma.UserRunningFitnessUncheckedCreateInput
> = {
  time5K: "predicted5kSeconds",
  time10K: "predicted10kSeconds",
  timeHalfMarathon: "predictedHalfSeconds",
  timeMarathon: "predictedMarathonSeconds",
};

function asObject(value: unknown): JsonObject | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function asInteger(value: unknown): number | undefined {
  const numeric = asNumber(value);
  if (numeric === undefined) {
    return undefined;
  }

  return Math.trunc(numeric);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return undefined;
}

function asDateTime(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function asDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("date must be a valid YYYY-MM-DD value.");
  }

  return parsed;
}

export function mapActivity(raw: unknown): Partial<Prisma.ActivityUncheckedCreateInput> {
  const source = asObject(raw);
  if (!source) {
    return {};
  }

  const mapped: Partial<Prisma.ActivityUncheckedCreateInput> = {};

  for (const [garminField, prismaField] of Object.entries(ACTIVITY_FIELD_MAP)) {
    const value = source[garminField];

    if (value === null || value === undefined) {
      continue;
    }

    if (prismaField === "activityDate") {
      const dateValue = asDateTime(value);
      if (dateValue) {
        mapped.activityDate = dateValue;
      }
      continue;
    }

    if (prismaField === "garminActivityId") {
      const numericId = asNumber(value);
      if (numericId !== undefined) {
        mapped.garminActivityId = BigInt(Math.trunc(numericId));
      }
      continue;
    }

    if (
      prismaField === "durationSeconds" ||
      prismaField === "averageHrBpm" ||
      prismaField === "maxHrBpm" ||
      prismaField === "hrTimeInZone1" ||
      prismaField === "hrTimeInZone2" ||
      prismaField === "hrTimeInZone3" ||
      prismaField === "hrTimeInZone4" ||
      prismaField === "hrTimeInZone5"
    ) {
      const numeric = asInteger(value);
      if (numeric !== undefined) {
        mapped[prismaField] = numeric as never;
      }
      continue;
    }

    if (
      prismaField === "distanceMeters" ||
      prismaField === "aerobicTrainingEffect" ||
      prismaField === "anaerobicTrainingEffect" ||
      prismaField === "elevationGain" ||
      prismaField === "elevationLoss"
    ) {
      const numeric = asNumber(value);
      if (numeric !== undefined) {
        mapped[prismaField] = numeric as never;
      }
      continue;
    }

    const text = asString(value);
    if (text !== undefined) {
      mapped[prismaField] = text as never;
    }
  }

  const activityTypeRaw = source.activityType;
  const activityTypeObj = asObject(activityTypeRaw);
  if (activityTypeObj && typeof activityTypeObj.typeKey === "string") {
    mapped.activityType = activityTypeObj.typeKey;
  } else {
    const activityTypeText = asString(activityTypeRaw);
    if (activityTypeText) {
      mapped.activityType = activityTypeText;
    }
  }

  if (Array.isArray(source.splitSummaries)) {
    mapped.splitSummariesJson = source.splitSummaries as Prisma.InputJsonValue;
  }

  const description = asString(source.description);
  if (description !== undefined) {
    mapped.activityDescription = description;
  }

  return mapped;
}

export function mapDailyHealthReadings(
  input: DailyHealthInput,
): Partial<Prisma.DailyHealthReadingUncheckedCreateInput> {
  const mapped: Partial<Prisma.DailyHealthReadingUncheckedCreateInput> = {
    readingDate: asDateOnly(input.date),
  };

  const sleep = asObject(input.sleep);
  if (sleep) {
    const avgOvernightHrv = asNumber(sleep.avgOvernightHrv);
    if (avgOvernightHrv !== undefined) {
      mapped.avgOvernightHrv = avgOvernightHrv;
    }

    const hrvStatus = asString(sleep.hrvStatus);
    if (hrvStatus !== undefined) {
      mapped.hrvStatus = hrvStatus;
    }

    const restingHeartRate = asInteger(sleep.restingHeartRate);
    if (restingHeartRate !== undefined) {
      mapped.restingHr = restingHeartRate;
    }

    const dailySleep = asObject(sleep.dailySleepDTO);
    if (dailySleep) {
      const sleepScores = asObject(dailySleep.sleepScores);
      const overallScore = sleepScores ? asObject(sleepScores.overall) : null;
      const scoreFromNewSchema = overallScore
        ? asInteger(overallScore.value)
        : undefined;
      if (scoreFromNewSchema !== undefined) {
        mapped.sleepScore = scoreFromNewSchema;
      } else {
        const scoreFromOldSchema = asObject(dailySleep.overallSleepScore);
        if (scoreFromOldSchema) {
          const score = asInteger(scoreFromOldSchema.value);
          if (score !== undefined) {
            mapped.sleepScore = score;
          }
        }
      }

      const sleepDuration = asInteger(dailySleep.sleepTimeSeconds);
      if (sleepDuration !== undefined) {
        mapped.totalSleepSeconds = sleepDuration;
      }

      const sleepStress = asInteger(dailySleep.sleepStress);
      if (sleepStress !== undefined) {
        mapped.sleepStress = sleepStress;
      }

      const feedback = asString(dailySleep.sleepScoreGarminFeedback);
      if (feedback !== undefined) {
        mapped.sleepScoreGarminFeedback = feedback;
      }
    }
  }

  const hrv = asObject(input.hrv);
  if (hrv) {
    const summary = asObject(hrv.hrvSummary);
    const weeklyAvg = summary ? asNumber(summary.weeklyAvg) : undefined;
    if (weeklyAvg !== undefined) {
      mapped.hrv7dayAvg = weeklyAvg;
    }
  }

  const restingHeartRate = asObject(input.restingHeartRate);
  if (restingHeartRate) {
    const avgResting = asInteger(restingHeartRate.lastSevenDaysAvgRestingHeartRate);
    if (avgResting !== undefined) {
      mapped.restingHr7dayAvg = avgResting;
    }

    if (mapped.restingHr === undefined) {
      const fallbackRestingHr = asInteger(restingHeartRate.restingHeartRate);
      if (fallbackRestingHr !== undefined) {
        mapped.restingHr = fallbackRestingHr;
      }
    }
  }

  return mapped;
}

export function mapRacePredictions(
  raw: unknown,
): Partial<Prisma.UserRunningFitnessUncheckedCreateInput> {
  const source = asObject(raw);
  if (!source) {
    return {};
  }

  const mapped: Partial<Prisma.UserRunningFitnessUncheckedCreateInput> = {};

  for (const [garminField, prismaField] of Object.entries(RACE_PREDICTION_MAP)) {
    const value = asInteger(source[garminField]);
    if (value !== undefined) {
      mapped[prismaField] = value as never;
    }
  }

  return mapped;
}

export function mapRunningVolume(rawActivities: unknown[]): {
  weeklyVolumeAvgKm?: number;
  longestRunKm?: number;
  runningDistanceAvgKm?: number;
} {
  const distancesMeters: number[] = [];

  for (const activity of rawActivities) {
    const activityObject = asObject(activity);
    if (!activityObject) {
      continue;
    }

    const activityTypeRaw = activityObject.activityType;
    const activityTypeObject = asObject(activityTypeRaw);
    const typeKey =
      (activityTypeObject ? asString(activityTypeObject.typeKey) : undefined) ??
      asString(activityTypeRaw);

    if (!typeKey || !typeKey.toLowerCase().includes("running")) {
      continue;
    }

    const distanceMeters = asNumber(activityObject.distance);
    if (distanceMeters !== undefined && distanceMeters > 0) {
      distancesMeters.push(distanceMeters);
    }
  }

  if (distancesMeters.length === 0) {
    return {};
  }

  const sumMeters = distancesMeters.reduce((acc, distance) => acc + distance, 0);
  const maxMeters = Math.max(...distancesMeters);
  const avgMeters = sumMeters / distancesMeters.length;

  return {
    weeklyVolumeAvgKm:
      sumMeters !== undefined ? Number((sumMeters / 4 / 1000).toFixed(2)) : undefined,
    longestRunKm: maxMeters !== undefined ? Number((maxMeters / 1000).toFixed(2)) : undefined,
    runningDistanceAvgKm:
      avgMeters !== undefined ? Number((avgMeters / 1000).toFixed(2)) : undefined,
  };
}
