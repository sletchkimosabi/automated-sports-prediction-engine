import { db } from "@/db";
import { pipelineRuns, verdictDays } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export const getDayContextSnapshot = async (day: string, context: "club" | "selection") => {
  return db.query.verdictDays.findFirst({
    where: and(eq(verdictDays.day, day), eq(verdictDays.context, context)),
  });
};

export const listDaySnapshots = async (day: string) => {
  return db.query.verdictDays.findMany({
    where: eq(verdictDays.day, day),
    orderBy: [desc(verdictDays.qualifiedCount)],
  });
};

export const upsertSnapshot = async (payload: {
  day: string;
  context: "club" | "selection";
  qualifiedCount: number;
  matchesJson: unknown;
}) => {
  await db
    .insert(verdictDays)
    .values({
      day: payload.day,
      context: payload.context,
      qualifiedCount: payload.qualifiedCount,
      matchesJson: payload.matchesJson,
    })
    .onConflictDoUpdate({
      target: [verdictDays.day, verdictDays.context],
      set: {
        qualifiedCount: payload.qualifiedCount,
        matchesJson: payload.matchesJson,
        updatedAt: new Date(),
      },
    });
};

export const insertRunLog = async (payload: { day: string; status: "ok" | "error"; message: string }) => {
  await db.insert(pipelineRuns).values(payload);
};

export const getRecentRuns = async () => {
  return db.query.pipelineRuns.findMany({
    orderBy: [desc(pipelineRuns.createdAt)],
    limit: 20,
  });
};
