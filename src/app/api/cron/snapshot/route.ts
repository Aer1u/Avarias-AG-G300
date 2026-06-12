import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Rota de API para Snapshot Automático de Inventário
 * Esta rota calcula o total de paletes e salva na tabela 'Paletes'.
 * Pode ser chamada por um serviço de Cron (ex: cron-job.org ou Vercel Cron).
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bvgwlkdqmkuuhqiwzfti.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sSplcLDY1MoxxlEVTKHUpg_piJhjjAS'
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  try {
    // 1. Busca os dados de mapeamento para calcular o total de paletes
    // Reproduzindo a lógica do Dashboard: total de paletes = IDs únicos + itens sem ID
    const { data: mapeamento, error: mapErr } = await supabase
      .from('mapeamento')
      .select('"Id Palete"')

    if (mapErr) throw mapErr

    const usedPalletIds = new Set()
    let totalPallets = 0

    mapeamento?.forEach((row: any) => {
      const rawPalletId = row['Id Palete']
      const palletId = (rawPalletId && typeof rawPalletId === 'string')
        ? rawPalletId.trim().toUpperCase()
        : (rawPalletId !== null && rawPalletId !== undefined) ? String(rawPalletId).trim().toUpperCase() : null

      const isInvalidId = !palletId || palletId === "" || palletId === "NAN" || palletId === "-" || palletId === "S/ID" || palletId === "N/A"

      if (!isInvalidId) {
        if (!usedPalletIds.has(palletId)) {
          usedPalletIds.add(palletId)
          totalPallets++
        }
      } else {
        // IDs inválidos ou vazios contam como 1 palete físico individual por linha
        totalPallets++
      }
    })

    // 2. Define data e hora no Horário de Brasília (UTC-3)
    const now = new Date()
    const brTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const dateStr = brTime.toISOString().split('T')[0]
    const hStr = brTime.getUTCHours().toString().padStart(2, '0')
    const mStr = brTime.getUTCMinutes().toString().padStart(2, '0')
    const timeStr = `${hStr}:${mStr}`

    // 3. Verifica se já existe um registro para este minuto (Prevenção de duplicidade)
    const { data: existing } = await supabase
      .from('Paletes')
      .select('id')
      .eq('Data', dateStr)
      .eq('Hora', timeStr)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Snapshot já realizado para este minuto. Ignorando.',
        data: { date: dateStr, time: timeStr }
      })
    }

    console.log(`[Server-Side Snapshot] Registrando ${totalPallets} paletes para ${dateStr} ${timeStr}`)

    // 4. Grava na tabela Paletes
    const { error: insErr } = await supabase
      .from('Paletes')
      .insert({
        Quantidade: totalPallets,
        Data: dateStr,
        Hora: timeStr
      })


    if (insErr) throw insErr

    return NextResponse.json({
      success: true,
      message: 'Snapshot realizado com sucesso',
      data: {
        total_pallets: totalPallets,
        date: dateStr,
        time: timeStr
      }
    })

  } catch (error: any) {
    console.error('[Snapshot Error]:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro interno ao realizar snapshot' 
    }, { status: 500 })
  }
}
