import { prisma } from "@/lib/prisma";
import { decryptTokenPayload, encryptTokenPayload } from "@/server/encryption";

const GARMIN_CONNECT_MODULE = "garmin-connect";

type JsonObject = Record<string, unknown>;
type RawGarminClient = Record<string, unknown>;

type GarminCapability =
  | "activities"
  | "sleep"
  | "hrv"
  | "restingHr"
  | "racePredictions"
  | "uploadWorkout";

type StoredGarminPayload = {
  provider: "garmin-connect";
  connectedAt: string;
  credentials: {
    email: string;
    password: string;
  };
  sessionData?: unknown;
  capabilities: GarminCapability[];
};

export type GarminConnectionResult =
  | { success: true; encryptedToken: Buffer }
  | { success: false; message: string; status?: number };

export type GarminClientResult =
  | { success: true; client: GarminAdapter }
  | { success: false; message: string; status?: number };

export interface GarminAdapter {
  getActivities(startDate: string, endDate: string): Promise<unknown[]>;
  getSleepData(date: string): Promise<unknown>;
  getHrvData(date: string): Promise<unknown>;
  getRestingHeartRate(date: string): Promise<unknown>;
  getRacePredictions(): Promise<unknown>;
  uploadWorkout(workoutJson: unknown): Promise<unknown>;
}

function asObject(value: unknown): JsonObject | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return null;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

function classifyGarminError(error: unknown): { message: string; status: number } {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("invalid") ||
    normalized.includes("authentication") ||
    normalized.includes("credential") ||
    normalized.includes("401")
  ) {
    return { message: "Invalid Garmin email or password.", status: 401 };
  }

  if (normalized.includes("too many") || normalized.includes("429")) {
    return { message: "Garmin rate limit reached. Please retry later.", status: 500 };
  }

  if (normalized.includes("connect") || normalized.includes("network")) {
    return { message: "Could not connect to Garmin right now.", status: 500 };
  }

  return { message: `Garmin connection failed: ${message}`, status: 500 };
}

