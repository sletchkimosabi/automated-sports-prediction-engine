import { date, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const verdictDays = pgTable(
  "verdict_days",
  {
    id: serial("id").primaryKey(),
    day: date("day", { mode: "string" }).notNull(),
    context: text("context").notNull(), // club | selection
    qualifiedCount: integer("qualified_count").notNull().default(0),
    matchesJson: jsonb("matches_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqDayContext: uniqueIndex("verdict_days_day_context_uidx").on(table.day, table.context),
  }),
);

export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  day: date("day", { mode: "string" }).notNull(),
  status: text("status").notNull(), // ok | error
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
