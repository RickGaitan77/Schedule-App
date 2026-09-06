const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /      const data = await response\.json\(\);\n      if \(data\.success\) \{\n        try \{\n          await fetch\('\/api\/shifts', \{\n            method: 'POST',\n            headers: \{ 'Content-Type': 'application\/json' \},\n            body: JSON\.stringify\(\{ shifts: data\.shifts \}\)\n          \}\);\n          const res = await fetch\('\/api\/shifts'\);\n          const finalData = await res\.json\(\);\n          if \(finalData\.success\) \{\n            setShifts\(prev => JSON\.stringify\(prev\) === JSON\.stringify\(finalData\.shifts\) \? prev : finalData\.shifts\);\n            setTranscript\(prev => \(prev \? prev \+ '\\\\n' : ''\) \+ '\[Audio parsed successfully\]'\);\n          \}\n        \} catch \(e\) \{\n          console\.error\("Failed to sync generated shifts:", e\);\n        \}\n      \} else \{/g;

code = code.replace(regex, `      const data = await response.json();
      if (data.success) {
        try {
          setShifts(prev => {
            const combined = [...data.shifts, ...prev];
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values()) as Shift[];
            return unique;
          });
          setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');
        } catch (e) {
          console.error("Failed to apply generated shifts:", e);
        }
      } else {`);

fs.writeFileSync('src/App.tsx', code);
console.log('regex replaced');
