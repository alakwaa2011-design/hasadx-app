function T(n,i){const e=n.trim();if(e)return e;const t=i.split(/\r?\n/).map(r=>r.trim()).find(Boolean)||"";return t.length>100?`${t.slice(0,99).trimEnd()}…`:t}export{T as g};
