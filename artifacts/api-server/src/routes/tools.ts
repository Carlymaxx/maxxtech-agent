import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, toolCallsTable } from "@workspace/db";
import { ListToolHistoryResponse } from "@workspace/api-zod";

function serializeDates<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const router: IRouter = Router();

router.get("/tools/history", async (req, res): Promise<void> => {
  const history = await db
    .select()
    .from(toolCallsTable)
    .orderBy(desc(toolCallsTable.createdAt))
    .limit(50);
  res.json(ListToolHistoryResponse.parse(serializeDates(history)));
});

export default router;
