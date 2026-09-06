const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldBtn = `                  <button 
                    onClick={handleDirectSync}
                    disabled={isSyncing}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer group transition-all duration-150 active:scale-95 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] disabled:opacity-70 disabled:cursor-wait"
                    title="Direct API Sync"
                  >
                    <Sparkles className={\`w-5 h-5 text-violet-400 transition-colors group-hover:text-cyan-300 \${isSyncing ? 'animate-spin' : ''}\`} />
                    <span className="text-[10px] font-mono uppercase text-slate-300 transition-colors group-hover:text-cyan-300">
                      {isSyncing ? 'Syncing...' : 'Direct Sync'}
                    </span>
                  </button>`;

const newBtn = `                  <button 
                    onClick={() => setShowQrModal(true)}
                    className="flex flex-col items-center gap-2 p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl cursor-pointer group transition-all duration-150 active:scale-95 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                    title="Sync to Phone"
                  >
                    <Smartphone className="w-5 h-5 text-violet-400 transition-colors group-hover:text-cyan-300" />
                    <span className="text-[10px] font-mono uppercase text-slate-300 transition-colors group-hover:text-cyan-300 text-center leading-tight">
                      Sync to Phone<br/>(QR Code)
                    </span>
                  </button>`;

code = code.replace(oldBtn, newBtn);
fs.writeFileSync('src/App.tsx', code);
