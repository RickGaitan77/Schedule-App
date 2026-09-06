const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove handleDirectSync
const oldHandleDirectSync = `  const handleDirectSync = async () => {
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
  };`;
if (code.includes(oldHandleDirectSync)) {
  code = code.replace(oldHandleDirectSync, '');
} else {
  console.log("oldHandleDirectSync not found. Moving on.");
}

// 2. Replace Export Panel Buttons
const oldExportButtons = `                  <button 
                    onClick={handleDirectSync}
                    disabled={isSyncing}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer group transition-all duration-150 active:scale-95 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] disabled:opacity-70 disabled:cursor-wait"
                    title="Direct API Sync"
                  >
                    <Sparkles className={\`w-5 h-5 text-violet-400 transition-colors group-hover:text-cyan-300 \${isSyncing ? 'animate-spin' : ''}\`} />
                    <span className="text-[10px] font-mono uppercase text-slate-300 transition-colors group-hover:text-cyan-300">
                      Sync Server<br/>(Live)
                    </span>
                  </button>`;

const newExportButtons = `                  <button 
                    onClick={() => setShowQrModal(true)}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer group transition-all duration-150 active:scale-95 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                    title="Sync to Phone"
                  >
                    <Smartphone className="w-5 h-5 text-violet-400 transition-colors group-hover:text-cyan-300" />
                    <span className="text-[10px] font-mono uppercase text-slate-300 transition-colors group-hover:text-cyan-300">
                      Sync to Phone<br/>(QR Code)
                    </span>
                  </button>`;
if(code.includes(oldExportButtons)) {
  code = code.replace(oldExportButtons, newExportButtons);
} else {
  console.log("oldExportButtons not found.");
}

// 3. Add Modal and Sync Alert
const mainReturn = `    <div className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black text-slate-200 p-2 sm:p-4 lg:p-8 font-sans selection:bg-emerald-500/30">`;

const modals = `
      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center shadow-2xl shadow-cyan-900/20 relative"
            >
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-bold text-white mb-2">Sync to Phone</h3>
              <p className="text-sm text-slate-400 text-center mb-8">
                Scan this QR code with your phone's camera to instantly import your entire schedule.
              </p>
              
              <div className="bg-white p-4 rounded-2xl mb-8">
                <div id="qrcode"></div>
              </div>
              
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Banner */}
      <AnimatePresence>
        {syncAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/50 text-emerald-400 px-6 py-3 rounded-full flex items-center gap-3 shadow-lg shadow-emerald-500/20"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium text-sm">Shifts successfully synced to phone!</span>
          </motion.div>
        )}
      </AnimatePresence>
`;

code = code.replace(mainReturn, mainReturn + modals);

fs.writeFileSync('src/App.tsx', code);
console.log('modal patched successfully');
