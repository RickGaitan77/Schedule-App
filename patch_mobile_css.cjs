const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldContainer = `                <div className="flex-1 p-4 space-y-4 overflow-y-auto scroll-hide">
                  <AnimatePresence>
                    {dashboardShifts.length === 0 ? (`;
const newContainer = `                <div className="flex-1 p-2 sm:p-4 space-y-1.5 sm:space-y-4 overflow-y-auto scroll-hide">
                  <AnimatePresence>
                    {dashboardShifts.length === 0 ? (`;
code = code.replace(oldContainer, newContainer);

const oldShiftCard = `        <div className="flex flex-col w-14 min-w-[56px] rounded-xl overflow-hidden border border-slate-700/80 shadow-md shrink-0 bg-slate-800/80">
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
            <span className={\`w-max text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider \${textColorClass} bg-current/10 border-current/30\`}>
              {label}
            </span>
          </div>
          <div className="text-sm font-mono mt-1 text-emerald-400">
            {formatTime(shift.start)} — {formatTime(shift.end)}
          </div>
        </div>`;

const newShiftCard = `        <div className="flex flex-col w-12 sm:w-14 min-w-[48px] sm:min-w-[56px] rounded-xl overflow-hidden border border-slate-700/80 shadow-md shrink-0 bg-slate-800/80">
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
              <span className={\`w-max text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider \${textColorClass} bg-current/10 border-current/30\`}>
                {label}
              </span>
            </div>
          </div>
          <div className="text-[11px] sm:text-sm font-mono mt-0.5 sm:mt-1 text-emerald-400 leading-tight sm:leading-normal">
            {formatTime(shift.start)} — {formatTime(shift.end)}
          </div>
        </div>`;

if(code.includes(oldShiftCard)) {
  code = code.replace(oldShiftCard, newShiftCard);
} else {
  console.log("oldShiftCard not found");
}

const oldOuter = `        className={\`p-4 bg-slate-800/40 rounded-xl flex flex-row items-center gap-4 \${borderColorClass} transition-colors group \${pulseClass}\`}`;
const newOuter = `        className={\`p-2.5 sm:p-4 bg-slate-800/40 rounded-xl flex flex-row items-center gap-3 sm:gap-4 \${borderColorClass} transition-colors group \${pulseClass}\`}`;

code = code.replace(oldOuter, newOuter);

fs.writeFileSync('src/App.tsx', code);
console.log('patched mobile styling');
