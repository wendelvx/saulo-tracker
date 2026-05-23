import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, ReferenceDot, Area, ComposedChart } from 'recharts';

export default function WorkoutChart({ data, currentTime, duration, currentRpm = 80 }) {
  
  // 1. Geração da "Malha" do Treino
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const points = [{ tempo: 0, intensidade: 0 }];
    data.forEach((bloco) => {
      points.push({ tempo: bloco.tempo_final, intensidade: bloco.intensidade });
    });
    return points;
  }, [data]);

  // 2. O CÉREBRO DA TELEMETRIA: Calcula Y, Cor e Brilho baseados na Ação Atual
  const telemetry = useMemo(() => {
    if (chartData.length < 2 || currentTime <= 0) {
      return { y: 0, color: '#00d2ff', glow: 'rgba(0, 210, 255, 0.8)' };
    }
    
    if (currentTime >= duration) {
      return { y: chartData[chartData.length - 1].intensidade, color: '#334155', glow: 'rgba(51, 65, 85, 0.8)' };
    }

    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const next = chartData[i];
      
      if (currentTime >= prev.tempo && currentTime <= next.tempo) {
        const progress = (currentTime - prev.tempo) / (next.tempo - prev.tempo);
        const currentY = prev.intensidade + (next.intensidade - prev.intensidade) * progress;

        let activeColor = '#ffffff';
        let activeGlow = 'rgba(255,255,255,0.8)';

        if (next.intensidade > prev.intensidade) {
          activeColor = '#ff2a2a';
          activeGlow = 'rgba(255, 42, 42, 1)';
        } 
        else if (next.intensidade < prev.intensidade) {
          activeColor = '#00d2ff';
          activeGlow = 'rgba(0, 210, 255, 1)';
        } 
        else {
          if (currentY > 8) { activeColor = '#ef4444'; activeGlow = 'rgba(239, 68, 68, 0.8)'; }
          else if (currentY > 6) { activeColor = '#f97316'; activeGlow = 'rgba(249, 115, 22, 0.8)'; }
          else if (currentY > 4) { activeColor = '#eab308'; activeGlow = 'rgba(234, 179, 8, 0.8)'; }
          else if (currentY > 2) { activeColor = '#22c55e'; activeGlow = 'rgba(34, 197, 94, 0.8)'; }
          else { activeColor = '#0052cc'; activeGlow = 'rgba(0, 82, 204, 0.8)'; }
        }

        return { y: currentY, color: activeColor, glow: activeGlow };
      }
    }
    return { y: 0, color: '#00d2ff', glow: 'rgba(0, 210, 255, 0.8)' };
  }, [chartData, currentTime, duration]);

  // CÁLCULO DINÂMICO DE VELOCIDADE (RPM -> Segundos de animação)
  const pulseDuration = useMemo(() => {
     const safeRpm = Math.max(currentRpm, 1); 
     return (60 / safeRpm).toFixed(2);
  }, [currentRpm]);

  return (
    <div className="w-full h-full relative bg-[#0f0f0f] overflow-hidden border-t border-[#1a1a1a]">
      
      <style>{`
        @keyframes heartbeat {
          0% { stroke-width: 2px; filter: brightness(1); }
          50% { stroke-width: 4px; filter: brightness(1.3); }
          100% { stroke-width: 2px; filter: brightness(1); }
        }
        .telemetry-sync line {
          transition: transform 0.03s linear, x1 0.03s linear, x2 0.03s linear, stroke 0.4s ease, stroke-opacity 0.4s ease;
          will-change: transform, x1, x2, stroke;
        }
        .telemetry-sync circle {
          transition: transform 0.03s linear, cx 0.03s linear, cy 0.03s linear, fill 0.4s ease, filter 0.4s ease;
          will-change: transform, cx, cy, fill, filter;
          animation: heartbeat ${pulseDuration}s infinite ease-in-out;
        }
        .chart-overlay {
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), 
                      linear-gradient(90deg, rgba(255, 0, 0, 0.01), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.01));
          background-size: 100% 4px, 3px 100%;
          pointer-events: none;
        }
      `}</style>

      <div className="absolute inset-0 chart-overlay z-20 opacity-40" />

      <div className="absolute right-0 top-0 bottom-0 w-3 md:w-5 bg-[#050505] border-l border-black z-10 flex flex-col items-center py-1">
        <div className="flex-1 w-full bg-gradient-to-t from-[#0052cc] via-[#22c55e] via-[#eab308] via-[#f97316] to-[#ef4444] rounded-full mx-0.5 opacity-90 shadow-[0_0_10px_rgba(255,255,255,0.1)]" />
      </div>

      <div className="absolute inset-0 pr-6 md:pr-8 pl-1 pb-4 pt-2 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="mountainside" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <XAxis dataKey="tempo" type="number" domain={[0, duration]} hide padding={{ left: 5, right: 5 }} />
            <YAxis domain={[0, 10]} hide />

            {[2, 4, 6, 8].map(zone => (
              <ReferenceLine 
                key={zone} y={zone} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.1} 
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

            <ReferenceLine 
              x={currentTime} 
              stroke={telemetry.color} 
              strokeWidth={2}
              strokeOpacity={0.6}
              className="telemetry-sync"
              style={{ filter: `drop-shadow(0px 0px 8px ${telemetry.glow})` }}
            />

            <ReferenceDot 
              x={currentTime} 
              y={telemetry.y} 
              r={7} 
              fill={telemetry.color} 
              stroke="#ffffff" 
              strokeWidth={2}
              isFront={true}
              className="telemetry-sync"
              style={{ filter: `drop-shadow(0px 0px 14px ${telemetry.glow})` }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute bottom-1 left-4 right-12 hidden sm:flex justify-between items-center z-30 pointer-events-none">
        <div className="flex gap-4">
          <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">Tracker OS v2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]" style={{ color: telemetry.color }}>
            Sync Lossless
          </span>
          <span 
             style={{ 
               color: telemetry.color, 
               animation: `pulse ${pulseDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite` 
             }}>
             ●
          </span>
        </div>
      </div>
    </div>
  );
}