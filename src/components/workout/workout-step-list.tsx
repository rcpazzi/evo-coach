import { cn } from "@/lib/utils";

type WorkoutStepListProps = {
  workoutJson: unknown;
  className?: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getSegments(workoutJson: unknown): Array<Record<string, unknown>> {
  const workoutObject = asObject(workoutJson);
  if (!workoutObject) {
    return [];
  }

  const rawSegments = workoutObject.workoutSegments;
  if (!Array.isArray(rawSegments)) {
    return [];
  }

  return rawSegments
    .map((segment) => asObject(segment))
    .filter((segment): segment is Record<string, unknown> => Boolean(segment));
}

function getSteps(segment: Record<string, unknown>): Array<Record<string, unknown>> {
  const rawSteps = segment.workoutSteps;
  if (!Array.isArray(rawSteps)) {
    return [];
  }

  return rawSteps
    .map((step) => asObject(step))
    .filter((step): step is Record<string, unknown> => Boolean(step));
}

function isRepeatGroup(step: Record<string, unknown>): boolean {
  const type = step.type;
  if (typeof type === "string" && type.toLowerCase().includes("repeat")) {
    return true;
  }

  return Array.isArray(step.workoutSteps) && asNumber(step.numberOfIterations) !== null;
}

function formatStepType(step: Record<string, unknown>): string {
  const stepTypeRaw = step.stepType;
  const stepType = asObject(stepTypeRaw);

  const rawValue =
    (stepType && typeof stepType.stepTypeKey === "string" ? stepType.stepTypeKey : null) ??
    (typeof step.stepType === "string" ? step.stepType : null) ??
    (typeof step.type === "string" ? step.type : null);

  if (!rawValue) {
    return "Step";
  }

  return rawValue
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEndCondition(step: Record<string, unknown>): string | null {
  const endConditionRaw = asObject(step.endCondition);
  const conditionKey =
    (endConditionRaw && typeof endConditionRaw.conditionTypeKey === "string"
      ? endConditionRaw.conditionTypeKey
      : null) ??
    null;

  const endConditionValue = asNumber(step.endConditionValue);
  if (!conditionKey || endConditionValue === null) {
    return null;
  }

  if (conditionKey === "time") {
    return `${Math.round(endConditionValue)} sec`;
  }

  if (conditionKey === "distance") {
    return `${Math.round(endConditionValue)} m`;
  }

  if (conditionKey === "iterations") {
    return `${Math.round(endConditionValue)} reps`;
  }

  return `${endConditionValue} ${conditionKey}`;
}

function formatTarget(step: Record<string, unknown>): string | null {
  const targetTypeRaw = asObject(step.targetType);
  const targetKey =
    (targetTypeRaw && typeof targetTypeRaw.workoutTargetTypeKey === "string"
      ? targetTypeRaw.workoutTargetTypeKey
      : null) ??
    null;

  if (!targetKey || targetKey === "no.target") {
    return null;
  }

  if (targetKey === "heart.rate.zone") {
    const zoneNumber = asNumber(step.zoneNumber);
    return zoneNumber !== null ? `HR Zone ${zoneNumber}` : "HR Zone";
  }

  if (targetKey === "pace.zone") {
    const lower = asNumber(step.targetValueOne);
    const upper = asNumber(step.targetValueTwo);
    if (lower !== null && upper !== null) {
      return `Pace ${lower.toFixed(3)}-${upper.toFixed(3)} m/s`;
    }

    return "Pace zone";
  }

  if (targetKey === "cadence") {
    const lower = asNumber(step.targetValueOne);
    const upper = asNumber(step.targetValueTwo);
    if (lower !== null && upper !== null) {
      return `Cadence ${Math.round(lower)}-${Math.round(upper)} spm`;
    }

    return "Cadence target";
  }

  return targetKey;
}

function renderStep(step: Record<string, unknown>, index: number, keyPrefix: string): React.ReactNode {
  const description =
    typeof step.description === "string" && step.description.trim() !== ""
      ? step.description.trim()
      : null;
  const endCondition = formatEndCondition(step);
  const target = formatTarget(step);

  if (isRepeatGroup(step)) {
    const iterations = asNumber(step.numberOfIterations);
    const nestedSteps = Array.isArray(step.workoutSteps)
      ? step.workoutSteps
          .map((nestedStep) => asObject(nestedStep))
          .filter((nestedStep): nestedStep is Record<string, unknown> => Boolean(nestedStep))
      : [];

    return (
      <li key={`${keyPrefix}-repeat-${index}`} className="rounded-md border border-border p-3">
        <p className="font-medium text-foreground">
          {index + 1}. Repeat Group{iterations !== null ? ` (${iterations} iterations)` : ""}
        </p>
        {nestedSteps.length > 0 && (
          <ol className="mt-2 space-y-2 pl-4 text-sm">
            {nestedSteps.map((nestedStep, nestedIndex) =>
              renderStep(nestedStep, nestedIndex, `${keyPrefix}-repeat-${index}`),
            )}
          </ol>
        )}
      </li>
    );
  }

  const details = [endCondition, target].filter((detail): detail is string => Boolean(detail));

  return (
    <li key={`${keyPrefix}-step-${index}`} className="rounded-md border border-border p-3">
      <p className="font-medium text-foreground">
        {index + 1}. {formatStepType(step)}
      </p>
      {description && <p className="mt-1 text-sm text-foreground">{description}</p>}
      {details.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{details.join(" · ")}</p>
      )}
    </li>
  );
}

export function WorkoutStepList({ workoutJson, className }: WorkoutStepListProps) {
  const segments = getSegments(workoutJson);

  if (segments.length === 0) {
    return (
      <pre className={cn("overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs", className)}>
        {JSON.stringify(workoutJson, null, 2)}
      </pre>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {segments.map((segment, segmentIndex) => {
        const steps = getSteps(segment);

        return (
          <div key={`segment-${segmentIndex}`}>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Segment {segmentIndex + 1}
            </p>
            {steps.length > 0 ? (
              <ol className="space-y-2">{steps.map((step, index) => renderStep(step, index, `segment-${segmentIndex}`))}</ol>
            ) : (
              <p className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No steps in this segment.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
