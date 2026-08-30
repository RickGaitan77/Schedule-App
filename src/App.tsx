import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, Square, Download, Calendar as CalendarIcon, Clock, Trash2, ShieldAlert, Sparkles, Loader2, CheckCircle2, LayoutDashboard, CalendarDays, Edit2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Shift = {
  id: string;
  title: string;
  start: string;
  end: string;
  details: string;
  colorCode: 'blue' | 'red' | 'amber' | 'violet';
};



export default function App() {
  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem('schedule_sync_shifts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule'>('dashboard');
  const [scheduleSubTab, setScheduleSubTab] = useState<'working' | 'off'>('working');
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const handleDirectSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      if (data.success && data.shifts) {
        setShifts(data.shifts);
      }
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(currentMonth.toString());
  const [year, setYear] = useState(currentYear.toString());
  
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  
  useEffect(() => {
    localStorage.setItem('schedule_sync_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    fetch('/api/shifts')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.shifts) {
          setShifts(data.shifts);
        }
      })
      .catch(console.error);
  }, []);
  

  
  const processAudioBlob = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('month', month);
      formData.append('year', year);

      const response = await fetch('/api/parse-audio', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
          const res = await fetch('/api/shifts');
          const finalData = await res.json();
          if (finalData.success) {
            setShifts(finalData.shifts);
            setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');
          }
        } catch (e) {
          console.error("Failed to sync generated shifts:", e);
        }
      } else {
        console.error("Server parse error:", data.error);
        alert(`Error parsing audio: ${data.error}`);
      }
    } catch (error) {
      console.error("Error sending audio:", error);
      alert('Error parsing audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          stream.getTracks().forEach(track => track.stop());
          processAudioBlob(audioBlob);
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (err: any) {
        console.error('Microphone access denied or error:', err);
        alert('Microphone access denied or unavailable. Please check your browser permissions.');
      }
    }
  };
  
  const processTranscript = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!transcript.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, month, year })
      });
      
      const data = await response.json();
      if (data.success) {
        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
        } catch (e) {
          console.error('Failed to sync new shifts to server', e);
        }
        setShifts((prev) => [...data.shifts, ...prev]);
        setTranscript('');
      } else {
        alert('Error parsing shifts: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Network error while processing.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const removeShift = async (id: string) => {
    try {
      await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete shift on server', e);
    }
    setShifts((prev) => prev.filter(s => s.id !== id));
  };

  const saveEditedShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(!editingShift) return;
    
    try {
      await fetch(`/api/shifts/${editingShift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingShift)
      });
    } catch (error) {
      console.error('Failed to update shift on server', error);
    }
    
    setShifts(prev => prev.map(s => s.id === editingShift.id ? editingShift : s));
    setEditingShift(null);
  }
  
  const exportCalendar = () => {
    const shiftsToExport = shifts.filter(s => {
      const d = new Date(s.start.replace('Z', ''));
      return (d.getMonth() + 1).toString() === month && d.getFullYear().toString() === year;
    });

    if (shiftsToExport.length === 0) {
      alert(`No shifts to export for this month.`);
      return;
    }
    
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ScheduleSync//EN\r\n';
    shiftsToExport.forEach(shift => {
      const start = shift.start.replace('Z', '').replace(/[-:]/g, '').split('.')[0];
      const end = shift.end.replace('Z', '').replace(/[-:]/g, '').split('.')[0];
      
      ics += 'BEGIN:VEVENT\r\n';
      ics += `UID:${shift.id}@schedulesync\r\n`;
      ics += `DTSTAMP:${start}\r\n`;
      ics += `DTSTART:${start}\r\n`;
      ics += `DTEND:${end}\r\n`;
      ics += `SUMMARY:${shift.title}\r\n`;
      ics += `DESCRIPTION:${shift.details}\r\n`;
      ics += 'END:VEVENT\r\n';
    });
    ics += 'END:VCALENDAR';
    
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const currentMonthName = new Date(0, parseInt(month) - 1).toLocaleString('default', { month: 'long' });
    a.download = `shifts-${currentMonthName.toLowerCase()}-${year}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };
  
  const formatTime = (isoString: string) => {
    const localString = isoString.replace('Z', '');
    return new Date(localString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };
  
  const formatDate = (isoString: string) => {
    const localString = isoString.replace('Z', '');
    return new Date(localString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Data processing for views
  const dashboardShifts = useMemo(() => {
    const realToday = new Date();
    realToday.setHours(0, 0, 0, 0);

    const selectedMonth = parseInt(month, 10);
    const selectedYear = parseInt(year, 10);

    const isCurrentMonth = (realToday.getMonth() + 1 === selectedMonth) && (realToday.getFullYear() === selectedYear);

    let windowStart = new Date(selectedYear, selectedMonth - 1, 1);
    if (isCurrentMonth) {
      windowStart = new Date(realToday);
    }

    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowStart.getDate() + 7);
    windowEnd.setHours(23, 59, 59, 999);
    
    return shifts.filter(s => {
      const d = new Date(s.start.replace('Z', ''));
      const isSameMonthYear = (d.getMonth() + 1 === selectedMonth) && (d.getFullYear() === selectedYear);
      return d >= windowStart && d <= windowEnd && isSameMonthYear;
    }).sort((a,b) => new Date(a.start.replace('Z', '')).getTime() - new Date(b.start.replace('Z', '')).getTime());
  }, [shifts, month, year]);

  const monthWorkingShifts = useMemo(() => {
    return shifts.filter(s => {
      const d = new Date(s.start.replace('Z', ''));
      return (d.getMonth() + 1).toString() === month && d.getFullYear().toString() === year;
    }).sort((a,b) => new Date(a.start.replace('Z', '')).getTime() - new Date(b.start.replace('Z', '')).getTime());
  }, [shifts, month, year]);

  const monthDaysOff = useMemo(() => {
    const y = parseInt(year);
    const m = parseInt(month) - 1;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysOff = [];
    
    for(let i=1; i<=daysInMonth; i++) {
      const currentDate = new Date(y, m, i);
      const hasShift = monthWorkingShifts.some(s => {
        const d = new Date(s.start.replace('Z', ''));
        return d.getDate() === i && d.getMonth() === m && d.getFullYear() === y;
      });
      if(!hasShift) {
        daysOff.push(currentDate);
      }
    }
    return daysOff;
  }, [monthWorkingShifts, month, year]);

  const ShiftCard = ({ shift }: { shift: Shift }) => {
    const shiftDate = new Date(shift.start.replace('Z', ''));
    const monthStr = shiftDate.toLocaleDateString('en-US', { month: 'short' });
    const dayStr = shiftDate.toLocaleDateString('en-US', { day: '2-digit' });
    
    let borderColorClass = 'border-2 border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.35)]';
    let textColorClass = 'text-blue-400';
    let label = 'REGULAR';
    let pulseClass = '';
    
    if (shift.colorCode === 'red') {
      borderColorClass = 'border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
      textColorClass = 'text-red-400';
      label = 'URGENT';
      pulseClass = 'animate-pulse';
    } else if (shift.colorCode === 'amber') {
      borderColorClass = 'border-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]';
      textColorClass = 'text-amber-400';
      label = 'SURGERY';
    } else if (shift.colorCode === 'violet') {
      borderColorClass = 'border-2 border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.35)]';
      textColorClass = 'text-purple-400';
      label = 'DROP-OFF';
    }

    const hasRoomInfo = shift.details && /room/i.test(shift.details);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        className={`p-4 bg-slate-800/40 rounded-xl flex flex-row items-center gap-4 ${borderColorClass} transition-colors group ${pulseClass}`}
      >
        <div className="flex flex-col w-14 min-w-[56px] rounded-xl overflow-hidden border border-slate-700/80 shadow-md shrink-0 bg-slate-800/80">
          <div className="bg-red-500/90 text-white text-[9px] font-bold uppercase tracking-widest text-center py-1">
            {monthStr}
          </div>
          <div className="flex items-center justify-center py-1.5 bg-slate-900/50">
            <span className="text-xl font-bold text-white">{dayStr}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <h3 className="text-lg font-medium text-white truncate">{shift.title}</h3>
            {hasRoomInfo ? (
              <span className="text-amber-200 bg-amber-400/10 border border-amber-300/30 px-2 py-0.5 rounded text-xs truncate sm:ml-2">
                {shift.details}
              </span>
            ) : (
              <span className="text-slate-400 text-sm truncate sm:border-l sm:border-slate-600 sm:pl-2">
                {shift.details || 'Standard Operational'}
              </span>
            )}
            <span className={`w-max text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${textColorClass} bg-current/10 border-current/30`}>
              {label}
            </span>
          </div>
          <div className="text-sm font-mono mt-1 text-emerald-400">
            {formatTime(shift.start)} — {formatTime(shift.end)}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
          <button
            onClick={() => setEditingShift(shift)}
            className="p-2 opacity-100 sm:opacity-0 group-hover:opacity-100 text-slate-500 hover:text-emerald-400 transition-all rounded-lg hover:bg-emerald-500/10"
            aria-label="Edit shift"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => removeShift(shift.id)}
            className="p-2 opacity-100 sm:opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10"
            aria-label="Remove shift"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#020617] text-slate-200 font-sans p-4 md:p-8 overflow-hidden relative selection:bg-emerald-500/30">
      {/* Futuristic Background Accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[120px]"></div>
      </div>
      
      <div className="max-w-[1400px] w-full mx-auto flex flex-col h-full relative z-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 mb-6 shrink-0">
          <div className="flex flex-col items-center md:items-start w-full md:w-auto">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tighter bg-gradient-to-r from-emerald-400 to-violet-400 bg-clip-text text-transparent uppercase">
              Schedule Sync
            </h1>
            <p className="text-slate-500 text-xs font-mono uppercase tracking-[0.2em] mt-1">
              Adaptive Scheduling Protocol
            </p>
          </div>

          <div className="flex bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-sky-400' : ''}`} /> 
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab('schedule')} 
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'schedule' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <CalendarDays className={`w-4 h-4 ${activeTab === 'schedule' ? 'text-amber-400' : ''}`} /> 
              <span>Schedule</span>
            </button>
          </div>
          
          <div className="flex flex-row items-center justify-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 p-1.5 rounded-lg">
              <select 
                value={month} 
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent text-slate-300 text-sm font-medium tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-md px-2 py-1 cursor-pointer"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i + 1} className="bg-slate-900 text-white">
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <div className="w-px h-4 bg-slate-700"></div>
              <select 
                value={year} 
                onChange={(e) => setYear(e.target.value)}
                className="bg-transparent text-slate-300 text-sm font-medium tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-md px-2 py-1 cursor-pointer"
              >
                {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 font-mono uppercase">System Status</span>
              <span className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>
                ONLINE
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-visible custom-scrollbar">
          {activeTab === 'dashboard' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-6 gap-6 h-full min-h-[800px] lg:min-h-0">
              
              {/* Shift Matrix */}
              <div className="col-span-1 lg:col-span-8 lg:row-span-6 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-3xl flex flex-col p-1 shadow-2xl overflow-hidden order-1 lg:order-1 h-[450px] lg:h-auto shrink-0">
                <div className="p-6 border-b border-slate-800/50 flex justify-between items-center shrink-0">
                  <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">Shift Matrix (Next 7 Days)</h2>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                      {dashboardShifts.length} UPCOMING
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 p-4 space-y-4 overflow-y-auto scroll-hide">
                  <AnimatePresence>
                    {dashboardShifts.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center text-slate-500 pb-10"
                      >
                        <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-mono text-sm uppercase tracking-widest text-slate-600">No shifts scheduled for the next 7 days</p>
                      </motion.div>
                    ) : (
                      dashboardShifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Input Panel */}
              <div className="col-span-1 lg:col-span-4 lg:row-span-4 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 flex flex-col shadow-2xl relative order-2 lg:order-2 shrink-0">
                <div className="absolute top-4 right-4">
                  <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse' : 'bg-violet-500 shadow-[0_0_10px_#a855f7]'}`}></div>
                </div>
                
                <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-6 shrink-0">Input Interface</h2>
                
                <div className="flex-1 flex flex-col gap-4 min-h-[220px]">
                  <div className="relative group flex-1 flex flex-col">
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="w-full h-full min-h-[120px] bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pb-14 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-slate-700 resize-none custom-scrollbar"
                      placeholder="PASTE SCHEDULE DATA OR SPEAK..."
                    ></textarea>
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button
                        onClick={toggleListening}
                        className={`w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center transition-all ${
                          isListening ? 'text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-slate-400 hover:text-white hover:border-violet-500/50'
                        }`}
                      >
                        {isListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={processTranscript}
                    disabled={(!transcript.trim() && !isListening) || isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-emerald-600 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-violet-900/20 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing Neural Feed</>
                    ) : (
                      'Process Neural Feed'
                    )}
                  </button>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-800/50 shrink-0">
                  <div className="flex items-center justify-center gap-1.5 h-6 mb-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div 
                        key={i} 
                        className={`w-1 rounded-full transition-all duration-300 ${isListening ? 'bg-cyan-400 shadow-[0_0_12px_#22d3ee] wave-active wave-delay-' + i : 'bg-slate-700 h-1.5 opacity-50'}`}
                      ></div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase">
                    <span>Memory Buffer</span>
                    <span>{(transcript.length / 1024).toFixed(3)} KB</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (transcript.length / 5000) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Export Panel */}
              <div className="col-span-1 lg:col-span-4 lg:row-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 flex flex-col justify-between shadow-2xl order-3 shrink-0">
                <h2 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4 lg:mb-0">Export Protocol</h2>
                
                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <button 
                    onClick={exportCalendar}
                    disabled={monthWorkingShifts.length === 0}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-emerald-500/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono uppercase text-slate-300 text-center leading-tight">Export {new Date(0, parseInt(month) - 1).toLocaleString('default', { month: 'long' })} Shifts<br/>(.ics)</span>
                  </button>
                  
                  <button 
                    onClick={handleDirectSync}
                    disabled={isSyncing}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer group transition-all duration-150 active:scale-95 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] disabled:opacity-70 disabled:cursor-wait"
                    title="Direct API Sync"
                  >
                    <Sparkles className={`w-5 h-5 text-violet-400 transition-colors group-hover:text-cyan-300 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-mono uppercase text-slate-300 transition-colors group-hover:text-cyan-300">
                      {isSyncing ? 'Syncing...' : 'Direct Sync'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[600px] bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-3xl flex flex-col p-1 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">Full Month Schedule</h2>
                <div className="flex bg-slate-950 p-1 rounded-lg">
                  <button 
                    onClick={() => setScheduleSubTab('working')} 
                    className={`px-4 py-1.5 rounded-md text-sm font-medium tracking-wide transition-all ${scheduleSubTab === 'working' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Working Days ({monthWorkingShifts.length})
                  </button>
                  <button 
                    onClick={() => setScheduleSubTab('off')} 
                    className={`px-4 py-1.5 rounded-md text-sm font-medium tracking-wide transition-all ${scheduleSubTab === 'off' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Days Off ({monthDaysOff.length})
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto scroll-hide">
                <AnimatePresence mode="wait">
                  {scheduleSubTab === 'working' ? (
                    <motion.div 
                      key="working"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-4"
                    >
                      {monthWorkingShifts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-500 py-20">
                           <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                           <p className="font-mono text-sm uppercase tracking-widest text-slate-600">No shifts scheduled for this month</p>
                        </div>
                      ) : (
                        monthWorkingShifts.map((shift) => (
                          <ShiftCard key={shift.id} shift={shift} />
                        ))
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="off"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                    >
                      {monthDaysOff.map((date, idx) => (
                        <div key={idx} className="p-4 bg-slate-800/20 border border-slate-700/30 rounded-2xl flex flex-col items-center justify-center text-center gap-1 hover:border-cyan-500/30 transition-colors">
                          <span className="text-[10px] uppercase font-mono text-slate-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className="text-2xl font-bold text-slate-400">{date.getDate()}</span>
                          <span className="text-[10px] uppercase font-mono text-cyan-500/70 bg-cyan-500/10 px-2 py-0.5 rounded-full mt-1 border border-cyan-500/20">OFF</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingShift(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-emerald-400" /> Edit Schedule Entry
                </h3>
                <button onClick={() => setEditingShift(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={saveEditedShift} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Title</label>
                  <input 
                    type="text" 
                    value={editingShift.title}
                    onChange={e => setEditingShift({...editingShift, title: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Details (Room, Location)</label>
                  <input 
                    type="text" 
                    value={editingShift.details}
                    onChange={e => setEditingShift({...editingShift, details: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={editingShift.start.replace('Z', '').slice(0, 16)}
                      onChange={e => setEditingShift({...editingShift, start: e.target.value + ":00"})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">End Time</label>
                    <input 
                      type="datetime-local" 
                      value={editingShift.end.replace('Z', '').slice(0, 16)}
                      onChange={e => setEditingShift({...editingShift, end: e.target.value + ":00"})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setEditingShift(null)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium text-sm">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-colors font-medium text-sm">
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Global CSS injected for custom scrollbar within this file constraint */}
      <style>{`
        .scroll-hide::-webkit-scrollbar {
          display: none;
        }
        .scroll-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @keyframes audio-wave {
          0%, 100% { height: 6px; opacity: 0.6; }
          50% { height: 24px; opacity: 1; }
        }
        .wave-active {
          animation: audio-wave 1s infinite ease-in-out;
        }
        .wave-delay-0 { animation-delay: 0.0s; }
        .wave-delay-1 { animation-delay: 0.2s; }
        .wave-delay-2 { animation-delay: 0.4s; }
        .wave-delay-3 { animation-delay: 0.1s; }
        .wave-delay-4 { animation-delay: 0.3s; }
      `}</style>
    </div>
  );
}
