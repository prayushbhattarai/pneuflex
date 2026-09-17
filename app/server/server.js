import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;
const sessions = [];

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function cleanIp(ip) {
  if (!ip || typeof ip !== "string") return "";
  return ip.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
}

async function callEsp(ip, endpoint) {
  const safeIp = cleanIp(ip);
  if (!safeIp) throw new Error("Missing ESP32 IP");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`http://${safeIp}${endpoint}`, { signal: controller.signal });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : await response.text();
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/", (req, res) => {
  res.json({ ok: true, name: "PneuFlex backend running" });
});

app.get("/api/status", async (req, res) => {
  try {
    const result = await callEsp(req.query.ip, "/status");
    res.status(result.status).send(result.body);
  } catch (error) {
    res.status(500).json({ error: "Could not reach ESP32", details: error.message });
  }
});

app.post("/api/command/:command", async (req, res) => {
  const allowed = new Set(["start", "stop", "emergency", "resetEmergency"]);
  if (!allowed.has(req.params.command)) {
    return res.status(400).json({ error: "Invalid command" });
  }

  try {
    const result = await callEsp(req.body.ip, `/${req.params.command}`);
    res.status(result.status).json({ ok: result.ok, response: result.body });
  } catch (error) {
    res.status(500).json({ error: "Command failed", details: error.message });
  }
});

app.post("/api/settings", async (req, res) => {
  const p = new URLSearchParams();
  if (req.body.bentThreshold !== undefined) p.set("bent", req.body.bentThreshold);
  if (req.body.flatThreshold !== undefined) p.set("flat", req.body.flatThreshold);
  if (req.body.restInterval !== undefined) p.set("rest", req.body.restInterval);
  if (req.body.maxPumpTime !== undefined) p.set("maxPump", req.body.maxPumpTime);

  try {
    const result = await callEsp(req.body.ip, `/setSettings?${p.toString()}`);
    res.status(result.status).json({ ok: result.ok, response: result.body });
  } catch (error) {
    res.status(500).json({ error: "Settings failed", details: error.message });
  }
});

app.post("/api/calibrate", async (req, res) => {
  try {
    const result = await callEsp(req.body.ip, `/calibrate?mode=${req.body.mode}`);
    res.status(result.status).json({ ok: result.ok, response: result.body });
  } catch (error) {
    res.status(500).json({ error: "Calibration failed", details: error.message });
  }
});

app.get("/api/sessions", (req, res) => {
  res.json(sessions);
});

app.post("/api/sessions", (req, res) => {
  const session = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...req.body
  };
  sessions.unshift(session);
  res.json(session);
});

app.get("/api/sessions.csv", (req, res) => {
  const rows = [["createdAt","durationSeconds","reps","repsPerMinute","avgFlex","maxFlex","minFlex"]];
  for (const s of sessions) {
    rows.push([s.createdAt, s.durationSeconds, s.reps, s.repsPerMinute, s.avgFlex, s.maxFlex, s.minFlex]);
  }
  const csv = rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=pneuflex_sessions.csv");
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`PneuFlex backend running on http://localhost:${PORT}`);
});
