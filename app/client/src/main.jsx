import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bluetooth,
  CalendarClock,
  CheckCircle,
  Download,
  Gauge,
  Home,
  Play,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Square,
  Target,
  Timer,
  UserRound,
  Wifi
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import "./styles.css";

const API =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

const emptyStatus = {
  rawFlex: 0,
  smoothFlex: 0,
  pump: false,
  reps: 0,
  running: false,
  emergency: false,
  repInProgress: false,
  bentThreshold: 800,
  flatThreshold: 1050,
  restInterval: 2000,
  maxPumpTime: 3000,
  sessionTime: 0,
  batteryPercent: -1
};

const GRAPH_POINTS = 80;
const GRAPH_MIN = 500;
const GRAPH_MAX = 1300;

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function stableGraphValue(previousPoints, newFlex) {
  if (!previousPoints.length) return newFlex;
  const prev = previousPoints[previousPoints.length - 1].flex;
  return Math.round(prev * 0.9 + newFlex * 0.1);
}

function Button({ children, className = "", ...props }) {
  return (
    <button className={`btn ${className}`} {...props}>
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="statCard">
      <div className="statIcon">{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function ConnectModal({ open, onClose, ip, setIp, connect, connected, message }) {
  if (!open) return null;

  return (
    <div className="modalBackdrop">
      <div className="modalSheet">
        <div className="modalHandle" />
        <div className="modalHeader">
          <h2>Connect Device</h2>
          <p>Enter your ESP32 IP address from Serial Monitor.</p>
        </div>

        <label className="fieldLabel">ESP32 IP Address</label>
        <input
          className="ipInput"
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          placeholder="192.168.1.42"
        />

        <div className={`connectionCard ${connected ? "online" : ""}`}>
          <Wifi size={18} />
          <div>
            <strong>{connected ? "Device connected" : "Device not connected"}</strong>
            <span>{message}</span>
          </div>
        </div>

        <div className="modalActions">
          <Button className="primary" onClick={connect}>
            <Bluetooth size={18} />
            Connect
          </Button>
          <Button className="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  status,
  connected,
  fakeBattery,
  displaySeconds,
  startSession,
  stopSession,
  finishSession,
  command,
  openConnect
}) {
  return (
    <section className="screen">
      <header className="mobileHeader">
        <button className={`circleIcon ${connected ? "connected" : ""}`} onClick={openConnect}>
          <Bluetooth size={20} />
        </button>
        <div className="headerCenter">
          <p>PneuFlex</p>
          <h1>Dashboard</h1>
        </div>
        <div className="avatarCircle">
          <UserRound size={20} />
        </div>
      </header>

      <div className="heroCard">
        <div>
          <p className="eyebrow">Current Session</p>
          <h2>{status.reps}</h2>
          <span>assisted reps</span>
        </div>
        <div className={`statusBubble ${status.running ? "active" : ""}`}>
          {status.running ? "Running" : "Stopped"}
        </div>
      </div>

      <div className="quickStats">
        <StatCard icon={<Timer />} label="Time" value={formatTime(displaySeconds)} />
        <StatCard icon={<Gauge />} label="Flex" value={status.smoothFlex} sub={`Raw ${status.rawFlex}`} />
        <StatCard icon={<Activity />} label="Pump" value={status.pump ? "ON" : "OFF"} />
        <StatCard icon={<ShieldAlert />} label="Battery" value={`${fakeBattery}%`} />
      </div>

      <div className="actionPanel">
        {!status.running ? (
          <>
            <Button className="primary large" disabled={!connected} onClick={startSession}>
              <Play size={19} />
              Start
            </Button>
            <Button className="secondary large" disabled={!connected || status.reps === 0} onClick={finishSession}>
              <CheckCircle size={19} />
              Finish Session
            </Button>
          </>
        ) : (
          <Button className="danger large full" disabled={!connected} onClick={stopSession}>
            <Square size={19} />
            Stop
          </Button>
        )}

        <Button className="danger outline" disabled={!connected} onClick={() => command("emergency")}>
          <AlertTriangle size={18} />
          Emergency
        </Button>
        <Button className="secondary outline" disabled={!connected} onClick={() => command("resetEmergency")}>
          <RotateCcw size={18} />
          Reset
        </Button>
      </div>

      {status.emergency && (
        <div className="alertCard">
          <AlertTriangle size={20} />
          Emergency stop is active. Reset before starting again.
        </div>
      )}
    </section>
  );
}

function Goals({ status }) {
  const dailyGoal = 200;
  const weeklyGoal = 1200;
  const dailyPct = Math.min(100, Math.round((status.reps / dailyGoal) * 100));
  const weeklyPct = 42;

  return (
    <section className="screen">
      <div className="pageTitle">
        <Target size={24} />
        <div>
          <p>Rehab Plan</p>
          <h1>Goals</h1>
        </div>
      </div>

      <div className="goalCard">
        <div className="goalTop">
          <span>Daily Rep Target</span>
          <strong>{status.reps}/{dailyGoal}</strong>
        </div>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${dailyPct}%` }} />
        </div>
        <p>{dailyPct}% completed today</p>
      </div>

      <div className="goalCard">
        <div className="goalTop">
          <span>Weekly Progress</span>
          <strong>{weeklyPct}%</strong>
        </div>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${weeklyPct}%` }} />
        </div>
        <p>Keep sessions consistent for better recovery tracking.</p>
      </div>

      <div className="goalCard compact">
        <CalendarClock size={24} />
        <div>
          <h3>Recommended Session</h3>
          <p>20–30 minutes, controlled reps, stop if discomfort occurs.</p>
        </div>
      </div>
    </section>
  );
}

function PastSessions({ sessions }) {
  return (
    <section className="screen">
      <div className="pageTitle">
        <BarChart3 size={24} />
        <div>
          <p>Saved Logs</p>
          <h1>Past Sessions</h1>
        </div>
      </div>

      <a className="downloadBtn" href={`${API}/api/sessions.csv`}>
        <Download size={18} />
        Download CSV
      </a>

      <div className="sessionList">
        {sessions.length === 0 && (
          <div className="emptyState">No sessions yet. Finish and log your first session.</div>
        )}

        {sessions.map((session) => (
          <div className="sessionItem" key={session.id}>
            <div>
              <strong>{new Date(session.createdAt).toLocaleString()}</strong>
              <span>{session.reps} reps · {formatTime(session.durationSeconds)} · {session.repsPerMinute} reps/min</span>
            </div>
            <div className="sessionScore">{session.avgFlex}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PatientSettings({ settings, setSettings, saveSettings, calibrate, connected }) {
  return (
    <section className="screen">
      <div className="pageTitle">
        <Settings size={24} />
        <div>
          <p>Device Setup</p>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="settingsList">
        {[
          ["bentThreshold", "Bent threshold"],
          ["flatThreshold", "Flat threshold"],
          ["restInterval", "Rest interval ms"],
          ["maxPumpTime", "Max pump time ms"]
        ].map(([key, label]) => (
          <label className="settingRow" key={key}>
            <span>{label}</span>
            <input
              type="number"
              value={settings[key]}
              onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>

      <Button className="primary full" disabled={!connected} onClick={saveSettings}>
        <Save size={18} />
        Save Settings
      </Button>

      <div className="calibrationBox">
        <h3>Calibration Wizard</h3>
        <p>Capture flat, capture bent, then apply calibration.</p>
        <div className="calibrationActions">
          <Button className="secondary" disabled={!connected} onClick={() => calibrate("flat")}>Capture Flat</Button>
          <Button className="secondary" disabled={!connected} onClick={() => calibrate("bent")}>Capture Bent</Button>
          <Button className="primary" disabled={!connected} onClick={() => calibrate("apply")}>Apply</Button>
        </div>
      </div>
    </section>
  );
}

function BottomNav({ activeTab, setActiveTab }) {
  const tabs = [
    ["dashboard", "Dashboard", Home],
    ["goals", "Goals", Target],
    ["sessions", "Sessions", BarChart3],
    ["settings", "Settings", Settings]
  ];

  return (
    <nav className="bottomNav">
      {tabs.map(([id, label, Icon]) => (
        <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
          <Icon size={21} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}


function TherapistDashboard({ status, points, connected, ip, setIp, connect, message }) {
  const flexValues = points.length ? points.map((point) => point.actualFlex || point.flex) : [status.smoothFlex || 0];
  const minFlex = Math.min(...flexValues);
  const maxFlex = Math.max(...flexValues);
  const avgFlex = Math.round(flexValues.reduce((sum, value) => sum + value, 0) / flexValues.length);
  const estimatedRom = Math.max(0, maxFlex - minFlex);
  const repsPerMinute = status.sessionTime > 0 ? ((status.reps / status.sessionTime) * 60).toFixed(1) : "0.0";
  const qualityScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgFlex - 950) / 6)));
  const completionScore = Math.min(100, Math.round((status.reps / 200) * 100));
  const safetyText = status.emergency ? "Emergency stop active" : status.pump ? "Actuator currently firing" : "No active safety event";

  return (
    <main className="therapistShell">
      <header className="therapistHeader clinical">
        <div>
          <p>Therapist Access</p>
          <h1>PneuFlex Clinical Dashboard</h1>
          <span>Remote upper-limb rehabilitation monitoring</span>
        </div>
        <div className={`therapistStatus ${connected ? "online" : ""}`}>{connected ? "Live Device" : "Offline"}</div>
      </header>

      <section className="therapistConnect">
        <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="ESP32 IP" />
        <Button className="primary" onClick={connect}>Connect Device</Button>
      </section>
      <p className="therapistMessage">{message}</p>

      <section className="clinicalLayout">
        <aside className="patientPanel">
          <div className="patientAvatar">PB</div>
          <h2>Patient Profile</h2>
          <div className="profileRows">
            <div><span>Name</span><strong>Demo Patient</strong></div>
            <div><span>Protocol</span><strong>Elbow Flexion Assist</strong></div>
            <div><span>Target</span><strong>200 reps/session</strong></div>
            <div><span>Device</span><strong>ESP32 PneuFlex Sleeve</strong></div>
            <div><span>Risk State</span><strong>{status.emergency ? "Locked" : "Normal"}</strong></div>
          </div>
        </aside>

        <section className="clinicalMain">
          <div className="clinicalCards">
            <StatCard icon={<Activity />} label="Session Status" value={status.running ? "Running" : "Stopped"} />
            <StatCard icon={<Timer />} label="Duration" value={formatTime(status.sessionTime)} />
            <StatCard icon={<Gauge />} label="Reps/min" value={repsPerMinute} />
            <StatCard icon={<ShieldAlert />} label="Safety" value={status.emergency ? "LOCKED" : "Clear"} />
          </div>

          <div className="chartCard clinicalChart">
            <div className="chartHeader">
              <div>
                <h2>Live Flexion Signal</h2>
                <p>Smoothed flex sensor trend with flat and bent thresholds.</p>
              </div>
              <div className="liveBadge">{connected ? "Live" : "No Signal"}</div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="index" type="number" domain={["dataMin", "dataMax"]} hide />
                <YAxis domain={[GRAPH_MIN, GRAPH_MAX]} allowDataOverflow={false} />
                <Tooltip formatter={(value, name) => [value, name === "flex" ? "Stable flex" : name]} />
                <ReferenceLine y={status.bentThreshold} stroke="#3B82F6" label={{ value: "Bent", fill: "#3B82F6" }} />
                <ReferenceLine y={status.flatThreshold} stroke="#60A5FA" label={{ value: "Flat", fill: "#60A5FA" }} />
                <Line type="monotone" dataKey="flex" dot={false} activeDot={false} strokeWidth={3} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </section>

      <section className="clinicalBottomGrid">
        <div className="clinicalBox">
          <h2>Movement Quality</h2>
          <div className="scoreRing">{qualityScore}%</div>
          <p>Estimated from smoothness and average flexion stability. Higher means more consistent movement.</p>
        </div>

        <div className="clinicalBox">
          <h2>Range Metrics</h2>
          <div className="metricRows">
            <div><span>Min flex</span><strong>{minFlex}</strong></div>
            <div><span>Max flex</span><strong>{maxFlex}</strong></div>
            <div><span>Estimated ROM delta</span><strong>{estimatedRom}</strong></div>
            <div><span>Average flex</span><strong>{avgFlex}</strong></div>
          </div>
        </div>

        <div className="clinicalBox">
          <h2>Adherence</h2>
          <div className="progressTrack clinicalProgress">
            <div className="progressFill" style={{ width: `${completionScore}%` }} />
          </div>
          <p>{status.reps}/200 target reps completed this session.</p>
          <strong>{completionScore}% session completion</strong>
        </div>

        <div className="clinicalBox">
          <h2>Alerts & Notes</h2>
          <div className={status.emergency ? "clinicalAlert dangerAlert" : "clinicalAlert"}>
            <AlertTriangle size={18} />
            {safetyText}
          </div>
          <textarea placeholder="Therapist notes: pain, fatigue, compensation, session observations..." />
        </div>
      </section>

      <section className="clinicalReport">
        <div>
          <h2>Clinical Summary</h2>
          <p>
            Patient completed {status.reps} reps with an estimated movement quality score of {qualityScore}%.
            Current average flex signal is {avgFlex}, with a ROM delta of {estimatedRom}.
          </p>
        </div>
        <div className="reportActions">
          <a href={`${API}/api/sessions.csv`} className="downloadBtn">Export CSV</a>
          <button className="btn secondary">Generate Report</button>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [ip, setIp] = useState(localStorage.getItem("pneuflex-ip") || "");
  const [status, setStatus] = useState(emptyStatus);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Not connected.");
  const [points, setPoints] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [connectOpen, setConnectOpen] = useState(false);
  const [showLogPopup, setShowLogPopup] = useState(false);
  const [pendingSummary, setPendingSummary] = useState(null);
  const [uiSessionSeconds, setUiSessionSeconds] = useState(0);
  const [fakeBattery, setFakeBattery] = useState(83);
  const [settings, setSettings] = useState({
    bentThreshold: 800,
    flatThreshold: 1050,
    restInterval: 2000,
    maxPumpTime: 3000
  });

  const sessionPoints = useRef([]);
  const timerRef = useRef(null);
  const sessionStartMs = useRef(null);
  const savedSessionSeconds = useRef(0);

  const isTherapistRoute = window.location.pathname === "/therapist";

  async function loadSessions() {
    try {
      const response = await fetch(`${API}/api/sessions`);
      setSessions(await response.json());
    } catch {
      setSessions([]);
    }
  }

  async function fetchStatus(targetIp = ip) {
    if (!targetIp) return;

    try {
      const response = await fetch(`${API}/api/status?ip=${encodeURIComponent(targetIp)}`);
      if (!response.ok) throw new Error("ESP32 did not respond");

      const data = { ...emptyStatus, ...(await response.json()) };
      setStatus(data);
      setConnected(true);
      setMessage("Device connected.");

      setPoints((previous) => {
        const chartFlex = stableGraphValue(previous, data.smoothFlex);
        const nextIndex = previous.length ? previous[previous.length - 1].index + 1 : 0;
        const point = {
          index: nextIndex,
          flex: chartFlex,
          actualFlex: data.smoothFlex,
          raw: data.rawFlex,
          pump: data.pump ? 1 : 0,
          reps: data.reps
        };
        return [...previous, point].slice(-GRAPH_POINTS);
      });

      if (data.running) {
        sessionPoints.current.push({ flex: data.smoothFlex, raw: data.rawFlex });
      }
    } catch {
      setConnected(false);
      setMessage("Could not reach ESP32.");
    }
  }

  function connect() {
    const cleaned = ip.replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
    setIp(cleaned);
    localStorage.setItem("pneuflex-ip", cleaned);
    fetchStatus(cleaned);
  }

  async function command(commandName) {
    try {
      const response = await fetch(`${API}/api/command/${commandName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip })
      });

      if (!response.ok) throw new Error("Command failed");
      setMessage(`${commandName} sent.`);
      setTimeout(() => fetchStatus(), 150);
    } catch {
      setMessage(`${commandName} failed.`);
    }
  }

  function beginTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    sessionStartMs.current = Date.now();
    savedSessionSeconds.current = 0;
    setUiSessionSeconds(0);

    timerRef.current = setInterval(() => {
      const seconds = Math.max(1, Math.floor((Date.now() - sessionStartMs.current) / 1000));
      savedSessionSeconds.current = seconds;
      setUiSessionSeconds(seconds);
    }, 250);
  }

  function stopTimer() {
    if (sessionStartMs.current) {
      const seconds = Math.max(1, Math.floor((Date.now() - sessionStartMs.current) / 1000));
      savedSessionSeconds.current = seconds;
      setUiSessionSeconds(seconds);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startSession() {
    sessionPoints.current = [];
    savedSessionSeconds.current = 0;
    setUiSessionSeconds(0);
    setPendingSummary(null);
    setShowLogPopup(false);
    beginTimer();
    await command("start");
  }

  async function stopSession() {
    stopTimer();
    await command("stop");
  }

  function makeSessionSummary() {
    const values = sessionPoints.current.length ? sessionPoints.current.map((p) => p.flex) : [status.smoothFlex];
    const durationSeconds = Math.max(1, savedSessionSeconds.current || uiSessionSeconds || status.sessionTime || 0);
    const reps = status.reps || 0;

    return {
      durationSeconds,
      reps,
      repsPerMinute: Number(((reps / durationSeconds) * 60).toFixed(2)),
      avgFlex: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      maxFlex: Math.max(...values),
      minFlex: Math.min(...values)
    };
  }

  function finishSession() {
    stopTimer();
    setPendingSummary(makeSessionSummary());
    setShowLogPopup(true);
  }

  async function logSession() {
    if (!pendingSummary) return;

    await fetch(`${API}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingSummary)
    });

    setShowLogPopup(false);
    setPendingSummary(null);
    await loadSessions();
    setActiveTab("sessions");
    setMessage("Session logged.");
  }

  async function saveSettings() {
    try {
      const response = await fetch(`${API}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, ...settings })
      });
      if (!response.ok) throw new Error("Settings failed");
      setMessage("Settings saved.");
      setTimeout(() => fetchStatus(), 150);
    } catch {
      setMessage("Could not save settings.");
    }
  }

  async function calibrate(mode) {
    try {
      const response = await fetch(`${API}/api/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, mode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error("Calibration failed");
      setMessage(data.response || "Calibration updated.");
      setTimeout(() => fetchStatus(), 150);
    } catch {
      setMessage("Calibration failed.");
    }
  }

  useEffect(() => {
    loadSessions();

    const batteryTimer = setInterval(() => {
      setFakeBattery((current) => Math.max(0, current - 1));
    }, 180000);

    return () => {
      clearInterval(batteryTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!connected || !ip) return;
    const id = setInterval(() => fetchStatus(), 500);
    return () => clearInterval(id);
  }, [connected, ip]);

  useEffect(() => {
    setSettings({
      bentThreshold: status.bentThreshold,
      flatThreshold: status.flatThreshold,
      restInterval: status.restInterval,
      maxPumpTime: status.maxPumpTime
    });
  }, [status.bentThreshold, status.flatThreshold, status.restInterval, status.maxPumpTime]);

  const displaySeconds = status.running ? uiSessionSeconds : (savedSessionSeconds.current || uiSessionSeconds || status.sessionTime);

  if (isTherapistRoute) {
    return (
      <TherapistDashboard
        status={status}
        points={points}
        connected={connected}
        ip={ip}
        setIp={setIp}
        connect={connect}
        message={message}
      />
    );
  }

  return (
    <main className="phoneShell">
      {activeTab === "dashboard" && (
        <Dashboard
          status={status}
          connected={connected}
          fakeBattery={fakeBattery}
          displaySeconds={displaySeconds}
          startSession={startSession}
          stopSession={stopSession}
          finishSession={finishSession}
          command={command}
          openConnect={() => setConnectOpen(true)}
        />
      )}

      {activeTab === "goals" && <Goals status={status} />}
      {activeTab === "sessions" && <PastSessions sessions={sessions} />}
      {activeTab === "settings" && (
        <PatientSettings
          settings={settings}
          setSettings={setSettings}
          saveSettings={saveSettings}
          calibrate={calibrate}
          connected={connected}
        />
      )}

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <ConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        ip={ip}
        setIp={setIp}
        connect={connect}
        connected={connected}
        message={message}
      />

      {showLogPopup && pendingSummary && (
        <div className="modalBackdrop">
          <div className="modalSheet">
            <div className="modalHandle" />
            <h2>Log Session?</h2>
            <p className="modalSub">Save this completed session to Past Sessions.</p>

            <div className="summaryGrid">
              <StatCard label="Reps" value={pendingSummary.reps} icon={<Activity />} />
              <StatCard label="Duration" value={formatTime(pendingSummary.durationSeconds)} icon={<Timer />} />
              <StatCard label="Avg Flex" value={pendingSummary.avgFlex} icon={<Gauge />} />
              <StatCard label="Reps/min" value={pendingSummary.repsPerMinute} icon={<BarChart3 />} />
            </div>

            <div className="modalActions">
              <Button className="primary" onClick={logSession}>Log Session</Button>
              <Button className="secondary" onClick={() => setShowLogPopup(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
