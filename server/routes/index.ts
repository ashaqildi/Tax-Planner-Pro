import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/clients", clientsRouter);

export default router;
