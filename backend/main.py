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
UNALLOCATED_GSHEET_URL = "https://docs.google.com/spreadsheets/d/1Ni-HNW28V8V2vHt__YPPiiBeTX333vDQf_9Qw96wdmc/export?format=xlsx"
LOCAL_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "data", "Drive atualizado.xlsx")

# Function to load and clean "Allocated" data (Existing logic)
def get_allocated_data():
    df = None
    try:
        response = requests.get(GSHEET_URL, timeout=10)
        if response.status_code == 200:
            df = pd.read_excel(io.BytesIO(response.content))
    except Exception as e:
        print(f"Failed to fetch allocated from Google Sheets: {e}")

    if df is None:
        if os.path.exists(LOCAL_EXCEL_PATH):
            df = pd.read_excel(LOCAL_EXCEL_PATH)
        else:
            raise FileNotFoundError("Allocated data source not found")
    
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
    df['is_unallocated_source'] = False

    # Standard damage check for allocated
    def check_damage(row, keyword):
        text = (str(row.get('produto', '')) + " " + str(row.get('observacao', ''))).lower()
        return 1 if keyword in text else 0

    df['is_molhado'] = df.apply(lambda r: check_damage(r, 'molhado'), axis=1)
    df['is_tombado'] = df.apply(lambda r: check_damage(r, 'tombado'), axis=1)

    return df

# Function to load and clean "Unallocated" data (New logic)
def get_unallocated_data():
    df = None
    try:
        response = requests.get(UNALLOCATED_GSHEET_URL, timeout=10)
        if response.status_code == 200:
            df = pd.read_excel(io.BytesIO(response.content))
    except Exception as e:
        print(f"Failed to fetch unallocated from Google Sheets: {e}")
        return pd.DataFrame()

    # Mapping based on user spec
    # 1. Produto, 2. Qtd no Palete, 3. Qtd de Palete, 4. Quantidade Total, 5. ID Palete, 6. Parte Tombada, 7. Parte Molhada, 8. Observação
    col_mapping = {
        'Produto': 'produto',
        'Quantidade no palete': 'qtd_por_palete',
        'Qtd. de palete': 'paletes',
        'Quantidade total': 'quantidade_total',
        'ID palete': 'id_palete',
        'Parte Tombada': 'qtd_tombada',
        'Parte Molhada': 'qtd_molhado',
        'Observação': 'observacao'
    }
    
    # Flexible mapping if names vary slightly
    actual_cols = df.columns
    final_mapping = {}
    for target_name, final_name in col_mapping.items():
        found = next((c for c in actual_cols if target_name.lower() in str(c).lower()), None)
        if found:
            final_mapping[found] = final_name

    df = df.rename(columns=final_mapping)
    df['posicao'] = 'S/P'
    df['nivel'] = '-'
    df['capacidade'] = 0
    df['is_unallocated_source'] = True

    # Rule: Damage Null to 0
    df['qtd_tombada'] = pd.to_numeric(df.get('qtd_tombada', 0), errors='coerce').fillna(0)
    df['qtd_molhado'] = pd.to_numeric(df.get('qtd_molhado', 0), errors='coerce').fillna(0)

    # Rule: Damage Logic (Subsets of Total) - Categorization for dashboard metrics
    df['is_molhado'] = (df['qtd_molhado'] > 0).astype(int)
    df['is_tombado'] = (df['qtd_tombada'] > 0).astype(int)

    return df

def get_clean_data():
    df_alloc = get_allocated_data()
    df_unalloc = get_unallocated_data()
    
    # Combine sources
    df = pd.concat([df_alloc, df_unalloc], ignore_index=True)

    # Ensure all required columns exist as Series before processing
    required_cols = ['produto', 'quantidade_total', 'paletes', 'capacidade', 'posicao', 'nivel', 'observacao', 'id_palete', 'qtd_tombada', 'qtd_molhado', 'qtd_por_palete']
    for rc in required_cols:
        if rc not in df.columns:
            df[rc] = 0 if rc in ['quantidade_total', 'paletes', 'capacidade', 'qtd_tombada', 'qtd_molhado', 'qtd_por_palete'] else ('S/P' if rc == 'posicao' else 'N/A')
    
    # Normalize data
    df['produto'] = df['produto'].fillna('Não Identificado').astype(str)
    df['quantidade_total'] = pd.to_numeric(df['quantidade_total'], errors='coerce').fillna(0)
    df['paletes'] = pd.to_numeric(df['paletes'], errors='coerce').fillna(0)
    df['capacidade'] = pd.to_numeric(df['capacidade'], errors='coerce').fillna(0)
    df['posicao'] = df['posicao'].fillna('S/P').astype(str)
    df['nivel'] = df['nivel'].fillna('-').astype(str)
    df['qtd_por_palete'] = pd.to_numeric(df['qtd_por_palete'], errors='coerce').fillna(0)
    df['qtd_tombada'] = pd.to_numeric(df['qtd_tombada'], errors='coerce').fillna(0)
    df['qtd_molhado'] = pd.to_numeric(df['qtd_molhado'], errors='coerce').fillna(0)
    
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
    
    # Rule: Mixed Pallet Detection (Palete Misto)
    df['id_palete'] = df['id_palete'].fillna('').astype(str).str.strip().replace('nan', '')
    # Only check non-empty IDs
    shared_mask = (df['id_palete'] != '') & (df['id_palete'] != '0') & (df['id_palete'] != 'None')
    if shared_mask.any():
        id_counts = df[shared_mask]['id_palete'].value_counts()
        # If an ID appears for different SKUs, it's mixed
        def balance_pallet(row):
            if row['id_palete'] != '' and row['id_palete'] != '0' and row['id_palete'] != 'None':
                count = id_counts.get(row['id_palete'], 1)
                return 1.0 / count
            return row['paletes']
        df['paletes'] = df.apply(balance_pallet, axis=1)

        # Metadata for frontend
        df['is_misto'] = df['id_palete'].map(lambda x: id_counts.get(x, 0) > 1 if x != '' else False)

    # Correct Occupancy Calculation
    df['ocupacao'] = (df['paletes'] / df.apply(lambda r: r['capacidade'] if r['capacidade'] > 0 else 1, axis=1) * 100).clip(0, 500)
    
    # Final cleanup
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    print(f"DEBUG: Consolidated {len(df)} rows. Unallocated count: {len(df[df['posicao'] == 'S/P'])}")
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
            "total_positions": int(df[df['posicao'] != 'S/P']['posicao'].nunique()),
            "total_skus": int(df['produto'].nunique()),
            "avg_occupancy": float(df[df['capacidade'] > 0]['ocupacao'].mean()) if not df[df['capacidade'] > 0].empty else 0,
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
