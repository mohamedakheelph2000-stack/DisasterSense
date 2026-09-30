"""
Comprehensive end-to-end verification script for DisasterSense.
Tests all features across backend, ML pipelines, and API services.
"""

import sys
import time
import requests

BASE_URL = "http://localhost:8000/api/v1"

def run_all_checks():
    passed = 0
    failed = 0

    def check(name, condition, extra=""):
        nonlocal passed, failed
        if condition:
            print(f"[PASS] {name} {extra}")
            passed += 1
        else:
            print(f"[FAIL] {name} {extra}")
            failed += 1

    print("=" * 60)
    print("STARTING DISASTERSENSE FULL SYSTEM INTEGRATION AUDIT")
    print("=" * 60)

    # 1. Health Endpoint
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        check("Health Check", r.status_code == 200 and r.json().get("db_reachable") is True, f"(status={r.status_code}, db={r.json().get('db_reachable')})")
    except Exception as e:
        check("Health Check", False, str(e))

    # 2. User Authentication Flow (Citizen, Responder, Admin)
    ts = int(time.time())
    admin_email = f"admin_{ts}@example.com"
    admin_pw = "Password123!"

    # Register Admin
    try:
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "email": admin_email,
            "plain_password": admin_pw,
            "full_name": "Auditor Admin",
            "role": "admin"
        })
        check("Register Admin", r.status_code == 201, f"(id={r.json().get('id')})")
    except Exception as e:
        check("Register Admin", False, str(e))

    # Login Admin
    admin_token = None
    try:
        r = requests.post(f"{BASE_URL}/auth/login", data={"username": admin_email, "password": admin_pw})
        admin_token = r.json().get("access_token")
        check("Login Admin", r.status_code == 200 and admin_token is not None)
    except Exception as e:
        check("Login Admin", False, str(e))

    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Auth Me
    try:
        r = requests.get(f"{BASE_URL}/auth/me", headers=headers_admin)
        check("Auth Me (/auth/me)", r.status_code == 200 and r.json().get("email") == admin_email)
    except Exception as e:
        check("Auth Me (/auth/me)", False, str(e))

    # 3. System Telemetry (Admin Only)
    try:
        r = requests.get(f"{BASE_URL}/system/status", headers=headers_admin)
        data = r.json()
        check("System Status (/system/status)", r.status_code == 200 and data.get("core_api") == "OPERATIONAL" and data.get("database") == "OPERATIONAL")
    except Exception as e:
        check("System Status (/system/status)", False, str(e))

    # 4. Locations CRUD
    loc_id = None
    try:
        r = requests.post(f"{BASE_URL}/locations", json={
            "name": f"Audit Station {ts}",
            "description": "Automated validation point in Wayanad, Kerala",
            "latitude": 11.685,
            "longitude": 76.132,
            "elevation_m": 850.0,
            "district": "Wayanad",
            "state": "Kerala",
            "country": "India"
        }, headers=headers_admin)
        loc_id = r.json().get("id")
        check("Create Location (/locations)", r.status_code == 201 and loc_id is not None)
    except Exception as e:
        check("Create Location (/locations)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/locations", headers=headers_admin)
        check("List Locations (/locations)", r.status_code == 200 and r.json().get("total") >= 1)
    except Exception as e:
        check("List Locations (/locations)", False, str(e))

    # 5. Environment Provider (Open-Meteo live integration)
    try:
        r = requests.get(f"{BASE_URL}/environment/current?latitude=11.685&longitude=76.132", headers=headers_admin)
        env_data = r.json()
        check("Live Environment Data (/environment/current)", r.status_code == 200 and "temperature" in env_data and "rainfall_24h" in env_data)
    except Exception as e:
        check("Live Environment Data (/environment/current)", False, str(e))

    # 6. ML Status & Real Models Validation
    try:
        r = requests.get(f"{BASE_URL}/ml/status", headers=headers_admin)
        ml_stat = r.json()
        flood_ok = ml_stat.get("flood", {}).get("loaded") is True and ml_stat.get("flood", {}).get("is_real") is True
        landslide_ok = ml_stat.get("landslide", {}).get("loaded") is True and ml_stat.get("landslide", {}).get("is_real") is True
        check("ML Status Real Models Loaded (/ml/status)", r.status_code == 200 and flood_ok and landslide_ok, f"(flood={ml_stat.get('flood',{}).get('model_name')}, landslide={ml_stat.get('landslide',{}).get('model_name')})")
    except Exception as e:
        check("ML Status Real Models Loaded (/ml/status)", False, str(e))

    # ML Evaluation & Experiments
    try:
        r = requests.get(f"{BASE_URL}/ml/evaluation/flood", headers=headers_admin)
        check("ML Evaluation Flood (/ml/evaluation/flood)", r.status_code == 200 and "feature_importance" in r.json())
    except Exception as e:
        check("ML Evaluation Flood (/ml/evaluation/flood)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/ml/evaluation/landslide", headers=headers_admin)
        check("ML Evaluation Landslide (/ml/evaluation/landslide)", r.status_code == 200 and "metrics" in r.json())
    except Exception as e:
        check("ML Evaluation Landslide (/ml/evaluation/landslide)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/ml/experiments/flood", headers=headers_admin)
        check("ML Experiments Flood (/ml/experiments/flood)", r.status_code == 200 and len(r.json().get("models", [])) > 0)
    except Exception as e:
        check("ML Experiments Flood (/ml/experiments/flood)", False, str(e))

    # 7. Live Risk Assessments (ML Inference Engine)
    # 7a. Flood Assessment (Manual Mode)
    flood_event_id = None
    try:
        r = requests.post(f"{BASE_URL}/risk-assessments/flood?mode=manual", json={
            "location_id": loc_id,
            "rainfall_mm_24h": 180.0,
            "rainfall_intensity_mm_h": 45.0,
            "elevation_m": 40.0,
            "soil_saturation_pct": 88.0,
            "drainage_capacity_score": 2.0,
            "distance_to_river_m": 120.0
        }, headers=headers_admin)
        res = r.json()
        flood_event_id = res.get("event_id")
        check("Flood Risk Assessment Manual (/risk-assessments/flood)", r.status_code == 200 and res.get("risk_score") is not None and flood_event_id is not None, f"(score={res.get('risk_score')}, level={res.get('risk_level')})")
    except Exception as e:
        check("Flood Risk Assessment Manual (/risk-assessments/flood)", False, str(e))

    # 7b. Flood Assessment (Automatic Mode - OpenMeteo)
    try:
        r = requests.post(f"{BASE_URL}/risk-assessments/flood?mode=automatic", json={
            "latitude": 11.685,
            "longitude": 76.132
        }, headers=headers_admin)
        res = r.json()
        check("Flood Risk Assessment Automatic (/risk-assessments/flood?mode=automatic)", r.status_code == 200 and res.get("risk_score") is not None, f"(input_mode={res.get('input_mode')})")
    except Exception as e:
        check("Flood Risk Assessment Automatic (/risk-assessments/flood?mode=automatic)", False, str(e))

    # 7c. Landslide Assessment (Manual Mode)
    landslide_event_id = None
    try:
        r = requests.post(f"{BASE_URL}/risk-assessments/landslide?mode=manual", json={
            "location_id": loc_id,
            "rainfall_mm_24h": 220.0,
            "slope_deg": 42.0,
            "soil_moisture_pct": 92.0,
            "geological_stability_index": 2.0,
            "vegetation_cover_pct": 20.0,
            "road_cut_proximity_m": 40.0
        }, headers=headers_admin)
        res = r.json()
        landslide_event_id = res.get("event_id")
        check("Landslide Risk Assessment Manual (/risk-assessments/landslide)", r.status_code == 200 and res.get("risk_score") is not None and landslide_event_id is not None, f"(score={res.get('risk_score')}, level={res.get('risk_level')})")
    except Exception as e:
        check("Landslide Risk Assessment Manual (/risk-assessments/landslide)", False, str(e))

    # 8. Disaster Events Management
    try:
        r = requests.get(f"{BASE_URL}/disaster-events", headers=headers_admin)
        events_total = r.json().get("total", 0)
        check("List Disaster Events (/disaster-events)", r.status_code == 200 and events_total >= 2)
    except Exception as e:
        check("List Disaster Events (/disaster-events)", False, str(e))

    # 9. Alerts Lifecycle (Create -> Acknowledge -> Respond -> Note -> Resolve)
    alert_id = None
    try:
        r = requests.post(f"{BASE_URL}/alerts", json={
            "location_id": loc_id,
            "disaster_event_id": flood_event_id,
            "title": "CRITICAL: Torrential Rain and Flash Flood Risk",
            "message": "Water levels rising rapidly in Wayanad watershed.",
            "status": "active"
        }, headers=headers_admin)
        alert_id = r.json().get("id")
        check("Create Alert (/alerts)", r.status_code == 201 and alert_id is not None)
    except Exception as e:
        check("Create Alert (/alerts)", False, str(e))

    if alert_id:
        try:
            r = requests.post(f"{BASE_URL}/alerts/{alert_id}/acknowledge", json={
                "acknowledged_by": "Senior Responder"
            }, headers=headers_admin)
            check("Acknowledge Alert (/alerts/{id}/acknowledge)", r.status_code == 200 and r.json().get("status") == "acknowledged")
        except Exception as e:
            check("Acknowledge Alert (/alerts/{id}/acknowledge)", False, str(e))

        try:
            r = requests.post(f"{BASE_URL}/alerts/{alert_id}/respond", json={
                "actor": admin_email,
                "note": "Rescue boats deployed to sector 4."
            }, headers=headers_admin)
            check("Respond to Alert (/alerts/{id}/respond)", r.status_code == 200 and r.json().get("status") == "response_in_progress")
        except Exception as e:
            check("Respond to Alert (/alerts/{id}/respond)", False, str(e))

        try:
            r = requests.post(f"{BASE_URL}/alerts/{alert_id}/notes", json={
                "actor": admin_email,
                "note": "Shelter camp capacity at 65%."
            }, headers=headers_admin)
            check("Add Alert Note (/alerts/{id}/notes)", r.status_code == 200)
        except Exception as e:
            check("Add Alert Note (/alerts/{id}/notes)", False, str(e))

        try:
            r = requests.post(f"{BASE_URL}/alerts/{alert_id}/resolve", headers=headers_admin)
            check("Resolve Alert (/alerts/{id}/resolve)", r.status_code == 200 and r.json().get("status") == "resolved")
        except Exception as e:
            check("Resolve Alert (/alerts/{id}/resolve)", False, str(e))

    # 10. Spatial Risk & Hotspots
    try:
        r = requests.get(f"{BASE_URL}/spatial-risk/aggregation?time_range=7d", headers=headers_admin)
        check("Spatial Risk Aggregation (/spatial-risk/aggregation)", r.status_code == 200 and "cells" in r.json())
    except Exception as e:
        check("Spatial Risk Aggregation (/spatial-risk/aggregation)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/spatial-risk/clusters?time_range=7d&record_type=predictive", headers=headers_admin)
        check("Spatial Risk Clusters (/spatial-risk/clusters)", r.status_code == 200 and "clusters" in r.json())
    except Exception as e:
        check("Spatial Risk Clusters (/spatial-risk/clusters)", False, str(e))

    # 11. Analytics Engine
    try:
        r = requests.get(f"{BASE_URL}/analytics/summary", headers=headers_admin)
        check("Analytics Summary (/analytics/summary)", r.status_code == 200 and "total_locations" in r.json())
    except Exception as e:
        check("Analytics Summary (/analytics/summary)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/analytics/trends?days=14", headers=headers_admin)
        check("Analytics Trends (/analytics/trends)", r.status_code == 200 and len(r.json().get("items", [])) == 14)
    except Exception as e:
        check("Analytics Trends (/analytics/trends)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/analytics/hazard-comparison", headers=headers_admin)
        check("Hazard Comparison (/analytics/hazard-comparison)", r.status_code == 200 and "flood_events" in r.json())
    except Exception as e:
        check("Hazard Comparison (/analytics/hazard-comparison)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/analytics/severity-distribution", headers=headers_admin)
        check("Severity Distribution (/analytics/severity-distribution)", r.status_code == 200 and "historical" in r.json())
    except Exception as e:
        check("Severity Distribution (/analytics/severity-distribution)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/analytics/geographic", headers=headers_admin)
        check("Geographic Analytics (/analytics/geographic)", r.status_code == 200 and "locations" in r.json())
    except Exception as e:
        check("Geographic Analytics (/analytics/geographic)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/analytics/data-quality", headers=headers_admin)
        check("Data Quality (/analytics/data-quality)", r.status_code == 200 and "total_records" in r.json())
    except Exception as e:
        check("Data Quality (/analytics/data-quality)", False, str(e))

    # 12. ML Data Governance (Admin Only)
    fb_id = None
    try:
        r = requests.post(f"{BASE_URL}/ml/governance/feedback", json={
            "event_id": flood_event_id,
            "hazard_type": "flood",
            "feedback_type": "confirmed_event",
            "notes": "Field team confirmed high flood waters in low lying tea gardens.",
            "provenance": "Field Observation",
            "feature_snapshot": {"rainfall_mm_24h": 180.0}
        }, headers=headers_admin)
        fb_id = r.json().get("id")
        check("Submit ML Feedback (/ml/governance/feedback)", r.status_code == 201 and fb_id is not None)
    except Exception as e:
        check("Submit ML Feedback (/ml/governance/feedback)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/ml/governance/feedback", headers=headers_admin)
        check("List ML Feedback (/ml/governance/feedback)", r.status_code == 200 and len(r.json()) >= 1)
    except Exception as e:
        check("List ML Feedback (/ml/governance/feedback)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/ml/governance/datasets/candidates", headers=headers_admin)
        check("List Dataset Candidates (/ml/governance/datasets/candidates)", r.status_code == 200)
    except Exception as e:
        check("List Dataset Candidates (/ml/governance/datasets/candidates)", False, str(e))

    # 13. User Preferences (Settings)
    try:
        r = requests.get(f"{BASE_URL}/users/me/preferences", headers=headers_admin)
        check("Get User Preferences (/users/me/preferences)", r.status_code == 200)
    except Exception as e:
        check("Get User Preferences (/users/me/preferences)", False, str(e))

    try:
        r = requests.put(f"{BASE_URL}/users/me/preferences", json={
            "phone_number": "+919876543210",
            "email_enabled": True,
            "sms_enabled": True
        }, headers=headers_admin)
        check("Update User Preferences (/users/me/preferences)", r.status_code == 200 and r.json().get("sms_enabled") is True)
    except Exception as e:
        check("Update User Preferences (/users/me/preferences)", False, str(e))

    # 14. Emergency Resources
    try:
        r = requests.get(f"{BASE_URL}/resources", headers=headers_admin)
        check("List Emergency Resources (/resources)", r.status_code == 200)
    except Exception as e:
        check("List Emergency Resources (/resources)", False, str(e))

    print("=" * 60)
    print(f"AUDIT SUMMARY: {passed} PASSED, {failed} FAILED (TOTAL {passed + failed} CHECKS)")
    print("=" * 60)

    return failed == 0

if __name__ == "__main__":
    success = run_all_checks()
    sys.exit(0 if success else 1)
