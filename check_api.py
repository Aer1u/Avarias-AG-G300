import requests
import json

base_url = "http://localhost:8000/api/stats"

for period in ["hoje", "semana", "mensal"]:
    try:
        print(f"Checking period: {period}")
        r = requests.get(f"{base_url}?period={period}", timeout=5)
        data = r.json()
        top_moved = data.get("top_moved", [])
        print(f"  Count: {len(top_moved)}")
        if top_moved:
            print(f"  Sample: {top_moved[0]}")
    except Exception as e:
        print(f"  Error: {e}")
