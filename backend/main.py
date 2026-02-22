from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import traceback
import json
import numpy as np

import requests
import io

app = FastAPI()

# Enable CORS for Next.js developer server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GSHEET_URL = "https://docs.google.com/spreadsheets/d/1q-gttvSLzCVD4x6xtVqivDeYMVvY3PIEOMEYaWnxyeM/export?format=xlsx"
LOCAL_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "data", "Drive atualizado.xlsx")

# Function to load and clean data
def get_clean_data():
    df = None
    
    # 1. Try to fetch from Google Sheets first
    try:
        response = requests.get(GSHEET_URL, timeout=10)
        if response.status_code == 200:
            df = pd.read_excel(io.BytesIO(response.content))
            print("Successfully loaded data from Google Sheets")
    except Exception as e:
        print(f"Failed to fetch from Google Sheets: {e}")

    # 2. Fallback to local file if fetch failed
    if df is None:
        if os.path.exists(LOCAL_EXCEL_PATH):
            df = pd.read_excel(LOCAL_EXCEL_PATH)
            print("Loaded data from local Excel file")
        else:
            raise FileNotFoundError("Data source not found (neither Google Sheets nor local file)")
    
    # Hardened mapping logic
    new_cols = {}
    for col in df.columns:
        c = str(col).lower()
        if 'posi' in c: new_cols[col] = 'posicao'
        elif str(col).startswith('G300'): new_cols[col] = 'posicao'
        elif 'produto' in c or 'sku' in c: new_cols[col] = 'produto'
        elif 'capacidade' in c: new_cols[col] = 'capacidade'
        elif 'quantidade total' in c or ('total' in c and ('qtd' in c or 'qua' in c or 'quant' in c)): new_cols[col] = 'quantidade_total'
        elif 'palete' in c and ('qtd' in c or 'qua' in c) and '/' not in c: new_cols[col] = 'paletes'
        elif 'nivel' in c or 'nível' in c: new_cols[col] = 'nivel'
        elif 'prof' in c: new_cols[col] = 'profundidade'
        elif '/' in c and 'palete' in c: new_cols[col] = 'qtd_por_palete'
        elif 'id' in c and 'palete' in c: new_cols[col] = 'id_palete'
        elif 'tombada' in c: new_cols[col] = 'qtd_tombada'
        elif 'molhado' in c: new_cols[col] = 'qtd_molhado'
        elif 'status' in c or 'observa' in c or 'avaria' in c: new_cols[col] = 'observacao'
    
    df = df.rename(columns=new_cols)

    # Damage categorization logic
    def check_damage(row, keyword):
        text = (str(row.get('produto', '')) + " " + str(row.get('observacao', ''))).lower()
        return 1 if keyword in text else 0

    df['is_molhado'] = df.apply(lambda r: check_damage(r, 'molhado'), axis=1)
    df['is_tombado'] = df.apply(lambda r: check_damage(r, 'tombado'), axis=1)

    # Ultra-robust position detection
    if 'posicao' not in df.columns or df['posicao'].astype(str).str.contains('N/A').all():
        for col in df.columns:
            if df[col].astype(str).str.contains('G300', na=False).any():
                df = df.rename(columns={col: 'posicao'})
                break
    
    required_cols = ['produto', 'quantidade_total', 'paletes', 'capacidade', 'posicao', 'nivel', 'observacao']
    for rc in required_cols:
        if rc not in df.columns:
            df[rc] = 0 if rc in ['quantidade_total', 'paletes', 'capacidade'] else ('-' if rc == 'nivel' else 'N/A')
    
    # Normalize data
    df['produto'] = df['produto'].fillna('Não Identificado')
    df['quantidade_total'] = pd.to_numeric(df['quantidade_total'], errors='coerce').fillna(0)
    df['paletes'] = pd.to_numeric(df['paletes'], errors='coerce').fillna(0)
    df['capacidade'] = pd.to_numeric(df['capacidade'], errors='coerce').fillna(0)
    df['posicao'] = df['posicao'].fillna('S/P')
    df['nivel'] = df['nivel'].fillna('-')
    df['qtd_por_palete'] = pd.to_numeric(df['qtd_por_palete'], errors='coerce').fillna(0)
    df['qtd_tombada'] = pd.to_numeric(df.get('qtd_tombada', 0), errors='coerce').fillna(0)
    df['qtd_molhado'] = pd.to_numeric(df.get('qtd_molhado', 0), errors='coerce').fillna(0)
    
    # Precise Depth Handling
    def clean_depth(val):
        if pd.isna(val) or str(val).lower() == 'nan' or str(val).strip() == '':
            return '-'
        v_str = str(val).strip()
        if v_str.endswith('.0'): v_str = v_str[:-2]
        return v_str

    if 'profundidade' in df.columns:
        df['profundidade'] = df['profundidade'].apply(clean_depth)
    else:
        df['profundidade'] = '-'
    
    # Logic for ID Palete (Shared Pallets)
    if 'id_palete' in df.columns:
        df['id_palete'] = df['id_palete'].fillna('').astype(str).str.strip().replace('nan', '')
        shared_mask = df['id_palete'] != ''
        if shared_mask.any():
            id_counts = df[shared_mask]['id_palete'].value_counts()
            def balance_pallet(row):
                if row['id_palete'] != '':
                    count = id_counts.get(row['id_palete'], 1)
                    return 1.0 / count
                return row['paletes']
            df['paletes'] = df.apply(balance_pallet, axis=1)

    # Correct Occupancy Calculation
    df['ocupacao'] = (df['paletes'] / df['capacidade'] * 100).clip(0, 500).fillna(0)
    
    # Final JSON compliance check
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.fillna(0)
    return df

@app.get("/api/data")
async def read_data():
    try:
        df = get_clean_data()
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"CRITICAL ERROR in /api/data: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    try:
        df = get_clean_data()
        return {
            "total_pallets": int(df['paletes'].sum()),
            "total_quantity": int(df['quantidade_total'].sum()),
            "total_positions": int(df['posicao'].nunique()),
            "total_skus": int(df['produto'].nunique()),
            "avg_occupancy": float(df['ocupacao'].mean()),
            "molhados": int(df['is_molhado'].sum()),
            "tombados": int(df['is_tombado'].sum()),
            "qtd_molhado": int(df['qtd_molhado'].sum()),
            "qtd_tombada": int(df['qtd_tombada'].sum())
        }
    except Exception as e:
        print(f"CRITICAL ERROR in /api/stats: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
