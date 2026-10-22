import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface PositionFormProps {
  onAdd: (name: string, type: 'drive-in' | 'aberta', capacity: number, levelCount: number) => void;
  onCancel: () => void;
}

export function PositionForm({ onAdd, onCancel }: PositionFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'drive-in' | 'aberta'>('drive-in');
  const [capacity, setCapacity] = useState(12);
  const [levelCount, setLevelCount] = useState(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(name, type, capacity, levelCount);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 p-4 rounded-2xl space-y-4">
      <h3 className="text-sm font-bold text-white uppercase">Cadastrar Nova Posição</h3>
      <input
        type="text"
        placeholder="Nome da Posição (ex: Rua 03)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
        required
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as 'drive-in' | 'aberta')}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
      >
        <option value="drive-in">Drive-In</option>
        <option value="aberta">Aberta (Chão)</option>
      </select>
      {type === 'drive-in' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Capacidade"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
          />
          <input
            type="number"
            placeholder="Níveis"
            value={levelCount}
            onChange={(e) => setLevelCount(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-2 text-xs font-bold uppercase">
          Adicionar
        </button>
        <button type="button" onClick={onCancel} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg p-2 text-xs font-bold uppercase">
          Cancelar
        </button>
      </div>
    </form>
  );
}
