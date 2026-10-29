import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

// Local migration mode is intentionally single-computer only. Host checks
// prevent DNS-rebinding, and rejecting foreign origins limits browser attacks.
// This is not user authentication and must not be used for shared hosting.
if (process.env.LOCAL_MODE === "1") {
  app.use((req, res, next) => {
    const apiPort = process.env.PORT || "8080";
    const webPort = process.env.WEB_PORT || "5173";
    const hosts = new Set([`localhost:${apiPort}`, `127.0.0.1:${apiPort}`]);
    const origins = new Set([`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`, `http://localhost:${apiPort}`, `http://127.0.0.1:${apiPort}`]);
    if (!hosts.has(req.headers.host || "") ||
        (req.headers.origin && !origins.has(req.headers.origin)) ||
        req.headers["sec-fetch-site"] === "cross-site") {
      res.status(403).json({ error: "This local API only accepts requests from the local application." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
} else {
  app.use(cors());
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
