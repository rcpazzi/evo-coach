import { prisma } from "@/lib/prisma";
import { type GarminAdapter, getGarminClientForUser } from "@/server/garmin";
import {
  mapActivity,
  mapDailyHealthReadings,
  mapRacePredictions,
  mapRunningVolume,
} from "@/server/garmin-field-mapper";
import { calculateTrainingPaces } from "@/server/vdot";

export type SyncContext = {
  client: GarminAdapter;
};

type SyncContextResult =
  | { success: true; context: SyncContext }
  | { success: false; message: string; status?: number };

type SyncCountResult = {
  success: boolean;
  synced: number;
  message: string;
};

type SyncFitnessResult = {
  success: boolean;
  synced: boolean;
  message: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value '${date}'. Expected YYYY-MM-DD.`);
  }

  return parsed;
}

function addDays(base: Date, offsetDays: number): Date {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + offsetDays);
  return copy;
}

function calculatePaceSecondsPerKm(
  activityRaw: unknown,
  mappedDistance?: number,
  mappedDuration?: number,
) {
  const rawObject = asObject(activityRaw);
  const speedMps = rawObject ? asNumber(rawObject.averageSpeed) : undefined;

  if (speedMps !== undefined && speedMps > 0) {
    return Math.round(1000 / speedMps);
  }

  if (!mappedDistance || !mappedDuration || mappedDistance <= 0 || mappedDuration <= 0) {
    return undefined;
  }

  const distanceKm = mappedDistance / 1000;
  if (distanceKm <= 0) {
    return undefined;
  }

  return Math.round(mappedDuration / distanceKm);
}

function isRunningActivity(raw: unknown, mappedType?: string | null): boolean {
  if (mappedType && mappedType.toLowerCase().includes("running")) {
    return true;
  }

  const rawObject = asObject(raw);
  if (!rawObject) {
    return false;
  }

  const activityTypeRaw = rawObject.activityType;
  const activityTypeObject = asObject(activityTypeRaw);
  const typeKey =
    (activityTypeObject && typeof activityTypeObject.typeKey === "string"
      ? activityTypeObject.typeKey
      : undefined) ??
    (typeof activityTypeRaw === "string" ? activityTypeRaw : undefined);

  return Boolean(typeKey && typeKey.toLowerCase().includes("running"));
}

async function resolveGarminClient(
  userId: number,
  context?: SyncContext,
): Promise<{ success: true; client: GarminAdapter } | { success: false; message: string }> {
  if (context?.client) {
    return { success: true, client: context.client };
  }

  const clientResult = await getGarminClientForUser(userId);
  if (!clientResult.success) {
    return {
      success: false,
      message: clientResult.message,
    };
  }

  return {
    success: true,
    client: clientResult.client,
  };
}

export async function createSyncContext(userId: number): Promise<SyncContextResult> {
  const clientResult = await getGarminClientForUser(userId);
  if (!clientResult.success) {
    return {
      success: false,
      message: clientResult.message,
      status: clientResult.status,
    };
  }

  return {
    success: true,
    context: { client: clientResult.client },
  };
}

export async function syncUserActivities(
  userId: number,
  startDate: string,
  endDate: string,
  context?: SyncContext,
): Promise<SyncCountResult> {
  const clientResult = await resolveGarminClient(userId, context);
  if (!clientResult.success) {
    return {
      success: false,
      synced: 0,
      message: clientResult.message,
    };
  }

  try {
    const rawActivities = await clientResult.client.getActivities(startDate, endDate);
    let synced = 0;

    for (const rawActivity of rawActivities) {
      const mapped = mapActivity(rawActivity);

      if (!isRunningActivity(rawActivity, mapped.activityType)) {
        continue;
      }

      if (!mapped.garminActivityId) {
        continue;
      }

      const averagePaceSecondsPerKm = calculatePaceSecondsPerKm(
        rawActivity,
        mapped.distanceMeters ?? undefined,
        mapped.durationSeconds ?? undefined,
      );

      const {
        garminActivityId,
        activityDate,
        activityName,
        activityType,
        activityDescription,
        distanceMeters,
        durationSeconds,
        averageHrBpm,
        maxHrBpm,
        hrTimeInZone1,
        hrTimeInZone2,
        hrTimeInZone3,
        hrTimeInZone4,
        hrTimeInZone5,
        aerobicTrainingEffect,
        anaerobicTrainingEffect,
        trainingEffectLabel,
        elevationGain,
        elevationLoss,
        locationName,
        splitSummariesJson,
      } = mapped;

      await prisma.activity.upsert({
        where: { garminActivityId },
        create: {
          userId,
          garminActivityId,
          activityDate: activityDate ?? null,
          activityName: activityName ?? null,
          activityType: activityType ?? null,
          activityDescription: activityDescription ?? null,
          distanceMeters: distanceMeters ?? null,
          durationSeconds: durationSeconds ?? null,
          averagePaceSecondsPerKm: averagePaceSecondsPerKm ?? null,
          averageHrBpm: averageHrBpm ?? null,
          maxHrBpm: maxHrBpm ?? null,
          hrTimeInZone1: hrTimeInZone1 ?? null,
          hrTimeInZone2: hrTimeInZone2 ?? null,
          hrTimeInZone3: hrTimeInZone3 ?? null,
          hrTimeInZone4: hrTimeInZone4 ?? null,
          hrTimeInZone5: hrTimeInZone5 ?? null,
          aerobicTrainingEffect: aerobicTrainingEffect ?? null,
          anaerobicTrainingEffect: anaerobicTrainingEffect ?? null,
          trainingEffectLabel: trainingEffectLabel ?? null,
          elevationGain: elevationGain ?? null,
          elevationLoss: elevationLoss ?? null,
          locationName: locationName ?? null,
          splitSummariesJson: splitSummariesJson ?? undefined,
        },
        update: {
          activityDate: activityDate ?? null,
          activityName: activityName ?? null,
          activityType: activityType ?? null,
          activityDescription: activityDescription ?? null,
          distanceMeters: distanceMeters ?? null,
          durationSeconds: durationSeconds ?? null,
          averagePaceSecondsPerKm: averagePaceSecondsPerKm ?? null,
          averageHrBpm: averageHrBpm ?? null,
          maxHrBpm: maxHrBpm ?? null,
          hrTimeInZone1: hrTimeInZone1 ?? null,
          hrTimeInZone2: hrTimeInZone2 ?? null,
          hrTimeInZone3: hrTimeInZone3 ?? null,
          hrTimeInZone4: hrTimeInZone4 ?? null,
          hrTimeInZone5: hrTimeInZone5 ?? null,
          aerobicTrainingEffect: aerobicTrainingEffect ?? null,
          anaerobicTrainingEffect: anaerobicTrainingEffect ?? null,
          trainingEffectLabel: trainingEffectLabel ?? null,
          elevationGain: elevationGain ?? null,
          elevationLoss: elevationLoss ?? null,
          locationName: locationName ?? null,
          splitSummariesJson: splitSummariesJson ?? undefined,
        },
      });

      synced += 1;
    }

    return {
      success: true,
      synced,
      message: `Synced ${synced} activities.`,
    };
  } catch (error) {
    return {
      success: false,
      synced: 0,
      message: error instanceof Error ? error.message : "Activity sync failed.",
    };
  }
}

export async function syncDailyHealthData(
  userId: number,
  startDate: string,
  endDate: string,
  context?: SyncContext,
): Promise<SyncCountResult> {
  const clientResult = await resolveGarminClient(userId, context);
  if (!clientResult.success) {
    return {
      success: false,
      synced: 0,
      message: clientResult.message,
    };
  }

  try {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);

    if (start > end) {
      return {
        success: false,
        synced: 0,
        message: "startDate must be before or equal to endDate.",
      };
    }

    let synced = 0;
    const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000);

    for (let offset = 0; offset <= totalDays; offset += 1) {
      const current = addDays(start, offset);
      const currentDate = formatDate(current);
      const isEndDate = currentDate === endDate;
      const readingDate = parseDateOnly(currentDate);

      if (!isEndDate) {
        const existing = await prisma.dailyHealthReading.findUnique({
          where: {
            userId_readingDate: {
              userId,
              readingDate,
            },
          },
          select: { id: true },
        });

        if (existing) {
          continue;
        }
      }

      const [sleep, hrv, restingHeartRate] = await Promise.all([
        clientResult.client.getSleepData(currentDate),
        clientResult.client.getHrvData(currentDate),
        clientResult.client.getRestingHeartRate(currentDate),
      ]);

      const mapped = mapDailyHealthReadings({
        date: currentDate,
        sleep,
        hrv,
        restingHeartRate,
      });

      const hasMetrics = Object.keys(mapped).some((key) => key !== "readingDate");
      if (!hasMetrics) {
        continue;
      }

      await prisma.dailyHealthReading.upsert({
        where: {
          userId_readingDate: {
            userId,
            readingDate,
          },
        },
        create: {
          userId,
          readingDate,
          sleepScore: mapped.sleepScore ?? null,
          totalSleepSeconds: mapped.totalSleepSeconds ?? null,
          sleepStress: mapped.sleepStress ?? null,
          sleepScoreGarminFeedback: mapped.sleepScoreGarminFeedback ?? null,
          avgOvernightHrv: mapped.avgOvernightHrv ?? null,
          hrvStatus: mapped.hrvStatus ?? null,
          hrv7dayAvg: mapped.hrv7dayAvg ?? null,
          restingHr: mapped.restingHr ?? null,
          restingHr7dayAvg: mapped.restingHr7dayAvg ?? null,
          bodyBatteryStart: mapped.bodyBatteryStart ?? null,
          bodyBatteryEnd: mapped.bodyBatteryEnd ?? null,
          dataSyncedAt: new Date(),
        },
        update: {
          sleepScore: mapped.sleepScore ?? null,
          totalSleepSeconds: mapped.totalSleepSeconds ?? null,
          sleepStress: mapped.sleepStress ?? null,
          sleepScoreGarminFeedback: mapped.sleepScoreGarminFeedback ?? null,
          avgOvernightHrv: mapped.avgOvernightHrv ?? null,
          hrvStatus: mapped.hrvStatus ?? null,
          hrv7dayAvg: mapped.hrv7dayAvg ?? null,
          restingHr: mapped.restingHr ?? null,
          restingHr7dayAvg: mapped.restingHr7dayAvg ?? null,
          bodyBatteryStart: mapped.bodyBatteryStart ?? null,
          bodyBatteryEnd: mapped.bodyBatteryEnd ?? null,
          dataSyncedAt: new Date(),
        },
      });

      synced += 1;
    }

    return {
      success: true,
      synced,
      message: `Synced health data for ${synced} day(s).`,
    };
  } catch (error) {
    return {
      success: false,
      synced: 0,
      message: error instanceof Error ? error.message : "Health sync failed.",
    };
  }
}

export async function syncUserRunningFitness(
  userId: number,
  context?: SyncContext,
): Promise<SyncFitnessResult> {
  const clientResult = await resolveGarminClient(userId, context);
  if (!clientResult.success) {
    return {
      success: false,
      synced: false,
      message: clientResult.message,
    };
  }

  try {
    const predictionsRaw = await clientResult.client.getRacePredictions();
    const predictions = Array.isArray(predictionsRaw)
      ? asObject(predictionsRaw[0])
      : asObject(predictionsRaw);

    if (!predictions) {
      return {
        success: false,
        synced: false,
        message: "No race prediction data returned by Garmin.",
      };
    }

    const mappedPredictions = mapRacePredictions(predictions);
    const predicted10kSeconds = mappedPredictions.predicted10kSeconds;

    if (!predicted10kSeconds) {
      return {
        success: false,
        synced: false,
        message: "Race predictions are missing 10K time.",
      };
    }

    const paces = calculateTrainingPaces(predicted10kSeconds);

    let volumeMetrics: ReturnType<typeof mapRunningVolume> = {};
    try {
      const lookbackEnd = new Date();
      const lookbackStart = addDays(lookbackEnd, -28);
      const activities = await clientResult.client.getActivities(
        formatDate(lookbackStart),
        formatDate(lookbackEnd),
      );
      volumeMetrics = mapRunningVolume(activities);
    } catch {
      volumeMetrics = {};
    }

    const todayDate = parseDateOnly(formatDate(new Date()));

    await prisma.userRunningFitness.upsert({
      where: { userId },
      create: {
        userId,
        predicted5kSeconds: mappedPredictions.predicted5kSeconds ?? null,
        predicted10kSeconds: mappedPredictions.predicted10kSeconds ?? null,
        predictedHalfSeconds: mappedPredictions.predictedHalfSeconds ?? null,
        predictedMarathonSeconds: mappedPredictions.predictedMarathonSeconds ?? null,
        racePredictionsLastUpdate: todayDate,
        easyPaceLow: paces.easyPaceLow,
        easyPaceHigh: paces.easyPaceHigh,
        tempoPace: paces.tempoPace,
        thresholdPace: paces.thresholdPace,
        intervalPace: paces.intervalPace,
        repetitionPace: paces.repetitionPace,
        weeklyVolumeAvgKm: volumeMetrics.weeklyVolumeAvgKm ?? null,
        longestRunKm: volumeMetrics.longestRunKm ?? null,
        runningDistanceAvgKm: volumeMetrics.runningDistanceAvgKm ?? null,
        lastUpdated: new Date(),
        dataSource: "garmin",
      },
      update: {
        predicted5kSeconds: mappedPredictions.predicted5kSeconds ?? null,
        predicted10kSeconds: mappedPredictions.predicted10kSeconds ?? null,
        predictedHalfSeconds: mappedPredictions.predictedHalfSeconds ?? null,
        predictedMarathonSeconds: mappedPredictions.predictedMarathonSeconds ?? null,
        racePredictionsLastUpdate: todayDate,
        easyPaceLow: paces.easyPaceLow,
        easyPaceHigh: paces.easyPaceHigh,
        tempoPace: paces.tempoPace,
        thresholdPace: paces.thresholdPace,
        intervalPace: paces.intervalPace,
        repetitionPace: paces.repetitionPace,
        weeklyVolumeAvgKm: volumeMetrics.weeklyVolumeAvgKm ?? null,
        longestRunKm: volumeMetrics.longestRunKm ?? null,
        runningDistanceAvgKm: volumeMetrics.runningDistanceAvgKm ?? null,
        lastUpdated: new Date(),
        dataSource: "garmin",
      },
    });

    return {
      success: true,
      synced: true,
      message: "Running fitness synced successfully.",
    };
  } catch (error) {
    return {
      success: false,
      synced: false,
      message: error instanceof Error ? error.message : "Running fitness sync failed.",
    };
  }
}

export async function uploadWorkoutToGarmin(
  userId: number,
  workoutData: unknown,
  context?: SyncContext,
): Promise<{ success: boolean; message: string; workoutId?: number }> {
  const clientResult = await resolveGarminClient(userId, context);
  if (!clientResult.success) {
    return {
      success: false,
      message: clientResult.message,
    };
  }

  try {
    const response = await clientResult.client.uploadWorkout(workoutData);
    const responseObj = asObject(response);
    const workoutId = responseObj ? asNumber(responseObj.workoutId) : undefined;

    return {
      success: true,
      message: "Workout uploaded successfully.",
      workoutId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Workout upload failed.",
    };
  }
}
