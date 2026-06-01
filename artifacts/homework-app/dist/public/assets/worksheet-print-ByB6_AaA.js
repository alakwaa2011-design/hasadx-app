import{W as N,u as $,a as M,r as u,t as f,j as e,L}from"./index-D0XpAK0_.js";import{p as C,d as A}from"./print-export-DjFgfEmw.js";import{A as I}from"./arrow-left-CAiovdBG.js";import{P as W}from"./pen-line-6NwypjLy.js";import{F}from"./file-type-Cn5f6zdG.js";import{P as _}from"./printer-BtSVTW1I.js";const z="",a="#225739",o="#D9A521";function B(t,s){const r="'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif",l="'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";switch(t){case"cairo":return`'Cairo', ${r}`;case"tajawal":return`'Tajawal', ${r}`;case"amiri":return`'Amiri', 'Scheherazade New', ${r}`;case"noto-naskh":return`'Noto Naskh Arabic', ${r}`;case"inter":return`'Inter', ${l}`;case"georgia":return"Georgia, 'Times New Roman', serif";default:return s==="ar"?r:l}}function D(t){return t==="ar"?"'Reem Kufi', 'Amiri', 'Cairo', sans-serif":"'Inter', 'Source Sans Pro', sans-serif"}function q({data:t}){const s=t.language==="ar",r=s?"rtl":"ltr",l=B(t.settings.fontFamily,t.language),i=D(t.language),n=Math.min(18,Math.max(9,t.settings.fontSizePt??12)),m=t.settings.showWatermark!==!1,c=s?{name:"الاسم",date:"التاريخ",clazz:"الصف",section:"الشعبة",school:"المدرسة",teacher:"المعلم",instructions:"تعليمات",answerKey:"صفحة الإجابات",question:"س",true:"صح",false:"خطأ",correct:"الإجابة:",goodLuck:"نتمنى لك التوفيق ✦"}:{name:"Name",date:"Date",clazz:"Class",section:"Section",school:"School",teacher:"Teacher",instructions:"Instructions",answerKey:"Answer Key",question:"Q",true:"True",false:"False",correct:"Answer:",goodLuck:"✦ Good luck!"},h=(t.settings.customFields??[]).filter(d=>(d?.label?.trim()??"")||(d?.value?.trim()??"")),p=!!t.settings.schoolName||!!t.settings.section||!!t.settings.teacherName||h.length>0;return e.jsxs(e.Fragment,{children:[e.jsx(se,{fontFamily:l,headingFont:i,fontSizePt:n,lang:t.language}),e.jsxs("div",{id:"ws-printable-root",className:"print-host bg-neutral-200 min-h-screen py-6 px-2 flex flex-col items-center",dir:r,children:[e.jsxs("article",{className:"ws-page",lang:t.language,children:[m&&e.jsx(b,{ar:s}),e.jsx(k,{}),e.jsxs("div",{className:"ws-content",children:[e.jsxs("header",{className:"ws-header",children:[e.jsxs("div",{className:`ws-headgrid${p?"":" ws-headgrid-titleonly"}`,children:[p&&e.jsxs("div",{className:"ws-headside ws-headside-start",children:[t.settings.schoolName&&e.jsx(g,{label:c.school,value:t.settings.schoolName,icon:e.jsx(H,{})}),t.settings.section&&e.jsx(g,{label:c.section,value:t.settings.section,icon:e.jsx(O,{})}),t.settings.teacherName&&e.jsx(g,{label:c.teacher,value:t.settings.teacherName,icon:e.jsx(P,{})}),h.map((d,x)=>e.jsx(g,{label:d.label.trim()||(s?"حقل":"Field"),value:d.value,icon:e.jsx(G,{})},`cf-${x}`))]}),e.jsxs("div",{className:"ws-headcenter",children:[e.jsx("h1",{className:"ws-title",children:t.title}),(t.subject||t.gradeLevel)&&e.jsx("div",{className:"ws-kicker-center",children:[t.subject,t.gradeLevel].filter(Boolean).join(" · ")}),e.jsx(y,{})]}),p&&e.jsx("div",{className:"ws-headside ws-headside-end","aria-hidden":"true"})]}),(t.settings.includeName||t.settings.includeDate||t.settings.includeClass)&&e.jsxs("div",{className:"ws-fields",children:[t.settings.includeName&&e.jsx(w,{label:c.name,icon:e.jsx(Q,{})}),t.settings.includeClass&&e.jsx(w,{label:c.clazz,icon:e.jsx(V,{}),short:!0}),t.settings.includeDate&&e.jsx(w,{label:c.date,icon:e.jsx(U,{}),short:!0})]}),t.settings.headerNote&&e.jsx("p",{className:"ws-subtitle",children:t.settings.headerNote}),t.settings.instructions&&e.jsxs("div",{className:"ws-instructions",children:[e.jsx(Y,{}),e.jsxs("div",{children:[e.jsx("strong",{children:c.instructions}),e.jsxs("span",{children:[" ",t.settings.instructions]})]})]})]}),e.jsx("section",{className:"ws-questions",style:{columnCount:t.settings.columns===2?2:1},children:t.questions.map((d,x)=>e.jsx(Z,{index:x+1,q:d,ar:s,labels:c},d.id))}),e.jsx(j,{note:t.settings.footerNote,goodLuck:c.goodLuck})]})]}),t.settings.includeAnswerKey&&e.jsxs("article",{className:"ws-page",lang:t.language,children:[m&&e.jsx(b,{ar:s}),e.jsx(k,{}),e.jsxs("div",{className:"ws-content",children:[e.jsx("header",{className:"ws-header",children:e.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:e.jsxs("div",{className:"ws-headcenter",children:[e.jsx("h1",{className:"ws-title",style:{color:o},children:c.answerKey}),e.jsx("div",{className:"ws-kicker-center",style:{color:o,background:`${o}1f`},children:t.title}),e.jsx(y,{gold:!0})]})})}),e.jsx("section",{className:"ws-questions",style:{columnCount:1},children:t.questions.map((d,x)=>e.jsx(ee,{index:x+1,q:d,ar:s,labels:c},d.id))}),e.jsx(j,{goodLuck:""})]})]})]})]})}function le(){const s=N()?.id,{lang:r}=$(),[,l]=M(),[i,n]=u.useState(null),[m,c]=u.useState(!0);if(u.useEffect(()=>{s&&fetch(`${z}/api/worksheets/${s}`,{credentials:"include"}).then(d=>{if(!d.ok)throw new Error("load failed");return d.json()}).then(n).catch(()=>f.error(r==="ar"?"تعذّر تحميل ورقة العمل":"Failed to load worksheet")).finally(()=>c(!1))},[s,r]),m)return e.jsx("div",{className:"min-h-screen flex items-center justify-center",children:e.jsx(L,{className:"w-8 h-8 animate-spin",style:{color:a}})});if(!i)return e.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:r==="ar"?"لم يتم العثور على ورقة العمل.":"Worksheet not found."});const h=i.language==="ar"?"rtl":"ltr",p=()=>{const d=document.getElementById("ws-printable-root");if(!d){f.error(r==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}A({element:d,title:i.title,lang:i.language})};return e.jsxs(e.Fragment,{children:[e.jsxs("div",{dir:h,className:"no-print sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[e.jsxs("button",{onClick:()=>l("/teacher"),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${a}55`,color:a},children:[e.jsx(I,{className:"w-3.5 h-3.5"}),r==="ar"?"اللوحة":"Dashboard"]}),e.jsx("div",{className:"text-xs font-bold truncate flex-1 text-center",style:{color:a},children:i.title}),e.jsxs("div",{className:"flex gap-1.5 flex-wrap justify-end",children:[i.isOwner!==!1&&e.jsxs("button",{onClick:()=>l(`/teacher/worksheets/create?edit=${i.id}`),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${a}55`,color:a},title:r==="ar"?"تحرير هذه الورقة":"Edit this worksheet",children:[e.jsx(W,{className:"w-3.5 h-3.5"}),r==="ar"?"تحرير":"Edit"]}),e.jsxs("button",{onClick:p,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${o}88`,color:o,background:`${o}10`},title:r==="ar"?"تنزيل كملف وورد":"Download as Word",children:[e.jsx(F,{className:"w-3.5 h-3.5"}),r==="ar"?"وورد":"Word"]}),e.jsxs("button",{onClick:()=>C(),className:"px-4 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:a},children:[e.jsx(_,{className:"w-3.5 h-3.5"}),r==="ar"?"PDF / طباعة":"PDF / Print"]})]})]}),e.jsx(q,{data:i})]})}function w({label:t,short:s,icon:r}){return e.jsxs("div",{className:`ws-field-line ${s?"short":""}`,children:[r&&e.jsx("span",{className:"ws-field-icon",children:r}),e.jsxs("span",{className:"ws-field-label",children:[t,":"]}),e.jsx("span",{className:"ws-field-rule"})]})}function g({label:t,value:s,icon:r}){return e.jsxs("div",{className:"ws-school-cell",children:[e.jsx("span",{className:"ws-school-icon",children:r}),e.jsxs("div",{className:"ws-school-text",children:[e.jsx("span",{className:"ws-school-label",children:t}),e.jsx("span",{className:"ws-school-value",children:s})]})]})}function j({note:t,goodLuck:s}){return!t&&!s?null:e.jsxs("footer",{className:"ws-footer",children:[s&&e.jsx("div",{className:"ws-footer-cheer",children:s}),t&&e.jsx("div",{className:"ws-footer-note",children:t})]})}function b({ar:t}){const s=t?"حصاد":"Hasad";return e.jsx("div",{className:"ws-watermark","aria-hidden":"true",children:e.jsx("span",{className:"ws-watermark-word",children:s})})}function k(){return e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ws-corner ws-corner-tl","aria-hidden":"true"}),e.jsx("span",{className:"ws-corner ws-corner-tr","aria-hidden":"true"}),e.jsx("span",{className:"ws-corner ws-corner-bl","aria-hidden":"true"}),e.jsx("span",{className:"ws-corner ws-corner-br","aria-hidden":"true"})]})}function y({gold:t}){return e.jsxs("div",{className:`ws-divider ${t?"gold":""}`,"aria-hidden":"true",children:[e.jsx("span",{className:"ws-divider-thick"}),e.jsx("span",{className:"ws-divider-thin"})]})}function T(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"3",y:"4",width:"18",height:"16",rx:"2"}),e.jsx("path",{d:"M7 9h10M7 13h6M7 17h8"})]})}function S(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M5 7h6M8 7v10M14 7h5l-5 10h5"})})}function R(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M4 19h16M4 15l11-11 4 4-11 11z"})})}function E(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M4 12h4M16 12h4"}),e.jsx("rect",{x:"9",y:"8",width:"6",height:"8",rx:"1"})]})}function K(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"6",cy:"7",r:"2"}),e.jsx("circle",{cx:"6",cy:"17",r:"2"}),e.jsx("circle",{cx:"18",cy:"7",r:"2"}),e.jsx("circle",{cx:"18",cy:"17",r:"2"}),e.jsx("path",{d:"M8 7h8M8 17h8M8 8c4 4 6 4 10 8"})]})}function H(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),e.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function O(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}),e.jsx("path",{d:"M9 4v16M4 9h16"})]})}function P(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"8",r:"3"}),e.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function G(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M4 7h16M4 12h16M4 17h10"})})}function Q(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"8",r:"4"}),e.jsx("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"})]})}function V(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"3",y:"6",width:"18",height:"13",rx:"2"}),e.jsx("path",{d:"M8 3v6M16 3v6"})]})}function U(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),e.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function Y(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:o,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flex:"0 0 auto"},children:[e.jsx("path",{d:"M9 18h6M10 21h4"}),e.jsx("path",{d:"M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"})]})}function J(t){switch(t){case"mcq":return e.jsx(T,{});case"true_false":return e.jsx(S,{});case"short_answer":return e.jsx(R,{});case"fill_blank":return e.jsx(E,{});case"matching":return e.jsx(K,{})}}function X(t,s){return s?{mcq:"اختيار من متعدد",true_false:"صح / خطأ",short_answer:"إجابة قصيرة",fill_blank:"أكمل الفراغ",matching:"وصّل بين العمودين"}[t]:{mcq:"Multiple choice",true_false:"True / False",short_answer:"Short answer",fill_blank:"Fill in the blank",matching:"Matching"}[t]}function Z({index:t,q:s,ar:r,labels:l}){return e.jsxs("div",{className:"ws-q",children:[e.jsxs("div",{className:"ws-q-head",children:[e.jsx("span",{className:"ws-q-num","aria-label":`${l.question} ${t}`,children:t}),e.jsxs("div",{className:"ws-q-prompt-wrap",children:[e.jsxs("div",{className:"ws-q-typeline",children:[e.jsxs("span",{className:"ws-q-typebadge",children:[J(s.type)," ",e.jsx("span",{children:X(s.type,r)})]}),typeof s.points=="number"&&s.points>0&&e.jsxs("span",{className:"ws-q-points",children:[s.points," ",r?"د":"pt"]})]}),s.type!=="matching"&&e.jsx("div",{className:"ws-q-prompt",children:s.prompt}),s.type==="matching"&&e.jsx("div",{className:"ws-q-prompt",children:s.prompt||(r?"صل بين العمودين بخطوط:":"Match the columns:")})]})]}),s.type==="mcq"&&e.jsx("ol",{className:"ws-mcq",children:s.options.map((i,n)=>e.jsxs("li",{children:[e.jsxs("span",{className:"ws-mcq-letter",children:[r?`${"أبجده"[n]||n+1}`:String.fromCharCode(65+n),")"]}),e.jsx("span",{className:"ws-bubble"}),e.jsx("span",{className:"ws-mcq-text",children:i})]},n))}),s.type==="true_false"&&e.jsxs("div",{className:"ws-tf",children:[e.jsxs("span",{className:"ws-tf-opt",children:[e.jsx("span",{className:"ws-bubble"})," ",l.true]}),e.jsxs("span",{className:"ws-tf-opt",children:[e.jsx("span",{className:"ws-bubble"})," ",l.false]})]}),s.type==="short_answer"&&e.jsx("div",{className:"ws-lines",children:Array.from({length:s.lines??2}).map((i,n)=>e.jsx("span",{className:"ws-line"},n))}),s.type==="fill_blank"&&e.jsx("div",{className:"ws-fill",children:e.jsx("span",{className:"ws-fill-rule"})}),s.type==="matching"&&e.jsxs("div",{className:"ws-match",children:[e.jsx("ul",{className:"ws-match-col",children:s.pairs.map((i,n)=>e.jsxs("li",{children:[e.jsx("span",{className:"ws-match-bullet ws-match-num",children:n+1}),e.jsx("span",{className:"ws-match-text",children:i.left}),e.jsx("span",{className:"ws-match-tab"})]},`l${n}`))}),e.jsx("div",{className:"ws-match-divider","aria-hidden":"true"}),e.jsx("ul",{className:"ws-match-col",children:v(s.pairs.length).map((i,n)=>e.jsxs("li",{children:[e.jsx("span",{className:"ws-match-tab"}),e.jsx("span",{className:"ws-match-bullet ws-match-letter",children:String.fromCharCode(65+n)}),e.jsx("span",{className:"ws-match-text",children:s.pairs[i].right})]},`r${n}`))})]})]})}function ee({index:t,q:s,ar:r,labels:l}){let i="";if(s.type==="mcq")i=`${r?`${"أبجده"[s.correctIndex]||s.correctIndex+1}`:String.fromCharCode(65+s.correctIndex)}) ${s.options[s.correctIndex]??""}`;else if(s.type==="true_false")i=s.correct?l.true:l.false;else if(s.type==="short_answer")i=s.answer?.trim()||"—";else if(s.type==="fill_blank")i=s.answer;else if(s.type==="matching"){const n=v(s.pairs.length);i=s.pairs.map((m,c)=>{const h=n.indexOf(c);return`${c+1} → ${String.fromCharCode(65+(h>=0?h:c))}`}).join("    ")}return e.jsxs("div",{className:"ws-q ws-answer",children:[e.jsxs("div",{className:"ws-q-head",children:[e.jsx("span",{className:"ws-q-num",children:t}),e.jsx("div",{className:"ws-q-prompt-wrap",children:e.jsx("div",{className:"ws-q-prompt",children:s.type==="matching"?r?"أزواج التوصيل":"Matching pairs":s.prompt})})]}),e.jsxs("div",{className:"ws-answer-line",children:[e.jsx("strong",{children:l.correct})," ",i]})]})}function v(t){const s=Array.from({length:t},(i,n)=>n);let r=t*2654435761>>>0;const l=()=>{r|=0,r=r+1831565813|0;let i=Math.imul(r^r>>>15,1|r);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296};for(let i=t-1;i>0;i--){const n=Math.floor(l()*(i+1)),m=s[i];s[i]=s[n],s[n]=m}return t>1&&s.every((i,n)=>i===n)&&([s[0],s[1]]=[s[1],s[0]]),s}function se({fontFamily:t,headingFont:s,fontSizePt:r,lang:l}){const i=l==="ar",n=i?"right":"left",m=i?"left":"right";return e.jsx("style",{children:`
      /* High-quality Arabic + Latin fonts, including elegant heading
         faces (Reem Kufi, Amiri) used for the title and section labels. */
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${t}; }
      .ws-page {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        background: white;
        margin: 0 auto 18px auto;
        box-shadow: 0 6px 28px rgba(34,87,57,0.12);
        color: #1a2421;
        font-size: ${r}pt;
        line-height: 1.85;
        page-break-after: always;
        overflow: hidden;
        border-radius: 4px;
      }
      .ws-page:last-of-type { page-break-after: auto; margin-bottom: 0; }
      .ws-content {
        position: relative;
        z-index: 1;
        padding: 18mm 18mm 16mm 18mm;
        display: flex;
        flex-direction: column;
        min-height: calc(297mm - 0px);
      }

      /* Faint Hasad watermark behind content. */
      .ws-watermark {
        position: absolute; inset: 0; z-index: 0;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none; overflow: hidden;
      }
      .ws-watermark-word {
        font-family: ${s};
        font-weight: 800;
        font-size: 200pt;
        color: ${a};
        opacity: 0.05;
        transform: rotate(-22deg);
        white-space: nowrap;
        letter-spacing: 0.05em;
        user-select: none;
      }

      /* Decorative gold corner ornaments. */
      .ws-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${o};
        z-index: 0; pointer-events: none;
      }
      .ws-corner-tl { top: 8mm; left: 8mm; border-right: 0; border-bottom: 0; border-top-left-radius: 6px; }
      .ws-corner-tr { top: 8mm; right: 8mm; border-left: 0; border-bottom: 0; border-top-right-radius: 6px; }
      .ws-corner-bl { bottom: 8mm; left: 8mm; border-right: 0; border-top: 0; border-bottom-left-radius: 6px; }
      .ws-corner-br { bottom: 8mm; right: 8mm; border-left: 0; border-top: 0; border-bottom-right-radius: 6px; }

      /* Header — top-of-page grid: identity panel pinned to the START
         side, title centered in the middle column, opposite side reserved
         for symmetry so the title stays visually centered on the page. */
      .ws-header { margin-bottom: 6mm; }
      .ws-headgrid {
        display: grid;
        grid-template-columns: minmax(58mm, 1fr) minmax(0, 1.6fr) minmax(58mm, 1fr);
        gap: 6mm;
        align-items: start;
      }
      .ws-headgrid-titleonly {
        grid-template-columns: 1fr;
      }
      .ws-headside {
        display: flex; flex-direction: column; gap: 3mm;
        font-size: ${Math.max(9,r-1.5)}pt;
      }
      .ws-headcenter {
        display: flex; flex-direction: column; align-items: center;
        text-align: center;
        padding-top: 1mm;
      }
      .ws-kicker-center {
        display: inline-block;
        font-size: ${Math.max(8.5,r-2)}pt;
        font-weight: 700;
        color: ${a};
        background: ${a}10;
        padding: 3px 12px;
        border-radius: 999px;
        letter-spacing: 0.02em;
        margin-top: 2mm;
      }

      .ws-title {
        font-family: ${s};
        font-size: ${r+12}pt;
        font-weight: 800;
        color: ${a};
        margin: 0;
        text-align: center;
        line-height: 1.2;
        letter-spacing: 0.005em;
      }
      .ws-subtitle {
        text-align: center;
        color: #5a6663;
        font-size: ${Math.max(9.5,r-1.5)}pt;
        margin: 3mm 0 0;
      }

      .ws-divider {
        display: flex; flex-direction: column; gap: 1.4mm;
        align-items: center; margin: 3mm auto 0;
        width: 100%;
      }
      .ws-divider-thick {
        width: 64%; height: 2px; background: ${o};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${a} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${a}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${o} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${a}0d 0%, ${o}10 100%);
        border-${n}: 3px solid ${a};
        padding: 5px 10px;
        border-radius: 4px;
      }
      .ws-school-icon {
        display: inline-flex; align-items: center; justify-content: center;
        color: ${a};
        flex: 0 0 auto;
      }
      .ws-school-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
      .ws-school-label {
        font-weight: 700;
        color: ${a};
        font-size: ${Math.max(8,r-3)}pt;
        letter-spacing: 0.02em;
      }
      .ws-school-value {
        color: #2a3431;
        font-weight: 600;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }

      .ws-fields {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 6mm;
        margin: 5mm 0 4mm;
      }
      .ws-field-line {
        display: flex; align-items: center; gap: 6px;
        border-bottom: 1px dashed ${a}55;
        padding: 4px 4px 6px;
      }
      .ws-field-icon { color: ${a}; flex: 0 0 auto; display: inline-flex; }
      .ws-field-label { font-weight: 700; color: ${a}; white-space: nowrap; flex: 0 0 auto; }
      .ws-field-rule { flex: 1; height: 14px; }

      .ws-instructions {
        display: flex; gap: 8px; align-items: flex-start;
        background: linear-gradient(135deg, ${o}1a 0%, ${o}08 100%);
        border-${n}: 4px solid ${o};
        padding: 8px 12px;
        font-size: ${Math.max(9,r-1)}pt;
        margin-top: 4mm;
        border-radius: 4px;
        line-height: 1.6;
      }
      .ws-instructions strong { color: ${a}; margin-${m}: 4px; }

      /* Questions */
      .ws-questions {
        column-gap: 8mm;
        flex: 1;
      }
      .ws-q {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 6mm;
        padding: 4mm 4mm 4mm 5mm;
        border-${n}: 3px solid ${o};
        background: linear-gradient(180deg, #ffffff 0%, ${a}04 100%);
        border-radius: 0 6px 6px 0;
        ${i?"border-radius: 6px 0 0 6px;":""}
      }
      .ws-q-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 3mm; }
      .ws-q-num {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px;
        background: ${a};
        color: white;
        border-radius: 50%;
        font-weight: 800;
        font-size: ${Math.max(9.5,r-1)}pt;
        font-family: ${s};
        box-shadow: 0 0 0 2px ${o}55;
      }
      .ws-q-prompt-wrap { flex: 1; min-width: 0; }
      .ws-q-typeline { display: flex; align-items: center; gap: 8px; margin-bottom: 1.5mm; flex-wrap: wrap; }
      .ws-q-typebadge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: ${Math.max(7.5,r-3.5)}pt;
        font-weight: 700;
        color: ${a};
        background: ${a}0e;
        padding: 1.5px 7px 1.5px 5px;
        border-radius: 999px;
        letter-spacing: 0.02em;
      }
      .ws-q-points {
        font-size: ${Math.max(7.5,r-3.5)}pt;
        font-weight: 800;
        color: ${o};
        background: ${o}18;
        padding: 1.5px 7px;
        border-radius: 999px;
      }
      .ws-q-prompt { font-weight: 600; color: #1a2421; line-height: 1.7; }

      .ws-mcq { list-style: none; padding-${n}: 36px; margin: 2mm 0 0; }
      .ws-mcq li {
        display: flex; gap: 7px; align-items: center;
        margin: 2mm 0;
        line-height: 1.6;
      }
      .ws-mcq-letter {
        display: inline-block;
        min-width: 18px;
        font-weight: 800;
        color: ${o};
        font-family: ${s};
      }
      .ws-bubble {
        display: inline-block;
        width: 14px; height: 14px;
        border: 1.6px solid ${a}88;
        border-radius: 50%;
        flex: 0 0 auto;
        background: white;
      }
      .ws-mcq-text { flex: 1; }

      .ws-tf {
        display: flex; gap: 30px;
        padding-${n}: 36px;
        margin-top: 2mm;
      }
      .ws-tf-opt {
        display: inline-flex; align-items: center; gap: 7px;
        font-weight: 600;
      }

      .ws-lines { padding-${n}: 36px; margin-top: 2mm; }
      .ws-line {
        display: block;
        border-bottom: 1px dotted ${a}66;
        height: 8mm;
      }

      .ws-fill { padding-${n}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${a};
      }

      .ws-match {
        display: grid;
        grid-template-columns: 1fr 6mm 1fr;
        gap: 6mm;
        padding-${n}: 36px;
        margin-top: 3mm;
        align-items: stretch;
      }
      .ws-match-col {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 2.5mm;
      }
      .ws-match-col li {
        display: flex; align-items: center; gap: 7px;
        background: white;
        border: 1px solid ${a}22;
        border-radius: 6px;
        padding: 4px 9px;
        font-weight: 500;
      }
      .ws-match-bullet {
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px;
        border-radius: 50%;
        font-weight: 800;
        font-family: ${s};
        font-size: ${Math.max(8.5,r-2.5)}pt;
        flex: 0 0 auto;
      }
      .ws-match-num { background: ${a}; color: white; }
      .ws-match-letter { background: ${o}; color: white; }
      .ws-match-text { flex: 1; }
      .ws-match-tab { flex: 0 0 0; }
      .ws-match-divider {
        background: repeating-linear-gradient(to bottom, ${o} 0 4px, transparent 4px 9px);
        width: 2px;
        margin: 0 auto;
      }

      /* Footer strip — brand line removed per teacher request; only the
         "good luck" cheer and optional teacher footer note remain. */
      .ws-footer {
        margin-top: auto;
        padding-top: 6mm;
        border-top: 1px dashed ${a}44;
        text-align: center;
        font-size: ${Math.max(8,r-2.5)}pt;
        color: #6a7370;
      }
      .ws-footer-cheer {
        font-family: ${s};
        font-weight: 700;
        color: ${o};
        font-size: ${Math.max(9.5,r-1)}pt;
        margin-bottom: 2mm;
        letter-spacing: 0.02em;
      }
      .ws-footer-note {
        color: #555;
        font-style: italic;
      }

      /* Answer key tweaks */
      .ws-answer { margin-bottom: 4mm; padding: 3mm 4mm; }
      .ws-answer .ws-q-num { background: ${o}; box-shadow: 0 0 0 2px ${a}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${n}: 36px;
        color: ${a};
        font-size: ${Math.max(9.5,r-.5)}pt;
      }
      .ws-answer-line strong { color: ${o}; margin-${m}: 4px; }

      @media print {
        @page { size: A4; margin: 0; }
        html, body { background: white !important; }
        .no-print { display: none !important; }
        .print-host {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: auto !important;
        }
        .ws-page {
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          width: 210mm !important;
          min-height: 297mm !important;
        }
        .ws-watermark, .ws-watermark-word,
        .ws-corner, .ws-q, .ws-instructions, .ws-school-cell,
        .ws-q-num, .ws-q-typebadge, .ws-q-points,
        .ws-match-bullet, .ws-divider-thick, .ws-divider-thin,
        .ws-kicker-center {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `})}export{q as WorksheetPrintView,le as default};
