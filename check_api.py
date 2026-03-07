import requests
import json

base_url = "http://localhost:8000/api/stats"

for period in ["hoje", "semana", "mensal"]:
    try:
        print(f"\n--- Checking period: {period} ---")
        r = requests.get(f"{base_url}?period={period}", timeout=60)
        data = r.json()
        print(f"Total Pallets: {data.get('total_pallets')}")
        print(f"Total Quantity: {data.get('total_quantity')}")
        print(f"Movement Pieces: {data.get('movement_pieces')}")
        print(f"Today Net: {data.get('today_net')}")
        print(f"Total Entries: {data.get('total_entries')}")
        print(f"Total Exits: {data.get('total_exits')}")
        top_moved = data.get("top_moved", [])
        print(f"Top Moved Count: {len(top_moved)}")
        if top_moved:
            print(f"Sample Top Moved: {top_moved[0]}")
    except Exception as e:
        print(f"Error: {e}")
