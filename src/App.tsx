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
    try {
      const saved = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse initial shifts:', e);
    }
    return [];
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule'>('dashboard');
  const [scheduleSubTab, setScheduleSubTab] = useState<'working' | 'off'>('working');
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const handleDirectSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(prev => JSON.stringify(prev) === JSON.stringify(data.shifts) ? prev : data.shifts);
      } else {
        const backup = localStorage.getItem('vet_shifts_backup');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && parsedBackup.length > 0) {
            await fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shifts: parsedBackup })
            });
            setShifts(parsedBackup);
          }
        }
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
  

  
  useEffect(() => {
    localStorage.setItem('vet_shifts_backup', JSON.stringify(shifts));
  }, [shifts]);

  const fetchSchedule = async (isInitial = false) => {
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(prev => JSON.stringify(prev) === JSON.stringify(data.shifts) ? prev : data.shifts);
        try {
          localStorage.setItem('vet_shifts_backup', JSON.stringify(data.shifts));
        } catch (e) {}
      } else {
        // Server returned an empty list - restore from local backup immediately
        let parsedBackup = null;
        try {
          const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
          if (backup) {
            parsedBackup = JSON.parse(backup);
          }
        } catch (e) {
          console.error('Failed to parse backup shifts:', e);
        }

        if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          try {
            await fetch('/api/update-schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shifts: parsedBackup })
            });
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
            console.log('Restored shifts from local backup to server.');
          } catch (err) {
            console.error('Failed to send backup to server:', err);
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        } else if (isInitial) {
           // Ensure it doesn't stay stuck
           setShifts([]);
        }
      }
    } catch (err) {
      console.error('Error fetching shifts:', err);
      // Always fallback to local backup on error
      try {
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        }
      } catch (e) {
        console.error('Failed to parse backup shifts:', e);
      }
    }
  };

  useEffect(() => {
    // Initial fetch to handle backup restoration if server is empty
    fetchSchedule(true);

    // 5-second setInterval background polling loop
    const pollingInterval = setInterval(() => {
      fetchSchedule(false);
    }, 5000);

    // Real-Time Cross-Device Sync via SSE (Kept as primary immediate sync)
    const eventSource = new EventSource('/api/shifts/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'sync' && Array.isArray(data.shifts)) {
          setShifts(prev => JSON.stringify(prev) === JSON.stringify(data.shifts) ? prev : data.shifts);
        }
      } catch (err) {
        console.error('SSE parsing error:', err);
      }
    };

    return () => {
      clearInterval(pollingInterval);
      eventSource.close();
    };
  }, []);
  

  
  const processAudioBlob = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });

      const response = await fetch('/api/parse-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64String,
          mimeType: audioBlob.type || 'audio/webm',
          month,
          year
        })
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
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(finalData.shifts) ? prev : finalData.shifts);
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

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript && transcriptRef.current) {
            transcriptRef.current.value += (transcriptRef.current.value ? ' ' : '') + finalTranscript.trim();
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech error:', event.error);
          setIsListening(false);
          if (transcriptRef.current) setTranscript(transcriptRef.current.value);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          if (transcriptRef.current) setTranscript(transcriptRef.current.value);
        };

        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert('Web Speech API is not supported in this browser.');
      }
    }
  };
  
  const processTranscript = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    const textToProcess = transcriptRef.current ? transcriptRef.current.value : transcript;
    if (!textToProcess.trim()) {
      setStatusMsg('Please provide some text or speech to process.');
      return;
    }
    
    setIsProcessing(true);
    setStatusMsg('Processing Neural Feed...');
    
    let targetMonth = parseInt(month, 10);
    const lower = textToProcess.toLowerCase();
    if (lower.includes('january')) targetMonth = 1;
    else if (lower.includes('february')) targetMonth = 2;
    else if (lower.includes('march')) targetMonth = 3;
    else if (lower.includes('april')) targetMonth = 4;
    else if (lower.includes('may')) targetMonth = 5;
    else if (lower.includes('june')) targetMonth = 6;
    else if (lower.includes('july')) targetMonth = 7;
    else if (lower.includes('august')) targetMonth = 8;
    else if (lower.includes('september')) targetMonth = 9;
    else if (lower.includes('october')) targetMonth = 10;
    else if (lower.includes('november')) targetMonth = 11;
    else if (lower.includes('december')) targetMonth = 12;

    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use the auto-detected month (stringified to match backend expectation if it expects string, but wait, backend expects 1-12 or 0-11?)
        // Let's pass it as a string to match previous `month` state (which is stringified currentMonth)
        body: JSON.stringify({ text: textToProcess, month: targetMonth.toString(), year })
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
        // Instead of overriding, we'll prepend them. SSE will also update this, but doing it optimistically.
        setShifts((prev) => {
          const prevIds = new Set(prev.map(s => s.id));
          const toAdd = data.shifts.filter((s: any) => !prevIds.has(s.id));
          return [...toAdd, ...prev];
        });
        setTranscript('');
        if (transcriptRef.current) transcriptRef.current.value = '';
        setStatusMsg('Successfully processed ' + (data.shifts ? data.shifts.length : 0) + ' shifts.');
      } else {
        setStatusMsg('Error parsing shifts: ' + data.error);
      }
    } catch (error: any) {
      console.error(error);
      setStatusMsg('Network error while processing: ' + (error.message || 'Unknown error'));
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
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowStart.getDate() + 7);
    windowEnd.setHours(23, 59, 59, 999);
    
    return shifts.filter(s => {
      const d = new Date(s.start.replace('Z', ''));
      return d >= windowStart && d <= windowEnd;
    }).sort((a,b) => new Date(a.start.replace('Z', '')).getTime() - new Date(b.start.replace('Z', '')).getTime());
  }, [shifts]);

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

  const ShiftCard = ({ shift }: { shift: Shift, key?: string | number }) => {
    const shiftDate = new Date(shift.start.replace('Z', ''));
    const monthStr = shiftDate.toLocaleDateString('en-US', { month: 'short' });
    const dayStr = shiftDate.toLocaleDateString('en-US', { day: '2-digit' });
    
    let borderColorClass = 'border-2 border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.35)]';
    let textColorClass = 'text-blue-400';
    let label = 'REGULAR';
    let pulseClass = '';
    
    if (shift.colorCode === 'red') {
      borderColorClass = 'border-2 border-red-500';
      textColorClass = 'text-red-400';
      label = 'URGENT';
      pulseClass = 'animate-pulse-shadow-urgent';
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
        className={`p-2.5 sm:p-4 bg-slate-800/40 rounded-xl flex flex-row items-center gap-3 sm:gap-4 ${borderColorClass} transition-colors group ${pulseClass}`}
      >
        <div className="flex flex-col w-12 sm:w-14 min-w-[48px] sm:min-w-[56px] rounded-xl overflow-hidden border border-slate-700/80 shadow-md shrink-0 bg-slate-800/80">
          <div className="bg-red-500/90 text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-center py-0.5 sm:py-1">
            {monthStr}
          </div>
          <div className="flex items-center justify-center py-0.5 sm:py-1.5 bg-slate-900/50">
            <span className="text-base sm:text-xl font-bold text-white leading-tight">{dayStr}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
            <h3 className="text-[13px] sm:text-lg font-medium text-white truncate leading-tight sm:leading-normal">{shift.title}</h3>
            <div className="flex flex-row items-center gap-2">
              {hasRoomInfo ? (
                <span className="text-amber-200 bg-amber-400/10 border border-amber-300/30 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-xs truncate">
                  {shift.details}
                </span>
              ) : (
                <span className="text-slate-400 text-[10px] sm:text-sm truncate sm:border-l sm:border-slate-600 sm:pl-2">
                  {shift.details || 'Standard Operational'}
                </span>
              )}
              <span className={`w-max text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${textColorClass} bg-current/10 border-current/30`}>
                {label}
              </span>
            </div>
          </div>
          <div className="text-[11px] sm:text-sm font-mono mt-0.5 sm:mt-1 text-emerald-400 leading-tight sm:leading-normal">
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
    <div className="min-h-screen h-screen flex flex-col bg-[#020617] text-slate-200 font-sans p-4 pt-[max(env(safe-area-inset-top),1.5rem)] md:p-8 md:pt-8 overflow-hidden relative selection:bg-emerald-500/30">
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
                
                <div className="flex-1 p-2 sm:p-4 space-y-1.5 sm:space-y-4 overflow-y-auto scroll-hide">
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
                      ref={transcriptRef}
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
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-emerald-600 rounded-2xl text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-violet-900/20 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                  >
                    {isProcessing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing Neural Feed</>
                    ) : (
                      'Process Neural Feed'
                    )}
                  </button>
                  {statusMsg && (
                    <div className="mt-2 text-center text-xs font-mono text-emerald-400 p-2 bg-slate-900/50 rounded border border-emerald-500/20">
                      {statusMsg}
                    </div>
                  )}
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
