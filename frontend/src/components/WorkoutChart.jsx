import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';

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
  // Limites exatos do gradiente: 30% (Verde), 60% (Amarelo/Laranja), 80% (Vermelho)
  if (val <= 3.0) return interpolateColor('#0052cc', '#22c55e', val / 3.0); 
  if (val <= 6.0) return interpolateColor('#22c55e', '#eab308', (val - 3.0) / 3.0); 
  if (val <= 8.0) return interpolateColor('#eab308', '#ef4444', (val - 6.0) / 2.0); 
  return interpolateColor('#ef4444', '#b91c1c', (val - 8.0) / 2.0); 
};

const formatTime = (totalSeconds) => {
  if (totalSeconds < 0) return "00:00";
  const intSeconds = Math.floor(totalSeconds);
  const m = Math.floor(intSeconds / 60).toString().padStart(2, '0');
  const s = (intSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// --- COMPONENTE DA BARRA DE INTENSIDADE MINIMALISTA (DIREITA) ---
const IntensityBar = ({ intensity }) => {
  const percentage = Math.max(0, Math.min((intensity / 10) * 100, 100));
  const c = getSmoothColor(intensity);
  return (
    <div className="absolute right-0 top-6 bottom-6 w-2 md:w-3 bg-[#050505] border-l border-black z-10 flex flex-col items-center py-2">
      <div 
        className="flex-1 w-full rounded-full mx-0.5 opacity-90 transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.05)] relative"
        // O gradiente CSS espelha a exata matemática do getSmoothColor
        style={{ background: 'linear-gradient(to top, #0052cc 0%, #22c55e 30%, #eab308 60%, #ef4444 80%, #b91c1c 100%)' }}
      >
        {/* Marcador dinâmico de intensidade */}
        <div 
          className="absolute left-[-2px] right-[-2px] h-1.5 rounded-full border border-white shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all duration-75"
          style={{ bottom: `calc(${percentage}% - 3px)`, backgroundColor: `rgb(${c})` }}
        />
      </div>
    </div>
  );
};

// --- COMPONENTE CUSTOM DOT (MARCADORES DE ARESTA) ---
const CustomDot = (props) => {
  const { cx, cy, payload, isDragging, dragBoundary } = props;
  const isFinalDot = payload.isEnd === true; 
  const isSelected = isDragging && (dragBoundary === 'END' ? isFinalDot : dragBoundary === payload.index);

  return (
    <g 
      className={`transition-all duration-150 ${isSelected ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`}
      style={{ filter: isSelected ? `drop-shadow(0px 0px 15px currentColor)` : 'none' }}
    >
       <circle 
         cx={cx} cy={cy} 
         r={isSelected ? 16 : 8} 
         fill="#0a0a0a" 
         stroke="currentColor" strokeWidth={3}
         className="transition-all duration-300"
       />
       {isFinalDot ? (
          <path d="M9 18l6-6-6-6" transform={`translate(${cx - 12}, ${cy - 12})`} stroke={isSelected ? "currentColor" : "white"} strokeWidth={3} fill="none" className="opacity-80" />
       ) : (
          <g transform={`translate(${cx - 5}, ${cy - 5})`} className={isSelected ? "opacity-100 text-white" : "opacity-0"}>
            <rect x="2" y="1" width="2" height="8" fill="currentColor" rx="1" />
            <rect x="6" y="1" width="2" height="8" fill="currentColor" rx="1" />
          </g>
       )}
    </g>
  );
};
// --------------------------------------------

export default function WorkoutChart({ 
  data, currentTime, duration, currentRpm = 80,
  onSeekStart, onSeek, onSeekEnd,
  isDragging, isEditMode, onBlocksUpdate, onDurationPreview
}) {
  const overlayRef = useRef(null);
  
  const [dragBoundary, setDragBoundary] = useState(null); 
  const [localBlocos, setLocalBlocos] = useState([]);     
  const [localDuration, setLocalDuration] = useState(duration);

  const dragSnapshotRef = useRef(null); 
  const [hoverTime, setHoverTime] = useState(null); 

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

  // MOTOR FÍSICO ROLL EDIT
  useEffect(() => {
    if (dragBoundary === null) return;
    
    const handlePointerMove = (e) => {
      if (!overlayRef.current || !dragSnapshotRef.current) return; 
      
      const snap = dragSnapshotRef.current;
      const deltaX = e.clientX - snap.startMouseX;
      const deltaSeconds = Math.round(deltaX / snap.pixelsPerSecond);

      setLocalBlocos(prev => {
        const newBlocos = prev.map(b => ({ ...b })); 
        const idx = snap.idx;
        
        if (dragBoundary === 'END') {
           const minTotalTime = newBlocos.length > 1 ? newBlocos[newBlocos.length - 2].tempo_final + 5 : 5;
           const newTotal = Math.max(minTotalTime, snap.originalTempoFinal + deltaSeconds);
           
           const lastIdx = newBlocos.length - 1;
           newBlocos[lastIdx].tempo_final = newTotal;
           newBlocos[lastIdx].duracao = newTotal - newBlocos[lastIdx].tempo_inicial;
           
           setLocalDuration(newTotal);
           setHoverTime(newTotal);

           if (onDurationPreview) onDurationPreview(newTotal);
           
        } else {
           const prevTime = idx > 0 ? newBlocos[idx - 1].tempo_final : 0;
           const nextTime = newBlocos[idx + 1].tempo_final;
           
           let newTime = Math.max(prevTime + 5, Math.min(snap.originalTempoFinal + deltaSeconds, nextTime - 5));

           newBlocos[idx].tempo_final = newTime;
           newBlocos[idx].duracao = newTime - newBlocos[idx].tempo_inicial;

           newBlocos[idx + 1].tempo_inicial = newTime;
           newBlocos[idx + 1].duracao = newBlocos[idx + 1].tempo_final - newTime;

           setHoverTime(newTime);
        }
        return newBlocos;
      });
    };
    
    const handlePointerUp = () => {
      if (onBlocksUpdate) onBlocksUpdate(localBlocosRef.current);
      if (onDurationPreview) onDurationPreview(null);
      setDragBoundary(null);
      dragSnapshotRef.current = null;
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragBoundary, onBlocksUpdate, onDurationPreview]);

  const handlePointerDown = (e, idx) => {
    e.preventDefault();
    if (!overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    const safeDuration = Math.max(1, localDurationRef.current);
    
    if (idx === 'END') {
      dragSnapshotRef.current = { 
        idx: 'END',
        startMouseX: e.clientX,
        originalTempoFinal: localDurationRef.current,
        pixelsPerSecond: rect.width / safeDuration
      };
    } else {
      dragSnapshotRef.current = { 
        idx: idx,
        startMouseX: e.clientX,
        originalTempoFinal: localBlocosRef.current[idx].tempo_final,
        pixelsPerSecond: rect.width / safeDuration
      };
    }
    setHoverTime(idx === 'END' ? localDurationRef.current : localBlocosRef.current[idx].tempo_final);
    setDragBoundary(idx);
  };

  const pulseDuration = useMemo(() => {
     const safeRpm = Math.max(currentRpm, 1); 
     return (60 / safeRpm).toFixed(2);
  }, [currentRpm]);

  // GERAÇÃO DA MALHA TELEMÉTRICA (ECG LINEAR)
  const chartData = useMemo(() => {
    if (!localBlocos || localBlocos.length === 0) return [];
    
    const points = [{ tempo: 0, intensidade: 0 }];
    localBlocos.forEach((bloco, idx) => {
      points.push({ 
        index: idx,
        tempo: bloco.tempo_final, 
        intensidade: Math.max(0, bloco.intensidade),
        isEnd: idx === localBlocos.length - 1
      });
    });
    return points;
  }, [localBlocos]);

  // A MÁGICA: Interpolação para a bolinha acompanhar exatamente a inclinação da rampa
  const telemetry = useMemo(() => {
    if (chartData.length < 2 || currentTime <= 0) {
        const c = getSmoothColor(0);
        return { y: 0, color: `rgb(${c})`, glow: `rgba(${c}, 0.8)` };
    }
    if (currentTime >= localDuration) {
      const lastInt = chartData[chartData.length - 1].intensidade;
      const c = getSmoothColor(lastInt);
      return { y: lastInt, color: `rgb(${c})`, glow: `rgba(${c}, 0.8)` };
    }

    // Procura o segmento onde o currentTime está
    for (let i = 0; i < chartData.length - 1; i++) {
      const ponto1 = chartData[i];
      const ponto2 = chartData[i + 1];
      
      if (currentTime >= ponto1.tempo && currentTime <= ponto2.tempo) {
        const duracaoSegmento = ponto2.tempo - ponto1.tempo;
        const tempoPercorrido = currentTime - ponto1.tempo;
        const fatorInterpolacao = duracaoSegmento === 0 ? 0 : tempoPercorrido / duracaoSegmento;

        // Calcula a altura (y) exata na rampa
        const yInterpolado = ponto1.intensidade + fatorInterpolacao * (ponto2.intensidade - ponto1.intensidade);
        const rgbColor = getSmoothColor(yInterpolado);
        
        return { y: yInterpolado, color: `rgb(${rgbColor})`, glow: `rgba(${rgbColor}, ${isDragging ? '1' : '0.8'})` };
      }
    }
    
    return { y: 0, color: 'rgb(0, 82, 204)', glow: 'rgba(0, 82, 204, 0.8)' };
  }, [chartData, currentTime, localDuration, isDragging]);


  return (
    <div className={`w-full h-full relative bg-[#0a0a0a] overflow-hidden flex flex-col border-t border-[#1a1a1a] ${isEditMode ? '' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
      
      <style>{`
        @keyframes heartbeatSafe {
          0% { filter: drop-shadow(0 0 5px currentColor); stroke-width: 2px; }
          50% { filter: drop-shadow(0 0 15px currentColor); stroke-width: 5px; }
          100% { filter: drop-shadow(0 0 5px currentColor); stroke-width: 2px; }
        }
        .tech-grid {
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .editor-mode-bg {
          background: repeating-linear-gradient( 45deg, rgba(59, 130, 246, 0.02), rgba(59, 130, 246, 0.02) 10px, transparent 10px, transparent 20px);
        }
      `}</style>

      <div className={`flex-1 relative tech-grid px-4 pr-10 md:px-8 md:pr-14 ${isEditMode ? 'editor-mode-bg' : ''}`}>
         {[2, 4, 6, 8].map(zone => (
           <div key={zone} className="absolute w-full border-b border-white/5 z-0 left-0 right-0" style={{ bottom: `${(zone / 10) * 100}%` }}></div>
         ))}

         {/* GRÁFICO DE TELEMETRIA RECHARTS */}
         <div className="absolute inset-0 z-10 px-4 pr-10 md:px-8 md:pr-14">
           <ResponsiveContainer width="100%" height="100%">
             <ComposedChart data={chartData} margin={{ top: 60, right: 0, left: 0, bottom: 60 }}>
               <XAxis dataKey="tempo" type="number" domain={[0, localDuration]} hide padding={{ left: 0, right: 0 }} />
               <YAxis domain={[0, 10]} hide />

               <Line
                  type="linear" 
                  dataKey="intensidade"
                  stroke="#ffffff" 
                  strokeWidth={2}
                  dot={<CustomDot isDragging={isEditMode && dragBoundary !== null} dragBoundary={dragBoundary} />}
                  activeDot={false}
                  isAnimationActive={false}
                  style={{ filter: `drop-shadow(0px 0px 6px rgba(255,255,255, 0.5))` }}
               />

               {!isEditMode && (
                 <>
                   <ReferenceLine 
                      x={currentTime} stroke={telemetry.color} strokeWidth={isDragging ? 3 : 2} strokeOpacity={0.6} className="transition-colors"
                      style={{ filter: `drop-shadow(0px 0px 10px ${telemetry.color})` }}
                   />
                   <ReferenceDot 
                      x={currentTime} y={telemetry.y} r={isDragging ? 10 : 6} fill={telemetry.color} stroke="#ffffff" strokeWidth={2} isFront={true} className="transition-colors"
                      style={{ 
                          animation: (!isDragging && !isEditMode) ? `heartbeatSafe ${pulseDuration}s infinite ease-in-out` : 'none',
                          color: telemetry.color
                      }} 
                   />
                 </>
               )}
             </ComposedChart>
           </ResponsiveContainer>
         </div>
         
         {!isEditMode && localDuration > 0 && (
          <input 
            type="range" min={0} max={localDuration} step="0.1" value={currentTime}
            onMouseDown={onSeekStart} onTouchStart={onSeekStart} onChange={(e) => onSeek(Number(e.target.value))} onMouseUp={onSeekEnd} onTouchEnd={onSeekEnd}
            className="absolute top-0 bottom-0 left-0 right-10 w-full h-full opacity-0 z-50 cursor-pointer"
          />
         )}

         {/* ZONAS DE ARRASTO INVISÍVEIS ALINHADAS MATEMATICAMENTE */}
         {isEditMode && localDuration > 0 && (
          <div className="absolute inset-0 z-50 pointer-events-none px-4 pr-10 md:px-8 md:pr-14">
             <div ref={overlayRef} className="relative w-full h-full" style={{ top: '60px', height: 'calc(100% - 120px)' }}>
               
               {localBlocos.slice(0, -1).map((bloco, idx) => {
                  const leftPercent = localDuration > 0 ? (bloco.tempo_final / localDuration) * 100 : 0;
                  const bottomPercent = (bloco.intensidade / 10) * 100;
                  const isDraggingThis = dragBoundary === idx;
                  
                  const leftBlock = localBlocos[idx];
                  const rightBlock = localBlocos[idx + 1];
                  
                  return (
                    <div 
                      key={idx}
                      className="absolute group pointer-events-auto cursor-ew-resize"
                      style={{ 
                          left: `${leftPercent}%`, bottom: `${bottomPercent}%`,
                          width: '50px', height: '50px',
                          transform: `translate(-50%, 50%)`, 
                          touchAction: 'none' 
                      }}
                      onPointerDown={(e) => handlePointerDown(e, idx)}
                    >
                      {/* HUD FLUTUANTE DUPLO */}
                      {isDraggingThis && (
                        <div className={`absolute flex rounded-2xl border-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-all duration-100 z-[100] bg-[#050505] overflow-hidden border-blue-500`}
                          style={{ bottom: '60px', left: '50%', transform: 'translateX(-50%)' }} 
                        >
                          <div className="flex flex-col px-4 py-2 border-r border-white/10 items-end min-w-[110px]">
                            <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider truncate w-full text-right">{leftBlock.exercicio || `FASE ${idx + 1}`}</span>
                            <span className="font-mono text-lg font-bold text-blue-400">{formatTime(leftBlock.duracao)}</span>
                          </div>
                          
                          <div className="bg-blue-600/10 flex flex-col items-center justify-center px-4 border-r border-white/10 min-w-[90px]">
                             <span className="text-[9px] uppercase font-black text-blue-500 tracking-wider mb-1">Corte (Min)</span>
                             <span className="font-mono text-sm font-black text-white">{formatTime(hoverTime)}</span>
                          </div>

                          <div className="flex flex-col px-4 py-2 items-start min-w-[110px]">
                            <span className="text-[9px] uppercase font-black text-gray-500 tracking-wider truncate w-full text-left">{rightBlock.exercicio || `FASE ${idx + 2}`}</span>
                            <span className="font-mono text-lg font-bold text-gray-200">{formatTime(rightBlock.duracao)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ALÇA FINAL EXCLUSIVA (MACRO STRETCH) */}
                {localBlocos.length > 0 && (
                  <div 
                      className="absolute group pointer-events-auto cursor-ew-resize"
                      style={{ 
                          left: `100%`, bottom: `${(localBlocos[localBlocos.length - 1].intensidade / 10) * 100}%`,
                          width: '50px', height: '50px',
                          transform: `translate(-50%, 50%)`,
                          touchAction: 'none' 
                      }}
                      onPointerDown={(e) => handlePointerDown(e, 'END')}
                  >
                     {dragBoundary === 'END' && (
                        <div className={`absolute flex flex-col px-5 py-3 rounded-xl border-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-colors duration-200 z-[100] bg-black/90 backdrop-blur-md items-center border-red-500`}
                          style={{ bottom: '60px', left: '50%', transform: 'translateX(-50%)' }} 
                        >
                          <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Tempo Total</span>
                          <span className={`font-mono text-2xl font-black text-red-500`}>{formatTime(hoverTime)}</span>
                        </div>
                      )}
                  </div>
                )}
             </div>
          </div>
         )}
      </div>

      {/* BARRA DE INTENSIDADE A DIREITA */}
      <IntensityBar intensity={telemetry.y} />

      {/* HUD INFERIOR */}
      <div className="absolute bottom-1 left-4 right-12 flex justify-between items-end z-30 pointer-events-none pr-4 md:pr-6">
        <div className="flex flex-col gap-1.5 mb-1">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] drop-shadow-md">Tracker OS v2</span>
        </div>

        <div className="flex items-center gap-2 bg-[#050505]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5 shadow-lg mb-1 transition-colors duration-300"
           style={{ borderColor: isEditMode ? '#3b82f6' : (isDragging ? '#ef4444' : telemetry.color) }}
        >
          <span 
            className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-300" 
            style={{ color: isEditMode ? '#3b82f6' : isDragging ? '#ef4444' : telemetry.color }}
          >
            {isEditMode ? 'MODO DE EDIÇÃO ATIVO' : isDragging ? '⚠ MANUAL OVERRIDE' : 'Sync Lossless'}
          </span>
          <span 
             className="text-[10px] transition-colors duration-300"
             style={{ 
               color: isEditMode ? '#3b82f6' : isDragging ? '#ef4444' : telemetry.color, 
               animation: isEditMode || isDragging ? 'none' : `heartbeatSafe ${pulseDuration}s infinite ease-in-out`,
               textShadow: `0 0 8px ${isEditMode ? '#3b82f6' : isDragging ? '#ef4444' : telemetry.color}`
             }}>
             ●
          </span>
        </div>
      </div>
    </div>
  );
}