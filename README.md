# PneuFlex

A wearable pneumatic prototype designed to assist elbow flexion during upper-limb rehabilitation. Combines soft robotics, custom electronics, and a React companion app.

## How It Works

A flex sensor measures bending while an ESP32 controls an air pump. Air pressure contracts a McKibben actuator to assist elbow movement.

Intent recognition aims to interpret flex-sensor patterns to identify attempted movement and provide assistance when needed.

## Hardware

- ESP32 and flex sensor
- McKibben actuator and 12 V pump
- MOSFET pump driver
- LiPo battery and boost converter
- Custom two-layer PCB, sleeve, and enclosure

## Software

- Embedded firmware for sensing and pump control
- Movement-intent recognition from sensor data
- React app with patient dashboard, goals, session history, and therapist views

## Recognition

Developed by a three-person team. **3rd place in Medical Innovation at the 2026 HOSA International Leadership Conference.**

## Status

Experimental prototype. Ongoing improvements focus on sensing, intent recognition, pneumatic control, and app integration. Not clinically validated.