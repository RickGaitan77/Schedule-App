const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `  const dashboardShifts = useMemo(() => {
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
  }, [shifts, month, year]);`;

const newCode = `  const dashboardShifts = useMemo(() => {
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowStart.getDate() + 7);
    windowEnd.setHours(23, 59, 59, 999);
    
    return shifts.filter(s => {
      const d = new Date(s.start.replace('Z', ''));
      return d >= windowStart && d <= windowEnd;
    }).sort((a,b) => new Date(a.start.replace('Z', '')).getTime() - new Date(b.start.replace('Z', '')).getTime());
  }, [shifts]);`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('src/App.tsx', code);
  console.log('patched dashboard shifts successfully');
} else {
  console.log('could not find oldCode snippet');
}
