import requests
try:
    r = requests.get('http://localhost:8000/api/data')
    data = r.json()
    print(f"Total items: {len(data)}")
    matches = [d for d in data if '5774-02' in str(d.get('produto', ''))]
    print(f"Matches for 5774-02: {len(matches)}")
    for m in matches:
        print(m)
except Exception as e:
    print(f"Error: {e}")
