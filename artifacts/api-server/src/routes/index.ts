import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import agentRouter from "./agent";
import toolsRouter from "./tools";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conversationsRouter);
router.use(agentRouter);
router.use(toolsRouter);
router.use(settingsRouter);

export default router;
