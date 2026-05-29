import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Play, Pause, RotateCcw, Settings, Activity, Edit2, Trash2, Maximize } from 'lucide-react';
import WorkoutChart from './components/WorkoutChart';
import WorkoutForm from './components/WorkoutForm';

const API = "http://localhost:3001/api";

const formatTime = (totalSeconds) => {
  if (totalSeconds < 0) return "00:00";
  const intSeconds = Math.floor(totalSeconds);
  const m = Math.floor(intSeconds / 60).toString().padStart(2, '0');
  const s = (intSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const getCargaDetails = (intensidade) => {
  if (!intensidade) return { label: '-', color: 'text-gray-500', bg: 'bg-[#111]' };
  if (intensidade <= 3) return { label: 'BAIXA', color: 'text-blue-500', bg: 'bg-[#0052cc]' };
  if (intensidade <= 5) return { label: 'MÉDIA', color: 'text-green-500', bg: 'bg-[#22c55e]' };
  if (intensidade <= 7) return { label: 'MÉDIA+', color: 'text-orange-500', bg: 'bg-[#f97316]' };
  if (intensidade <= 9) return { label: 'ALTA', color: 'text-red-500', bg: 'bg-[#ef4444]' };
  return { label: 'MÁX', color: 'text-red-600', bg: 'bg-[#b91c1c]' };
};

export default function App() {
  const [treinos, setTreinos] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutToEdit, setWorkoutToEdit] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [obsMode, setObsMode] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isVisualEditMode, setIsVisualEditMode] = useState(false); 
  
  const [previewDuration, setPreviewDuration] = useState(null);
  
  const wasRunningRef = useRef(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastAccumulatedRef = useRef(0);

  const stateRef = useRef({ isRunning, isCountingDown, activeWorkout });
  useEffect(() => {
    stateRef.current = { isRunning, isCountingDown, activeWorkout };
  }, [isRunning, isCountingDown, activeWorkout]);

  useEffect(() => { fetchTreinos(); }, []);

  const fetchTreinos = async () => {
    try {
      const res = await axios.get(`${API}/treinos`);
      setTreinos(res.data);
      
      setActiveWorkout(prevActive => {
        if (!prevActive) return null;
        const updatedWorkout = res.data.find(t => t.id === prevActive.id);
        return updatedWorkout || prevActive; 
      });
      
    } catch (err) { 
      console.error("Erro ao carregar treinos", err); 
    }
  };

  const saveWorkout = async (workoutData) => {
    try {
      if (workoutData.id) {
        await axios.put(`${API}/treinos/${workoutData.id}`, workoutData);
        setWorkoutToEdit(null);
        setIsVisualEditMode(false);
        setPreviewDuration(null); 
      } else {
        await axios.post(`${API}/treinos`, workoutData);
      }
      fetchTreinos();
    } catch (err) { console.error("Erro ao salvar", err); alert("Erro ao salvar treino."); }
  };

  const deleteWorkout = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este treino?")) return;

    try {
      await axios.delete(`${API}/treinos/${id}`);
      if (activeWorkout?.id === id) {
        setActiveWorkout(null);
        handleReset();
      }
      if (workoutToEdit?.id === id) setWorkoutToEdit(null);
      fetchTreinos();
    } catch (err) { console.error("Erro ao excluir", err); }
  };

  const handleEditClick = (treino, e) => {
    e.stopPropagation();
    setWorkoutToEdit(treino);
    setShowConfig(true);
  };

  const handlePlayPause = () => {
    if (isVisualEditMode) return; 
    
    const { activeWorkout: aw, isRunning: r, isCountingDown: c } = stateRef.current;
    if (!aw) return;

    if (!r && lastAccumulatedRef.current === 0 && !c) {
      setIsCountingDown(true);
      setCountdownValue(5);
    } else {
      setIsRunning(!r);
    }
  };

  const handleSeekStart = () => {
    if (isVisualEditMode) return;
    setIsDragging(true);
    wasRunningRef.current = stateRef.current.isRunning;
    if (stateRef.current.isRunning) setIsRunning(false);
    if (stateRef.current.isCountingDown) setIsCountingDown(false);
  };

  const handleSeek = (newTime) => {
    if (isVisualEditMode || !stateRef.current.activeWorkout) return;
    const safeTime = Math.max(0, Math.min(newTime, stateRef.current.activeWorkout.duracao_total));
    setCurrentTime(safeTime);
    lastAccumulatedRef.current = safeTime;
  };

  const handleSeekEnd = () => {
    if (isVisualEditMode) return;
    setIsDragging(false);
    if (wasRunningRef.current) setIsRunning(true);
  };

  const handleChartBlocksUpdate = (newBlocos) => {
    if (!activeWorkout) return;
    
    const newTotalDuration = newBlocos.length > 0 ? newBlocos[newBlocos.length - 1].tempo_final : 0;
    
    const updatedWorkout = {
      ...activeWorkout,
      duracao_total: newTotalDuration,
      blocos: newBlocos
    };

    setActiveWorkout(updatedWorkout);
    setWorkoutToEdit(updatedWorkout);
    if (!showConfig) setShowConfig(true);
  };

  useEffect(() => {
    if (isCountingDown && countdownValue > 0) {
      const timer = setTimeout(() => setCountdownValue(v => v - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isCountingDown && countdownValue === 0) {
      const timer = setTimeout(() => {
        setIsCountingDown(false);
        setIsRunning(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCountingDown, countdownValue]);

  useEffect(() => {
    if (isRunning && activeWorkout && !isVisualEditMode) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = (now - startTimeRef.current) / 1000;
        const totalTime = lastAccumulatedRef.current + delta;

        if (totalTime >= activeWorkout.duracao_total) {
          setCurrentTime(activeWorkout.duracao_total);
          setIsRunning(false);
        } else {
          setCurrentTime(totalTime);
        }
      }, 30);
    } else {
      lastAccumulatedRef.current = currentTime;
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, activeWorkout, isVisualEditMode]);

  const handleReset = () => {
    setIsRunning(false);
    setIsCountingDown(false);
    setCurrentTime(0);
    setPreviewDuration(null); 
    lastAccumulatedRef.current = 0;
    startTimeRef.current = null;
  };

  const toggleObsMode = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(err => console.error(err));
      setObsMode(true);
      setShowConfig(false);
    } else {
      await document.exitFullscreen().catch(err => console.error(err));
      setObsMode(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setObsMode(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.code === 'KeyF' || e.code === 'Keyf') {
        e.preventDefault();
        toggleObsMode();
      }
      if (e.code === 'KeyR' || e.code === 'Keyr') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); 

  const stats = useMemo(() => {
    if (!activeWorkout) return null;
    const current = activeWorkout.blocos.find(b => currentTime >= b.tempo_inicial && currentTime < b.tempo_final);
    const nextIndex = activeWorkout.blocos.findIndex(b => b.tempo_inicial >= (current?.tempo_final || 0));
    const next = nextIndex !== -1 ? activeWorkout.blocos[nextIndex] : null;

    return {
      current: current || activeWorkout.blocos[activeWorkout.blocos.length - 1],
      next: next,
    };
  }, [activeWorkout, currentTime]);

  return (
    <div className={`bg-[#050505] text-white font-sans selection:bg-orange-600/30 overflow-hidden antialiased flex flex-col w-screen h-screen`}>

      {isCountingDown && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-[20vw] font-black italic tracking-tighter animate-pulse flex flex-col items-center">
            {countdownValue > 0 ? (
              <span className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">{countdownValue}</span>
            ) : (
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent drop-shadow-[0_0_50px_rgba(234,88,12,0.8)]">
                GO!
              </span>
            )}
            {countdownValue > 0 && <span className="text-2xl text-gray-500 uppercase tracking-[0.5em] mt-4">PREPARE-SE</span>}
          </div>
        </div>
      )}

      <main className={`mx-auto flex flex-col flex-1 w-full min-h-0 ${obsMode ? 'p-2' : 'p-3 md:p-6 max-w-[1700px]'}`}>

        <div className={`flex-1 min-h-0 grid gap-6 transition-all duration-700 ease-in-out ${showConfig && !obsMode ? 'lg:grid-cols-[1fr_420px]' : 'grid-cols-1'}`}>

          <div className={`flex flex-col h-full min-h-0 w-full mx-auto ${obsMode ? 'max-w-none' : 'max-w-[1250px]'}`}>

            {!obsMode && (
              <div className="flex justify-between items-center mb-5 shrink-0 animate-in fade-in slide-in-from-top-4">

                <div className="flex items-center">
                  <img
                    src="/saulo.png"
                    alt="Saulo Logo"
                    className="h-10 md:h-12 w-auto object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                  />
                </div>

                <div className="flex gap-3 bg-[#111] p-1.5 rounded-2xl border border-[#222]">
                  <button onClick={toggleObsMode} className="p-3 bg-[#1a1a1a] hover:bg-[#252525] rounded-xl text-gray-400 hover:text-white transition-all group relative">
                    <Maximize size={20} />
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">Modo OBS (F)</span>
                  </button>
                  <div className="w-[1px] bg-[#333] mx-1 my-2"></div>
                  <button
                    onClick={handlePlayPause}
                    disabled={isVisualEditMode}
                    className={`p-3 rounded-xl flex items-center justify-center transition-all active:scale-95 ${isVisualEditMode ? 'bg-[#1a1a1a] text-[#444] cursor-not-allowed' : isRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'}`}
                  >
                    {isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={handleReset} className="p-3 bg-[#1a1a1a] hover:bg-[#252525] rounded-xl text-gray-400 hover:text-white transition-all">
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className={`p-3 rounded-xl transition-all ${showConfig ? 'bg-blue-600' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'}`}
                  >
                    <Settings size={20} />
                  </button>
                </div>
              </div>
            )}

            {activeWorkout ? (
              <div className={`flex flex-col flex-1 min-h-0 bg-[#0a0a0a] border-[4px] border-[#1a1a1a] overflow-hidden shadow-2xl transition-all ${obsMode ? 'rounded-2xl' : 'rounded-[2rem]'}`}>

                <div className="shrink-0 flex flex-col font-bold border-b-[4px] border-[#1a1a1a]">

                  <div className="flex justify-between items-center px-4 md:px-6 py-3 bg-[#050505] border-b-2 border-[#151515]">
                    
                    <div className="flex items-center">
                      <img
                        src="/saulo.png"
                        alt="Saulo Logo"
                        className="h-8 md:h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      {!obsMode && (
                        <div className="flex bg-[#111] p-1 rounded-lg border border-[#222]">
                          <button 
                            onClick={() => {
                              setIsVisualEditMode(false);
                              setPreviewDuration(null); 
                            }}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${!isVisualEditMode ? 'bg-orange-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                          >
                            Telemetria
                          </button>
                          <button 
                            onClick={() => {
                              setIsRunning(false);
                              setWorkoutToEdit(activeWorkout);
                              setShowConfig(true);
                              setIsVisualEditMode(true);
                            }}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-1 ${isVisualEditMode ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                          >
                            <Edit2 size={10}/> Editor Visual
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col text-right">
                        <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Progresso Total</span>
                        <span className="text-white font-mono font-black italic text-lg md:text-xl leading-none">
                          <span className={isVisualEditMode ? "text-blue-500" : "text-orange-500"}>
                            {formatTime(currentTime)}
                          </span>
                          <span className="text-gray-700 mx-1">/</span>
                          <span className={previewDuration !== null ? "text-red-500 transition-colors" : ""}>
                            {formatTime(previewDuration !== null ? previewDuration : activeWorkout.duracao_total)}
                          </span>
                        </span>
                      </div>
                    </div>

                  </div>

                  <div className="grid grid-cols-[1fr_2fr_1.5fr_1fr] text-center text-[10px] md:text-xs uppercase tracking-[0.2em] text-gray-500 bg-black py-2 border-b-2 border-[#151515]">
                    <div>Tempo</div><div>Método</div><div>Carga</div><div>RPM</div>
                  </div>

                  <div className="grid grid-cols-[1fr_2fr_1.5fr_1fr] text-center items-stretch bg-[#050505] transition-all">

                    <div
                      className="py-4 px-2 flex items-center justify-center border-r-[4px] border-[#1a1a1a] tabular-nums font-mono text-white italic"
                      style={obsMode ? { fontSize: 'clamp(2rem, 5vw, 6rem)' } : { fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
                    >
                      {formatTime((stats?.current?.tempo_final || 0) - currentTime)}
                    </div>

                    {/* SOLUÇÃO DE TIPOGRAFIA FLUIDA (Sem truncate) */}
                    <div
                      className="py-4 px-2 sm:px-4 flex items-center justify-center border-r-[4px] border-[#1a1a1a] bg-[#ea580c] uppercase text-white italic min-w-0"
                      // A matemática do clamp foi reduzida ligeiramente para caber textos longos.
                      style={obsMode ? { fontSize: 'clamp(1.2rem, 3vw, 5.5rem)' } : { fontSize: 'clamp(0.8rem, 1.8vw, 2.2rem)' }}
                    >
                      <span className="drop-shadow-md w-full px-1 md:px-2 whitespace-normal break-words text-center leading-[1.1]">
                        {stats?.current?.exercicio || 'RECUPERA'}
                      </span>
                    </div>

                    <div
                      className={`py-4 px-2 sm:px-4 flex flex-col items-center justify-center border-r-[4px] border-[#1a1a1a] uppercase italic leading-tight ${stats?.current?.intensidade ? getCargaDetails(stats?.current?.intensidade).color : 'text-gray-600'}`}
                      style={obsMode ? { fontSize: 'clamp(1.5rem, 3.5vw, 5rem)' } : { fontSize: 'clamp(1.1rem, 2vw, 1.8rem)' }}
                    >
                       <span className="drop-shadow-md whitespace-normal leading-tight text-center">
                         <span className="font-black">{stats?.current?.intensidade || '-'}</span>
                         {stats?.current?.intensidade && (
                           <span className="block text-[0.4em] tracking-widest opacity-80 mt-1">{getCargaDetails(stats?.current?.intensidade).label}</span>
                         )}
                       </span>
                    </div>

                    <div 
                      className="py-4 px-2 flex items-center justify-center bg-black text-white font-mono italic leading-none relative overflow-hidden"
                      style={obsMode ? { fontSize: 'clamp(2rem, 5vw, 6rem)' } : { fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
                    >
                      <style>{`
                        @keyframes spinGearApp {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                      `}</style>
                      
                      <div className="flex items-center gap-3 z-10">
                        <div 
                          className={isVisualEditMode ? "text-blue-500" : "text-orange-500"}
                          style={{ 
                            animation: isRunning ? `spinGearApp ${(60 / Math.max(stats?.current?.rpm || 80, 1)).toFixed(2)}s linear infinite` : 'none',
                            filter: !isRunning ? 'grayscale(100%) opacity(0.3)' : `drop-shadow(0 0 10px ${isVisualEditMode ? 'rgba(59,130,246,0.6)' : 'rgba(249,115,22,0.6)'})`
                          }}
                        >
                          <svg 
                            width={obsMode ? "70" : "32"} 
                            height={obsMode ? "70" : "32"} 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/>
                            <path d="M4.9 4.9l2.1 2.1"/><path d="M17 17l2.1 2.1"/><path d="M4.9 19.1l2.1-2.1"/><path d="M17 7l2.1-2.1"/>
                          </svg>
                        </div>
                        <span className="ml-1">{stats?.current?.rpm || 80}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_2fr_1.5fr_1fr] text-center items-stretch bg-[#111] opacity-80">
                    <div
                      className="py-2 sm:py-3 px-2 flex items-center justify-center border-r-[4px] border-[#1a1a1a] text-gray-400 tabular-nums font-mono"
                      style={obsMode ? { fontSize: 'clamp(1.2rem, 1.5vw, 2rem)' } : { fontSize: 'clamp(1rem, 1.2vw, 1.5rem)' }}
                    >
                      {stats?.next ? formatTime(stats.next.tempo_final - stats.next.tempo_inicial) : '00:00'}
                    </div>
                    {/* SOLUÇÃO DE TIPOGRAFIA FLUIDA (Sem truncate) */}
                    <div
                      className="py-2 sm:py-3 px-2 flex items-center justify-center border-r-[4px] border-[#1a1a1a] uppercase text-gray-400 bg-[#0d0d0d] min-w-0"
                      style={obsMode ? { fontSize: 'clamp(0.9rem, 1.2vw, 2rem)' } : { fontSize: 'clamp(0.65rem, 1vw, 1.2rem)' }}
                    >
                      <span className="w-full px-1 md:px-2 whitespace-normal break-words text-center leading-[1.1]">
                        {stats?.next ? stats.next.exercicio : 'FIM'}
                      </span>
                    </div>
                    <div
                      className={`py-2 sm:py-3 px-2 flex flex-col items-center justify-center border-r-[4px] border-[#1a1a1a] uppercase leading-tight ${stats?.next ? getCargaDetails(stats?.next?.intensidade).color : 'text-gray-700'}`}
                      style={obsMode ? { fontSize: 'clamp(1rem, 1.5vw, 2rem)' } : { fontSize: 'clamp(0.9rem, 1.2vw, 1.2rem)' }}
                    >
                      <span className="whitespace-normal leading-tight text-center flex items-center gap-2">
                        <span className="font-black">{stats?.next ? stats.next.intensidade : '-'}</span>
                        {stats?.next && (
                          <span className="text-[0.6em] tracking-widest opacity-70">{getCargaDetails(stats?.next?.intensidade).label}</span>
                        )}
                      </span>
                    </div>
                    <div
                      className="py-2 sm:py-3 px-2 flex items-center justify-center bg-black text-gray-500 font-mono italic leading-none"
                      style={obsMode ? { fontSize: 'clamp(1.2rem, 1.5vw, 2rem)' } : { fontSize: 'clamp(1rem, 1.2vw, 1.5rem)' }}
                    >
                      {stats?.next ? (stats.next.rpm || 80) : '-'}
                    </div>
                  </div>
                </div>

                <div className="relative flex-1 min-h-0 bg-[#181818]">
                  <WorkoutChart
                    data={activeWorkout.blocos}
                    currentTime={currentTime}
                    duration={activeWorkout.duracao_total}
                    currentRpm={stats?.current?.rpm || 80}
                    onSeekStart={handleSeekStart}
                    onSeek={handleSeek}
                    onSeekEnd={handleSeekEnd}
                    isDragging={isDragging}
                    isEditMode={isVisualEditMode}
                    onBlocksUpdate={handleChartBlocksUpdate}
                    onDurationPreview={setPreviewDuration} 
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center border-[4px] border-dashed border-[#1a1a1a] rounded-[3rem] text-gray-600 bg-[#080808]">
                <div className="bg-[#111] p-8 rounded-full mb-6 text-gray-800"><Play size={60} fill="currentColor" /></div>
                <h2 className="text-2xl font-bold uppercase tracking-widest text-gray-500">Selecione um Treino</h2>
              </div>
            )}
          </div>

          {showConfig && !obsMode && (
            <aside className="flex flex-col gap-5 h-full min-h-0 overflow-hidden animate-in slide-in-from-right duration-700">
              
              <div className={`transition-all duration-500 ease-in-out min-h-0 flex flex-col ${isVisualEditMode ? 'h-full flex-1' : 'flex-1'}`}>
                <WorkoutForm
                  onSave={saveWorkout}
                  workoutToEdit={workoutToEdit}
                  onCancel={() => {
                     setWorkoutToEdit(null);
                     setIsVisualEditMode(false);
                     setPreviewDuration(null);
                  }}
                />
              </div>

              {!isVisualEditMode && (
                <div className="bg-[#0a0a0a] p-6 rounded-[2rem] border border-[#1a1a1a] h-[40%] shrink-0 flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-bold text-gray-500 mb-4 uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 shrink-0">
                    <Activity size={14} className="text-orange-500" /> Biblioteca
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
                    {treinos.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setActiveWorkout(t);
                          handleReset();
                          setIsVisualEditMode(false);
                          setPreviewDuration(null);
                        }}
                        className={`group relative p-5 rounded-2xl border-2 transition-all cursor-pointer ${activeWorkout?.id === t.id ? 'border-orange-600 bg-orange-600/5' : 'border-[#1a1a1a] bg-[#0d0d0d] hover:border-[#333]'}`}
                      >
                        <div className="font-black uppercase italic text-lg tracking-tight pr-12">{t.nome}</div>
                        <div className="text-[10px] font-bold text-gray-500 mt-2 uppercase opacity-60">
                          {formatTime(t.duracao_total)} • {t.blocos?.length} Fases
                        </div>

                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEditClick(t, e)}
                            className="p-2 bg-blue-600/20 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => deleteWorkout(t.id, e)}
                            className="p-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}