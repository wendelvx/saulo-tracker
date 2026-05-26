import React, { useMemo } from 'react';
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

// Mapeia Y (0 a 10) para o degradê exato da barra lateral
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
  isDragging 
}) {
  
  // 1. Geração da "Malha" do Treino
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const points = [{ tempo: 0, intensidade: 0 }];
    data.forEach((bloco) => {
      points.push({ tempo: bloco.tempo_final, intensidade: bloco.intensidade });
    });
    return points;
  }, [data]);

  // 2. Cálculo da Posição e Cor (Telemetria)
  const telemetry = useMemo(() => {
    if (chartData.length < 2 || currentTime <= 0) {
      return { y: 0, color: 'rgb(0, 82, 204)', glow: 'rgba(0, 82, 204, 0.8)' };
    }
    
    if (currentTime >= duration) {
      const lastColor = getSmoothColor(chartData[chartData.length - 1].intensidade);
      return { y: chartData[chartData.length - 1].intensidade, color: `rgb(${lastColor})`, glow: `rgba(${lastColor}, 0.8)` };
    }

    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const next = chartData[i];
      
      if (currentTime >= prev.tempo && currentTime <= next.tempo) {
        const progress = (currentTime - prev.tempo) / (next.tempo - prev.tempo);
        const currentY = prev.intensidade + (next.intensidade - prev.intensidade) * progress;

        const rgbColor = getSmoothColor(currentY);

        return { 
          y: currentY, 
          color: `rgb(${rgbColor})`, 
          glow: `rgba(${rgbColor}, ${isDragging ? '1' : '0.8'})`
        };
      }
    }
    return { y: 0, color: 'rgb(0, 82, 204)', glow: 'rgba(0, 82, 204, 0.8)' };
  }, [chartData, currentTime, duration, isDragging]);

  // CÁLCULO DINÂMICO DE VELOCIDADE (RPM -> Segundos de animação)
  // Quanto maior o RPM, menor o tempo da animação (gira/pulsa mais rápido)
  const pulseDuration = useMemo(() => {
     const safeRpm = Math.max(currentRpm, 1); 
     return (60 / safeRpm).toFixed(2);
  }, [currentRpm]);

  return (
    <div className={`w-full h-full relative bg-[#0f0f0f] overflow-hidden border-t border-[#1a1a1a] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
      
      <style>{`
        @keyframes heartbeat {
          0% { stroke-width: 2px; filter: brightness(1); }
          50% { stroke-width: 4px; filter: brightness(1.3); }
          100% { stroke-width: 2px; filter: brightness(1); }
        }
        @keyframes spinGear {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
          ${!isDragging ? `animation: heartbeat ${pulseDuration}s infinite ease-in-out;` : ''}
        }
        .chart-overlay {
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), 
                      linear-gradient(90deg, rgba(255, 0, 0, 0.01), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.01));
          background-size: 100% 4px, 3px 100%;
          pointer-events: none;
        }
        /* Malha de fundo para visual técnico */
        .tech-grid {
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
      `}</style>

      {/* Camadas de Textura Visual */}
      <div className="absolute inset-0 tech-grid z-0" />
      <div className="absolute inset-0 chart-overlay z-20 opacity-40" />

      {/* Barra de cores de referência à direita */}
      <div className="absolute right-0 top-0 bottom-0 w-3 md:w-5 bg-[#050505] border-l border-black z-10 flex flex-col items-center py-1">
        <div className="flex-1 w-full bg-gradient-to-t from-[#0052cc] via-[#22c55e] via-[#eab308] via-[#f97316] to-[#ef4444] rounded-full mx-0.5 opacity-90 shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
      </div>

      {/* GRÁFICO RECHARTS */}
      <div className="absolute inset-0 pr-6 md:pr-8 pl-1 pb-4 pt-2 z-10 pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="mountainside" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.12}/>
                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <XAxis dataKey="tempo" type="number" domain={[0, duration]} hide padding={{ left: 5, right: 5 }} />
            <YAxis domain={[0, 10]} hide />

            {[2, 4, 6, 8].map(zone => (
              <ReferenceLine 
                key={zone} y={zone} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.05} 
              />
            ))}

            <Area 
              type="linear" dataKey="intensidade" fill="url(#mountainside)" stroke="none" isAnimationActive={false} 
            />

            <Line
              type="linear" dataKey="intensidade" stroke="#ffffff" strokeWidth={3}
              dot={{ r: 4, fill: '#0a0a0a', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={false} isAnimationActive={false}
              style={{ filter: 'drop-shadow(0px 0px 6px rgba(255,255,255,0.4))' }}
            />

            {/* Linha vertical sincronizada */}
            <ReferenceLine 
              x={currentTime} 
              stroke={telemetry.color} 
              strokeWidth={isDragging ? 3 : 2}
              strokeOpacity={0.6}
              className="telemetry-sync"
              style={{ filter: `drop-shadow(0px 0px 8px ${telemetry.glow})` }}
            />

            {/* Bolinha principal brilhante */}
            <ReferenceDot 
              x={currentTime} 
              y={telemetry.y} 
              r={isDragging ? 12 : 7} // Cresce mais ao arrastar (feedback tátil)
              fill={telemetry.color} 
              stroke="#ffffff" 
              strokeWidth={isDragging ? 3 : 2}
              isFront={true}
              className="telemetry-sync"
              style={{ filter: `drop-shadow(0px 0px ${isDragging ? '20px' : '14px'} ${telemetry.glow})` }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* CONTROLE DE DRAG (SCRUBBER INVISÍVEL) */}
      {duration > 0 && (
        <input 
          type="range"
          min={0}
          max={duration}
          step="0.1"
          value={currentTime}
          onMouseDown={onSeekStart}
          onTouchStart={onSeekStart}
          onChange={(e) => onSeek(Number(e.target.value))}
          onMouseUp={onSeekEnd}
          onTouchEnd={onSeekEnd}
          className="absolute top-0 bottom-0 left-1 right-6 md:right-8 w-[calc(100%-28px)] md:w-[calc(100%-36px)] h-full opacity-0 z-50 m-0"
          style={{ 
             paddingLeft: '5px', 
             paddingRight: '5px',
             touchAction: 'none',
             cursor: isDragging ? 'grabbing' : 'grab' // Força o cursor via style também
          }}
        />
      )}

      {/* MICRO-INTERAÇÕES: HUD INFERIOR DO GRÁFICO */}
      <div className="absolute bottom-1 left-2 right-12 flex justify-between items-end z-30 pointer-events-none">
        
        {/* Lado Esquerdo: Marca e RPM Dinâmico */}
        <div className="flex flex-col gap-1.5 ml-2 mb-1">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Tracker OS v2</span>
          
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10 shadow-lg">
            <span 
              className="inline-block text-[10px]"
              style={{ 
                animation: `spinGear ${pulseDuration}s linear infinite`,
                filter: isDragging ? 'grayscale(100%) opacity(0.5)' : 'none'
              }}
            >
              ⚙️
            </span>
            <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: isDragging ? '#666' : '#fff' }}>
              {currentRpm} RPM
            </span>
          </div>
        </div>

        {/* Lado Direito: Status da Sincronização */}
        <div className="flex items-center gap-2 bg-[#050505]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5 shadow-lg mb-1">
          <span 
            className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-300" 
            style={{ color: isDragging ? '#ef4444' : telemetry.color }}
          >
            {isDragging ? '⚠ MANUAL OVERRIDE' : 'Sync Lossless'}
          </span>
          <span 
             className="text-[10px]"
             style={{ 
               color: isDragging ? '#ef4444' : telemetry.color, 
               animation: isDragging ? 'none' : `pulse ${pulseDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite`,
               opacity: isDragging ? 1 : 0.8,
               textShadow: `0 0 8px ${isDragging ? 'rgba(239, 68, 68, 0.8)' : telemetry.glow}`
             }}>
             ●
          </span>
        </div>
      </div>
      
    </div>
  );
}