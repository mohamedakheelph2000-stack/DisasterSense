# DisasterSense GIS Risk Visualization v1

## Overview
DisasterSense features an interactive, real-time Geographic Information System (GIS) mapping interface. This document outlines the risk visualization capabilities, highlighting the distinction between predictive models and historical ground-truth data.

## Map Layers and Controls
The GIS visualization separates data into distinct, togglable semantic layers:
- **Predictive Risk (Red marker):** On-demand or scheduled ML-based predictive assessments of risk, colored according to severity (`critical`, `high`, `moderate`, `low`).
- **Historical Events (Purple marker):** Authoritatively curated past disaster events (e.g. 2018 Floods). These are visually distinct from predictions to avoid misleading users.
- **Demo Data (Grey marker):** Mock data designed solely for system demonstrations and UI tests.

## Interactive Point-Based Assessment
The `RiskEngine` calculates risk at a *specific point*. The map supports on-the-fly, point-based predictive assessments:
1. The user clicks anywhere on the map to select a precise coordinate.
2. The user initiates a **Flood** or **Landslide** risk assessment.
3. The system executes an environmental data hydration request (using `automatic` mode via Open-Meteo).
4. A new "Predictive Risk" marker appears on the map detailing the score and environmental context.

> [!NOTE]
> Point-based assessments are currently ephemeral in the UI unless explicitly saved to the backend by associating them with a persisted location.

## Spatial Prediction Limitations
> [!IMPORTANT]
> **Continuous spatial grid prediction is currently unavailable.**

The map explicitly avoids rendering large fake radii or artificial heatmaps for predictions, adhering to strict data provenance rules. The map legend clearly informs the user that risk visualization is point-based.

## Privacy & Performance
- **Geolocation:** The map intentionally avoids silently capturing or tracking browser location coordinates.
- **Performance:** Complex geographic queries are offloaded to PostgreSQL using composite indices. React state updates are debounced and limited to explicit click interactions to maintain a fluid 60FPS UI.
