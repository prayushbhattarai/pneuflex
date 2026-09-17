#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 6445
#define FLEX_PIN 34
#define PUMP_PIN 25

#define BATTERY_SENSE_ENABLED false
#define BATTERY_PIN 35

const char* ssid = "Prayush";
const char* password = "hellohello";

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WebServer server(80);

int rawFlex = 0;
int smoothFlex = 1100;
int reps = 0;
int bentThreshold = 800;
int flatThreshold = 1050;
unsigned long maxPumpOnTime = 3000;
unsigned long restInterval = 2000;

bool sessionRunning = false;
bool pumpOn = false;
bool emergencyStop = false;
bool repInProgress = false;

unsigned long sessionStartTime = 0;
unsigned long pumpStartTime = 0;
unsigned long lastRestTime = 0;
unsigned long lastDotUpdate = 0;
unsigned long lastDisplayUpdate = 0;

int dotCount = 1;
int calibrationFlat = 1100;
int calibrationBent = 800;

void cors() { server.sendHeader("Access-Control-Allow-Origin", "*"); }

void showMessage(String line1, String line2 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 18);
  display.println(line1);
  if (line2 != "") {
    display.setCursor(0, 42);
    display.println(line2);
  }
  display.display();
}

void pumpOff() {
  digitalWrite(PUMP_PIN, LOW);
  pumpOn = false;
}

bool pumpOnSafe() {
  if (!sessionRunning) return false;
  if (emergencyStop) return false;
  if (pumpOn) return false;
  if (millis() - lastRestTime < restInterval) return false;

  digitalWrite(PUMP_PIN, HIGH);
  pumpOn = true;
  pumpStartTime = millis();
  return true;
}

void updateFlex() {
  rawFlex = analogRead(FLEX_PIN);
  smoothFlex = (smoothFlex * 9 + rawFlex) / 10;
}

int getBatteryPercent() {
  if (!BATTERY_SENSE_ENABLED) return -1;
  int adc = analogRead(BATTERY_PIN);
  float adcVoltage = (adc / 4095.0) * 3.3;
  float batteryVoltage = adcVoltage * 2.0;
  int percent = (int)(((batteryVoltage - 3.2) / (4.2 - 3.2)) * 100.0);
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  return percent;
}

void updateRepLogic() {
  updateFlex();

  if (!repInProgress && smoothFlex < bentThreshold) {
    if (pumpOnSafe()) {
      repInProgress = true;
    }
  }

  if (repInProgress && smoothFlex > flatThreshold) {
    reps++;
    repInProgress = false;
    pumpOff();
    lastRestTime = millis();
  }
}

void updateOLED() {
  if (emergencyStop) {
    showMessage("EMERGENCY", "STOP");
    return;
  }

  if (!sessionRunning) {
    if (millis() - lastDisplayUpdate >= 300) {
      lastDisplayUpdate = millis();
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setTextSize(2);
      display.setCursor(5, 12);
      display.println("Hi");
      display.setCursor(5, 34);
      display.println("Prayush");
      display.setTextSize(1);
      display.setCursor(0, 56);
      display.print("Flex:");
      display.print(smoothFlex);
      display.print(" Reps:");
      display.print(reps);
      display.display();
    }
    return;
  }

  if (repInProgress) {
    if (millis() - lastDotUpdate >= 500) {
      lastDotUpdate = millis();
      dotCount++;
      if (dotCount > 3) dotCount = 1;
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setTextSize(2);
      display.setCursor(0, 12);
      display.print("Activating");
      for (int i = 0; i < dotCount; i++) display.print(".");
      display.setTextSize(1);
      display.setCursor(0, 48);
      display.print("Reps:");
      display.print(reps);
      display.print(" Flex:");
      display.print(smoothFlex);
      display.display();
    }
  } else {
    if (millis() - lastDisplayUpdate >= 300) {
      lastDisplayUpdate = millis();
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setTextSize(2);
      display.setCursor(5, 12);
      display.println("Ready");
      display.setTextSize(1);
      display.setCursor(0, 42);
      display.print("Reps:");
      display.print(reps);
      display.setCursor(0, 54);
      display.print("Flex:");
      display.print(smoothFlex);
      display.display();
    }
  }
}

