import pandas as pd
import requests
import io

GSHEET_URL = "https://docs.google.com/spreadsheets/d/1q-gttvSLzCVD4x6xtVqivDeYMVvY3PIEOMEYaWnxyeM/export?format=xlsx"

try:
    response = requests.get(GSHEET_URL, timeout=10)
    if response.status_code == 200:
        df = pd.read_excel(io.BytesIO(response.content))
        print("COLUMNS:")
        for col in df.columns:
            print(f"- {col}")
        print("\nSAMPLE DATA (First 5 rows):")
        print(df.head().to_string())
except Exception as e:
    print(f"Error: {e}")
