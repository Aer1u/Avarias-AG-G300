from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import traceback
import json
import numpy as np
import io
import requests

app = FastAPI()

# Habilitar CORS para o frontend (Vercel ou local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# EXPLICAÇÃO: Para Google Sheets, o link precisa terminar em /export?format=xlsx
EXCEL_URL = os.environ.get(
    "EXCEL_URL",
    "https://docs.google.com/spreadsheets/d/1q-gttvSLzCVD4x6xtVqivDeYMVvY3PIEOMEYaWnxyeM/export?format=xlsx" 
)
UNALLOCATED_GSHEET_URL = "https://docs.google.com/spreadsheets/d/1Ni-HNW28V8V2vHt__YPPiiBeTX333vDQf_9Qw96wdmc/export?format=xlsx"

def get_allocated_data():
    try:
        response = requests.get(EXCEL_URL, timeout=10)
        response.raise_for_status()
        df = pd.read_excel(io.BytesIO(response.content))
    except Exception as e:
        print(f"Erro ao carregar alocados: {e}")
        local_path = os.path.join(os.path.dirname(__file__), "data", "Drive atualizado.xlsx")
        if os.path.exists(local_path):
            df = pd.read_excel(local_path)
        else:
            return pd.DataFrame()
    
    new_cols = {}
    for col in df.columns:
        c = str(col).lower()
        if 'posi' in c: new_cols[col] = 'posicao'
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
    return df

def get_unallocated_data():
    try:
        response = requests.get(UNALLOCATED_GSHEET_URL, timeout=10)
        response.raise_for_status()
        df = pd.read_excel(io.BytesIO(response.content))
    except Exception as e:
        print(f"Erro ao carregar não alocados: {e}")
        return pd.DataFrame()

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
    
    actual_cols = df.columns
    final_mapping = {}
    for target_name, final_name in col_mapping.items():
        found = next((c for c in actual_cols if target_name.lower() in str(c).lower()), None)
        if found:
            final_mapping[found] = final_name

    df = df.rename(columns=final_mapping)
    df['posicao'] = 'S/P'
    df['is_unallocated_source'] = True
    return df

def get_clean_data():
    df_alloc = get_allocated_data()
    df_unalloc = get_unallocated_data()
    
    df = pd.concat([df_alloc, df_unalloc], ignore_index=True)

    required_cols = ['produto', 'quantidade_total', 'paletes', 'capacidade', 'posicao', 'nivel', 'observacao', 'id_palete', 'qtd_tombada', 'qtd_molhado', 'qtd_por_palete']
    for rc in required_cols:
        if rc not in df.columns:
            df[rc] = 0 if rc in ['quantidade_total', 'paletes', 'capacidade', 'qtd_tombada', 'qtd_molhado', 'qtd_por_palete'] else ('S/P' if rc == 'posicao' else ('-' if rc == 'nivel' else 'N/A'))
    
    df['produto'] = df['produto'].fillna('Não Identificado').astype(str)
    df['quantidade_total'] = pd.to_numeric(df['quantidade_total'], errors='coerce').fillna(0)
    df['paletes'] = pd.to_numeric(df['paletes'], errors='coerce').fillna(0)
    df['capacidade'] = pd.to_numeric(df['capacidade'], errors='coerce').fillna(0)
    df['posicao'] = df['posicao'].fillna('S/P').astype(str)
    df['nivel'] = df['nivel'].fillna('-').astype(str)
    df['qtd_por_palete'] = pd.to_numeric(df['qtd_por_palete'], errors='coerce').fillna(0)
    df['qtd_tombada'] = pd.to_numeric(df['qtd_tombada'], errors='coerce').fillna(0)
    df['qtd_molhado'] = pd.to_numeric(df['qtd_molhado'], errors='coerce').fillna(0)
    
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
    
    df['id_palete'] = df['id_palete'].fillna('').astype(str).str.strip().replace('nan', '')
    shared_mask = (df['id_palete'] != '') & (df['id_palete'] != '0') & (df['id_palete'] != 'None')
    if shared_mask.any():
        id_counts = df[shared_mask]['id_palete'].value_counts()
        def balance_pallet(row):
            if row['id_palete'] != '' and row['id_palete'] != '0' and row['id_palete'] != 'None':
                count = id_counts.get(row['id_palete'], 1)
                return 1.0 / count
            return row['paletes']
        df['paletes'] = df.apply(balance_pallet, axis=1)

    # Normalize damage columns
    for col in ['qtd_tombada', 'qtd_molhado']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        else:
            df[col] = 0.0

    # Ensure is_unallocated_source exists and is boolean
    if 'is_unallocated_source' not in df.columns:
        df['is_unallocated_source'] = False
    df['is_unallocated_source'] = df['is_unallocated_source'].fillna(False).astype(bool)

    # Damage Logic (Subsets of Total) - Ensure metrics pick them up
    def check_damage_flag(row):
        text = (str(row.get('produto', '')) + " " + str(row.get('observacao', ''))).lower()
        is_molhado = 1 if 'molhado' in text or row['qtd_molhado'] > 0 else 0
        is_tombado = 1 if 'tombado' in text or row['qtd_tombada'] > 0 else 0
        return pd.Series([is_molhado, is_tombado], index=['is_molhado', 'is_tombado'])

    df[['is_molhado', 'is_tombado']] = df.apply(check_damage_flag, axis=1)

    # FIX: Occupancy and Capacity should only apply to ALLOCATED items
    # Unallocated items (is_unallocated_source == True) should have 0 capacity and 0 contribution to occupied positions
    def calculate_occupancy(row):
        if row.get('is_unallocated_source', False):
            return 0.0
        cap = row.get('capacidade', 0)
        pal = row.get('paletes', 0)
        if cap > 0:
            return (pal / cap) * 100
        return 0.0

    df['ocupacao'] = df.apply(calculate_occupancy, axis=1)
    
    # Ensure capacity is 0 for unallocated items to avoid skewing stats
    df.loc[df['is_unallocated_source'] == True, 'capacidade'] = 0.0

    # Mixed pallets detection (Only for allocated items with a real position)
    df['is_mixed'] = False
    mask_allocated = (~df['is_unallocated_source']) & (df['posicao'] != 'S/P')
    pos_counts = df[mask_allocated].groupby('posicao')['produto'].transform('nunique')
    df.loc[mask_allocated, 'is_mixed'] = pos_counts > 1
    
    # Debug print with more detail
    allocated_count = len(df[~df['is_unallocated_source']])
    unallocated_count = len(df[df['is_unallocated_source']])
    total_tombada = df['qtd_tombada'].sum()
    total_molhada = df['qtd_molhado'].sum()
    print(f"DEBUG: {len(df)} total, {allocated_count} alocados, {unallocated_count} não alocados.")
    print(f"DEBUG: Total Tombada: {total_tombada}, Total Molhada: {total_molhada}")
    
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    print(f"DEBUG: {len(df)} registros processados.")
    return df

@app.get("/api/data")
async def read_data():
    try:
        df = get_clean_data()
        return df.to_dict(orient="records")
    except Exception as e:
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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Mantendo a porta 8000 que é o padrão do frontend geralmente
    uvicorn.run(app, host="0.0.0.0", port=8000)
