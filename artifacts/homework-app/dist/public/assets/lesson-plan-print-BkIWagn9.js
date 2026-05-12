import{W as $,u as L,a as M,r as j,t as v,j as e,L as C}from"./index-D0XpAK0_.js";import{p as A,d as z}from"./print-export-DjFgfEmw.js";import{A as I}from"./arrow-left-CAiovdBG.js";import{P as B}from"./pen-line-6NwypjLy.js";import{F as W}from"./file-type-Cn5f6zdG.js";import{P}from"./printer-BtSVTW1I.js";const _="",o="#225739",s="#D9A521";function F({data:n}){const a=n.language==="ar",l=a?"rtl":"ltr",r=a?{teacher:"المعلم",subject:"المادة",grade:"المرحلة",date:"التاريخ",duration:"المدة",objectives:"الأهداف التعليمية",materials:"المواد والأدوات",vocabulary:"المفردات الجديدة",warmUp:"التهيئة (الإحماء)",introduction:"التمهيد",activities:"الأنشطة الرئيسة",assessment:"التقويم",method:"أسلوب التقويم",closure:"الخاتمة",homework:"الواجب المنزلي",differentiation:"تنويع التعليم",support:"للطلاب الذين يحتاجون دعمًا",extension:"للطلاب المتقدّمين",notes:"ملاحظات المعلم",lessonPlan:"خطة درس",minute:"د",term:"المصطلح",definition:"المعنى"}:{teacher:"Teacher",subject:"Subject",grade:"Grade",date:"Date",duration:"Duration",objectives:"Learning Objectives",materials:"Materials & Tools",vocabulary:"New Vocabulary",warmUp:"Warm-up",introduction:"Introduction",activities:"Main Activities",assessment:"Assessment",method:"Method",closure:"Closure",homework:"Homework",differentiation:"Differentiation",support:"Support",extension:"Extension",notes:"Teacher Notes",lessonPlan:"Lesson Plan",minute:"min",term:"Term",definition:"Definition"},t=n.sections,i=n.settings,u=y(i.fontFamily,n.language),m=ee(i.fontFamily,n.language),g=te(i.fontSizePt),f=(i.lessonDateGregorian??"").trim(),p=(i.lessonDateHijri??"").trim(),k=a?"التاريخ الميلادي":"Gregorian date",N=a?"التاريخ الهجري":"Hijri date";return e.jsxs(e.Fragment,{children:[e.jsx(Z,{lang:n.language,fontStack:u,headingFont:m,fontSizePt:g}),e.jsx("div",{id:"lp-printable-root",className:"print-host bg-gray-100 py-6 px-2 sm:px-6 min-h-screen flex justify-center",children:e.jsxs("article",{dir:l,className:"lp-page",lang:n.language,children:[e.jsx(D,{}),e.jsxs("div",{className:"lp-content",children:[e.jsxs("header",{className:"lp-header",children:[e.jsx("div",{className:"lp-kicker-row",children:e.jsx("div",{className:"lp-kicker",children:r.lessonPlan})}),e.jsx("h1",{className:"lp-title",style:{fontFamily:m},children:n.title}),i.headerNote&&e.jsx("p",{className:"lp-subtitle",children:i.headerNote}),e.jsxs("div",{className:"lp-divider","aria-hidden":"true",children:[e.jsx("span",{className:"lp-divider-thick"}),e.jsx("span",{className:"lp-divider-thin"})]}),e.jsxs("div",{className:"lp-meta-grid",children:[e.jsx(x,{label:r.teacher,value:n.ownerName||"—",icon:e.jsx(Y,{})}),n.subject&&e.jsx(x,{label:r.subject,value:n.subject,icon:e.jsx(q,{})}),n.gradeLevel&&e.jsx(x,{label:r.grade,value:n.gradeLevel,icon:e.jsx(Q,{})}),n.durationMinutes&&e.jsx(x,{label:r.duration,value:`${n.durationMinutes} ${r.minute}`,icon:e.jsx(X,{})}),f||p?e.jsxs(e.Fragment,{children:[f&&e.jsx(x,{label:k,value:f,icon:e.jsx(b,{})}),p&&e.jsx(x,{label:N,value:p,icon:e.jsx(b,{})})]}):e.jsx(x,{label:r.date,value:"________________",icon:e.jsx(b,{})})]})]}),e.jsxs("div",{className:"lp-body",children:[(i.includeObjectives&&t.objectives.length>0||i.includeMaterials&&t.materials.length>0)&&e.jsxs("div",{className:"lp-row-2",children:[i.includeObjectives&&t.objectives.length>0&&e.jsx(d,{title:r.objectives,icon:e.jsx(S,{}),accent:"primary",children:e.jsx("ol",{className:"lp-ol",children:t.objectives.map((c,h)=>e.jsx("li",{children:c},h))})}),i.includeMaterials&&t.materials.length>0&&e.jsx(d,{title:r.materials,icon:e.jsx(H,{}),accent:"gold",children:e.jsx("ul",{className:"lp-checklist",children:t.materials.map((c,h)=>e.jsxs("li",{children:[e.jsx("span",{className:"lp-check"})," ",e.jsx("span",{children:c})]},h))})})]}),i.includeVocabulary&&t.vocabulary.length>0&&e.jsx(d,{title:r.vocabulary,icon:e.jsx(R,{}),accent:"gold",children:e.jsxs("table",{className:"lp-vocab",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:r.term}),e.jsx("th",{children:r.definition})]})}),e.jsx("tbody",{children:t.vocabulary.map((c,h)=>e.jsxs("tr",{className:h%2===0?"even":"odd",children:[e.jsx("td",{className:"lp-vocab-term",children:c.term}),e.jsx("td",{children:c.definition||"—"})]},h))})]})}),i.includeWarmUp&&e.jsx(d,{title:r.warmUp,duration:t.warmUp.durationMinutes,minLabel:r.minute,icon:e.jsx(T,{}),accent:"primary",children:e.jsx("p",{children:t.warmUp.description})}),i.includeIntroduction&&e.jsx(d,{title:r.introduction,duration:t.introduction.durationMinutes,minLabel:r.minute,icon:e.jsx(G,{}),accent:"primary",children:e.jsx("p",{children:t.introduction.description})}),i.includeActivities&&t.activities.length>0&&e.jsx(d,{title:r.activities,icon:e.jsx(E,{}),accent:"gold",children:e.jsx("div",{className:"lp-activities",children:t.activities.map((c,h)=>e.jsxs("div",{className:"lp-activity",children:[e.jsx("div",{className:"lp-activity-num",children:h+1}),e.jsxs("div",{className:"lp-activity-body",children:[e.jsxs("div",{className:"lp-activity-head",children:[e.jsx("span",{className:"lp-activity-title",children:c.title}),typeof c.durationMinutes=="number"&&c.durationMinutes>0&&e.jsxs("span",{className:"lp-activity-dur",children:[e.jsx(w,{})," ",c.durationMinutes," ",r.minute]})]}),e.jsx("p",{className:"lp-activity-desc",children:c.description}),c.activityRef&&e.jsxs("div",{className:"lp-activity-ref","aria-label":a?"نشاط مرتبط":"Linked activity",children:[e.jsx("span",{className:"lp-activity-ref-icon","aria-hidden":"true",children:"↗"}),e.jsxs("span",{className:"lp-activity-ref-kind",children:[ie(c.activityRef.kind,a),":"]}),e.jsx("span",{className:"lp-activity-ref-title",children:c.activityRef.title})]})]})]},h))})}),i.includeAssessment&&e.jsxs(d,{title:r.assessment,icon:e.jsx(V,{}),accent:"primary",children:[t.assessment.method&&e.jsxs("p",{className:"lp-meta-line",children:[e.jsxs("strong",{children:[r.method,":"]})," ",t.assessment.method]}),e.jsx("p",{children:t.assessment.description})]}),i.includeClosure&&e.jsx(d,{title:r.closure,icon:e.jsx(O,{}),accent:"primary",children:e.jsx("p",{children:t.closure.description})}),i.includeHomework&&t.homework?.description&&e.jsx(d,{title:r.homework,icon:e.jsx(U,{}),accent:"gold",children:e.jsx("p",{children:t.homework.description})}),i.includeDifferentiation&&t.differentiation&&(t.differentiation.support||t.differentiation.extension)&&e.jsx(d,{title:r.differentiation,icon:e.jsx(K,{}),accent:"primary",children:e.jsxs("div",{className:"lp-diff-grid",children:[t.differentiation.support&&e.jsxs("div",{className:"lp-diff-card lp-diff-support",children:[e.jsx("strong",{children:r.support}),e.jsx("span",{children:t.differentiation.support})]}),t.differentiation.extension&&e.jsxs("div",{className:"lp-diff-card lp-diff-extension",children:[e.jsx("strong",{children:r.extension}),e.jsx("span",{children:t.differentiation.extension})]})]})}),i.includeNotes&&t.notes&&e.jsx(d,{title:r.notes,icon:e.jsx(J,{}),accent:"gold",children:e.jsx("p",{className:"lp-notes",children:t.notes})})]}),i.footerNote&&e.jsx("footer",{className:"lp-footer",children:e.jsx("div",{className:"lp-footer-note",children:i.footerNote})})]})]})})]})}function ce(){const a=$()?.id,{lang:l}=L(),[,r]=M(),[t,i]=j.useState(null),[u,m]=j.useState(!0);if(j.useEffect(()=>{a&&fetch(`${_}/api/lesson-plans/${a}`,{credentials:"include"}).then(p=>{if(!p.ok)throw new Error("load failed");return p.json()}).then(i).catch(()=>v.error(l==="ar"?"تعذّر تحميل الخطة":"Failed to load plan")).finally(()=>m(!1))},[a,l]),u)return e.jsx("div",{className:"min-h-screen flex items-center justify-center",children:e.jsx(C,{className:"w-8 h-8 animate-spin",style:{color:o}})});if(!t)return e.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:l==="ar"?"لم يتم العثور على الخطة.":"Plan not found."});const g=t.language==="ar"?"rtl":"ltr",f=()=>{const p=document.getElementById("lp-printable-root");if(!p){v.error(l==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}z({element:p,title:t.title,lang:t.language})};return e.jsxs(e.Fragment,{children:[e.jsxs("div",{dir:g,className:"no-print sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[e.jsxs("button",{onClick:()=>r("/teacher"),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]",style:{borderColor:`${o}55`,color:o},children:[e.jsx(I,{className:"w-3.5 h-3.5"}),l==="ar"?"اللوحة":"Dashboard"]}),e.jsxs("div",{className:"flex items-center gap-2 flex-wrap justify-end",children:[t.isOwner&&e.jsxs("button",{onClick:()=>r(`/teacher/lesson-plans/create?edit=${t.id}`),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]",style:{borderColor:`${o}55`,color:o},children:[e.jsx(B,{className:"w-3.5 h-3.5"}),l==="ar"?"تعديل":"Edit"]}),e.jsxs("button",{onClick:f,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 min-h-[40px]",style:{borderColor:`${s}88`,color:s,background:`${s}10`},title:l==="ar"?"تنزيل كملف وورد":"Download as Word",children:[e.jsx(W,{className:"w-3.5 h-3.5"}),l==="ar"?"وورد":"Word"]}),e.jsxs("button",{onClick:()=>A(),className:"px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 text-white shadow min-h-[40px]",style:{background:o},children:[e.jsx(P,{className:"w-4 h-4"}),l==="ar"?"PDF / طباعة":"PDF / Print"]})]})]}),e.jsx(F,{data:t})]})}function D(){return e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"lp-corner lp-corner-tl","aria-hidden":"true"}),e.jsx("span",{className:"lp-corner lp-corner-tr","aria-hidden":"true"}),e.jsx("span",{className:"lp-corner lp-corner-bl","aria-hidden":"true"}),e.jsx("span",{className:"lp-corner lp-corner-br","aria-hidden":"true"})]})}function x({label:n,value:a,icon:l}){return e.jsxs("div",{className:"lp-meta-cell",children:[l&&e.jsx("span",{className:"lp-meta-icon",children:l}),e.jsxs("div",{className:"lp-meta-text",children:[e.jsx("span",{className:"lp-meta-label",children:n}),e.jsx("span",{className:"lp-meta-value",children:a})]})]})}function d({title:n,duration:a,minLabel:l,children:r,icon:t,accent:i="primary"}){return e.jsxs("section",{className:`lp-section lp-accent-${i}`,children:[e.jsxs("h2",{className:"lp-section-title",children:[e.jsx("span",{className:"lp-section-icon",children:t}),e.jsx("span",{className:"lp-section-name",children:n}),typeof a=="number"&&a>0&&e.jsxs("span",{className:"lp-section-dur",children:[e.jsx(w,{})," ",a," ",l]})]}),e.jsx("div",{className:"lp-section-body",children:r})]})}function S(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"12",r:"9"}),e.jsx("circle",{cx:"12",cy:"12",r:"5.5"}),e.jsx("circle",{cx:"12",cy:"12",r:"2",fill:"currentColor",stroke:"none"})]})}function H(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"3",y:"7",width:"18",height:"13",rx:"2"}),e.jsx("path",{d:"M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"})]})}function R(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4z"}),e.jsx("path",{d:"M20 4h-7a3 3 0 0 0-3 3v13h7a3 3 0 0 1 3 3V4z"})]})}function T(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1 1 2 2 2 0-3 1-5 1-7z"})})}function G(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"12",r:"9"}),e.jsx("path",{d:"M15 9l-2 6-6 2 2-6 6-2z"})]})}function E(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M3 12h3l3-7 4 14 3-7h5"})})}function V(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M3 12l5 5L21 4"})})}function O(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M5 12h14M13 6l6 6-6 6"})})}function U(){return e.jsx("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9z"})})}function K(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"6",cy:"6",r:"2"}),e.jsx("circle",{cx:"18",cy:"6",r:"2"}),e.jsx("circle",{cx:"12",cy:"20",r:"2"}),e.jsx("path",{d:"M6 8v4a4 4 0 0 0 4 4M18 8v4a4 4 0 0 1-4 4"})]})}function J(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"}),e.jsx("path",{d:"M16 4v4h4M8 12h8M8 16h6"})]})}function Y(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"8",r:"3"}),e.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function q(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"4",y:"3",width:"16",height:"18",rx:"2"}),e.jsx("path",{d:"M8 7h8M8 11h8M8 15h5"})]})}function Q(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),e.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function X(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"12",r:"9"}),e.jsx("path",{d:"M12 7v5l3 2"})]})}function w(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"11",height:"11",fill:"none",stroke:"currentColor",strokeWidth:"2.4",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("circle",{cx:"12",cy:"12",r:"9"}),e.jsx("path",{d:"M12 7v5l3 2"})]})}function b(){return e.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),e.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function Z({lang:n,fontStack:a,headingFont:l,fontSizePt:r}){const t=n==="ar",i=t?"right":"left",u=t?"left":"right",m=a;return e.jsx("style",{children:`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${m}; }
      .lp-page {
        position: relative;
        width: 210mm;
        min-height: 297mm;
        background: white;
        box-shadow: 0 6px 28px rgba(34,87,57,0.12);
        color: #1a2421;
        font-size: ${r}pt;
        line-height: 1.85;
        box-sizing: border-box;
        border-radius: 4px;
        overflow: hidden;
      }
      .lp-content {
        position: relative; z-index: 1;
        padding: 22mm 20mm 18mm;
        display: flex; flex-direction: column;
        min-height: 297mm; box-sizing: border-box;
      }

      .lp-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${s};
        z-index: 0; pointer-events: none;
      }
      .lp-corner-tl { top: 8mm; left: 8mm; border-right: 0; border-bottom: 0; border-top-left-radius: 6px; }
      .lp-corner-tr { top: 8mm; right: 8mm; border-left: 0; border-bottom: 0; border-top-right-radius: 6px; }
      .lp-corner-bl { bottom: 8mm; left: 8mm; border-right: 0; border-top: 0; border-bottom-left-radius: 6px; }
      .lp-corner-br { bottom: 8mm; right: 8mm; border-left: 0; border-top: 0; border-bottom-right-radius: 6px; }

      .lp-header { margin-bottom: 8mm; }
      /* Kicker row — used to host the brand bar; now centers the
         "Lesson Plan" pill since the Hasad brand mark has been removed. */
      .lp-kicker-row { display: flex; align-items: center; justify-content: center; margin-bottom: 4mm; }
      .lp-kicker {
        font-size: 9pt; letter-spacing: 1.6px; text-transform: uppercase;
        color: ${s}; font-weight: 800;
        background: ${s}1c; padding: 4px 12px; border-radius: 999px;
      }
      .lp-title {
        font-size: 24pt; font-weight: 800; color: ${o};
        margin: 4px 0 4px; text-align: center; line-height: 1.25;
      }
      .lp-subtitle { color: #5a6663; font-size: 10.5pt; margin: 2px 0 8px; text-align: center; }

      .lp-divider {
        display: flex; flex-direction: column; gap: 1.4mm;
        align-items: center; margin: 3mm auto 5mm; width: 100%;
      }
      .lp-divider-thick { width: 60%; height: 2px; background: ${s}; border-radius: 2px; }
      .lp-divider-thin {
        width: 38%; height: 1px;
        background: repeating-linear-gradient(to right, ${o} 0 6px, transparent 6px 12px);
      }

      .lp-meta-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 6px 14px; margin-top: 6mm;
      }
      .lp-meta-cell {
        display: flex; align-items: center; gap: 8px;
        font-size: 10pt; padding: 4px 8px;
        background: ${o}07;
        border-${i}: 2.5px solid ${o};
        border-radius: 4px;
      }
      .lp-meta-icon { color: ${o}; flex: 0 0 auto; display: inline-flex; }
      .lp-meta-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
      .lp-meta-label { font-weight: 700; color: ${o}; font-size: 8pt; letter-spacing: 0.02em; }
      .lp-meta-value { color: #2a3431; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .lp-meta-line { font-size: 10.5pt; margin: 0 0 4px; color: #444; }
      .lp-meta-line strong { color: ${o}; margin-${u}: 4px; }

      .lp-body { display: flex; flex-direction: column; gap: 6mm; }
      .lp-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
      @media (max-width: 600px) { .lp-row-2 { grid-template-columns: 1fr; } }

      .lp-section {
        border: 1px solid ${o}1f;
        border-radius: 8px;
        padding: 10px 14px 12px;
        page-break-inside: avoid;
        background: white;
        position: relative;
        overflow: hidden;
      }
      .lp-section::before {
        content: "";
        position: absolute; top: 0; left: 0; right: 0; height: 4px;
        background: ${o};
      }
      .lp-accent-gold::before { background: ${s}; }

      .lp-section-title {
        display: flex; align-items: center; gap: 8px;
        font-family: ${l};
        font-size: 13pt; font-weight: 800; color: ${o};
        margin: 2mm 0 4mm; padding-bottom: 6px;
        border-bottom: 1px dashed ${s}88;
      }
      .lp-section-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        background: ${o}11;
        color: ${o};
        border-radius: 50%;
        flex: 0 0 auto;
      }
      .lp-accent-gold .lp-section-icon { background: ${s}1c; color: ${s}; }
      .lp-section-name { flex: 1; }
      .lp-section-dur {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 9.5pt; color: ${s};
        background: ${s}18;
        padding: 3px 9px; border-radius: 999px; font-weight: 700;
      }
      .lp-section-body { font-size: ${Math.max(9.5,r-.5)}pt; color: #222; }
      .lp-section-body p { margin: 0 0 4px; }

      .lp-ol, .lp-ul {
        margin: 0; padding-${i}: 22px;
        list-style-position: outside;
      }
      .lp-ol { counter-reset: lpcnt; list-style: none; padding-${i}: 0; }
      .lp-ol li {
        counter-increment: lpcnt;
        position: relative;
        padding-${i}: 28px;
        margin: 3px 0;
      }
      .lp-ol li::before {
        content: counter(lpcnt);
        position: absolute; ${i}: 0; top: 2px;
        width: 20px; height: 20px;
        background: ${o};
        color: white;
        border-radius: 50%;
        font-weight: 800;
        font-size: 9pt;
        font-family: ${l};
        display: inline-flex; align-items: center; justify-content: center;
      }

      .lp-checklist { list-style: none; margin: 0; padding: 0; }
      .lp-checklist li {
        display: flex; align-items: center; gap: 8px;
        margin: 4px 0;
      }
      .lp-check {
        display: inline-block;
        width: 12px; height: 12px;
        border: 1.6px solid ${s};
        border-radius: 3px;
        flex: 0 0 auto;
      }

      .lp-vocab {
        width: 100%; border-collapse: separate; border-spacing: 0;
        border-radius: 6px; overflow: hidden;
        border: 1px solid ${o}22;
      }
      .lp-vocab thead th {
        background: ${o};
        color: white;
        padding: 7px 12px;
        text-align: ${i};
        font-size: 10.5pt;
        font-weight: 800;
        font-family: ${l};
      }
      .lp-vocab tbody td {
        padding: 7px 12px;
        text-align: ${i};
        font-size: 10.5pt;
        vertical-align: top;
        border-bottom: 1px solid ${o}15;
      }
      .lp-vocab tbody tr:last-child td { border-bottom: none; }
      .lp-vocab tbody tr.even { background: ${s}07; }
      .lp-vocab tbody tr.odd { background: white; }
      .lp-vocab-term {
        font-weight: 700;
        color: ${o};
        width: 30%;
      }

      /* Activities timeline */
      .lp-activities { display: flex; flex-direction: column; gap: 6px; position: relative; }
      .lp-activities::before {
        content: "";
        position: absolute;
        top: 18px; bottom: 18px;
        ${i}: 14px;
        width: 2px;
        background: repeating-linear-gradient(to bottom, ${s} 0 4px, transparent 4px 9px);
      }
      .lp-activity {
        display: flex; gap: 10px; align-items: flex-start;
        background: ${o}05;
        border-${i}: 4px solid ${s};
        padding: 8px 12px; border-radius: 4px;
        page-break-inside: avoid;
        position: relative;
      }
      .lp-activity-num {
        flex: 0 0 auto;
        width: 28px; height: 28px;
        background: ${o};
        color: white;
        border-radius: 50%;
        font-weight: 800; font-size: 10pt;
        font-family: ${l};
        display: inline-flex; align-items: center; justify-content: center;
        box-shadow: 0 0 0 2px ${s}55;
        z-index: 1;
      }
      .lp-activity-body { flex: 1; min-width: 0; }
      .lp-activity-head {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 3px; flex-wrap: wrap;
      }
      .lp-activity-title { font-weight: 800; color: ${o}; flex: 1; font-size: ${Math.max(9.5,r-.5)}pt; }
      .lp-activity-dur {
        display: inline-flex; align-items: center; gap: 3px;
        font-size: ${Math.max(8,r-2.5)}pt; color: ${s};
        background: ${s}18;
        padding: 2px 8px; border-radius: 999px; font-weight: 700;
      }
      .lp-activity-desc { font-size: ${Math.max(9.5,r-.5)}pt; color: #222; margin: 0; }
      /* Linked-Hasad-activity badge: a small, low-key inline reference
         that follows the description so the printed plan tells the
         teacher exactly which platform asset they wired this step to. */
      .lp-activity-ref {
        margin-top: 4px;
        display: inline-flex; align-items: center; gap: 5px;
        font-size: ${Math.max(8.5,r-2)}pt;
        color: ${o};
        background: ${s}14;
        border: 1px dashed ${s}88;
        padding: 2px 8px; border-radius: 999px;
        max-width: 100%; flex-wrap: wrap;
      }
      .lp-activity-ref-icon { color: ${s}; font-weight: 800; }
      .lp-activity-ref-kind { font-weight: 800; color: ${s}; }
      .lp-activity-ref-title { color: #2a3431; font-weight: 600; }

      .lp-diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      @media (max-width: 600px) { .lp-diff-grid { grid-template-columns: 1fr; } }
      .lp-diff-card {
        padding: 8px 10px; border-radius: 6px;
        font-size: 10.5pt; line-height: 1.6;
        display: flex; flex-direction: column; gap: 3px;
      }
      .lp-diff-card strong { color: ${o}; font-weight: 800; }
      .lp-diff-support { background: ${o}0d; border-${i}: 3px solid ${o}; }
      .lp-diff-extension { background: ${s}12; border-${i}: 3px solid ${s}; }
      .lp-diff-extension strong { color: ${s}; }

      .lp-notes {
        white-space: pre-wrap;
        font-size: 11pt; color: #333;
        font-style: italic;
        background: ${s}08;
        padding: 8px 12px; border-radius: 4px;
        border-${i}: 3px solid ${s};
      }

      .lp-footer {
        margin-top: auto;
        padding-top: 6mm;
        border-top: 1px dashed ${o}44;
        text-align: center;
        font-size: 9pt;
        color: #6a7370;
      }
      .lp-footer-note { font-style: italic; margin-bottom: 2mm; color: #555; }
      .lp-footer-brand {
        display: inline-flex; align-items: center; gap: 8px;
        font-weight: 700; color: ${o};
      }
      .lp-footer-dot {
        display: inline-block; width: 4px; height: 4px;
        background: ${s}; border-radius: 50%;
      }

      @page { size: A4; margin: 0; }
      @media print {
        html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
        .no-print, .no-print * { display: none !important; }
        .print-host { background: white !important; padding: 0 !important; }
        .lp-page {
          box-shadow: none !important;
          border-radius: 0 !important;
          min-height: 297mm;
        }
        .lp-section, .lp-section::before,
        .lp-section-icon, .lp-section-dur,
        .lp-corner, .lp-meta-cell,
        .lp-kicker, .lp-divider-thick, .lp-divider-thin,
        .lp-vocab thead th, .lp-vocab tbody tr.even,
        .lp-activity, .lp-activity-num, .lp-activity-dur,
        .lp-activity-ref,
        .lp-ol li::before, .lp-diff-support, .lp-diff-extension,
        .lp-notes, .lp-footer-dot {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `})}function y(n,a){const l=a==="ar";switch(n){case"cairo":return"'Cairo', 'Tajawal', 'Arial', sans-serif";case"tajawal":return"'Tajawal', 'Cairo', 'Arial', sans-serif";case"amiri":return"'Amiri', 'Noto Naskh Arabic', serif";case"naskh":return"'Noto Naskh Arabic', 'Amiri', serif";case"reem":return"'Reem Kufi', 'Cairo', sans-serif";case"inter":return"'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";case"serif":return l?"'Amiri', 'Noto Naskh Arabic', Georgia, serif":"Georgia, 'Times New Roman', serif";case"mono":return"'JetBrains Mono', 'Courier New', monospace";default:return l?"'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif":"'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif"}}function ee(n,a){const l=a==="ar";return!n||n==="default"?l?"'Reem Kufi', 'Amiri', 'Cairo', sans-serif":"'Inter', 'Source Sans Pro', sans-serif":y(n,a)}function te(n){const a=typeof n=="number"&&Number.isFinite(n)?n:11.5;return Math.min(18,Math.max(9,a))}function ie(n,a){return a?n==="assignment"?"واجب":"درس فيديو":n==="assignment"?"Assignment":"Video lesson"}export{F as LessonPlanPrintView,te as clampFontSize,ce as default,ie as labelForRefKind,y as resolveLpFont,ee as resolveLpHeadingFont};
