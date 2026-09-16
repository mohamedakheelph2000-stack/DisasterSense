import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_result(name, res):
    print(f"--- {name} ---")
    print(f"Status: {res.status_code}")
    try:
        print(json.dumps(res.json(), indent=2)[:500])
    except:
        print(res.text[:500])
    print()

def run_tests():
    print("Server is up. Running tests...")
    
    # 1. Health (or docs if health doesn't exist)
    res = requests.get("http://localhost:8000/docs")
    print(f"--- /docs ---")
    print(f"Status: {res.status_code}\n")

    # 2. Register
    reg_data = {
        "email": f"test_{int(time.time())}@example.com",
        "plain_password": "Password123!",
        "full_name": "Test User",
        "role": "responder" # Try to register as responder, might fallback to citizen or be allowed
    }
    res = requests.post(f"{BASE_URL}/auth/register", json=reg_data)
    print_result("Register", res)

    # 3. Login
    login_data = {
        "username": reg_data["email"],
        "password": reg_data["plain_password"]
    }
    res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    print_result("Login", res)

    token = ""
    if res.status_code == 200:
        token = res.json().get("access_token", "")
    
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Auth Me
    res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print_result("Auth Me", res)

    # 5. Locations
    res = requests.get(f"{BASE_URL}/locations/", headers=headers)
    print_result("Locations", res)

    # 6. Disaster Events
    res = requests.get(f"{BASE_URL}/disaster-events/", headers=headers)
    print_result("Disaster Events", res)

    # 7. Alerts
    res = requests.get(f"{BASE_URL}/alerts/", headers=headers)
    print_result("Alerts", res)

    # 8. Analytics Trends
    res = requests.get(f"{BASE_URL}/analytics/trends", headers=headers)
    print_result("Analytics Trends", res)

    # 9. Environment Current
    res = requests.get(f"{BASE_URL}/environment/current?latitude=34.05&longitude=-118.24", headers=headers)
    print_result("Environment Current", res)

    # 10. ML Status
    res = requests.get(f"{BASE_URL}/ml/status", headers=headers)
    print_result("ML Status", res)

if __name__ == "__main__":
    run_tests()
