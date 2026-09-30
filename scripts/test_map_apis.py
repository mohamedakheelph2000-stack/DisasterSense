import requests

login_resp = requests.post('http://localhost:8000/api/v1/auth/login', data={'username': 'admin@disastersense.org', 'password': 'Password123!'})
print("Login status:", login_resp.status_code)
token = login_resp.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'} if token else {}

for ep in [
    '/locations',
    '/disaster-events',
    '/resources',
    '/spatial-risk/aggregation?time_range=7d&record_type=predictive',
    '/spatial-risk/clusters?time_range=7d&record_type=predictive'
]:
    r = requests.get('http://localhost:8000/api/v1' + ep, headers=headers)
    print(ep, '->', r.status_code)
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, dict):
            print("   keys:", list(data.keys()))
            for k in ['items', 'cells', 'clusters']:
                if k in data:
                    print(f"   {k} count: {len(data[k])}")
        else:
            print("   array length:", len(data))
    else:
        print("   error:", r.text[:200])
