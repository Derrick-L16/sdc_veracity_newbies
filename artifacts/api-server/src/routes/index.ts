import { Router, type IRouter } from "express";
import healthRouter from "./health";
import backendRouter from "./backend";

const router: IRouter = Router();

router.use(healthRouter);
router.use(backendRouter);

export default router;
