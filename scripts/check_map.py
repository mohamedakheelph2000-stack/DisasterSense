import requests
import re

r = requests.get('http://localhost:3000')
m = re.search(r'href="(/_next/static/css/[^"]+)"', r.text)
if m:
    c = requests.get('http://localhost:3000' + m.group(1))
    print('Leaflet container in CSS:', '.leaflet-container' in c.text)
    print('Leaflet pane in CSS:', '.leaflet-pane' in c.text)
else:
    print('No CSS found')

# Test map page HTTP
r_map = requests.get('http://localhost:3000/map')
print('Map page HTTP status:', r_map.status_code)
print('Map page length:', len(r_map.text))
