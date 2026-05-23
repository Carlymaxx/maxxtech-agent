import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody, GetSettingsResponse, UpdateSettingsResponse } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

function serializeDates<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const router: IRouter = Router();

router.get("/settings", async (req, res): Promise<void> => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({}).returning();
  }
  res.json(GetSettingsResponse.parse(serializeDates(settings)));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) {
    [settings] = await db.insert(settingsTable).values({}).returning();
  }
  const [updated] = await db
    .update(settingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(settingsTable.id, settings.id))
    .returning();
  res.json(UpdateSettingsResponse.parse(serializeDates(updated)));
});

export default router;
