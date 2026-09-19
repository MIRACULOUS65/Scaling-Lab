import express from "express";
import os from "os";
const app = express();
const PORT = process.env.PORT || 3000;
const INSTANCE_ID = process.env.INSTANCE_ID || "app-1";
app.get("/", (_req, res) => {
    res.json({
        message: "Hello from Scaling Lab",
        instance: INSTANCE_ID,
        pid: process.pid,
        cpuCores: os.cpus().length
    });
});
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        instance: INSTANCE_ID,
        pid: process.pid
    });
});
app.listen(PORT, () => {
    console.log(`[${INSTANCE_ID}] Server running on http://localhost:${PORT} | PID: ${process.pid}`);
});
//# sourceMappingURL=server.js.map