void handleStatus() {
  String json = "{";
  json += "\"rawFlex\":" + String(rawFlex) + ",";
  json += "\"smoothFlex\":" + String(smoothFlex) + ",";
  json += "\"pump\":" + String(pumpOn ? "true" : "false") + ",";
  json += "\"reps\":" + String(reps) + ",";
  json += "\"running\":" + String(sessionRunning ? "true" : "false") + ",";
  json += "\"emergency\":" + String(emergencyStop ? "true" : "false") + ",";
  json += "\"repInProgress\":" + String(repInProgress ? "true" : "false") + ",";
  json += "\"bentThreshold\":" + String(bentThreshold) + ",";
  json += "\"flatThreshold\":" + String(flatThreshold) + ",";
  json += "\"restInterval\":" + String(restInterval) + ",";
  json += "\"maxPumpTime\":" + String(maxPumpOnTime) + ",";
  json += "\"batteryPercent\":" + String(getBatteryPercent()) + ",";
  json += "\"sessionTime\":" + String(sessionRunning ? (millis() - sessionStartTime) / 1000 : 0);
  json += "}";
  cors();
  server.send(200, "application/json", json);
}

void handleStart() {
  sessionRunning = true;
  emergencyStop = false;
  reps = 0;
  repInProgress = false;
  pumpOff();
  sessionStartTime = millis();
  lastRestTime = 0;
  showMessage("Session", "Started");
  cors();
  server.send(200, "text/plain", "Session started");
}

void handleStop() {
  sessionRunning = false;
  repInProgress = false;
  pumpOff();
  showMessage("Session", "Stopped");
  cors();
  server.send(200, "text/plain", "Session stopped");
}

void handleEmergency() {
  emergencyStop = true;
  sessionRunning = false;
  repInProgress = false;
  pumpOff();
  showMessage("EMERGENCY", "STOP");
  cors();
  server.send(200, "text/plain", "Emergency stop activated");
}

void handleResetEmergency() {
  emergencyStop = false;
  sessionRunning = false;
  repInProgress = false;
  pumpOff();
  showMessage("Emergency", "Reset");
  cors();
  server.send(200, "text/plain", "Emergency reset");
}

void handleSetSettings() {
  if (server.hasArg("bent")) bentThreshold = server.arg("bent").toInt();
  if (server.hasArg("flat")) flatThreshold = server.arg("flat").toInt();
  if (server.hasArg("rest")) restInterval = server.arg("rest").toInt();
  if (server.hasArg("maxPump")) maxPumpOnTime = server.arg("maxPump").toInt();
  cors();
  server.send(200, "text/plain", "Settings updated");
}

void handleCalibrate() {
  updateFlex();
  String mode = server.arg("mode");

  if (mode == "flat") {
    calibrationFlat = smoothFlex;
    cors();
    server.send(200, "text/plain", "Flat captured: " + String(calibrationFlat));
    return;
  }

  if (mode == "bent") {
    calibrationBent = smoothFlex;
    cors();
    server.send(200, "text/plain", "Bent captured: " + String(calibrationBent));
    return;
  }

  if (mode == "apply") {
    bentThreshold = calibrationBent + 50;
    flatThreshold = calibrationFlat - 50;
    if (bentThreshold >= flatThreshold) {
      bentThreshold = calibrationBent;
      flatThreshold = calibrationFlat;
    }
    cors();
    server.send(200, "text/plain", "Calibration applied. Bent=" + String(bentThreshold) + " Flat=" + String(flatThreshold));
    return;
  }

  cors();
  server.send(400, "text/plain", "Invalid calibration mode");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin(21, 22);
  pinMode(FLEX_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  pumpOff();

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED FAILED");
    while (true);
  }

  display.ssd1306_command(SSD1306_SETCONTRAST);
  display.ssd1306_command(0xFF);
  showMessage("Connecting", "WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi FAILED");
    showMessage("WiFi", "FAILED");
  } else {
    Serial.println("WiFi connected");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    showMessage("IP:", WiFi.localIP().toString());
  }

  server.on("/status", handleStatus);
  server.on("/start", handleStart);
  server.on("/stop", handleStop);
  server.on("/emergency", handleEmergency);
  server.on("/resetEmergency", handleResetEmergency);
  server.on("/setSettings", handleSetSettings);
  server.on("/calibrate", handleCalibrate);

  server.begin();
  delay(3000);
  showMessage("Hi", "Prayush");
}

void loop() {
  server.handleClient();
  updateFlex();

  if (pumpOn && millis() - pumpStartTime >= maxPumpOnTime) {
    pumpOff();
    lastRestTime = millis();
  }

  if (sessionRunning && !emergencyStop) {
    updateRepLogic();
  } else {
    pumpOff();
  }

  updateOLED();
  delay(20);
}
