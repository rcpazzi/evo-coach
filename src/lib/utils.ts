import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistanceMeters(distanceMeters?: number | null): string {
  if (!distanceMeters || distanceMeters <= 0) {
    return "-";
  }

  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

export function formatDurationSeconds(durationSeconds?: number | null): string {
  if (!durationSeconds || durationSeconds <= 0) {
    return "-";
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPaceSecondsPerKm(paceSeconds?: number | null): string {
  if (!paceSeconds || paceSeconds <= 0) {
    return "-";
  }

  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

export function formatDate(value?: Date | string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString();
}

export function formatDateTime(value?: Date | string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}
