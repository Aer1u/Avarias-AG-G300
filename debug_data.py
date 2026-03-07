import requests
try:
    r = requests.get('https://avarias-ag-g300.onrender.com/api/data')
    data = r.json()
    print(f"Total items: {len(data)}")
    if data:
        print(f"All keys in first item: {list(data[0].keys())}")
        print(f"Sample item full: {data[0]}")
except Exception as e:
    print(f"Error: {e}")
