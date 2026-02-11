-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "garmin_connected" BOOLEAN NOT NULL DEFAULT false,
    "garmin_oauth_token" BYTEA,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "garmin_activity_id" BIGINT,
    "activity_date" TIMESTAMP(3),
    "activity_name" TEXT,
    "activity_type" TEXT,
    "activity_description" TEXT,
    "distance_meters" DOUBLE PRECISION,
    "duration_seconds" INTEGER,
    "average_pace_seconds_per_km" INTEGER,
    "split_summaries_json" JSONB,
    "average_hr_bpm" INTEGER,
    "max_hr_bpm" INTEGER,
    "hr_time_in_zone1" INTEGER,
    "hr_time_in_zone2" INTEGER,
    "hr_time_in_zone3" INTEGER,
    "hr_time_in_zone4" INTEGER,
    "hr_time_in_zone5" INTEGER,
    "aerobic_training_effect" DOUBLE PRECISION,
    "anaerobic_training_effect" DOUBLE PRECISION,
    "training_effect_label" TEXT,
    "elevation_gain" DOUBLE PRECISION,
    "elevation_loss" DOUBLE PRECISION,
    "location_name" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_health_readings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reading_date" DATE NOT NULL,
    "sleep_score" INTEGER,
    "total_sleep_seconds" INTEGER,
    "sleep_stress" INTEGER,
    "sleep_score_garmin_feedback" TEXT,
    "avg_overnight_hrv" DOUBLE PRECISION,
    "hrv_status" TEXT,
    "hrv_7day_avg" DOUBLE PRECISION,
    "resting_hr" INTEGER,
    "resting_hr_7day_avg" INTEGER,
    "body_battery_start" INTEGER,
    "body_battery_end" INTEGER,
    "data_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_health_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_running_fitness" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "vo2_max" INTEGER,
    "predicted_5k_seconds" INTEGER,
    "predicted_10k_seconds" INTEGER,
    "predicted_half_seconds" INTEGER,
    "predicted_marathon_seconds" INTEGER,
    "race_predictions_last_update" DATE,
    "easy_pace_low" INTEGER,
    "easy_pace_high" INTEGER,
    "tempo_pace" INTEGER,
    "threshold_pace" INTEGER,
    "interval_pace" INTEGER,
    "repetition_pace" INTEGER,
    "long_run_pace" INTEGER,
    "weekly_volume_avg_km" DOUBLE PRECISION,
    "longest_run_km" DOUBLE PRECISION,
    "running_distance_avg_km" DOUBLE PRECISION,
    "last_updated" TIMESTAMP(3),
    "data_source" TEXT NOT NULL DEFAULT 'garmin',

    CONSTRAINT "user_running_fitness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "workout_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ai_description" TEXT,
    "workout_json" JSONB NOT NULL,
    "total_distance_km" DOUBLE PRECISION,
    "estimated_duration_minutes" INTEGER,
    "user_prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "scheduled_date" DATE,
    "garmin_workout_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_training_insights" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "insight_date" DATE NOT NULL,
    "insight_text" TEXT NOT NULL,
    "insight_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_training_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "activities_garmin_activity_id_key" ON "activities"("garmin_activity_id");

-- CreateIndex
CREATE INDEX "idx_activities_user_date" ON "activities"("user_id", "activity_date");

-- CreateIndex
CREATE INDEX "idx_daily_health_user_date" ON "daily_health_readings"("user_id", "reading_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_health_readings_user_id_reading_date_key" ON "daily_health_readings"("user_id", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "user_running_fitness_user_id_key" ON "user_running_fitness"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_training_insights_user_id_insight_date_insight_type_key" ON "ai_training_insights"("user_id", "insight_date", "insight_type");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_health_readings" ADD CONSTRAINT "daily_health_readings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_running_fitness" ADD CONSTRAINT "user_running_fitness_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_training_insights" ADD CONSTRAINT "ai_training_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
