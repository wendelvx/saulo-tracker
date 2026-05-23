import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Save, Trash2, Clock, LayoutList, Dumbbell, Timer, CheckCircle2, X, Activity, HelpCircle } from 'lucide-react';

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function WorkoutForm({ onSave, workoutToEdit, onCancel }) {
  const [nome, setNome] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [blocos, setBlocos] = useState([
    { duracao: 60, intensidade: 2, rpm: 80, exercicio: 'AQUECIMENTO' }
  ]);

  useEffect(() => {
    if (workoutToEdit) {
      setNome(workoutToEdit.nome);
      const blocosCarregados = workoutToEdit.blocos.map(b => ({
        duracao: b.tempo_final - b.tempo_inicial,
        intensidade: b.intensidade,
        rpm: b.rpm || 80,
        exercicio: b.exercicio
      }));
      setBlocos(blocosCarregados);
    } else {
      resetForm();
    }
  }, [workoutToEdit]);

  const resetForm = () => {
    setNome('');
    setBlocos([{ duracao: 60, intensidade: 2, rpm: 80, exercicio: 'AQUECIMENTO' }]);
  };

  const timeline = useMemo(() => {
    let tempoAcumulado = 0;
    return blocos.map(bloco => {
      const inicio = tempoAcumulado;
      tempoAcumulado += (Number(bloco.duracao) || 0);
      return { ...bloco, tempo_inicial: inicio, tempo_final: tempoAcumulado };
    });
  }, [blocos]);

  const totalDuration = timeline.length > 0 ? timeline[timeline.length - 1].tempo_final : 0;

  const addBloco = () => {
    setBlocos([...blocos, { duracao: 30, intensidade: 5, rpm: 80, exercicio: '' }]);
  };

  const removeBloco = (index) => {
    if (blocos.length <= 1) return;
    setBlocos(blocos.filter((_, i) => i !== index));
  };

  const updateBloco = (index, field, value) => {
    const newBlocos = [...blocos];
    newBlocos[index][field] = value;
    setBlocos(newBlocos);
  };

  const handleSave = () => {
    if (!nome) return alert("Dê um nome ao seu treino!");
    
    const blocosParaSalvar = timeline.map(b => ({
        tempo_inicial: b.tempo_inicial,
        tempo_final: b.tempo_final,
        intensidade: b.intensidade,
        rpm: Number(b.rpm) || 80,
        exercicio: b.exercicio.trim() === '' ? 'ATIVIDADE' : b.exercicio.trim().toUpperCase()
    }));

    onSave({ 
      id: workoutToEdit?.id, 
      nome, 
      duracao_total: totalDuration, 
      blocos: blocosParaSalvar 
    });
    
    setShowSuccess(true);
    setTimeout(() => {
        setShowSuccess(false);
        if (!workoutToEdit) resetForm();
    }, 2000);
  };

  // Lógica aprimorada para retornar texto e estilos dinâmicos
  const getCargaDetails = (level) => {
    if (level <= 3) return { label: 'BAIXA', text: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' };
    if (level <= 5) return { label: 'MÉDIA', text: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' };
    if (level <= 7) return { label: 'MÉDIA+', text: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' };
    if (level <= 9) return { label: 'ALTA', text: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    return { label: 'MÁXIMA', text: 'text-red-600', bg: 'bg-red-600/10 border-red-600/20' };
  };

  return (
    <div className="bg-[#111] border border-[#222] p-4 md:p-5 rounded-2xl flex flex-col gap-4 shadow-2xl h-full w-full relative overflow-hidden">
      
      {showSuccess && (
        <div className="absolute inset-0 bg-green-600/10 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-black border border-green-500 p-4 rounded-2xl flex items-center gap-3 shadow-2xl">
            <CheckCircle2 className="text-green-500" />
            <span className="font-bold text-white uppercase text-sm">
                {workoutToEdit ? 'Alterações Salvas!' : 'Treino Salvo com Sucesso!'}
            </span>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 flex flex-col p-6 animate-in fade-in overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-orange-500 font-black italic tracking-wider uppercase text-lg flex items-center gap-2">
              <HelpCircle size={20} /> Como usar
            </h3>
            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4 text-sm text-gray-300">
            <div>
              <p className="font-bold text-white uppercase text-xs tracking-widest border-b border-[#333] pb-1 mb-2">Estrutura</p>
              <p>O treino é construído em <b>fases contínuas</b>. Defina os <b>Segundos</b> de cada bloco e o sistema calculará automaticamente o tempo total (ex: do minuto 2:00 ao 3:00).</p>
            </div>
            
            <div>
              <p className="font-bold text-white uppercase text-xs tracking-widest border-b border-[#333] pb-1 mb-2 mt-4 flex items-center gap-1"><Activity size={12}/> RPM</p>
              <p>Rotações por minuto. Reflete a cadência dos pedais. O gráfico usará esse número para definir a <b>velocidade da pulsação visual</b> na tela do aluno.</p>
            </div>

            <div>
              <p className="font-bold text-white uppercase text-xs tracking-widest border-b border-[#333] pb-1 mb-2 mt-4">Níveis de Carga (1 a 10)</p>
              <ul className="space-y-2 mt-2">
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> <b>1 a 3 (Baixa):</b> Giro leve, recuperação.</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> <b>4 a 5 (Média):</b> Resistência base, confortável.</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500"></span> <b>6 a 7 (Média+):</b> Esforço moderado/pesado, subida leve.</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> <b>8 a 10 (Alta/Máx):</b> Subida pesada, tiro de força (sprint).</li>
              </ul>
            </div>
          </div>
          
          <button 
            onClick={() => setShowHelp(false)}
            className="mt-6 bg-[#222] hover:bg-[#333] text-white p-3 rounded-xl font-bold uppercase text-xs transition-colors"
          >
            Entendi
          </button>
        </div>
      )}

      <header className="flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-gray-500 uppercase text-[10px] font-bold tracking-widest ml-1">
                <LayoutList size={14} className={workoutToEdit ? "text-blue-500" : "text-green-500"} /> 
                {workoutToEdit ? 'Editando Treino' : 'Novo Cadastro'}
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowHelp(true)} 
                className="text-gray-500 hover:text-orange-500 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
                title="Como preencher"
              >
                <HelpCircle size={14} /> Ajuda
              </button>

              {workoutToEdit && (
                  <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                      <X size={12} /> Cancelar
                  </button>
              )}
            </div>
        </div>
        <input 
          className={`w-full bg-black border rounded-xl p-3 text-white placeholder:text-gray-600 outline-none transition-all font-bold text-base md:text-lg uppercase ${workoutToEdit ? 'border-blue-500/50 focus:border-blue-500' : 'border-[#333] focus:border-green-500'}`}
          placeholder="NOME DO TREINO"
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
        />
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        {timeline.map((b, i) => {
          const carga = getCargaDetails(b.intensidade); // Calcula o visual da carga para o bloco atual

          return (
          <div key={i} className="group bg-[#1a1a1a] border border-[#2a2a2a] p-3 md:p-4 rounded-xl transition-all hover:border-gray-500 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 bg-black px-2 py-1 rounded text-[10px] font-mono text-gray-400 border border-[#222]">
                 <Clock size={10} /> 
                 {formatTime(b.tempo_inicial)} <span className="text-gray-600">→</span> {formatTime(b.tempo_final)}
              </div>
              <button onClick={() => removeBloco(i)} className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-500 transition-all">
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px] gap-3 items-end">
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-1">
                  <Dumbbell size={10} /> Movimento
                </label>
                <input 
                  type="text" 
                  className="w-full bg-black text-white rounded-lg p-2.5 text-sm font-bold outline-none border border-[#333] focus:border-green-500 placeholder:text-gray-700 uppercase"
                  placeholder="EX: GIRO"
                  value={b.exercicio}
                  onChange={e => updateBloco(i, 'exercicio', e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-1" title="Rotações por Minuto">
                  <Activity size={10} /> RPM
                </label>
                <input 
                  type="number" 
                  className="w-full bg-black text-white rounded-lg p-2.5 text-center font-mono font-bold outline-none border border-[#333] focus:border-blue-500 transition-colors"
                  value={b.rpm} 
                  onChange={e => updateBloco(i, 'rpm', e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 flex items-center gap-1" title="Duração do bloco">
                  <Timer size={10} /> Segs
                </label>
                <input 
                  type="number" 
                  className="w-full bg-black text-white rounded-lg p-2.5 text-center font-mono font-bold outline-none border border-[#333] focus:border-green-500"
                  value={b.duracao} 
                  onChange={e => updateBloco(i, 'duracao', e.target.value)} 
                />
              </div>
            </div>

            {/* BARRA DE CARGA COM BADGE DINÂMICO */}
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Carga</label>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${carga.bg} ${carga.text}`}>
                    {carga.label}
                  </span>
                  <span className={`font-black text-lg md:text-xl italic leading-none ${carga.text}`}>
                    {b.intensidade}
                  </span>
                </div>
              </div>
              <input 
                type="range" min="1" max="10" 
                className={`w-full h-1.5 bg-black rounded-lg appearance-none cursor-pointer border border-[#333] ${workoutToEdit ? 'accent-blue-500' : 'accent-orange-500'}`} 
                value={b.intensidade}
                onChange={e => updateBloco(i, 'intensidade', Number(e.target.value))}
              />
            </div>
          </div>
        )})}
      </div>

      <footer className="flex flex-col gap-3 pt-3 border-t border-[#222] shrink-0">
        <div className="flex justify-between items-end px-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Duração Total</span>
            <span className={`text-xl md:text-2xl font-mono font-black ${workoutToEdit ? 'text-blue-500' : 'text-green-500'}`}>{formatTime(totalDuration)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={addBloco} 
            className="flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] text-white p-3 md:p-4 rounded-xl font-bold transition-all text-xs uppercase"
          >
            <Plus size={16} /> Nova Fase
          </button>
          <button 
            onClick={handleSave} 
            className={`flex items-center justify-center gap-2 text-white p-3 md:p-4 rounded-xl font-black transition-all text-xs uppercase shadow-lg active:scale-95 ${workoutToEdit ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'}`}
          >
            <Save size={16} /> {workoutToEdit ? 'Salvar Alterações' : 'Salvar Treino'}
          </button>
        </div>
      </footer>
    </div>
  );
}