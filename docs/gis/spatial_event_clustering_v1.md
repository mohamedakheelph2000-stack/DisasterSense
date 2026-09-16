# Spatial Event Clustering (v1)

## Overview
The Spatial Event Clustering layer provides Regional Situation Intelligence by grouping individual risk assessments (or historical events) into cohesive spatial-temporal clusters. This enables operators to identify concentrations of disaster risk or historical activity without falsely inflating individual data points into "confirmed disasters."

## Architecture & Algorithm
The clustering engine uses a greedy agglomerative algorithm performed entirely in Python after a constrained SQL query fetches relevant data.

### Configuration Thresholds
- **Spatial Threshold (`CLUSTER_SPATIAL_THRESHOLD_KM`)**: 10.0 km. Records within this Haversine distance of a cluster centroid are evaluated for inclusion.
- **Temporal Threshold (`CLUSTER_TEMPORAL_THRESHOLD_HOURS`)**: 24.0 hours. Records must occur within this time window relative to the cluster's most recent timestamp.

### Clustering Strategy
1. **Filtering**: The database is queried for `DisasterEvent`s matching the requested `hazard_type`, `record_type`, `time_range`, and bounding box.
2. **Iteration**: For each record, the algorithm checks proximity (both spatial and temporal) to existing clusters.
3. **Merge vs Create**: If a record falls within both thresholds of an existing cluster, it is added. The cluster's centroid is updated (running average), and its temporal bounds are extended. Otherwise, a new cluster is initialized.

## Core Rules & Semantics

### Hazard Separation
**Flood and Landslide data never mix.** A cluster is exclusively composed of a single hazard type. 

### Record-Type Separation
**PREDICTIVE, HISTORICAL, and DEMO records never mix.** 
- **Predictive Cluster**: "Multiple predictive assessments are spatially/temporally concentrated." It does NOT mean a disaster is actively occurring.
- **Historical Cluster**: Concentrated historical/observed events.
- **Demo Cluster**: Isolated for testing and UI demonstration.

### Quality Indicators
To prevent weak signals from causing false alarms, clusters expose deterministic quality states based on member counts:
- `WELL_SUPPORTED`: 10+ members
- `MODERATE_DATA`: 3 to 9 members
- `LOW_DATA`: 1 or 2 members

These are operational indicators, **not statistical confidence intervals.**

### Traceability
Every cluster maintains a `provenance` array derived from its member records, ensuring users can trace the origin of the underlying risk assessments. The cluster centroid and exact membership count are always exposed via the API.

## Performance
By bounding the initial SQL query with viewport coordinates (`min_lat`, `max_lon`) and strict time windows, the data volume transferred to Python remains well within memory limits. The O(N*K) complexity of the greedy clustering is highly performant for regional operational dashboards.

## Visual Representation
On the frontend mapping client, clusters are represented strictly as bounded centroid markers rather than literal geometric boundaries (e.g. 10 km circles). This design choice prevents users from falsely interpreting the threshold distance as the exact physical extent of a hazard event.

## Scientific Limitations
> **CRITICAL DISCLAIMER**
> These thresholds are operational clustering parameters and are not scientifically validated disaster boundaries. A "Critical" predictive cluster represents a high density of algorithmic risk signals, not absolute proof of emergency. Automated external alerting based solely on these clusters is explicitly forbidden to prevent panic and alarm fatigue.
