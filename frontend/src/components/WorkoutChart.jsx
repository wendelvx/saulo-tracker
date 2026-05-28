import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceDot, Area, ComposedChart } from 'recharts';

// --- FUNÇÕES UTILITÁRIAS DE COR ---
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
};

const interpolateColor = (color1, color2, factor) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
  return `${r}, ${g}, ${b}`;
};

const getSmoothColor = (y) => {
  const val = Math.max(0, Math.min(y, 10));
  if (val <= 2.5) return interpolateColor('#0052cc', '#22c55e', val / 2.5);
  if (val <= 5.0) return interpolateColor('#22c55e', '#eab308', (val - 2.5) / 2.5);
  if (val <= 7.5) return interpolateColor('#eab308', '#f97316', (val - 5.0) / 2.5);
  return interpolateColor('#f97316', '#ef4444', (val - 7.5) / 2.5);
};
// --------------------------------------------

export default function WorkoutChart({ 
  data, 
  currentTime, 
  duration, 
  currentRpm = 80,
  onSeekStart,
  onSeek,
  onSeekEnd,
  isDragging,
  isEditMode, 
  onBlocksUpdate 
}) {
  
  const overlayRef = useRef(null);
  
  // dragBoundary pode ser o índice de uma divisória interna (0 até data.length - 2)
  // ou 'END' se for a última aresta (que altera o tempo total do treino)
  const [dragBoundary, setDragBoundary] = useState(null); 
  const [localBlocos, setLocalBlocos] = useState([]);     
  
  // Memória elástica da duração durante o arraste
  const [localDuration, setLocalDuration] = useState(duration);

  // Mantém os blocos e a duração sincronizados quando não estamos arrastando
  useEffect(() => {
    if (dragBoundary === null) {
      setLocalBlocos(data || []);
      setLocalDuration(duration);
    }
  }, [data, duration, dragBoundary]);

  const localBlocosRef = useRef(localBlocos);
  const localDurationRef = useRef(localDuration);
  useEffect(() => { 
    localBlocosRef.current = localBlocos; 
    localDurationRef.current = localDuration;
  }, [localBlocos, localDuration]);

  // MOTOR FÍSICO DO RIPPLE EDIT (EMPURRAR BLOCOS E TEMPO TOTAL)
  useEffect(() => {
    if (dragBoundary === null) return;
    
    const handlePointerMove = (e) => {
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      
      let x = e.clientX - rect.left;
      let percentage = Math.max(0, x / rect.width);
      
      // Ao arrastar a aresta final (END), ela pode passar de 100% (crescer a timeline visualmente se quiser)
      // Mas para manter simples, ela altera o tempo local baseado numa projeção da duration inicial.
      // A matemática ideal aqui: calcula os "segundos apontados pelo mouse" com base na escala atual do grid
      let mouseSeconds = Math.round(percentage * localDurationRef.current);

      setLocalBlocos(prev => {
        const newBlocos = prev.map(b => ({ ...b })); 

        if (dragBoundary === 'END') {
           // ARRASTE DA ARESTA FINAL
           // Impede que o treino inteiro fique com menos de X segundos
           const minTotalTime = newBlocos.length > 1 ? newBlocos[newBlocos.length - 2].tempo_final + 5 : 5;
           const newTotal = Math.max(minTotalTime, mouseSeconds);
           
           // Apenas estica ou encolhe o último bloco
           const lastIdx = newBlocos.length - 1;
           newBlocos[lastIdx].tempo_final = newTotal;
           newBlocos[lastIdx].duracao = newTotal - newBlocos[lastIdx].tempo_inicial;
           
           setLocalDuration(newTotal); // O gráfico expande dinamicamente
           
        } else {
           // ARRASTE DE ARESTA INTERMEDIÁRIA (RIPPLE EDIT)
           const idx = dragBoundary; // Bloco à esquerda da aresta
           
           // Limite mínimo: o bloco arrastado precisa ter pelo menos 5s
           const prevTime = idx > 0 ? newBlocos[idx - 1].tempo_final : 0;
           let newArestaTime = Math.max(prevTime + 5, mouseSeconds);

           // Descobre o "delta" de tempo (quanto a aresta moveu em segundos)
           const delta = newArestaTime - newBlocos[idx].tempo_final;
           
           if (delta === 0) return prev; // Não moveu

           // 1. Atualiza o bloco alvo
           newBlocos[idx].tempo_final = newArestaTime;
           newBlocos[idx].duracao = newArestaTime - newBlocos[idx].tempo_inicial;

           // 2. Desloca (Ripple) todos os blocos subsequentes pelo mesmo Delta
           for (let i = idx + 1; i < newBlocos.length; i++) {
             newBlocos[i].tempo_inicial += delta;
             newBlocos[i].tempo_final += delta;
           }

           // O novo tempo total do treino é o tempo final do último bloco
           setLocalDuration(newBlocos[newBlocos.length - 1].tempo_final);
        }
        
        return newBlocos;
      });
    };
    
    const handlePointerUp = () => {
      if (onBlocksUpdate) {
        onBlocksUpdate(localBlocosRef.current);
      }
      setDragBoundary(null);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragBoundary, onBlocksUpdate]);
  // --------------------------------------------

  // GERAÇÃO DA MALHA VISUAL (DEGRAUS)
  const chartData = useMemo(() => {
    const sourceData = (isEditMode && dragBoundary !== null) ? localBlocos : (data || []);
    if (!sourceData || sourceData.length === 0) return [];
    
    const points = [];
    sourceData.forEach((bloco) => {
      // Início do degrau
      points.push({ tempo: bloco.tempo_inicial, intensidade: Math.max(0, bloco.intensidade) });
      // Fim do degrau
      points.push({ tempo: bloco.tempo_final, intensidade: Math.max(0, bloco.intensidade) });
    });
    return points;
  }, [data, localBlocos, isEditMode, dragBoundary]);

  // CÁLCULO DE POSIÇÃO DA TELEMETRIA
  const telemetry = useMemo(() => {
    if (chartData.length < 2 || currentTime <= 0) return { y: 0, color: 'rgb(0, 82, 204)', glow: 'rgba(0, 82, 204, 0.8)' };
    if (currentTime >= localDuration) {
      const lastColor = getSmoothColor(chartData[chartData.length - 1].intensidade);
      return { y: chartData[chartData.length - 1].intensidade, color: `rgb(${lastColor})`, glow: `rgba(${lastColor}, 0.8)` };
    }

    // Procura o degrau exato em que o currentTime está
    for (let i = 0; i < chartData.length; i += 2) {
      const inicio = chartData[i];
      const fim = chartData[i + 1];
      if (currentTime >= inicio.tempo && currentTime <= fim.tempo) {
        const rgbColor = getSmoothColor(inicio.intensidade);
        return { y: inicio.intensidade, color: `rgb(${rgbColor})`, glow: `rgba(${rgbColor}, ${isDragging ? '1' : '0.8'})` };
      }
    }
    return { y: 0, color: 'rgb(0, 82, 204)', glow: 'rgba(0, 82, 204, 0.8)' };
  }, [chartData, currentTime, localDuration, isDragging]);

  const pulseDuration = useMemo(() => {
     const safeRpm = Math.max(currentRpm, 1); 
     return (60 / safeRpm).toFixed(2);
  }, [currentRpm]);

  return (
    <div className={`w-full h-full relative bg-[#0f0f0f] overflow-hidden border-t border-[#1a1a1a] ${isEditMode ? '' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
      
      <style>{`
        @keyframes heartbeat {
          0% { stroke-width: 2px; filter: brightness(1); }
          50% { stroke-width: 4px; filter: brightness(1.3); }
          100% { stroke-width: 2px; filter: brightness(1); }
        }
        .telemetry-sync line {
          transition: stroke 0.2s ease, stroke-opacity 0.2s ease;
          will-change: transform, stroke;
          transform: translateZ(0);
        }
        .telemetry-sync circle {
          transition: fill 0.2s ease, filter 0.2s ease, r 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          will-change: transform, fill, filter, r;
          transform: translateZ(0);
          ${!isDragging && !isEditMode ? `animation: heartbeat ${pulseDuration}s infinite ease-in-out;` : ''}
        }
        .chart-overlay {
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), 
                      linear-gradient(90deg, rgba(255, 0, 0, 0.01), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.01));
          background-size: 100% 4px, 3px 100%;
          pointer-events: none;
        }
        .tech-grid {
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
        .editor-mode-bg {
          background: repeating-linear-gradient( 45deg, rgba(59, 130, 246, 0.02), rgba(59, 130, 246, 0.02) 10px, transparent 10px, transparent 20px);
        }
      `}</style>

      <div className={`absolute inset-0 tech-grid z-0 ${isEditMode ? 'editor-mode-bg' : ''}`} />
      <div className="absolute inset-0 chart-overlay z-20 opacity-40" />

      <div className="absolute right-0 top-0 bottom-0 w-3 md:w-5 bg-[#050505] border-l border-black z-10 flex flex-col items-center py-1">
        <div className={`flex-1 w-full rounded-full mx-0.5 opacity-90 transition-all duration-500 ${isEditMode ? 'bg-blue-600/30' : 'bg-gradient-to-t from-[#0052cc] via-[#22c55e] via-[#eab308] via-[#f97316] to-[#ef4444] shadow-[0_0_10px_rgba(255,255,255,0.1)]'}`} />
      </div>

      {/* GRÁFICO RECHARTS */}
      <div className="absolute inset-0 pr-6 md:pr-8 pl-1 pb-4 pt-2 z-10 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="mountainside" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isEditMode ? "#3b82f6" : "#ffffff"} stopOpacity={isEditMode ? 0.2 : 0.12}/>
                <stop offset="95%" stopColor={isEditMode ? "#3b82f6" : "#ffffff"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <XAxis dataKey="tempo" type="number" domain={[0, localDuration]} hide padding={{ left: 5, right: 5 }} />
            <YAxis domain={[0, 10]} hide />

            {[2, 4, 6, 8].map(zone => (
              <ReferenceLine key={zone} y={zone} stroke={isEditMode ? "#3b82f6" : "#ffffff"} strokeDasharray="4 4" strokeOpacity={isEditMode ? 0.15 : 0.05} />
            ))}

            {/* O type linear cria as arestas retas porque injetamos pontos de inicio e fim no chartData */}
            <Area type="linear" dataKey="intensidade" fill="url(#mountainside)" stroke="none" isAnimationActive={false} />

            <Line
              type="linear" dataKey="intensidade" stroke={isEditMode ? "#3b82f6" : "#ffffff"} strokeWidth={3}
              dot={false} activeDot={false} isAnimationActive={false}
              style={{ filter: `drop-shadow(0px 0px 6px ${isEditMode ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.4)'})` }}
            />

            {!isEditMode && (
              <>
                <ReferenceLine 
                  x={currentTime} stroke={telemetry.color} strokeWidth={isDragging ? 3 : 2}
                  strokeOpacity={0.6} className="telemetry-sync"
                  style={{ filter: `drop-shadow(0px 0px 8px ${telemetry.glow})` }}
                />
                <ReferenceDot 
                  x={currentTime} y={telemetry.y} r={isDragging ? 12 : 7} 
                  fill={telemetry.color} stroke="#ffffff" strokeWidth={isDragging ? 3 : 2}
                  isFront={true} className="telemetry-sync"
                  style={{ filter: `drop-shadow(0px 0px ${isDragging ? '20px' : '14px'} ${telemetry.glow})` }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* CAMADA INVISÍVEL 1: Scrubber de Tempo Normal */}
      {!isEditMode && localDuration > 0 && (
        <input 
          type="range" min={0} max={localDuration} step="0.1" value={currentTime}
          onMouseDown={onSeekStart} onTouchStart={onSeekStart}
          onChange={(e) => onSeek(Number(e.target.value))}
          onMouseUp={onSeekEnd} onTouchEnd={onSeekEnd}
          className="absolute top-0 bottom-0 left-1 right-6 md:right-8 w-[calc(100%-28px)] md:w-[calc(100%-36px)] h-full opacity-0 z-50 m-0"
          style={{ paddingLeft: '5px', paddingRight: '5px', touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        />
      )}

      {/* CAMADA INVISÍVEL 2: UI DO EDITOR VISUAL */}
      {isEditMode && localDuration > 0 && (
        <div ref={overlayRef} className="absolute top-0 bottom-0 left-1 right-6 md:right-8 w-[calc(100%-28px)] md:w-[calc(100%-36px)] z-50 pointer-events-none" style={{ paddingLeft: '5px', paddingRight: '5px' }}>
          <div className="relative w-full h-full">
            
            {/* ALÇAS INTERMEDIÁRIAS (Empurram a timeline toda) */}
            {localBlocos.slice(0, -1).map((bloco, idx) => {
              const leftPercent = (bloco.tempo_final / localDuration) * 100;
              return (
                <div 
                  key={idx}
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center cursor-ew-resize group pointer-events-auto"
                  style={{ left: `${leftPercent}%`, width: '30px', transform: 'translateX(-50%)', touchAction: 'none' }}
                  onPointerDown={(e) => { e.preventDefault(); setDragBoundary(idx); }}
                >
                  <div className={`w-[2px] h-full transition-colors ${dragBoundary === idx ? 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-blue-500/30 group-hover:bg-blue-400/80'}`} />
                  <div className={`absolute w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${dragBoundary === idx ? 'bg-blue-500 border-white scale-125 shadow-[0_0_15px_rgba(59,130,246,0.8)]' : 'bg-[#0f0f0f] border-blue-500 group-hover:scale-110 shadow-lg'}`}>
                     <div className="w-1 h-2.5 flex justify-between">
                        <div className="w-[1px] bg-blue-300/50 h-full"></div>
                        <div className="w-[1px] bg-blue-300/50 h-full"></div>
                     </div>
                  </div>
                </div>
              );
            })}

            {/* ALÇA FINAL EXCLUSIVA (Puxa e Encolhe o tempo total macro do treino) */}
            {localBlocos.length > 0 && (
              <div 
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center cursor-ew-resize group pointer-events-auto"
                  style={{ left: `100%`, width: '30px', transform: 'translateX(-50%)', touchAction: 'none' }}
                  onPointerDown={(e) => { e.preventDefault(); setDragBoundary('END'); }}
              >
                 <div className={`w-[4px] h-full transition-colors ${dragBoundary === 'END' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-red-600/50 group-hover:bg-red-500/80'}`} />
                 <div className={`absolute w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${dragBoundary === 'END' ? 'bg-red-600 border-white scale-110 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-[#0f0f0f] border-red-500 group-hover:scale-105 shadow-lg'}`}>
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
                        <path d="M9 18l6-6-6-6" />
                     </svg>
                 </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* HUD INFERIOR */}
      <div className="absolute bottom-1 left-4 right-12 flex justify-between items-end z-30 pointer-events-none">
        <div className="flex flex-col gap-1.5 mb-1">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] drop-shadow-md">Tracker OS v2</span>
        </div>

        <div className="flex items-center gap-2 bg-[#050505]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5 shadow-lg mb-1">
          <span 
            className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-300" 
            style={{ color: isEditMode ? (dragBoundary === 'END' ? '#ef4444' : '#3b82f6') : isDragging ? '#ef4444' : telemetry.color }}
          >
            {isEditMode ? (dragBoundary === 'END' ? 'MACRO STRETCH ATIVO' : 'MODO DE EDIÇÃO ATIVO') : isDragging ? '⚠ MANUAL OVERRIDE' : 'Sync Lossless'}
          </span>
          <span 
             className="text-[10px]"
             style={{ 
               color: isEditMode ? (dragBoundary === 'END' ? '#ef4444' : '#3b82f6') : isDragging ? '#ef4444' : telemetry.color, 
               animation: isEditMode || isDragging ? 'none' : `pulse ${pulseDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
               opacity: isEditMode || isDragging ? 1 : 0.8,
               textShadow: `0 0 8px ${isEditMode ? (dragBoundary === 'END' ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.8)') : isDragging ? 'rgba(239, 68, 68, 0.8)' : telemetry.glow}`
             }}>
             ●
          </span>
        </div>
      </div>
    </div>
  );
}