import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  AI_REQUEST_TIMEOUT_MS,
  ANTHROPIC_MODEL,
  OPENROUTER_API_URL,
  OPENROUTER_MODEL,
  SYSTEM_PROMPT,
  type GarminWorkoutJson,
  type WorkoutType,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";

type AIMessage = {
  role: "system" | "user";
  content: string;
};

type WorkoutPromptInput = {
  workoutType: WorkoutType;
  distanceKm?: number;
  userPrompt?: string;
};

type WorkoutGenerationResult = {
  workout: GarminWorkoutJson;
  explanation: string | null;
};

type FitnessContext = {
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

type ActivityContext = {
  activityDate: Date | null;
  activityName: string | null;
  activityType: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  averagePaceSecondsPerKm: number | null;
  averageHrBpm: number | null;
  maxHrBpm: number | null;
};

type HealthContext = {
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
};

export interface AIProvider {
  generateCompletion(messages: AIMessage[]): Promise<string>;
}

type ProviderErrorShape = {
  status?: number;
  code?: string | number;
  message?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlaceholderApiKey(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized.includes("your-key") || normalized.includes("your_api_key")) {
    return true;
  }

  if (normalized.startsWith("<") && normalized.endsWith(">")) {
    return true;
  }

  return false;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function parseProviderError(error: unknown): ProviderErrorShape {
  if (isObject(error)) {
    const nestedError = isObject(error.error) ? error.error : undefined;
    const nestedCause = isObject(error.cause) ? error.cause : undefined;

    const message = firstString(
      error.message,
      nestedError?.message,
      nestedCause?.message,
    );

    return {
      status:
        typeof error.status === "number"
          ? error.status
          : typeof error.statusCode === "number"
            ? error.statusCode
            : typeof nestedError?.status === "number"
              ? nestedError.status
              : typeof nestedError?.statusCode === "number"
                ? nestedError.statusCode
            : undefined,
      code:
        typeof error.code === "string" || typeof error.code === "number"
          ? error.code
          : typeof nestedError?.code === "string" ||
              typeof nestedError?.code === "number"
            ? nestedError.code
          : undefined,
      message,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

function mapProviderError(provider: "openrouter" | "anthropic", error: unknown): Error {
  const parsed = parseProviderError(error);
  const message = (parsed.message ?? "").toLowerCase();

  if (
    parsed.status === 401 ||
    parsed.status === 403 ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("auth credentials") ||
    message.includes("no auth credentials found") ||
    message.includes("authentication") ||
    message.includes("invalid api key") ||
    message.includes("no cookie auth credentials found")
  ) {
    return new Error(
      `AI provider authentication failed (${provider}). Update ${
        provider === "openrouter" ? "OPENROUTER_API_KEY" : "ANTHROPIC_API_KEY"
      } in .env.local.`,
    );
  }

  if (parsed.status === 429 || message.includes("rate limit")) {
    return new Error(`AI provider rate limit reached (${provider}). Please retry soon.`);
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return new Error(`AI provider timed out (${provider}). Please retry.`);
  }

  return new Error(`AI provider request failed (${provider}).`);
}

function stripMarkdownCodeBlock(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline === -1) {
    return trimmed;
  }

  let withoutOpeningFence = trimmed.slice(firstNewline + 1);
  if (withoutOpeningFence.endsWith("```")) {
    withoutOpeningFence = withoutOpeningFence.slice(0, -3);
  }

  return withoutOpeningFence.trim();
}

function validateWorkoutStructure(value: unknown): value is GarminWorkoutJson {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.workoutName !== "string" || value.workoutName.trim() === "") {
    return false;
  }

  if (!isObject(value.sportType)) {
    return false;
  }

  if (!Array.isArray(value.workoutSegments) || value.workoutSegments.length === 0) {
    return false;
  }

  const firstSegment = value.workoutSegments[0];
  if (!isObject(firstSegment)) {
    return false;
  }

  if (!Array.isArray(firstSegment.workoutSteps) || firstSegment.workoutSteps.length === 0) {
    return false;
  }

  return true;
}

class OpenRouterProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_API_URL,
      timeout: AI_REQUEST_TIMEOUT_MS,
    });
  }

  async generateCompletion(messages: AIMessage[]): Promise<string> {
    let response;
    try {
      response = await this.client.chat.completions.create({
        model: OPENROUTER_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 8192,
        messages,
      });
    } catch (error) {
      throw mapProviderError("openrouter", error);
    }

    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("AI provider returned an empty response.");
    }

    return content;
  }
}

class AnthropicProvider implements AIProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      timeout: AI_REQUEST_TIMEOUT_MS,
    });
  }

  async generateCompletion(messages: AIMessage[]): Promise<string> {
    const systemPrompt = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n")
      .trim();

    const userPrompt = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n\n")
      .trim();

    let response;
    try {
      response = await this.client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (error) {
      throw mapProviderError("anthropic", error);
    }

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!content) {
      throw new Error("AI provider returned an empty response.");
    }

    return content;
  }
}

function resolveAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? "openrouter").trim().toLowerCase();

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey || isPlaceholderApiKey(apiKey)) {
      throw new Error(
        "AI provider configuration error: OPENROUTER_API_KEY is required when AI_PROVIDER=openrouter.",
      );
    }

    return new OpenRouterProvider(apiKey);
  }

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey || isPlaceholderApiKey(apiKey)) {
      throw new Error(
        "AI provider configuration error: ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic.",
      );
    }

    return new AnthropicProvider(apiKey);
  }

  throw new Error(
    `AI provider configuration error: Unsupported AI_PROVIDER '${provider}'. Use 'openrouter' or 'anthropic'.`,
  );
}

function buildModelUserMessage(
  fitness: FitnessContext,
  activities: ActivityContext[],
  health: HealthContext[],
  workoutPrompt: string,
): string {
  const activitiesText =
    activities.length > 0
      ? JSON.stringify(activities, null, 2)
      : "No recent activities available.";

  const healthText =
    health.length > 0
      ? JSON.stringify(health, null, 2)
      : "No recent health data available.";

  return `## User Fitness Profile
${JSON.stringify(fitness, null, 2)}

## User's Last 5 Activities
${activitiesText}

## User's Health Data (Last 3 Days)
${healthText}

## Workout Request
${workoutPrompt}

Generate a Garmin-compatible workout JSON based on the user's current fitness level, recovery status, and recent training history. Output ONLY the JSON, no explanations.`;
}

export function buildUserPrompt(input: WorkoutPromptInput): string {
  const workoutType = input.workoutType;
  const normalizedDistance =
    isFiniteNumber(input.distanceKm) && input.distanceKm > 0
      ? input.distanceKm
      : undefined;
  const note = typeof input.userPrompt === "string" ? input.userPrompt.trim() : "";

  const parts = [`Create a ${workoutType} running workout`];

  if (normalizedDistance !== undefined) {
    parts.push(`for ${normalizedDistance} km`);
  }

  let prompt = `${parts.join(" ")}.`;
  if (note) {
    prompt = `${prompt} ${note}`;
  }

  return prompt;
}

export function parseWorkoutResponse(raw: string): WorkoutGenerationResult {
  const normalized = stripMarkdownCodeBlock(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Failed to parse workout JSON from AI response.");
  }

  let workoutCandidate: unknown;
  let explanation: string | null = null;

  if (isObject(parsed) && "workout" in parsed) {
    workoutCandidate = parsed.workout;
    if (typeof parsed.explanation === "string") {
      const trimmed = parsed.explanation.trim();
      explanation = trimmed === "" ? null : trimmed;
    }
  } else {
    workoutCandidate = parsed;
  }

  if (!validateWorkoutStructure(workoutCandidate)) {
    throw new Error("Workout is missing required Garmin fields.");
  }

  return {
    workout: workoutCandidate,
    explanation,
  };
}

async function fetchWorkoutGenerationContext(userId: number): Promise<{
  fitness: FitnessContext;
  activities: ActivityContext[];
  health: HealthContext[];
}> {
  const [fitness, activities, health] = await Promise.all([
    prisma.userRunningFitness.findUnique({
      where: { userId },
      select: {
        predicted5kSeconds: true,
        predicted10kSeconds: true,
        predictedHalfSeconds: true,
        predictedMarathonSeconds: true,
        easyPaceLow: true,
        easyPaceHigh: true,
        tempoPace: true,
        thresholdPace: true,
        intervalPace: true,
        repetitionPace: true,
        weeklyVolumeAvgKm: true,
        longestRunKm: true,
        runningDistanceAvgKm: true,
        racePredictionsLastUpdate: true,
      },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: [{ activityDate: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        activityDate: true,
        activityName: true,
        activityType: true,
        distanceMeters: true,
        durationSeconds: true,
        averagePaceSecondsPerKm: true,
        averageHrBpm: true,
        maxHrBpm: true,
      },
    }),
    prisma.dailyHealthReading.findMany({
      where: { userId },
      orderBy: [{ readingDate: "desc" }, { id: "desc" }],
      take: 3,
      select: {
        readingDate: true,
        sleepScore: true,
        totalSleepSeconds: true,
        sleepStress: true,
        avgOvernightHrv: true,
        hrvStatus: true,
        hrv7dayAvg: true,
        restingHr: true,
        restingHr7dayAvg: true,
        bodyBatteryStart: true,
        bodyBatteryEnd: true,
      },
    }),
  ]);

  if (!fitness) {
    throw new Error("No fitness profile found. Please sync Garmin data first.");
  }

  return {
    fitness,
    activities,
    health,
  };
}

export async function generateWorkout(
  userId: number,
  userPrompt: string,
): Promise<WorkoutGenerationResult> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid user id.");
  }

  const prompt = userPrompt.trim();
  if (!prompt) {
    throw new Error("Workout prompt is required.");
  }

  const context = await fetchWorkoutGenerationContext(userId);
  const provider = resolveAIProvider();

  const messages: AIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: buildModelUserMessage(
        context.fitness,
        context.activities,
        context.health,
        prompt,
      ),
    },
  ];

  const raw = await provider.generateCompletion(messages);
  return parseWorkoutResponse(raw);
}