function detectCapabilities(client: RawGarminClient): GarminCapability[] {
  const checks: Array<[GarminCapability, string[]]> = [
    ["activities", ["getActivitiesByDate", "get_activities_by_date", "getActivities"]],
    ["sleep", ["getSleepData", "get_sleep_data"]],
    ["hrv", ["getHrvData", "get_hrv_data"]],
    ["restingHr", ["getHeartRates", "get_heart_rates", "getRestingHeartRate"]],
    ["racePredictions", ["getRacePredictions", "get_race_predictions"]],
    ["uploadWorkout", ["uploadWorkout", "upload_workout"]],
  ];

  const capabilities: GarminCapability[] = [];

  for (const [capability, methodNames] of checks) {
    if (methodNames.some((name) => isFunction(client[name]))) {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

function extractSerializableSession(client: RawGarminClient): unknown {
  const garth = asObject(client.garth);
  if (!garth) {
    return undefined;
  }

  const session = {
    oauth1: garth.oauth1_token ?? garth.oauth1Token,
    oauth2: garth.oauth2_token ?? garth.oauth2Token,
  };

  try {
    return JSON.parse(JSON.stringify(session));
  } catch {
    return undefined;
  }
}

async function importGarminConnectModule(): Promise<JsonObject | null> {
  try {
    return (await import(GARMIN_CONNECT_MODULE as string)) as JsonObject;
  } catch {
    return null;
  }
}

async function tryLogin(client: RawGarminClient, email: string, password: string): Promise<void> {
  const loginMethods = ["login", "authenticate", "connect", "signIn"];

  for (const methodName of loginMethods) {
    const method = client[methodName];
    if (!isFunction(method)) {
      continue;
    }

    const argVariants: unknown[][] = [
      [email, password],
      [{ email, password }],
      [],
    ];

    let lastError: unknown = null;
    for (const args of argVariants) {
      try {
        await Promise.resolve(method.apply(client, args));
        return;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  throw new Error("No compatible login method found on garmin-connect client.");
}

async function createRawGarminClient(
  email: string,
  password: string,
): Promise<{ success: true; client: RawGarminClient } | { success: false; message: string; status: number }> {
  const garminModule = await importGarminConnectModule();
  if (!garminModule) {
    return {
      success: false,
      message:
        "garmin-connect package is unavailable in this environment. Install dependency and retry.",
      status: 500,
    };
  }

  const candidateConstructors: unknown[] = [
    garminModule.GarminConnect,
    garminModule.Garmin,
    garminModule.default,
  ];

  let lastError: unknown = null;

  for (const Candidate of candidateConstructors) {
    if (!isFunction(Candidate)) {
      continue;
    }

    const constructorArgVariants: unknown[][] = [
      [],
      [email, password],
      [{ email, password }],
    ];

    for (const constructorArgs of constructorArgVariants) {
      try {
        const GarminCtor = Candidate as unknown as new (
          ...args: unknown[]
        ) => RawGarminClient;
        const client = new GarminCtor(...constructorArgs);

        await tryLogin(client, email, password);
        return { success: true, client };
      } catch (error) {
        lastError = error;
      }
    }
  }

  const classified = classifyGarminError(lastError);
  return { success: false, ...classified };
}

function parseStoredPayload(raw: string): StoredGarminPayload {
  const parsed = JSON.parse(raw) as unknown;
  const payload = asObject(parsed);

  if (!payload || payload.provider !== "garmin-connect") {
    throw new Error("Stored Garmin payload is invalid.");
  }

  const credentials = asObject(payload.credentials);
  if (!credentials) {
    throw new Error("Stored Garmin credentials are invalid.");
  }

  const email = credentials.email;
  const password = credentials.password;

  if (typeof email !== "string" || typeof password !== "string") {
    throw new Error("Stored Garmin credentials are malformed.");
  }

  const capabilitiesRaw = Array.isArray(payload.capabilities)
    ? payload.capabilities.filter((value): value is GarminCapability => typeof value === "string")
    : [];

  return {
    provider: "garmin-connect",
    connectedAt:
      typeof payload.connectedAt === "string"
        ? payload.connectedAt
        : new Date().toISOString(),
    credentials: { email, password },
    sessionData: payload.sessionData,
    capabilities: capabilitiesRaw,
  };
}

async function invokeMethod(
  client: RawGarminClient,
  methodNames: string[],
  argsVariants: unknown[][],
): Promise<unknown> {
  let lastError: unknown = null;

  for (const methodName of methodNames) {
    const method = client[methodName];
    if (!isFunction(method)) {
      continue;
    }

    for (const args of argsVariants) {
      try {
        return await Promise.resolve(method.apply(client, args));
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Missing Garmin capability: ${methodNames.join("/")}`);
}

async function fallbackHttpRequest(operation: string): Promise<never> {
  throw new Error(
    `Garmin operation '${operation}' is not supported by current adapter methods and HTTP fallback is not configured yet.`,
  );
}

function normalizeActivityResponse(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const asObj = asObject(value);
  if (!asObj) {
    return [];
  }

  const listKeys = ["activities", "activityList", "items"];
  for (const key of listKeys) {
    const candidate = asObj[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function createGarminAdapter(client: RawGarminClient): GarminAdapter {
  return {
    async getActivities(startDate, endDate) {
      try {
        const response = await invokeMethod(
          client,
          ["getActivitiesByDate", "get_activities_by_date", "getActivities"],
          [
            [startDate, endDate, "running"],
            [startDate, endDate],
            [{ startDate, endDate, activityType: "running" }],
          ],
        );

        return normalizeActivityResponse(response);
      } catch {
        return fallbackHttpRequest("activities");
      }
    },

    async getSleepData(date) {
      try {
        return await invokeMethod(client, ["getSleepData", "get_sleep_data"], [[date]]);
      } catch {
        return fallbackHttpRequest("sleep");
      }
    },

    async getHrvData(date) {
      try {
        return await invokeMethod(client, ["getHrvData", "get_hrv_data"], [[date]]);
      } catch {
        return fallbackHttpRequest("hrv");
      }
    },

    async getRestingHeartRate(date) {
      try {
        return await invokeMethod(
          client,
          ["getHeartRates", "get_heart_rates", "getRestingHeartRate"],
          [[date]],
        );
      } catch {
        return fallbackHttpRequest("resting-heart-rate");
      }
    },

    async getRacePredictions() {
      try {
        return await invokeMethod(
          client,
          ["getRacePredictions", "get_race_predictions"],
          [[], [{}]],
        );
      } catch {
        return fallbackHttpRequest("race-predictions");
      }
    },

    async uploadWorkout(workoutJson) {
      try {
        return await invokeMethod(client, ["uploadWorkout", "upload_workout"], [[workoutJson]]);
      } catch {
        return fallbackHttpRequest("upload-workout");
      }
    },
  };
}

export async function createGarminConnection(
  email: string,
  password: string,
): Promise<GarminConnectionResult> {
  const result = await createRawGarminClient(email, password);
  if (!result.success) {
    return result;
  }

  const payload: StoredGarminPayload = {
    provider: "garmin-connect",
    connectedAt: new Date().toISOString(),
    credentials: { email, password },
    sessionData: extractSerializableSession(result.client),
    capabilities: detectCapabilities(result.client),
  };

  return {
    success: true,
    encryptedToken: encryptTokenPayload(JSON.stringify(payload)),
  };
}

export async function getGarminClientForUser(userId: number): Promise<GarminClientResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { garminOauthToken: true, garminConnected: true },
  });

  if (!user || !user.garminConnected || !user.garminOauthToken) {
    return {
      success: false,
      message: "Garmin not connected.",
      status: 400,
    };
  }

  let payload: StoredGarminPayload;
  try {
    const decrypted = decryptTokenPayload(Buffer.from(user.garminOauthToken));
    payload = parseStoredPayload(decrypted);
  } catch {
    return {
      success: false,
      message: "Stored Garmin session is invalid. Please reconnect Garmin.",
      status: 400,
    };
  }

  const clientResult = await createRawGarminClient(
    payload.credentials.email,
    payload.credentials.password,
  );
  if (!clientResult.success) {
    return {
      success: false,
      message: clientResult.message,
      status: clientResult.status,
    };
  }

  return {
    success: true,
    client: createGarminAdapter(clientResult.client),
  };
}
