import{j as t,r as w,v as mt,k as xe,X as ms,aM as ps,u as hs,b as gs,aC as us,L as et,R as Nt}from"./index-I_MEjkET.js";import{P as xs,F as ws,a as bs,S as fs,I as ys,T as js,V as ks,b as vs,H as $s,c as Ns,p as _s,d as As}from"./print-export-jIFFbylF.js";import{D as Ss,a as Cs,b as Ls,c as _t}from"./dropdown-menu-XBKAXsnN.js";import{r as Is}from"./image-url-Cm2t2lLM.js";import{I as Es}from"./image-DhmY1eUl.js";import{F as Ms}from"./file-text-HNEGURZQ.js";import{B as zs,a as At,T as Fs}from"./text-align-end-t6HXk5Kr.js";import{S as Rs}from"./settings-C08amWtF.js";import{a as Ie}from"./math-text-Db7-w-n7.js";import{c as Bs}from"./content-direction-DAlRqWnC.js";import{Q as Ds}from"./index-J9j1LPmt.js";import{A as Ps}from"./arrow-left-CneuaSsM.js";import{C as Ws}from"./camera-DIvibtD_.js";import{P as Pt}from"./pen-line-DLhI--Cj.js";import{S as Hs}from"./save-CptX_Lhy.js";import{F as qs}from"./file-type-CHeVNuHa.js";import{D as Os}from"./download-qDsGEGJA.js";import{M as Us}from"./minus-BNIP21v8.js";import{T as St}from"./text-align-start-BEJqYkXV.js";import{C as Ts}from"./check-check-Cw0A3E6H.js";function Me(e){if(!e)return e;const s="/";try{const r=new URL(e,window.location.href);if(r.origin!==window.location.origin)return e;if(r.pathname===`${s}images/logo-hasaad.png`)return`${s}images/logo-hasaad-transparent.png`;if([`${s}images/logo-icon.png`,`${s}images/logo-mark.png`].includes(r.pathname))return`${s}images/logo-mark-transparent.png`}catch{return e}return e}const pt={geometric:{id:"geometric",nameAr:"هندسي",nameEn:"Geometric",description:"هيكل منظم، شبكة، وأرقام مربعة — للرياضيات والفيزياء",headerLayout:"tabular",defaultColor:"#1B2D6B",swatchColors:["#1B2D6B","#E07B20"],css({TC:e,GOLD:s,fontSizePt:r,isAr:o,startSide:l}){return`
        .ws-theme-geometric.ws-page {
          --ws-frame: 5px; /* حد 2.5px أعلى + أسفل */
          background: white;
          border: 2.5px solid ${e};
          border-radius: 0;
          box-shadow: 4px 4px 0 ${e}22;
        }
        .ws-theme-geometric .ws-content {
          padding: 14mm 16mm 13mm;
        }
        /* No classic corner ornaments — replaced by the border frame */
        .ws-theme-geometric .ws-corner { display: none; }
        /* Watermark: very faint, rotated */
        .ws-theme-geometric .ws-watermark-word { opacity: 0.018; color: ${e}; }
        /* Square number badges — geometric feel */
        .ws-theme-geometric .ws-q-num {
          border-radius: 3px;
          box-shadow: none;
          background: ${e};
          width: 24px; height: 24px;
        }
        /* Questions: clean bottom-rule style, no left bar */
        .ws-theme-geometric .ws-q {
          border-${l}: 0;
          border-bottom: 1.5px solid ${e}20;
          border-radius: 0;
          background: none;
          padding: 3mm 0 4mm;
          margin-bottom: 4mm;
        }
        .ws-theme-geometric .ws-q:last-child { border-bottom: 0; }
        /* Accent lines for fill/short answer */
        .ws-theme-geometric .ws-line { border-bottom-color: ${e}44; }
        .ws-theme-geometric .ws-fill-rule { border-bottom-color: ${e}; border-bottom-style: solid; }
        /* MCQ bullets: square */
        .ws-theme-geometric .ws-bubble {
          border-radius: 2px;
          border-color: ${e}66;
        }
        /* Footer */
        .ws-theme-geometric .ws-footer { border-top-color: ${e}44; }
        /* Match column items */
        .ws-theme-geometric .ws-match-col li { border-radius: 2px; border-color: ${e}33; }
        /* Tabular header styles */
        .ws-tab-header { border-top: 3px solid ${e}; border-bottom: 2px solid ${e}; padding: 4mm 0; margin-bottom: 5mm; }
        .ws-tab-toprow {
          display: grid;
          grid-template-columns: 1fr 1.6fr 1fr;
          align-items: center;
          gap: 4mm;
          margin-bottom: 3mm;
        }
        .ws-tab-school {
          font-size: ${Math.max(8.5,r-2)}pt;
          font-weight: 700;
          color: ${e};
          line-height: 1.4;
        }
        .ws-tab-title {
          text-align: center;
          font-size: ${r+10}pt;
          font-weight: 900;
          color: ${e};
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .ws-tab-meta {
          text-align: ${o?"left":"right"};
          font-size: ${Math.max(8.5,r-2)}pt;
          color: ${e}cc;
          font-weight: 600;
          line-height: 1.4;
        }
        .ws-tab-sub {
          display: inline-block;
          background: ${e};
          color: white;
          font-size: ${Math.max(8,r-3)}pt;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 2px;
          margin-bottom: 2mm;
        }
        .ws-tab-inner-rule { height: 1px; background: ${e}33; margin: 2mm 0; }
        /* Cont header */
        .ws-theme-geometric .ws-cont-header { border-bottom-color: ${e}44; }
      `}},arabic_ink:{id:"arabic_ink",nameAr:"خط عربي",nameEn:"Arabic Ink",description:"أناقة كلاسيكية، خلفية كريمية، زخارف عربية",headerLayout:"arabesque",defaultColor:"#1B4D3E",swatchColors:["#1B4D3E","#C9972A"],headingFontOverride:"'Amiri', 'Scheherazade New', 'Cairo', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:o,isAr:l,startSide:a}){return`
        .ws-theme-arabic_ink.ws-page {
          --ws-frame: 3px; /* حد 1.5px أعلى + أسفل */
          background: ${r};
          border: 1.5px solid ${e}33;
          border-radius: 4px;
        }
        .ws-theme-arabic_ink .ws-content {
          padding: 16mm 18mm 14mm;
        }
        /* Double page border using content padding + inner rule */
        .ws-theme-arabic_ink.ws-page::before {
          content: '';
          position: absolute;
          inset: 5mm;
          border: 1px solid ${s}55;
          pointer-events: none;
          z-index: 0;
          border-radius: 2px;
        }
        .ws-theme-arabic_ink .ws-corner { border-color: ${s}; }
        /* Questions: right-side thick gold bar, no box, generous spacing */
        .ws-theme-arabic_ink .ws-q {
          border-${a}: 3.5px solid ${s};
          background: none;
          border-radius: 0;
          padding: 3mm ${l?"12px":"4mm"} 4mm ${l?"4mm":"12px"};
          margin-bottom: 6mm;
        }
        /* Circle badge in teal */
        .ws-theme-arabic_ink .ws-q-num { background: ${e}; box-shadow: 0 0 0 2px ${s}55; }
        /* Larger question text for Arabic readability */
        .ws-theme-arabic_ink .ws-q-prompt {
          font-size: ${o+.5}pt;
          line-height: 2;
          letter-spacing: 0.01em;
        }
        /* Answer lines */
        .ws-theme-arabic_ink .ws-line { border-bottom: 1px solid ${e}33; height: 9mm; }
        .ws-theme-arabic_ink .ws-fill-rule { border-bottom-color: ${e}66; }
        /* Footer */
        .ws-theme-arabic_ink .ws-footer { border-top: 1px solid ${s}55; color: #4a3a28; }
        .ws-theme-arabic_ink .ws-footer-cheer { color: ${s}; }
        /* Match */
        .ws-theme-arabic_ink .ws-match-col li { border-color: ${s}33; border-radius: 3px; background: ${r}; }
        /* Arabesque header CSS */
        .ws-arb-header { text-align: center; margin-bottom: 6mm; }
        .ws-arb-ornament {
          display: flex; align-items: center; justify-content: center;
          gap: 3mm; margin: 0 auto 3mm;
        }
        .ws-arb-ornament-line {
          flex: 1; height: 1.5px;
          background: linear-gradient(to ${l?"left":"right"}, transparent, ${s}, transparent);
          max-width: 60mm;
        }
        .ws-arb-diamond {
          width: 8px; height: 8px;
          background: ${s};
          transform: rotate(45deg);
          flex: 0 0 auto;
        }
        .ws-arb-diamond-sm {
          width: 5px; height: 5px;
          border: 1.5px solid ${s};
          transform: rotate(45deg);
          flex: 0 0 auto;
        }
        .ws-arb-title {
          font-size: ${o+13}pt;
          font-weight: 700;
          color: ${e};
          line-height: 1.3;
          letter-spacing: 0.03em;
          margin: 2mm 0;
        }
        .ws-arb-kicker {
          font-size: ${Math.max(9,o-1)}pt;
          color: ${s};
          font-weight: 600;
          margin: 1mm 0 3mm;
        }
        .ws-arb-identity {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 4mm;
          margin-top: 4mm;
          padding-top: 3mm;
          border-top: 1px dotted ${e}33;
        }
        .ws-arb-cell {
          display: flex; align-items: center; gap: 5px;
          font-size: ${Math.max(8.5,o-2)}pt;
          font-weight: 600;
          color: ${e};
        }
        .ws-arb-cell-label { color: ${e}88; font-weight: 500; }
        .ws-cont-header { border-bottom-color: ${s}55; }
      `}},modern_band:{id:"modern_band",nameAr:"شريط عصري",nameEn:"Modern Band",description:"شريط لوني علوي، بطاقات بيضاء، تصميم ناشر حديث",headerLayout:"band",defaultColor:"#1D4ED8",swatchColors:["#1D4ED8","#ffffff"],css({TC:e,GOLD:s,fontSizePt:r,isAr:o,startSide:l}){return`
        .ws-theme-modern_band.ws-page {
          background: white;
          border-radius: 4px;
        }
        .ws-theme-modern_band .ws-content { padding: 0 0 13mm; }
        /* No corner ornaments */
        .ws-theme-modern_band .ws-corner { display: none; }
        /* Questions: floating card style */
        .ws-theme-modern_band .ws-q {
          border-${l}: 0;
          border-radius: 6px;
          border: 1px solid ${e}18;
          box-shadow: 0 1px 4px ${e}12;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
        }
        .ws-theme-modern_band .ws-q-num {
          background: ${e};
          box-shadow: none;
          border-radius: 50%;
        }
        .ws-theme-modern_band .ws-line { border-bottom-color: ${e}33; }
        .ws-theme-modern_band .ws-fill-rule { border-bottom-color: ${e}55; }
        .ws-theme-modern_band .ws-bubble { border-color: ${e}55; }
        .ws-theme-modern_band .ws-footer { border-top-color: ${e}22; }
        .ws-theme-modern_band .ws-match-col li { border-color: ${e}22; }
        /* Band header CSS — negative margins break out of ws-content padding */
        .ws-band-top {
          background: ${e};
          padding: 8mm 18mm 6mm;
          margin: -18mm -18mm 5mm;
          position: relative;
          overflow: hidden;
        }
        .ws-band-top::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 60mm; height: 100%;
          background: white;
          opacity: 0.04;
          transform: skewX(${o?"":"-"}15deg) translateX(${o?"-":""}10mm);
        }
        .ws-band-title {
          color: white;
          font-size: ${r+12}pt;
          font-weight: 800;
          margin: 0 0 2mm;
          line-height: 1.2;
          position: relative;
        }
        .ws-band-sub {
          color: rgba(255,255,255,0.8);
          font-size: ${Math.max(9,r-1)}pt;
          font-weight: 600;
          position: relative;
        }
        .ws-band-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 3mm;
          position: relative;
        }
        .ws-band-chip {
          background: rgba(255,255,255,0.2);
          color: white;
          font-size: ${Math.max(7.5,r-3.5)}pt;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.3);
        }
        .ws-band-body { padding: 0 18mm; }
        .ws-band-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin: 0 0 4mm;
        }
        .ws-band-instr {
          margin-bottom: 4mm;
          background: ${e}08;
          border-${l}: 4px solid ${e};
          padding: 6px 10px;
          font-size: ${Math.max(9,r-1)}pt;
          border-radius: 4px;
        }
        .ws-band-instr strong { color: ${e}; margin-${l==="right"?"left":"right"}: 4px; }
        .ws-questions-band { padding: 0 18mm; }
        .ws-theme-modern_band .ws-questions { column-gap: 6mm; }
        .ws-theme-modern_band .ws-footer { padding: 5mm 18mm 0; border-top: 1px solid ${e}22; }
        .ws-theme-modern_band .ws-cont-header { margin: 0 18mm 4mm; }
      `}},exam_paper:{id:"exam_paper",nameAr:"ورقة امتحان",nameEn:"Exam Paper",description:"رسمي، جدول منظم، أسلوب امتحانات وزارية",headerLayout:"tabular",defaultColor:"#1A1A1A",swatchColors:["#1A1A1A","#888888"],css({TC:e,GOLD:s,fontSizePt:r,isAr:o,startSide:l}){return`
        .ws-theme-exam_paper.ws-page {
          background: white;
          border-radius: 0;
          border: none;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10);
        }
        .ws-theme-exam_paper .ws-content { padding: 15mm 18mm 14mm; }
        .ws-theme-exam_paper .ws-corner { display: none; }
        .ws-theme-exam_paper .ws-watermark-word { opacity: 0.016; color: ${e}; }
        /* Questions: plain numbered list — no boxes */
        .ws-theme-exam_paper .ws-q {
          border-${l}: 0;
          background: none;
          border-radius: 0;
          padding: 3mm 0 3mm;
          margin-bottom: 3mm;
          border-bottom: 1px solid #1A1A1A18;
        }
        .ws-theme-exam_paper .ws-q:last-child { border-bottom: 0; }
        /* Plain text number badge */
        .ws-theme-exam_paper .ws-q-num {
          background: none;
          color: ${e};
          border: 1.5px solid ${e};
          border-radius: 0;
          width: 22px; height: 22px;
          font-weight: 900;
          box-shadow: none;
        }
        .ws-theme-exam_paper .ws-line { border-bottom: 1px solid #1A1A1A44; height: 8mm; }
        .ws-theme-exam_paper .ws-fill-rule { border-bottom: 2px solid ${e}; }
        .ws-theme-exam_paper .ws-bubble { border-color: ${e}66; }
        .ws-theme-exam_paper .ws-footer { border-top: 2px solid ${e}22; }
        .ws-theme-exam_paper .ws-footer-cheer { color: ${e}; }
        .ws-theme-exam_paper .ws-match-col li { border-color: ${e}22; border-radius: 2px; }
        /* Exam tabular header */
        .ws-exam-header {
          border-top: 3px solid ${e};
          padding: 3mm 0 4mm;
          border-bottom: 1px solid ${e}33;
          margin-bottom: 5mm;
        }
        .ws-exam-toprow {
          display: grid;
          grid-template-columns: 1fr 1.8fr 1fr;
          align-items: center;
          gap: 3mm;
          margin-bottom: 3mm;
        }
        .ws-exam-school {
          font-size: ${Math.max(8,r-2.5)}pt;
          font-weight: 700;
          color: ${e};
          line-height: 1.4;
        }
        .ws-exam-title {
          font-size: ${r+9}pt;
          font-weight: 900;
          color: ${e};
          text-align: center;
          margin: 0;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .ws-exam-meta {
          text-align: ${o?"left":"right"};
          font-size: ${Math.max(8,r-2.5)}pt;
          color: ${e}99;
          font-weight: 600;
          line-height: 1.5;
        }
        .ws-exam-divider { height: 1px; background: ${e}22; margin: 2mm 0; }
        .ws-exam-fields-row {
          display: flex; gap: 6mm; align-items: center; flex-wrap: wrap;
          margin-top: 3mm;
          padding-top: 2mm;
          border-top: 1px solid ${e}22;
        }
        .ws-exam-field {
          display: flex; align-items: center; gap: 5px;
          font-size: ${Math.max(9,r-1)}pt;
          font-weight: 700;
          color: ${e};
          flex: 1;
          min-width: 50mm;
          border-bottom: 1.5px solid ${e}55;
          padding-bottom: 3mm;
        }
        .ws-exam-field-rule { flex: 1; }
        .ws-theme-exam_paper .ws-cont-header { border-bottom-color: ${e}44; }
      `}},kids_play:{id:"kids_play",nameAr:"مرح الأطفال",nameEn:"Kids Play",description:"ألوان زاهية، حروف كبيرة، مرح وودود للمراحل الأولى",headerLayout:"playful",defaultColor:"#E84393",swatchColors:["#E84393","#FFC107"],css({TC:e,GOLD:s,fontSizePt:r,isAr:o,startSide:l}){const a="#2196F3",i="#4CAF50";return`
        .ws-theme-kids_play.ws-page {
          --ws-frame: 6px; /* حد 3px أعلى + أسفل */
          background: #FFFBF0;
          border: 3px dashed ${e};
          border-radius: 16px;
          box-shadow: 0 4px 20px ${e}22;
        }
        .ws-theme-kids_play .ws-content { padding: 14mm 16mm 14mm; }
        .ws-theme-kids_play .ws-corner { display: none; }
        .ws-theme-kids_play .ws-watermark-word { opacity: 0.022; color: ${s}; }
        /* Large rounded question cards */
        .ws-theme-kids_play .ws-q {
          border-${l}: 0;
          border-radius: 12px;
          border: 2.5px solid ${e}33;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
          box-shadow: 0 2px 6px ${e}14;
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+1) { border-color: ${e}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) { border-color: ${a}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) { border-color: ${i}44; }
        /* Very large circle number badges */
        .ws-theme-kids_play .ws-q-num {
          width: 32px; height: 32px;
          border-radius: 50%;
          box-shadow: none;
          font-size: ${Math.max(12,r+1)}pt;
          background: ${e};
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) .ws-q-num { background: ${a}; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) .ws-q-num { background: ${i}; }
        /* Large text throughout */
        .ws-theme-kids_play .ws-q-prompt {
          font-size: ${r+1.5}pt;
          line-height: 2;
          font-weight: 700;
        }
        .ws-theme-kids_play .ws-line { height: 10mm; border-bottom: 2px dotted ${e}44; }
        .ws-theme-kids_play .ws-fill-rule { border-bottom: 3px dashed ${e}; }
        .ws-theme-kids_play .ws-bubble { width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${e}88; }
        .ws-theme-kids_play .ws-footer { border-top: 2px dashed ${e}44; }
        .ws-theme-kids_play .ws-footer-cheer { color: ${e}; font-size: ${r+2}pt; }
        .ws-theme-kids_play .ws-match-col li { border-radius: 8px; border: 2px solid ${s}55; }
        /* Playful header CSS */
        .ws-play-header { text-align: center; margin-bottom: 6mm; }
        .ws-play-banner {
          background: linear-gradient(135deg, ${e} 0%, ${e}cc 100%);
          border-radius: 12px 12px 12px 12px;
          padding: 6mm 18mm;
          margin: -16mm -18mm 5mm;
          position: relative;
          overflow: hidden;
        }
        .ws-play-banner::before {
          content: '★   ☆   ★   ☆   ★   ☆   ★   ☆   ★';
          position: absolute;
          top: 2mm; left: 0; right: 0;
          text-align: center;
          font-size: 7pt;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.3em;
        }
        .ws-play-title {
          color: white;
          font-size: ${r+14}pt;
          font-weight: 900;
          margin: 0;
          line-height: 1.2;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          position: relative;
        }
        .ws-play-sub {
          color: rgba(255,255,255,0.85);
          font-size: ${r+1}pt;
          font-weight: 700;
          margin-top: 2mm;
          position: relative;
        }
        .ws-play-stars {
          color: ${s};
          font-size: 16pt;
          letter-spacing: 5px;
          margin-bottom: 2mm;
          position: relative;
        }
        .ws-play-chips {
          display: flex; flex-wrap: wrap; gap: 5px;
          justify-content: center; margin-top: 2mm;
          position: relative;
        }
        .ws-play-chip {
          background: rgba(255,255,255,0.25);
          color: white;
          font-size: ${Math.max(8,r-2)}pt;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 999px;
        }
        .ws-play-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin-bottom: 4mm;
        }
        .ws-play-field {
          display: flex; align-items: center; gap: 5px;
          border-bottom: 2px dashed ${e}55;
          padding-bottom: 4mm;
          font-size: ${r+.5}pt;
          font-weight: 700;
          color: ${e};
        }
        .ws-play-field-rule { flex: 1; }
        .ws-theme-kids_play .ws-cont-header { border-bottom: 2px dashed ${e}44; }
      `}},science_lab:{id:"science_lab",nameAr:"مختبر علوم",nameEn:"Science Lab",description:"ورق مربعات خفيف، شارة المادة، أسلوب مفكرة العالم",headerLayout:"clipboard",defaultColor:"#0A6B6B",swatchColors:["#0A6B6B","#4FC3F7"],css({TC:e,GOLD:s,fontSizePt:r,isAr:o,startSide:l}){return`
        .ws-theme-science_lab.ws-page {
          --ws-frame: 3px; /* حد 1.5px أعلى + أسفل */
          background: white;
          /* Graph-paper grid watermark via CSS gradients */
          background-image:
            linear-gradient(${e}09 1px, transparent 1px),
            linear-gradient(90deg, ${e}09 1px, transparent 1px);
          background-size: 6mm 6mm;
          border: 1.5px solid ${e}44;
          border-radius: 3px;
          border-${l}: 4mm solid ${e};
          box-shadow: 0 3px 14px ${e}18;
        }
        .ws-theme-science_lab .ws-content { padding: 14mm 16mm 13mm; }
        .ws-theme-science_lab .ws-corner { display: none; }
        .ws-theme-science_lab .ws-watermark-word { opacity: 0.018; }
        /* Lab-notebook question boxes */
        .ws-theme-science_lab .ws-q {
          border-${l}: 0;
          border: 1.5px solid ${e}33;
          border-radius: 3px;
          background: rgba(255,255,255,0.85);
          padding: 3mm 4mm;
          margin-bottom: 5mm;
          box-shadow: 1px 1px 0 ${e}18;
        }
        /* Hexagonal-ish number badges — just square with slight clip */
        .ws-theme-science_lab .ws-q-num {
          border-radius: 4px;
          background: ${e};
          box-shadow: none;
          width: 24px; height: 24px;
        }
        .ws-theme-science_lab .ws-line { border-bottom: 1px solid ${e}33; height: 8mm; }
        .ws-theme-science_lab .ws-fill-rule { border-bottom: 2px solid ${e}; }
        .ws-theme-science_lab .ws-bubble { border-radius: 3px; border-color: ${e}66; }
        .ws-theme-science_lab .ws-footer { border-top: 1px solid ${e}33; background: rgba(255,255,255,0.7); padding-top: 4mm; }
        .ws-theme-science_lab .ws-match-col li { border-color: ${e}33; border-radius: 2px; background: rgba(255,255,255,0.9); }
        /* Clipboard / tab header */
        .ws-clip-header { margin-bottom: 6mm; }
        .ws-clip-badges {
          display: flex; gap: 3mm; align-items: center; margin-bottom: 4mm;
          flex-wrap: wrap;
        }
        .ws-clip-badge {
          background: ${e};
          color: white;
          font-size: ${Math.max(8,r-2.5)}pt;
          font-weight: 700;
          padding: 3px 10px 3px 8px;
          border-radius: 3px 3px 0 0;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .ws-clip-badge-sec {
          background: #4FC3F7;
          color: #003344;
          font-size: ${Math.max(8,r-2.5)}pt;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 3px 3px 0 0;
        }
        .ws-clip-title-row {
          display: flex; align-items: baseline; gap: 4mm;
          border-bottom: 3px solid ${e};
          padding-bottom: 3mm;
          margin-bottom: 4mm;
        }
        .ws-clip-title {
          font-size: ${r+10}pt;
          font-weight: 900;
          color: ${e};
          margin: 0;
          line-height: 1.2;
          flex: 1;
        }
        .ws-clip-identity {
          display: flex; flex-direction: column; gap: 2mm;
          font-size: ${Math.max(8.5,r-2)}pt;
        }
        .ws-clip-id-row {
          display: flex; gap: 4px; align-items: center;
          font-weight: 600; color: ${e}cc;
        }
        .ws-clip-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin-bottom: 3mm;
        }
        .ws-theme-science_lab .ws-cont-header { border-bottom: 2px solid ${e}33; }
      `}},editorial:{id:"editorial",nameAr:"أسلوب تحريري",nameEn:"Editorial",description:"رأسية صحفية، خط سيريف، لإسلاميات والأدب والتاريخ",headerLayout:"masthead",defaultColor:"#4A1042",swatchColors:["#4A1042","#C8952A"],headingFontOverride:"'Amiri', 'Georgia', 'Times New Roman', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:o,isAr:l,startSide:a}){return`
        .ws-theme-editorial.ws-page {
          background: ${r};
          border: none;
          border-top: 4px solid ${e};
          border-bottom: 4px solid ${e};
          border-radius: 0;
          box-shadow: 0 2px 16px rgba(74,16,66,0.10);
        }
        .ws-theme-editorial .ws-content { padding: 15mm 18mm 14mm; }
        .ws-theme-editorial .ws-corner { display: none; }
        /* Questions: editorial paragraph style */
        .ws-theme-editorial .ws-q {
          border-${a}: 0;
          background: none;
          border-radius: 0;
          border-bottom: 1px solid ${e}1a;
          padding: 3mm 0 4mm;
          margin-bottom: 4mm;
        }
        .ws-theme-editorial .ws-q:last-child { border-bottom: 0; }
        /* Drop-cap style number — italic serif */
        .ws-theme-editorial .ws-q-num {
          background: none;
          color: ${e};
          border: 0;
          font-style: italic;
          font-size: ${o+5}pt;
          font-weight: 700;
          width: auto;
          height: auto;
          box-shadow: none;
          border-radius: 0;
          line-height: 1;
          min-width: 20px;
          padding: 0 3px;
        }
        .ws-theme-editorial .ws-q-prompt {
          font-size: ${o+.5}pt;
          line-height: 2;
          color: #1a1010;
        }
        .ws-theme-editorial .ws-line { border-bottom: 1px solid ${e}33; height: 9mm; }
        .ws-theme-editorial .ws-fill-rule { border-bottom: 1.5px solid ${e}; }
        .ws-theme-editorial .ws-bubble { border-color: ${e}55; }
        .ws-theme-editorial .ws-footer { border-top: 1px solid ${e}33; }
        .ws-theme-editorial .ws-footer-cheer { color: ${e}; font-style: italic; }
        .ws-theme-editorial .ws-match-col li { border-color: ${e}22; background: ${r}; }
        /* Masthead header */
        .ws-mast-header { text-align: center; margin-bottom: 6mm; }
        .ws-mast-rule-thick {
          height: 4px; background: ${e};
          margin-bottom: 1.5mm;
        }
        .ws-mast-rule-mid {
          height: 1.5px; background: ${e};
          margin-bottom: 3mm;
        }
        .ws-mast-title {
          font-size: ${o+13}pt;
          font-weight: 700;
          color: ${e};
          margin: 0 0 2mm;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
        .ws-mast-meta {
          font-size: ${Math.max(9,o-1)}pt;
          color: ${e}99;
          font-weight: 600;
          letter-spacing: 0.04em;
          margin-bottom: 3mm;
        }
        .ws-mast-rule-thin {
          height: 1px; background: ${e}44;
          margin: 3mm 0;
        }
        .ws-mast-identity {
          display: flex; justify-content: center; flex-wrap: wrap; gap: 6mm;
          font-size: ${Math.max(8.5,o-2)}pt;
          color: ${e}cc;
          font-weight: 600;
        }
        .ws-mast-fields {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 5mm;
          margin-top: 4mm;
        }
        .ws-theme-editorial .ws-cont-header { border-bottom: 1px solid ${e}44; }
      `}}},Wt="ws_last_theme";function tn(){try{return localStorage.getItem(Wt)??null}catch{return null}}function sn(e){try{localStorage.setItem(Wt,e)}catch{}}function rn(e,s,r,o,l){const a=(e??"").trim().toLowerCase(),i=(s??"").trim().toLowerCase();if(/روض|kg|kind|التمهيد|kinder|grade 1\b|1st grade|first grade|الأول الابتدائي|الصف الأول/.test(i))return"kids_play";const m=[[/رياض|math|حساب|جبر|هندس|algebra|geometry|trigon|calculus|statistics/,"geometric"],[/فيزياء|physics/,"science_lab"],[/علوم|science|biology|chemistry|أحياء|كيمياء|بيولوجيا|biolog|chem|lab/,"science_lab"],[/اللغة العربية|عرب|arabic lang|لغة عرب|نحو|إملاء|صرف|بلاغ/,"arabic_ink"],[/إسلام|دين|قرآن|تلاوة|فقه|حديث|سيرة|Islamic|religion|quran|fiqh|hadith|seerah/,"editorial"],[/english|اللغة الإنجليزية|لغة إنجليزية|grammar|vocabulary|reading/,"modern_band"],[/تاريخ|جغرافيا|اجتماع|وطني|history|geography|social stud|civics/,"editorial"],[/أدب|literature|poetry|قصة|رواية|شعر|نثر/,"editorial"],[/تقنية|حاسوب|حاسب|technology|computer|ict/,"modern_band"]];for(const[g,j]of m)if(g.test(a))return j===l?{geometric:"science_lab",science_lab:"geometric",arabic_ink:"editorial",editorial:"arabic_ink",modern_band:"exam_paper",exam_paper:"modern_band",kids_play:"modern_band"}[j]:j;if(/ثانو|secondary|high school|grade 1[0-2]|10th|11th|12th|عاشر|الحادي عشر|الثاني عشر/.test(i)){const j=["exam_paper","editorial","modern_band"].filter(F=>F!==l);return j[o%j.length]}const p=["geometric","modern_band","editorial","exam_paper","science_lab"].filter(g=>g!==l);return p[o%p.length]}const Qs={geometric:"white",arabic_ink:"#FDFAF4",modern_band:"white",exam_paper:"white",kids_play:"#FFFBF0",science_lab:"white",editorial:"#FDF8F5"};function Ks({data:e,labels:s,TC:r,ar:o,hasIdentity:l,customFields:a}){const i=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),m=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-tab-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"3mm",justifyContent:o?"flex-end":"flex-start"},children:t.jsx("img",{src:Me(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsxs("div",{className:"ws-tab-toprow",children:[t.jsx("div",{className:"",style:{textAlign:o?"right":"left"},children:m.map((n,p)=>t.jsx("div",{className:"ws-tab-school",children:n},p))}),t.jsx("h1",{className:"ws-tab-title",lang:e.language,children:e.title}),t.jsx("div",{className:"ws-tab-meta",children:i&&t.jsx("div",{children:i})})]}),t.jsx("div",{className:"ws-tab-inner-rule"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsx(Vs,{data:e,labels:s,TC:r}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#555",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`4px solid ${r}`,fontSize:"90%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function Vs({data:e,labels:s,TC:r}){const o=[e.settings.includeName&&{label:s.name,flex:2},e.settings.includeClass&&{label:s.clazz,flex:1},e.settings.includeDate&&{label:s.date,flex:1}].filter(Boolean);return t.jsx("div",{style:{display:"grid",gridTemplateColumns:o.map(l=>`${l.flex}fr`).join(" "),gap:"5mm",marginTop:"3mm"},children:o.map((l,a)=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${r}55`,paddingBottom:"3mm",fontWeight:700,color:r,fontSize:"90%"},children:[l.label,t.jsx("span",{style:{flex:1}})]},a))})}function Ys({data:e,labels:s,TC:r,GOLD:o,ar:l,hasIdentity:a,customFields:i}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName&&{label:s.school,value:e.settings.schoolName},e.settings.teacherName&&{label:s.teacher,value:e.settings.teacherName},e.settings.section&&{label:s.section,value:e.settings.section},...i.map(p=>({label:p.label.trim(),value:p.value}))].filter(Boolean);return t.jsxs("div",{className:"ws-arb-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"4mm"},children:t.jsx("img",{src:Me(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsx(Ct,{GOLD:o}),m&&t.jsx("div",{className:"ws-arb-kicker",children:m}),t.jsx("h1",{className:"ws-arb-title",lang:e.language,children:e.title}),t.jsx(Ct,{GOLD:o}),n.length>0&&t.jsx("div",{className:"ws-arb-identity",children:n.map((p,g)=>t.jsxs("div",{className:"ws-arb-cell",children:[t.jsxs("span",{className:"ws-arb-cell-label",children:[p.label,":"]}),t.jsx("span",{children:p.value})]},g))}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"5mm",marginTop:"4mm"},children:[e.settings.includeName&&t.jsx(tt,{label:s.name,TC:r,GOLD:o}),e.settings.includeClass&&t.jsx(tt,{label:s.clazz,TC:r,GOLD:o}),e.settings.includeDate&&t.jsx(tt,{label:s.date,TC:r,GOLD:o})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#6a5c3a",margin:"3mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${o}12`,borderInlineStart:`4px solid ${o}`,fontSize:"90%",lineHeight:1.7,borderRadius:"4px"},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function Ct({GOLD:e}){return t.jsxs("div",{className:"ws-arb-ornament",children:[t.jsx("div",{className:"ws-arb-ornament-line"}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-diamond",style:{background:e}}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-ornament-line"})]})}function tt({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px dashed ${r}88`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function Gs({data:e,labels:s,TC:r,GOLD:o,ar:l,hasIdentity:a,customFields:i}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...i.map(p=>`${p.label}: ${p.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-band-header",children:[t.jsxs("div",{className:"ws-band-top",children:[e.settings.logoUrl&&t.jsx("div",{style:{position:"absolute",top:"4mm",[l?"left":"right"]:"16mm"},children:t.jsx("img",{src:Me(e.settings.logoUrl),alt:"",style:{height:"12mm",width:"auto",objectFit:"contain",filter:"brightness(10)"}})}),n.length>0&&t.jsx("div",{className:"ws-band-chips",children:n.map((p,g)=>t.jsx("span",{className:"ws-band-chip",children:p},g))}),t.jsx("h1",{className:"ws-band-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-band-sub",children:m})]}),t.jsxs("div",{className:"ws-band-body",children:[(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-band-fields",children:[e.settings.includeName&&t.jsx(st,{label:s.name,TC:r,flex:2}),e.settings.includeClass&&t.jsx(st,{label:s.clazz,TC:r,flex:1}),e.settings.includeDate&&t.jsx(st,{label:s.date,TC:r,flex:1})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"90%",color:"#555",margin:"0 0 3mm",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{className:"ws-band-instr",children:[t.jsxs("strong",{children:[s.instructions,":"]})," ",e.settings.instructions]})]})]})}function st({label:e,TC:s,flex:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%",flex:r},children:[e,t.jsx("span",{style:{flex:1}})]})}function Xs({data:e,labels:s,TC:r,GOLD:o,ar:l,hasIdentity:a,customFields:i}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName,e.settings.section,...i.map(p=>p.value)].filter(Boolean);return t.jsxs("div",{className:"ws-play-header",children:[t.jsxs("div",{className:"ws-play-banner",children:[t.jsx("div",{className:"ws-play-stars",children:"★ ☆ ★"}),t.jsx("h1",{className:"ws-play-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-play-sub",children:m}),n.length>0&&t.jsx("div",{className:"ws-play-chips",children:n.map((p,g)=>t.jsx("span",{className:"ws-play-chip",children:p},g))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-play-fields",children:[e.settings.includeName&&t.jsx(rt,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(rt,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(rt,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontWeight:700,color:r,margin:"2mm 0",fontSize:"105%"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{background:`${r}12`,borderRadius:"10px",padding:"6px 12px",fontSize:"95%",fontWeight:700,color:r,marginBottom:"4mm"},children:["⭐ ",e.settings.instructions]})]})}function rt({label:e,TC:s}){return t.jsxs("div",{className:"ws-play-field",children:[e,t.jsx("span",{className:"ws-play-field-rule"})]})}function Js({data:e,labels:s,TC:r,GOLD:o,ar:l,hasIdentity:a,customFields:i}){[e.subject,e.gradeLevel].filter(Boolean).join(" · ");const m=[e.settings.schoolName&&`${s.school}: ${e.settings.schoolName}`,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...i.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-clip-header",children:[t.jsxs("div",{className:"ws-clip-badges",children:[e.settings.logoUrl&&t.jsx("img",{src:Me(e.settings.logoUrl),alt:"",style:{height:"10mm",width:"auto",objectFit:"contain"}}),e.subject&&t.jsx("span",{className:"ws-clip-badge",children:e.subject}),e.gradeLevel&&t.jsx("span",{className:"ws-clip-badge-sec",children:e.gradeLevel})]}),t.jsxs("div",{className:"ws-clip-title-row",children:[t.jsx("h1",{className:"ws-clip-title",lang:e.language,children:e.title}),m.length>0&&t.jsx("div",{className:"ws-clip-identity",children:m.map((n,p)=>t.jsx("div",{className:"ws-clip-id-row",children:n},p))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-clip-fields",children:[e.settings.includeName&&t.jsx(nt,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(nt,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(nt,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"88%",color:"#4a7a7a",margin:"2mm 0 0"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"4px 9px",background:`${r}08`,border:`1.5px solid ${r}33`,borderRadius:"3px",fontSize:"88%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function nt({label:e,TC:s}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}55`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function Zs({data:e,labels:s,TC:r,GOLD:o,ar:l,hasIdentity:a,customFields:i}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...i.map(p=>`${p.label}: ${p.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-mast-header",children:[t.jsx("div",{className:"ws-mast-rule-thick"}),t.jsx("div",{className:"ws-mast-rule-mid"}),e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{margin:"2mm auto"},children:t.jsx("img",{src:Me(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsx("h1",{className:"ws-mast-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-mast-meta",children:m}),n.length>0&&t.jsx("div",{className:"ws-mast-identity",children:n.map((p,g)=>t.jsx("span",{children:p},g))}),t.jsx("div",{className:"ws-mast-rule-thin"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-mast-fields",children:[e.settings.includeName&&t.jsx(ot,{label:s.name,TC:r,GOLD:o}),e.settings.includeClass&&t.jsx(ot,{label:s.clazz,TC:r,GOLD:o}),e.settings.includeDate&&t.jsx(ot,{label:s.date,TC:r,GOLD:o})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"88%",color:"#6a4a5a",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`3px solid ${o}`,fontSize:"88%",lineHeight:1.7},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function ot({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function er(e,s){return e?pt[e]?.headingFontOverride??s:s}const it=6,tr=[{color:"#225739",label:"أخضر حصاد"},{color:"#1a3a6b",label:"أزرق رسمي"},{color:"#5C2D0E",label:"بني دافئ"},{color:"#4a1a6b",label:"أرجواني"},{color:"#1A1A2E",label:"أسود راقٍ"},{color:"#7b1a1a",label:"أحمر"}],de="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";function re({label:e,children:s,className:r}){return t.jsxs("label",{className:`block ${r??""}`,children:[t.jsx("span",{className:"block text-[11px] font-bold mb-1 text-muted-foreground",children:e}),s]})}function Pe({label:e,value:s,onChange:r,testId:o}){return t.jsx("button",{type:"button",role:"switch","aria-checked":!!s,"data-testid":o,onClick:()=>r(!s),className:`px-3 h-8 rounded-full border text-xs font-bold transition-colors ${s?"bg-primary text-primary-foreground border-primary":"bg-background text-muted-foreground hover:bg-muted"}`,children:e})}function sr({ar:e,settings:s,onSettingsChange:r,meta:o,onMetaChange:l,onClearProfile:a,showProfileNote:i,readOnly:m}){const[n,p]=w.useState("info"),g=c=>r(d=>({...d,...c})),j=s.customFields??[],F=!!(s.schoolName||s.section||s.teacherName||s.logoUrl||j.length),N=[{id:"info",label:e?"بيانات الورقة":"Details",icon:t.jsx(Ms,{className:"w-3.5 h-3.5"})},{id:"header",label:e?"الترويسة":"Header",icon:t.jsx(zs,{className:"w-3.5 h-3.5"})},{id:"design",label:e?"التصميم":"Design",icon:t.jsx(Rs,{className:"w-3.5 h-3.5"})}];return t.jsxs("fieldset",{disabled:m,className:"min-w-0 border-0 p-0 m-0","data-testid":"panel-worksheet-format",children:[t.jsx("div",{role:"tablist",className:"flex gap-1 p-1 bg-muted/50 rounded-lg mb-4 w-full sm:w-auto sm:inline-flex",children:N.map(c=>t.jsxs("button",{role:"tab",type:"button","aria-selected":n===c.id,"data-testid":`tab-format-${c.id}`,onClick:()=>p(c.id),className:`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${n===c.id?"bg-background shadow-sm text-primary":"text-muted-foreground"}`,children:[c.icon,c.label]},c.id))}),n==="info"&&t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[t.jsx(re,{label:e?"عنوان الورقة":"Title",className:"sm:col-span-3",children:t.jsx("input",{"data-testid":"input-ws-title",value:o.title,maxLength:200,onChange:c=>l({title:c.target.value}),className:de})}),t.jsx(re,{label:e?"المادة":"Subject",className:"sm:col-span-2",children:t.jsx("input",{"data-testid":"input-ws-subject",value:o.subject,maxLength:100,onChange:c=>l({subject:c.target.value}),className:de})}),t.jsx(re,{label:e?"الصف":"Grade",children:t.jsx("input",{"data-testid":"input-ws-grade",value:o.gradeLevel,maxLength:100,onChange:c=>l({gradeLevel:c.target.value}),className:de})})]}),n==="header"&&t.jsxs("div",{className:"space-y-4",children:[t.jsxs("div",{className:"flex items-center justify-between gap-2",children:[t.jsx("p",{className:"text-[11px] text-muted-foreground",children:i?e?"تُحفظ تلقائياً لكل أوراقك القادمة":"Saved automatically for future sheets":""}),a&&F&&t.jsx("button",{type:"button",onClick:a,className:"text-[11px] font-bold text-destructive hover:underline",children:e?"مسح المحفوظ":"Clear saved"})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[t.jsx(re,{label:e?"اسم المدرسة":"School name",children:t.jsx("input",{"data-testid":"input-ws-school",value:s.schoolName??"",maxLength:200,onChange:c=>g({schoolName:c.target.value}),className:de})}),t.jsx(re,{label:e?"اسم المعلم":"Teacher",children:t.jsx("input",{"data-testid":"input-ws-teacher",value:s.teacherName??"",maxLength:100,onChange:c=>g({teacherName:c.target.value}),className:de})}),t.jsx(re,{label:e?"القسم":"Department",className:"sm:col-span-2",children:t.jsx("input",{"data-testid":"input-ws-section",value:s.section??"",maxLength:100,onChange:c=>g({section:c.target.value}),className:de})})]}),t.jsxs("div",{className:"pt-2 border-t border-border/50",children:[t.jsxs("div",{className:"flex items-center justify-between mb-2",children:[t.jsx("span",{className:"text-[11px] font-bold",children:e?"حقول إضافية (اختياري)":"Extra fields"}),t.jsxs("button",{type:"button","data-testid":"button-add-custom-field",onClick:()=>{if(j.length>=it){xe.error(e?`الحد الأقصى ${it} حقول`:`Max ${it} fields`);return}g({customFields:[...j,{label:"",value:""}]})},className:"text-[11px] font-bold px-2 py-1 rounded bg-muted hover:bg-muted/80 flex items-center gap-1",children:[t.jsx(mt,{className:"w-3 h-3"})," ",e?"إضافة":"Add"]})]}),j.length===0?t.jsx("p",{className:"text-[11px] text-muted-foreground",children:e?"مثال: العام الدراسي، الدرجة، الفصل…":"e.g., Academic Year, Marks, Term…"}):t.jsx("div",{className:"space-y-2",children:j.map((c,d)=>t.jsxs("div",{className:"flex gap-2 items-center",children:[t.jsx("input",{"aria-label":e?"اسم الحقل":"Label",value:c.label,maxLength:40,placeholder:e?"اسم الحقل":"Label",onChange:y=>g({customFields:j.map((D,_)=>_===d?{...D,label:y.target.value}:D)}),className:"w-1/3 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"}),t.jsx("input",{"aria-label":e?"القيمة":"Value",value:c.value,maxLength:120,placeholder:e?"القيمة":"Value",onChange:y=>g({customFields:j.map((D,_)=>_===d?{...D,value:y.target.value}:D)}),className:"flex-1 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"}),t.jsx("button",{type:"button","aria-label":e?"حذف الحقل":"Remove field",onClick:()=>g({customFields:j.filter((y,D)=>D!==d)}),className:"p-1 rounded text-destructive hover:bg-destructive/10",children:t.jsx(ms,{className:"w-4 h-4"})})]},d))})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[t.jsx(re,{label:e?"ملاحظة الترويسة":"Header note",children:t.jsx("input",{"data-testid":"input-ws-header-note",value:s.headerNote??"",maxLength:300,onChange:c=>g({headerNote:c.target.value}),className:de})}),t.jsx(re,{label:e?"ملاحظة التذييل":"Footer note",children:t.jsx("input",{"data-testid":"input-ws-footer-note",value:s.footerNote??"",maxLength:300,onChange:c=>g({footerNote:c.target.value}),className:de})})]}),t.jsx(re,{label:e?"تعليمات الطالب":"Instructions",children:t.jsx("textarea",{"data-testid":"input-ws-instructions",rows:2,value:s.instructions??"",onChange:c=>g({instructions:c.target.value}),className:"w-full p-2 rounded-lg border bg-background text-sm outline-none focus:border-primary"})}),t.jsx(re,{label:e?"جملة الختام":"Closing line",children:t.jsx("input",{"data-testid":"input-ws-goodluck",value:s.goodLuck??"",maxLength:200,placeholder:e?"نتمنى لك التوفيق (الافتراضي)":"Good luck! (default)",onChange:c=>g({goodLuck:c.target.value}),className:de})}),t.jsxs("div",{className:"flex flex-wrap gap-2 pt-2 border-t border-border/50",children:[t.jsx(Pe,{testId:"toggle-ws-name",label:e?"الاسم":"Name",value:s.includeName,onChange:c=>g({includeName:c})}),t.jsx(Pe,{testId:"toggle-ws-date",label:e?"التاريخ":"Date",value:s.includeDate,onChange:c=>g({includeDate:c})}),t.jsx(Pe,{testId:"toggle-ws-class",label:e?"الصف":"Class",value:s.includeClass,onChange:c=>g({includeClass:c})}),t.jsx(Pe,{testId:"toggle-ws-answers",label:e?"ورقة الإجابات":"Answer key",value:s.includeAnswerKey,onChange:c=>g({includeAnswerKey:c})}),t.jsx(Pe,{testId:"toggle-ws-watermark",label:e?"علامة مائية":"Watermark",value:s.showWatermark,onChange:c=>g({showWatermark:c})})]})]}),n==="design"&&t.jsxs("div",{className:"space-y-5",children:[t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-2 text-muted-foreground",children:e?"القالب المرئي":"Visual template"}),t.jsxs("div",{className:"grid grid-cols-4 sm:grid-cols-7 gap-2",children:[t.jsx("button",{type:"button","aria-pressed":!s.template,"data-testid":"theme-classic",onClick:()=>g({template:void 0}),className:`p-1.5 rounded-lg border-2 ${s.template?"border-transparent hover:bg-muted":"border-primary bg-primary/5"}`,children:t.jsx("div",{className:"h-8 rounded flex items-center justify-center border border-dashed border-primary/40 bg-background text-[9px] font-bold text-primary",children:e?"كلاسيك":"Classic"})}),Object.values(pt).map(c=>{const d=s.template===c.id,[y]=c.swatchColors;return t.jsxs("button",{type:"button","aria-pressed":d,"data-testid":`theme-${c.id}`,title:e?`${c.nameAr}: ${c.description}`:c.nameEn,onClick:()=>g({template:d?void 0:c.id}),className:"p-1.5 rounded-lg border-2 transition-colors",style:{borderColor:d?y:"transparent",background:d?`${y}10`:void 0},children:[t.jsxs("div",{className:"h-8 rounded overflow-hidden shadow-sm",style:{background:y},children:[t.jsx("div",{className:"h-[40%]",style:{background:y}}),t.jsx("div",{className:"h-[60%] bg-white",children:t.jsx("div",{className:"mx-1 mt-0.5 h-px",style:{background:`${y}44`}})})]}),t.jsx("span",{className:"block mt-1 text-[9px] font-bold truncate",children:e?c.nameAr:c.nameEn})]},c.id)})]})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[t.jsx(re,{label:e?"الأعمدة":"Columns",children:t.jsx("div",{className:"flex gap-1",role:"group",children:[1,2].map(c=>t.jsx("button",{type:"button","aria-pressed":s.columns===c,"data-testid":`columns-${c}`,onClick:()=>g({columns:c}),className:`flex-1 h-9 rounded-lg border text-sm font-bold ${s.columns===c?"bg-primary text-primary-foreground border-primary":"bg-background"}`,children:c},c))})}),t.jsx(re,{label:e?"نوع الخط":"Font",children:t.jsxs("select",{"data-testid":"select-ws-font",value:s.fontFamily,onChange:c=>g({fontFamily:c.target.value}),className:de,children:[t.jsx("option",{value:"default",children:e?"افتراضي":"Default"}),t.jsx("option",{value:"cairo",children:"Cairo"}),t.jsx("option",{value:"tajawal",children:"Tajawal"}),t.jsx("option",{value:"amiri",children:"Amiri"}),t.jsx("option",{value:"noto-naskh",children:"Noto Naskh"}),t.jsx("option",{value:"inter",children:"Inter"}),t.jsx("option",{value:"georgia",children:"Georgia"})]})}),t.jsx(re,{label:e?`حجم الخط (${s.fontSizePt}pt)`:`Font size (${s.fontSizePt}pt)`,children:t.jsx("input",{"data-testid":"range-ws-fontsize",type:"range",min:9,max:18,step:1,value:s.fontSizePt,onChange:c=>g({fontSizePt:parseInt(c.target.value,10)}),className:"w-full mt-2"})})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-1.5 text-muted-foreground",children:e?"لون الورقة":"Accent color"}),t.jsxs("div",{className:"flex flex-wrap gap-2 items-center",children:[tr.map(c=>t.jsx("button",{type:"button",title:c.label,"aria-label":c.label,"aria-pressed":s.themeColor===c.color,onClick:()=>g({themeColor:s.themeColor===c.color?void 0:c.color}),className:"w-6 h-6 rounded-full border-2",style:{background:c.color,borderColor:s.themeColor===c.color?"#fff":"transparent",boxShadow:s.themeColor===c.color?`0 0 0 2px ${c.color}`:"none"}},c.color)),t.jsxs("label",{className:"w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer bg-background",title:e?"لون مخصص":"Custom",children:[t.jsx("input",{type:"color",className:"sr-only","aria-label":e?"لون مخصص":"Custom color",value:s.themeColor??"#225739",onChange:c=>g({themeColor:c.target.value})}),t.jsx(mt,{className:"w-3 h-3 text-muted-foreground"})]}),s.themeColor&&t.jsx("button",{type:"button",onClick:()=>g({themeColor:void 0}),className:"text-[11px] text-muted-foreground hover:underline",children:e?"افتراضي":"Reset"})]})]}),t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-1.5 text-muted-foreground",children:e?"الشعار (اختياري)":"Logo"}),s.logoUrl?t.jsxs("div",{className:"flex items-center gap-3",children:[t.jsx("img",{src:s.logoUrl,alt:e?"الشعار":"Logo",className:"h-8 w-auto rounded border object-contain bg-white"}),t.jsx("button",{type:"button",onClick:()=>g({logoUrl:void 0}),className:"text-[11px] text-destructive hover:underline",children:e?"إزالة":"Remove"})]}):t.jsxs("label",{className:"flex items-center justify-center gap-2 cursor-pointer h-8 rounded-lg border border-dashed border-border bg-background hover:bg-muted text-xs text-muted-foreground",children:[t.jsx(Es,{className:"w-3.5 h-3.5"}),t.jsx("span",{children:e?"رفع صورة (PNG/JPG)":"Upload (PNG/JPG)"}),t.jsx("input",{type:"file",accept:"image/png,image/jpeg,image/webp",className:"sr-only","data-testid":"input-ws-logo",onChange:c=>{const d=c.target.files?.[0];if(c.target.value="",!d)return;if(d.size>500*1024){xe.error(e?"الحجم يجب أن يكون أقل من 500KB":"Under 500KB");return}const y=new FileReader;y.onload=D=>g({logoUrl:D.target?.result}),y.readAsDataURL(d)}})]})]})]})]})]})}const rr=["display","position","top","right","bottom","left","box-sizing","width","height","min-width","min-height","max-width","max-height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","border-top","border-right","border-bottom","border-left","border-radius","background-color","background-image","background-size","background-position","background-repeat","background-clip","color","opacity","visibility","font-family","font-size","font-weight","font-style","font-variant","line-height","letter-spacing","word-spacing","text-align","text-indent","text-decoration","text-transform","text-shadow","white-space","word-break","overflow-wrap","direction","unicode-bidi","vertical-align","writing-mode","transform","transform-origin","z-index","overflow-x","overflow-y","clip-path","box-shadow","filter","mix-blend-mode","flex-direction","flex-wrap","flex-grow","flex-shrink","flex-basis","align-items","align-self","align-content","justify-content","order","gap","grid-template-columns","grid-template-rows","grid-column","grid-row","column-count","column-width","column-gap","column-fill","column-rule","list-style-type","list-style-position","object-fit","object-position","fill","fill-opacity","stroke","stroke-width","stroke-linecap","stroke-linejoin"];function Lt(e){return rr.map(s=>{const r=e.getPropertyValue(s);return r?`${s}:${r};`:""}).join("")}function nr(e){const s=e.cloneNode(!0),r=[];let o=0;const l=(a,i)=>{if(a.matches(".no-print, script, iframe, object, embed, link")){i.remove();return}const m=`ws-export-${o++}`;i.setAttribute("data-ws-export-node",m),i.setAttribute("style",Lt(getComputedStyle(a))),i.removeAttribute("contenteditable"),i.removeAttribute("autofocus"),Array.from(i.attributes).forEach(p=>{/^on/i.test(p.name)&&i.removeAttribute(p.name)});for(const p of["::before","::after"]){const g=getComputedStyle(a,p),j=g.getPropertyValue("content");j&&j!=="none"&&j!=="normal"&&r.push(`[data-ws-export-node="${m}"]${p}{${Lt(g)}content:${j};}`)}i instanceof HTMLElement&&(a.matches(".ws-editable")&&(i.style.backgroundColor="transparent",i.style.boxShadow="none",i.style.outline="none"),a.matches(".ws-q-selected")&&(i.style.backgroundColor="transparent",i.style.outline="none"));const n=Array.from(i.children);Array.from(a.children).forEach((p,g)=>l(p,n[g]))};if(l(e,s),s.style.setProperty("zoom","1"),s.style.margin="0",s.style.boxShadow="none",s.style.width=`${e.offsetWidth||210/25.4*96}px`,s.style.height="auto",r.length){const a=document.createElement("style");a.textContent=r.join(`
`),s.appendChild(a)}return s}const Ht="[data-worksheet-page], [data-answer-key-page]",It=11906,Et=16838;class J extends Error{constructor(s){super(`Visual Word export failed: ${s}`),this.code=s}}function or(e,s,r="ar"){if(!e.length)throw new J("pages");return new ws({creator:"Hasad",title:s,description:r==="ar"?"نسخة مطابقة بصريًا؛ صفحات مصورة غير قابلة لتحرير النص":"Visual copy; page images, not editable text",sections:e.map((o,l)=>{const a=Math.min(It/15/o.width,Et/15/o.height);return{properties:{type:fs.NEXT_PAGE,page:{size:{width:It,height:Et},margin:{top:0,bottom:0,left:0,right:0,header:0,footer:0}}},children:[new bs({spacing:{before:0,after:0,line:20},children:[new ys({type:"png",data:o.data,transformation:{width:o.width*a,height:o.height*a},altText:{name:`Worksheet page ${l+1}`,title:`${s} — ${l+1}`,description:r==="ar"?"صفحة مصورة للحفاظ على التصميم":"Page image preserving the design"},floating:{horizontalPosition:{relative:Ns.PAGE,align:$s.CENTER},verticalPosition:{relative:vs.PAGE,align:ks.TOP},wrap:{type:js.NONE},allowOverlap:!0,behindDocument:!1}})]})]}})})}function ir(e){return new Promise((s,r)=>{const o=new FileReader;o.onload=()=>s(String(o.result)),o.onerror=()=>r(new J("image")),o.readAsDataURL(e)})}async function ar(e,s){const r=Array.from(e.querySelectorAll("img")).filter(a=>!a.closest(".no-print")),o=Array.from(s.querySelectorAll("img")),l=new Map;await Promise.all(r.map(async(a,i)=>{const m=a.currentSrc||a.src;if(!m||!o[i])throw new J("image");l.has(m)||l.set(m,(async()=>{try{const p=await fetch(m,{credentials:"same-origin",signal:AbortSignal.timeout(2e4)});if(!p.ok)throw new J("image");return await ir(await p.blob())}catch{throw new J("image")}})());const n=o[i];n.removeAttribute("srcset"),n.removeAttribute("crossorigin"),n.loading="eager",n.src=await l.get(m),typeof n.decode=="function"&&await n.decode().catch(()=>{throw new J("image")})}))}async function lr(e){if("fonts"in document){let o;try{await Promise.race([document.fonts.ready.catch(()=>{}),new Promise(l=>{o=setTimeout(l,8e3)})])}finally{clearTimeout(o)}}let s="",r=0;for(let o=0;o<20&&r<3;o+=1){await new Promise(a=>requestAnimationFrame(()=>a()));const l=Array.from(e.querySelectorAll(Ht)).map(a=>`${a.scrollHeight}:${a.textContent?.length}`).join("|");r=l===s?r+1:0,s=l}}async function cr(e){await Promise.all(Array.from(e.querySelectorAll("img")).filter(s=>!s.closest(".no-print")).map(s=>new Promise((r,o)=>{const l=s.getAttribute("loading"),a=p=>{clearTimeout(n),s.removeEventListener("load",i),s.removeEventListener("error",m),l===null?s.removeAttribute("loading"):s.setAttribute("loading",l),p?o(new J("image")):r()},i=()=>a(!1),m=()=>a(!0),n=setTimeout(m,2e4);s.addEventListener("load",i,{once:!0}),s.addEventListener("error",m,{once:!0}),s.loading="eager",s.complete&&a(s.naturalWidth===0)})))}async function dr(e,s,r){if(!Number.isSafeInteger(s)||s<=0)throw new J("pages");await cr(e),await lr(e);try{const o=Array.from(e.querySelectorAll(Ht));if(!o.length)throw new J("pages");const l=o.map(nr);await Promise.all(o.map((i,m)=>ar(i,l[m])));const a=[];for(const[i,m]of l.entries()){const n=o[i].offsetWidth||793.7007874015749,p=o[i].offsetHeight||297/25.4*96,g=await fetch(`/api/worksheets/${s}/render-page`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(9e4),body:JSON.stringify({html:m.outerHTML,width:n,height:p})});if(g.status===429)throw new J("busy");if(!g.ok||!g.headers.get("content-type")?.includes("image/png"))throw new J("capture");a.push({data:new Uint8Array(await g.arrayBuffer()),width:n,height:p}),r?.(i+1,l.length)}return a}catch(o){throw o instanceof J?o:new J("capture")}}async function mr(e){const s=await dr(e.element,e.worksheetId,e.onProgress),r=await xs.toBlob(or(s,e.title,e.lang)),o=e.title.replace(/[\\/:*?"<>|\x00-\x1f]+/g,"-").trim().slice(0,80)||"worksheet",l=URL.createObjectURL(r),a=document.createElement("a");a.href=l,a.download=`${o} - ${e.lang==="en"?"Visual design":"مطابق للتصميم"}.docx`,document.body.appendChild(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(l),1500)}const qt=210/25.4*96;function pr(e,s=qt){return e<=0||s<=0?1:Math.min(1,e/s)}function hr(){const e=w.useRef(null);return w.useLayoutEffect(()=>{const s=e.current;if(!s)return;const r=()=>{const l=getComputedStyle(s),a=s.clientWidth-(parseFloat(l.paddingLeft)||0)-(parseFloat(l.paddingRight)||0),i=s.querySelector(":scope > .ws-page"),m=pr(a,i?.offsetWidth||qt),n=String(m);s.style.getPropertyValue("--ws-preview-scale")!==n&&s.style.setProperty("--ws-preview-scale",n)};r();const o=typeof ResizeObserver=="function"?new ResizeObserver(r):null;return o?.observe(s),window.addEventListener("resize",r),()=>{o?.disconnect(),window.removeEventListener("resize",r)}},[]),e}const at="#225739";function gr({layout:e}){return e?.elements?.length?t.jsx(t.Fragment,{children:e.elements.map(s=>{const r={position:"absolute",left:`${s.x}%`,top:`${s.y}%`,width:`${s.width}%`,height:s.kind==="line"?`${s.strokeWidth??2}px`:`${s.height}%`,pointerEvents:"none",boxSizing:"border-box",zIndex:2,opacity:s.opacity??1};return s.kind==="text"?t.jsx("div",{style:{...r,fontSize:`${s.fontSize??14}pt`,fontWeight:s.bold?800:400,fontStyle:s.italic?"italic":"normal",color:s.fontColor??"#1a2421",textAlign:s.align??"right",padding:"2px 4px",whiteSpace:"pre-wrap",wordBreak:"break-word",overflow:"hidden"},children:s.text??""},s.id):s.kind==="rect"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??at}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:`${s.borderRadius??2}px`,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="circle"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??at}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:"50%",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="line"?t.jsx("div",{style:{...r,background:s.strokeColor??at,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):null})}):null}const Mt="",ee="#225739",I="#D9A521";function ur(e,s){const r="'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif",o="'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";switch(e){case"cairo":return`'Cairo', ${r}`;case"tajawal":return`'Tajawal', ${r}`;case"amiri":return`'Amiri', 'Scheherazade New', ${r}`;case"noto-naskh":return`'Noto Naskh Arabic', ${r}`;case"inter":return`'Inter', ${o}`;case"georgia":return"Georgia, 'Times New Roman', serif";default:return s==="ar"?r:o}}function xr(e){return e==="ar"?"'Cairo', 'Noto Naskh Arabic', 'Tajawal', sans-serif":"'Inter', 'Source Sans Pro', sans-serif"}function zt(e,s,r,o,l,a){if(e.length===0)return[[]];const i=s*.352778*1.85,m=r===2?22:44,n=5,p=c=>{const y=10+Math.max(1,Math.ceil((c.prompt?.length??0)/m))*i;switch(c.type){case"mcq":return y+c.options.filter(Boolean).length*i*1.3;case"true_false":return y+i*1.1;case"short_answer":return y+(c.lines??2)*9;case"fill_blank":return y+3;case"matching":return y+c.pairs.length*i*1.3;case"tic_tac_toe":return Math.max(185,y+165);case"worked_problem":return y+Math.max(4,c.steps??4)*8+12;case"extended_response":return y+Math.max(3,c.lines??6)*8;case"error_correction":return y+16+16+12;case"word_bank":return y+18;case"compare":return y+42}},g=[];let j=[],F=0,N=o;if(r===2)for(let c=0;c<e.length;c+=2){const d=a?.has(e[c].id)||c+1<e.length&&a?.has(e[c+1].id),y=Math.max(p(e[c]),c+1<e.length?p(e[c+1]):0)+n;j.length>0&&(d||F+y>N)&&(g.push(j),j=[],F=0,N=l),j.push(e[c]),c+1<e.length&&j.push(e[c+1]),F+=y}else for(const c of e){const d=a?.has(c.id),y=p(c)+n;j.length>0&&(d||F+y>N)&&(g.push(j),j=[],F=0,N=l),j.push(c),F+=y}return j.length>0&&g.push(j),g.length>0?g:[e]}function wr({theme:e,TC:s,GOLD:r,BG:o,fontFamily:l,headingFont:a,fontSizePt:i,lang:m}){const n=m==="ar",p=n?"right":"left",g=n?"left":"right";return t.jsx("style",{children:e.css({TC:s,GOLD:r,BG:o,fontFamily:l,headingFont:a,fontSizePt:i,isAr:n,startSide:p,endSide:g})})}function br({theme:e,data:s,labels:r,TC:o,GOLD:l,ar:a,hasIdentity:i,customFields:m,classicFallback:n}){if(!e)return n;const p={data:s,labels:r,TC:o,GOLD:l,ar:a,hasIdentity:i,customFields:m,IdentityCell:()=>null,FieldLine:()=>null,DoubleDivider:()=>null,IconUser:()=>null,IconClass:()=>null,IconDate:()=>null,IconLightbulb:()=>null,IconSchool:()=>null,IconSection:()=>null,IconTeacher:()=>null,IconField:()=>null};switch(e.headerLayout){case"tabular":return t.jsx(Ks,{...p});case"arabesque":return t.jsx(Ys,{...p});case"band":return t.jsx(Gs,{...p});case"playful":return t.jsx(Xs,{...p});case"clipboard":return t.jsx(Js,{...p});case"masthead":return t.jsx(Zs,{...p});default:return n}}const Ft=[];function Ot({data:e,onLayoutChange:s,onDraftChange:r,flushRef:o,onRequestSave:l,onRequestDiscard:a}){const i=e.language==="ar",m=i?"rtl":"ltr",n=ur(e.settings.fontFamily,e.language),p=xr(e.language),g=e.settings.template,j=g?pt[g]:void 0,F=g?Qs[g]??"white":"white",N=er(g,p),c=Math.min(18,Math.max(9,e.settings.fontSizePt??12)),d=e.settings.showWatermark!==!1,y=e.settings.themeColor??j?.defaultColor??ee,D=Me(e.settings.logoUrl),[_,Z]=w.useState(e.questions),x=w.useRef(e.questions),[f,C]=w.useState(()=>new Set(e.settings.pageBreaks??[])),W=w.useRef(f),M=w.useCallback(h=>{const b=typeof h=="function"?h(W.current):h;W.current=b,C(b)},[]),G=w.useRef(r);G.current=r;const we=w.useCallback(()=>({questions:x.current,pageBreaks:[...W.current],questionStyles:K.current}),[]),O=w.useCallback(()=>{G.current?.(we())},[we]);o&&(o.current=()=>{const h=document.activeElement;return h&&h!==document.body&&h.closest("#ws-printable-root")&&h.blur(),we()});const[pe,ve]=w.useState(()=>e.settings.questionStyles??[]),K=w.useRef(e.settings.questionStyles??[]),[S,ne]=w.useState(null),ie=w.useMemo(()=>{const h=new Set;let b=null;for(const v of _)v.type!==b&&(h.add(v.id),b=v.type);return h},[_]),[be,$e]=w.useState(!1),[fe,H]=w.useState(!1),[V,ze]=w.useState(!1),[ye,We]=w.useState(null),[ht,Ve]=w.useState(null),Ne=w.useRef(e.questions),Fe=w.useRef(e.settings.questionStyles??Ft),u=w.useRef((e.settings.pageBreaks??[]).join(","));w.useEffect(()=>{const h=e.settings.questionStyles??Ft,b=(e.settings.pageBreaks??[]).join(",");let v=!1;Ne.current!==e.questions&&(Ne.current=e.questions,e.questions!==x.current&&(x.current=e.questions,Z(e.questions),v=!0)),Fe.current!==h&&(Fe.current=h,h!==K.current&&(K.current=h,ve(h),v=!0)),u.current!==b&&(u.current=b,[...W.current].join(",")!==b&&(M(new Set(e.settings.pageBreaks??[])),v=!0)),v&&(ne(null),H(!1))},[e,M]),w.useCallback(h=>{M(b=>{const v=new Set(b);return v.add(h),v}),H(!0),O()},[O,M]),w.useCallback(h=>{M(b=>{const v=new Set(b);return v.delete(h),v}),H(!0),O()},[O,M]);const k=w.useCallback(()=>{if(l){l();return}s?.(x.current,[...W.current],K.current),H(!1)},[s,l]),q=w.useCallback(()=>{if(a){a(),ne(null),H(!1),ze(!1);return}x.current=e.questions,Z(e.questions),M(new Set(e.settings.pageBreaks??[]));const h=e.settings.questionStyles??[];K.current=h,ve(h),ne(null),H(!1),ze(!1)},[e,a]),U=w.useCallback(h=>{const b=x.current.map(v=>v.id===h.id?h:v);x.current=b,Z(b),M(new Set),H(!0),O()},[O,M]),L=w.useCallback((h,b)=>{const v=K.current,A=v.find(R=>R.questionId===h)??{questionId:h},z=b(A),$=[...v.filter(R=>R.questionId!==h),z];K.current=$,ve($),M(new Set),H(!0),O()},[O,M]),X=w.useCallback((h,b,v)=>{L(h,A=>{const z=A.fields??[],$=z.find(R=>R.key===b)??{key:b};return{...A,fields:[...z.filter(R=>R.key!==b),{...$,...v}]}})},[L]),ge=w.useCallback(()=>{S&&L(S.questionId,h=>({...h,fields:(h.fields??[]).filter(b=>b.key!==S.key)}))},[S,L]);w.useCallback(h=>{if(!ye)return;Ve(null),We(null);const b=x.current,A=zt(b,c,e.settings.columns,190,250,f)[h];if(!A||A.length===0)return;const z=A[0].id;if(z===ye)return;const $=b.find(B=>B.id===ye);if(!$)return;const R=b.filter(B=>B.id!==ye),T=R.findIndex(B=>B.id===z),Q=T===-1?[...R,$]:[...R.slice(0,T),$,...R.slice(T)];x.current=Q,Z(Q),H(!0),O()},[ye,c,e.settings.columns,f,O]);const E=i?{name:"الاسم",date:"التاريخ",clazz:"الصف",section:"القسم",school:"المدرسة",teacher:"المعلم",instructions:"تعليمات",answerKey:"صفحة الإجابات",question:"س",true:"صح",false:"خطأ",correct:"الإجابة:",goodLuck:"نتمنى لك التوفيق ✦"}:{name:"Name",date:"Date",clazz:"Class",section:"Section",school:"School",teacher:"Teacher",instructions:"Instructions",answerKey:"Answer Key",question:"Q",true:"True",false:"False",correct:"Answer:",goodLuck:"✦ Good luck!"},Ye=(e.settings.customFields??[]).filter(h=>(h?.label?.trim()??"")||(h?.value?.trim()??"")),Xt=!!e.settings.schoolName||!!e.settings.section||!!e.settings.teacherName||!!D||Ye.length>0,Re=e.settings.columns,[_e,gt]=w.useState(()=>zt(e.questions,c,Re,190,250)),Ae=Yt(_,i,E),[ut,Ge]=w.useState(()=>[Ae]),xt=w.useRef(null),Jt=hr(),wt=w.useRef("");w.useLayoutEffect(()=>{const h=[JSON.stringify(_),Re,c,e.settings.schoolName??"",e.settings.section??"",e.settings.teacherName??"",D?"logo":"",e.settings.includeName?"n":"",e.settings.includeDate?"d":"",e.settings.includeClass?"c":"",e.settings.instructions??"",g??"",[...f].sort().join(","),JSON.stringify(pe)].join("|");if(h===wt.current)return;const b=xt.current;if(!b)return;const v=Array.from(b.querySelectorAll("[data-q-measure]"));if(v.length!==_.length)return;const A=b.querySelector("[data-header-measure]"),z=b.querySelector("[data-continuation-measure]"),$=b.querySelector("[data-footer-measure]"),R=Array.from(b.querySelectorAll("[data-answer-measure]")),T=b.querySelector("[data-answer-header-measure]"),Q=b.querySelector("[data-answer-continuation-measure]");wt.current=h;const B=3.7795,He=263*B,rs=A?A.offsetHeight:60*B,ns=z?z.offsetHeight:12*B,qe=$?$.offsetHeight:18*B,os=12*B,is=8*B,as=Math.max(He-rs-qe-os,80*B),jt=Math.max(He-qe-ns-is,150*B),kt=4*B,Je=v.map(P=>P.offsetHeight+kt),Be=[];let oe=[],Se=0,Oe=as;if(Re===2)for(let P=0;P<_.length;P+=2){const je=Math.max(Je[P]??0,Je[P+1]??0),Ze=f.has(_[P].id)||P+1<_.length&&f.has(_[P+1].id);oe.length>0&&(Ze||Se+je>Oe)&&(Be.push(oe),oe=[],Se=0,Oe=jt),oe.push(_[P]),P+1<_.length&&oe.push(_[P+1]),Se+=je}else for(let P=0;P<_.length;P++){const je=Je[P];oe.length>0&&(f.has(_[P].id)||Se+je>Oe)&&(Be.push(oe),oe=[],Se=0,Oe=jt),oe.push(_[P]),Se+=je}if(oe.length>0&&Be.push(oe),Be.length>0&&gt(Be),R.length===Ae.length&&Ae.length>0){const P=T?T.offsetHeight:38*B,je=Q?Q.offsetHeight:12*B,Ze=4*B,ls=3*B,cs=Math.max(He-P-qe-Ze,80*B),vt=Math.max(He-je-qe-ls,150*B),Ue=[];let ae=[],De=0,Te=cs;const $t=(ue,te,ke)=>{const Y=ue.cloneNode(!0),le=Y.querySelector(".ws-answer-line"),ce=Y.querySelector(".ws-q-prompt");le&&(le.textContent=`${ke?i?"تابع الإجابة:":"Answer continued:":E.correct} ${te}`),ke&&ce&&ce.append(` (${i?"تابع":"continued"})`),b.appendChild(Y);const se=Y.offsetHeight+kt;return Y.remove(),se},ds=(ue,te,ke,Y)=>{let le=1,ce=te.length,se=0;for(;le<=ce;){const Le=Math.floor((le+ce)/2);$t(ue,te.slice(0,Le),ke)<=Y?(se=Le,le=Le+1):ce=Le-1}if(se<=0)return 0;const Ce=Math.max(te.lastIndexOf(" ",se),te.lastIndexOf(`
`,se),te.lastIndexOf("	",se));let he=Ce>=Math.floor(se*.6)?Ce:se;return he>0&&/[\uD800-\uDBFF]/.test(te[he-1]??"")&&(he-=1),Math.max(1,he)};for(let ue=0;ue<Ae.length;ue++){const te=Ae[ue],ke=R[ue];let Y=te.text,le=0;for(;Y;){const ce=te.continuation||le>0,se={...te,id:`${te.id}:${le}`,text:Y,continuation:ce},Ce=$t(ke,Y,ce);if(De+Ce<=Te){ae.push(se),De+=Ce;break}if(ae.length>0){Ue.push(ae),ae=[],De=0,Te=vt;continue}const he=ds(ke,Y,ce,Te);if(he<=0||he>=Y.length){ae.push(se),De=Ce;break}const Le=Y.slice(0,he).trimEnd();ae.push({...se,text:Le}),Ue.push(ae),ae=[],De=0,Te=vt,Y=Y.slice(he).trimStart(),le+=1}}ae.length>0&&Ue.push(ae),Ge(Ue)}else _.length===0&&Ge([[]])}),w.useLayoutEffect(()=>{const h=document.getElementById("ws-printable-root");if(!h)return;const b=Array.from(h.querySelectorAll("[data-worksheet-page]")),v=297/25.4*96,A=b.findIndex(z=>z.offsetHeight>v+2);A<0||(_e[A]?.length??0)<=1||gt(z=>{const $=z.map(T=>[...T]),R=$[A].pop();return R?($[A+1]?$[A+1].unshift(R):$.push([R]),$):z})},[_e]),w.useLayoutEffect(()=>{if(!e.settings.includeAnswerKey)return;const h=document.getElementById("ws-printable-root");if(!h)return;const b=Array.from(h.querySelectorAll("[data-answer-key-page]")),v=297/25.4*96,A=b.findIndex(z=>z.offsetHeight>v+2);A<0||Ge(z=>{const $=z.map(T=>[...T]);if($[A].length===1){const T=zr($[A][0]);return T?($[A]=[T[0]],$[A+1]?$[A+1].unshift(T[1]):$.push([T[1]]),$):z}const R=$[A].pop();return R?($[A+1]?$[A+1].unshift(R):$.push([R]),$):z})},[ut,e.settings.includeAnswerKey]);const Zt=t.jsxs("header",{className:"ws-header",children:[t.jsxs("div",{className:"ws-headrow",dir:i?"rtl":"ltr",children:[t.jsxs("div",{className:"ws-headstart",children:[e.settings.schoolName&&t.jsx(Qe,{label:E.school,value:e.settings.schoolName,icon:t.jsx(yr,{})}),e.settings.section&&t.jsx(Qe,{label:E.section,value:e.settings.section,icon:t.jsx(jr,{})}),e.settings.teacherName&&t.jsx(Qe,{label:E.teacher,value:e.settings.teacherName,icon:t.jsx(kr,{})}),Ye.map((h,b)=>t.jsx(Qe,{label:h.label.trim()||(i?"حقل":"Field"),value:h.value,icon:t.jsx(vr,{})},`cf-${b}`))]}),t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",children:e.title}),(e.subject||e.gradeLevel)&&t.jsx("div",{className:"ws-kicker-center",children:[e.subject,e.gradeLevel].filter(Boolean).join(" · ")}),t.jsx(dt,{})]}),t.jsx("div",{className:"ws-headend",children:D&&t.jsx("img",{src:D,alt:i?"شعار المدرسة":"School logo",className:"ws-logo-img"})})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-fields",children:[e.settings.includeName&&t.jsx(lt,{label:E.name,icon:t.jsx($r,{})}),e.settings.includeClass&&t.jsx(lt,{label:E.clazz,icon:t.jsx(Nr,{}),short:!0}),e.settings.includeDate&&t.jsx(lt,{label:E.date,icon:t.jsx(_r,{}),short:!0})]}),e.settings.headerNote&&t.jsx("p",{className:"ws-subtitle",children:e.settings.headerNote}),e.settings.learningObjective&&t.jsxs("div",{className:"ws-learning-objective",children:[t.jsx("strong",{children:i?"هدف الورقة:":"Learning objective:"}),t.jsx("span",{children:e.settings.learningObjective}),e.settings.activityDuration&&t.jsx("small",{children:i?`${e.settings.activityDuration} دقيقة`:`${e.settings.activityDuration} min`})]}),e.settings.instructions&&t.jsxs("div",{className:"ws-instructions",children:[t.jsx(Ar,{}),t.jsxs("div",{children:[t.jsx("strong",{children:E.instructions}),t.jsxs("span",{children:[" ",e.settings.instructions]})]})]})]}),bt=t.jsx(br,{theme:j,data:e,labels:E,TC:y,GOLD:I,ar:i,hasIdentity:Xt,customFields:Ye,classicFallback:Zt}),es=Re===2?"calc((174mm - 8mm) / 2)":"174mm",ft=`ws-page${g?` ws-theme-${g}`:""}`,ts="bg-neutral-200",Xe=S?_.find(h=>h.id===S.questionId):void 0,yt=S?pe.find(h=>h.questionId===S.questionId):void 0,ss=S?yt?.fields?.find(h=>h.key===S.key):void 0;return w.useEffect(()=>{if(!S)return;const h=window.requestAnimationFrame(()=>{if(!window.matchMedia("(max-width: 640px)").matches)return;const b=document.activeElement,v=document.querySelector(".ws-format-toolbar");if(!(b instanceof HTMLElement)||!b.matches(".ws-editable")||!v)return;const A=b.getBoundingClientRect(),z=v.getBoundingClientRect(),$=Tt(A.bottom,z.top);$>0&&window.scrollBy({top:$,behavior:"smooth"})});return()=>window.cancelAnimationFrame(h)},[S]),t.jsxs(t.Fragment,{children:[t.jsx(Er,{fontFamily:n,headingFont:N,fontSizePt:c,lang:e.language,themeColor:y}),j&&t.jsx(wr,{theme:j,TC:y,GOLD:I,BG:F,fontFamily:n,headingFont:N,fontSizePt:c,lang:e.language}),t.jsxs("div",{ref:xt,"aria-hidden":"true",className:`no-print print-host${g?` ws-theme-${g}`:""}`,style:{position:"fixed",left:0,top:0,width:"210mm",height:0,overflow:"hidden",visibility:"hidden",pointerEvents:"none"},dir:m,children:[t.jsx("div",{"data-header-measure":!0,style:{width:"174mm"},children:bt}),t.jsx("div",{"data-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:i?"صفحة 2":"Page 2"})]})}),_.map((h,b)=>t.jsx("div",{"data-q-measure":!0,style:{width:es},children:t.jsx(Bt,{index:String(b+1),q:h,ar:i,labels:E,showTypeHeader:ie.has(h.id),questionStyle:pe.find(v=>v.questionId===h.id)})},h.id)),t.jsx("div",{"data-footer-measure":!0,style:{width:"174mm"},children:t.jsx(ct,{note:e.settings.footerNote,goodLuck:e.settings.goodLuck?.trim()||E.goodLuck})}),t.jsx("div",{"data-answer-header-measure":!0,style:{width:"174mm"},children:t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:I},children:E.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:I,background:`${I}1f`},children:e.title}),t.jsx(dt,{gold:!0})]})})})}),t.jsx("div",{"data-answer-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsxs("span",{className:"ws-cont-title",children:[E.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:i?"صفحة متابعة":"Continued"})]})}),Ae.map(h=>t.jsx("div",{"data-answer-measure":!0,style:{width:"174mm"},children:t.jsx(Dt,{item:h,ar:i,labels:E})},`answer-${h.id}`))]}),s&&t.jsxs("div",{className:"no-print ws-edit-tools",style:{position:"fixed",bottom:16,[i?"left":"right"]:16,zIndex:40,display:"flex",gap:8,alignItems:"center",background:V?I:"white",border:`2px solid ${V?I:ee}`,borderRadius:999,padding:"7px 14px",boxShadow:"0 4px 16px rgba(0,0,0,0.18)",fontFamily:"inherit",fontWeight:700,fontSize:13,color:V?"white":ee,cursor:"pointer",transition:"all 0.18s"},role:"group","aria-label":i?"أدوات التعديل":"Edit tools",children:[V&&fe&&t.jsxs("button",{onClick:k,style:{background:"white",color:ee,border:"none",borderRadius:999,padding:"3px 12px",fontWeight:800,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5},children:[t.jsx(Ts,{style:{width:14,height:14}}),i?"حفظ":"Save"]}),V&&fe&&t.jsx("button",{type:"button",onClick:q,title:i?"إلغاء تعديلات هذه الجلسة والعودة إلى آخر نسخة محفوظة":"Discard this session's changes",style:{background:"transparent",color:"white",border:"1px solid rgba(255,255,255,0.75)",borderRadius:999,padding:"3px 10px",fontWeight:800,fontSize:12,cursor:"pointer"},children:i?"تجاهل التعديلات":"Discard"}),V&&f.size>0&&t.jsx("button",{type:"button",onClick:()=>{M(new Set),H(!0),O()},title:i?"إزالة فواصل الصفحات اليدوية وإعادة توزيع الأسئلة":"Remove manual page breaks and repaginate",style:{background:"white",color:ee,border:"none",borderRadius:999,padding:"3px 12px",fontWeight:800,fontSize:12,cursor:"pointer"},children:i?"توزيع تلقائي":"Auto layout"}),t.jsxs("button",{onClick:()=>{ze(h=>(h&&ne(null),!h))},style:{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:"inherit",fontWeight:700,fontSize:13,padding:0},children:[t.jsx(Pt,{style:{width:15,height:15}}),V?i?"إنهاء التعديل":"Done editing":i?"تحرير الورقة":"Edit worksheet"]})]}),V&&S&&Xe&&t.jsx(Ut,{ar:i,question:Xe,questionNumber:_.findIndex(h=>h.id===Xe.id)+1,questionStyle:yt,fieldStyle:ss,onFieldChange:h=>X(S.questionId,S.key,h),onQuestionChange:h=>L(S.questionId,b=>({...b,...h})),onQuestionTypeChange:h=>{const b=x.current.map(v=>v.id===S.questionId?Qt(v,h,i):v);x.current=b,Z(b),M(new Set),ne({questionId:S.questionId,key:"prompt"}),H(!0),O()},onQuestionEdit:U,onResetField:ge,onResetQuestion:()=>{const h=K.current.filter(b=>b.questionId!==S.questionId);K.current=h,ve(h),H(!0),O()}}),t.jsxs("div",{id:"ws-printable-root",ref:Jt,"data-responsive-preview":!0,className:`print-host ${S?"ws-format-toolbar-open ":""}${ts} min-h-screen py-6 px-2 flex flex-col items-center`,dir:m,style:V?{outline:"none"}:void 0,children:[_e.map((h,b)=>{const v=b+1,A=b===0,z=b===_e.length-1;return t.jsxs("article",{"data-worksheet-page":!0,className:ft,lang:e.language,style:{background:F},children:[d&&t.jsx(Rt,{ar:i}),!g&&t.jsx(Ke,{}),g==="arabic_ink"&&t.jsx(Ke,{}),A&&t.jsx(gr,{layout:e.settings.layout}),t.jsxs("div",{className:"ws-content",children:[A?bt:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:i?`صفحة ${v}`:`Page ${v}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:Re===2?2:1},children:h.map($=>{const R=_.find(Q=>Q.id===$.id)??$,T=_.findIndex(Q=>Q.id===$.id);return t.jsx(Bt,{index:String(T+1),q:R,ar:i,labels:E,editMode:V,onEdit:U,showTypeHeader:ie.has($.id),questionStyle:pe.find(Q=>Q.questionId===$.id),onSelectField:Q=>ne({questionId:$.id,key:Q}),selected:S?.questionId===$.id,onSelectQuestion:()=>ne({questionId:$.id,key:"prompt"}),onMatchingWidthChange:Q=>{L($.id,B=>({...B,matchingLeftWidth:Q})),ne({questionId:$.id,key:"prompt"})},onQuestionStyleChange:Q=>{L($.id,B=>({...B,...Q})),ne({questionId:$.id,key:"prompt"})}},$.id)})}),t.jsx(ct,{note:z?e.settings.footerNote:void 0,goodLuck:z?e.settings.goodLuck?.trim()||E.goodLuck:""})]}),e.linkedAssignmentId!=null&&t.jsx(Mr,{worksheetId:e.id,page:v,total:_e.length,ar:i})]},v)}),e.settings.includeAnswerKey&&ut.map((h,b)=>{const v=_e.length+b+1;return t.jsxs("article",{"data-answer-key-page":!0,"data-answer-key-page-number":b+1,className:ft,lang:e.language,style:{background:F},children:[d&&t.jsx(Rt,{ar:i}),!g&&t.jsx(Ke,{}),g==="arabic_ink"&&t.jsx(Ke,{}),t.jsxs("div",{className:"ws-content",children:[b===0?t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:I},children:E.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:I,background:`${I}1f`},children:e.title}),t.jsx(dt,{gold:!0})]})})}):t.jsxs("div",{className:"ws-cont-header","data-answer-key-continuation":!0,children:[t.jsxs("span",{className:"ws-cont-title",children:[E.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:i?`صفحة ${v}`:`Page ${v}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:1},children:h.map(A=>t.jsx(Dt,{item:A,ar:i,labels:E},A.id))}),t.jsx(ct,{goodLuck:""})]})]},`answer-page-${b+1}`)})]})]})}function fr(){const s=ps()?.id,{lang:r}=hs(),[,o]=gs(),l=us("/teacher/worksheets/create"),[a,i]=w.useState(null),m=w.useRef(null),n=w.useCallback(u=>{const k=typeof u=="function"?u(m.current):u;m.current=k,i(k)},[]),p=w.useRef(null),g=w.useRef(null),j=w.useRef(0),F=w.useRef(null),[N,c]=w.useState(!0),[d,y]=w.useState(null),[D,_]=w.useState(""),Z=w.useRef(!1),[x,f]=w.useState(!1),[C,W]=w.useState(!1),M=w.useRef(!1),[G,we]=w.useState(""),[O,pe]=w.useState(null),[,ve]=w.useState(0),K=u=>JSON.stringify({t:u.title,s:u.subject,g:u.gradeLevel,st:{...u.settings,pageBreaks:u.settings.pageBreaks??[],questionStyles:u.settings.questionStyles??[]}}),S=u=>JSON.stringify(u.questions),ne=w.useRef(r);ne.current=r,w.useEffect(()=>{if(!s)return;const u=new AbortController;return c(!0),fetch(`${Mt}/api/worksheets/${s}`,{credentials:"include",signal:u.signal}).then(k=>{if(!k.ok)throw new Error("load failed");return k.json()}).then(k=>{u.signal.aborted||(p.current={meta:K(k),questions:S(k)},g.current=k,n(k))}).catch(()=>{u.signal.aborted||xe.error(ne.current==="ar"?"تعذّر تحميل ورقة العمل":"Failed to load worksheet")}).finally(()=>{u.signal.aborted||c(!1)}),()=>u.abort()},[s,n]);const ie=a?.isOwner!==!1,be=!!(a&&p.current&&ie&&(K(a)!==p.current.meta||S(a)!==p.current.questions)),$e=w.useRef(!1);$e.current=be,w.useEffect(()=>{const u=k=>{const q=m.current,U=p.current,L=F.current?.(),X=q&&L?{...q,questions:L.questions,settings:{...q.settings,pageBreaks:L.pageBreaks,questionStyles:L.questionStyles}}:q,ge=X&&U&&X.isOwner!==!1&&(K(X)!==U.meta||S(X)!==U.questions);($e.current||ge)&&(k.preventDefault(),k.returnValue="")};return window.addEventListener("beforeunload",u),()=>window.removeEventListener("beforeunload",u)},[]);const fe=w.useCallback(u=>{n(k=>k&&{...k,questions:u.questions,settings:{...k.settings,pageBreaks:u.pageBreaks,questionStyles:u.questionStyles}})},[n]),H=w.useCallback(()=>{const u=F.current?.();u&&fe(u);const k=m.current;return!k||!u?k:{...k,questions:u.questions,settings:{...k.settings,pageBreaks:u.pageBreaks,questionStyles:u.questionStyles}}},[fe]),V=w.useCallback(async()=>{if(M.current)return!1;const u=H(),k=p.current;if(!u||!k||u.isOwner===!1)return!1;M.current=!0,W(!0),we("");const q=S(u)!==k.questions,U={title:u.title,language:u.language,gradeLevel:u.gradeLevel,subject:u.subject,questions:u.questions,settings:u.settings};q&&u.linkedAssignmentId!=null&&(U.smartGrading=!0);try{const L=await fetch(`${Mt}/api/worksheets/${u.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(U)});if(!L.ok){const E=await L.json().catch(()=>({}));throw new Error(E?.message||"save failed")}const X=await L.json().catch(()=>null),ge=Array.isArray(X)?X[0]:X;return p.current={meta:K(u),questions:S(u)},g.current=u,n(E=>E&&{...E,linkedAssignmentId:ge&&"linkedAssignmentId"in ge?ge.linkedAssignmentId??null:E.linkedAssignmentId}),xe.success(ge?.gradingVersioned?r==="ar"?"تم الحفظ وإنشاء نسخة جديدة للتصحيح":"Saved; grading version updated":r==="ar"?"تم حفظ تعديلات الورقة":"Worksheet changes saved"),!0}catch(L){const X=(L instanceof Error&&L.message!=="save failed"?L.message:"")||(r==="ar"?"تعذّر الحفظ. تعديلاتك محفوظة هنا؛ أعد المحاولة.":"Save failed. Your edits are kept here; retry.");return we(X),xe.error(X),!1}finally{M.current=!1,W(!1),ve(L=>L+1)}},[H,n,r]),ze=w.useCallback(()=>{const u=g.current;u&&(we(""),n(k=>k?{...u,linkedAssignmentId:k.linkedAssignmentId,isOwner:k.isOwner}:u))},[n]),ye=w.useCallback(()=>{V()},[V]),We=w.useCallback(u=>{H(),j.current+=1,queueMicrotask(()=>{$e.current||m.current&&p.current&&m.current.isOwner!==!1&&(K(m.current)!==p.current.meta||S(m.current)!==p.current.questions)?pe(()=>u):u()})},[H]),ht=w.useCallback(u=>{n(k=>k&&{...k,...u.title!==void 0?{title:u.title}:{},...u.subject!==void 0?{subject:u.subject.trim()?u.subject:null}:{},...u.gradeLevel!==void 0?{gradeLevel:u.gradeLevel.trim()?u.gradeLevel:null}:{}})},[n]),Ve=w.useCallback(u=>{n(k=>k&&{...k,settings:u(k.settings)})},[n]);if(N)return t.jsx("div",{className:"min-h-screen flex items-center justify-center",children:t.jsx(et,{className:"w-8 h-8 animate-spin",style:{color:ee}})});if(!a)return t.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:r==="ar"?"لم يتم العثور على ورقة العمل.":"Worksheet not found."});const Ne=a.language==="ar"?"rtl":"ltr",Fe=async u=>{if(Z.current)return;H();const k=document.getElementById("ws-printable-root");if(!k){xe.error(r==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}Z.current=!0,y(u),_("");try{u==="visual"?await mr({element:k,title:a.title,lang:a.language,worksheetId:a.id,onProgress:(q,U)=>_(`${q}/${U}`)}):await As({element:k,title:`${a.title} - ${r==="ar"?"قابل للتحرير":"Editable"}`,lang:a.language}),xe.success(r==="ar"?"تم تجهيز ملف Word للتنزيل":"Word file ready for download")}catch(q){const U=q instanceof J&&q.code==="image",L=q instanceof J&&q.code==="busy";xe.error(L?r==="ar"?"خدمة التصدير مشغولة الآن؛ أعد المحاولة بعد قليل.":"The export service is busy. Please retry shortly.":U?r==="ar"?"تعذّر تحميل إحدى صور التصميم. لم يُصدّر ملف ناقص؛ أعد المحاولة بعد اكتمال تحميل الصور.":"A design image could not be loaded. No incomplete file was exported; retry after images finish loading.":r==="ar"?"تعذّر تصدير ملف Word. يرجى المحاولة مرة أخرى.":"Could not export the Word file. Please try again.")}finally{Z.current=!1,y(null),_("")}};return t.jsxs(t.Fragment,{children:[t.jsxs("div",{dir:Ne,className:"no-print ws-action-toolbar sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[t.jsxs("button",{onClick:()=>We(l),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${ee}55`,color:ee},children:[t.jsx(Ps,{className:"w-3.5 h-3.5"}),r==="ar"?"رجوع":"Back"]}),t.jsx("div",{className:"text-xs font-bold truncate flex-1 text-center",style:{color:ee},children:a.title}),t.jsxs("div",{className:"ws-actions flex gap-1.5 flex-wrap justify-end",children:[a.isOwner!==!1&&a.linkedAssignmentId!=null&&t.jsxs("button",{onClick:()=>We(()=>o(`/teacher/worksheets/${a.id}/grade`)),className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:"#2f684d"},title:r==="ar"?"تصحيح الأوراق بالكاميرا":"Grade papers with camera","data-testid":"btn-open-grading",children:[t.jsx(Ws,{className:"w-3.5 h-3.5"}),r==="ar"?"تصحيح":"Grade"]}),ie&&t.jsxs(t.Fragment,{children:[t.jsxs("button",{onClick:()=>f(u=>!u),"aria-expanded":x,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${ee}55`,color:ee,background:x?`${ee}12`:void 0},"data-testid":"btn-toggle-format-panel",children:[t.jsx(Pt,{className:"w-3.5 h-3.5"}),r==="ar"?"الترويسة والتنسيق":"Header & format"]}),t.jsxs("button",{onClick:()=>{V()},disabled:C||!be,className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm disabled:opacity-50",style:{background:be?I:"#2f684d"},"data-testid":"btn-save-worksheet",children:[C?t.jsx(et,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(Hs,{className:"w-3.5 h-3.5"}),C?r==="ar"?"جار الحفظ":"Saving":be?r==="ar"?"حفظ التعديلات":"Save changes":r==="ar"?"محفوظ":"Saved"]})]}),t.jsxs(Ss,{dir:r==="ar"?"rtl":"ltr",children:[t.jsx(Cs,{asChild:!0,children:t.jsxs("button",{disabled:d!==null,"aria-busy":d!==null,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 disabled:opacity-60",style:{borderColor:`${I}88`,color:I,background:`${I}10`},title:r==="ar"?"اختر نسخة Word":"Choose a Word version","data-testid":"btn-word-export",children:[d?t.jsx(et,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(qs,{className:"w-3.5 h-3.5"}),t.jsx("span",{"aria-live":"polite",children:d?`${r==="ar"?"جار التجهيز":"Preparing"} ${D}`:r==="ar"?"وورد":"Word"})]})}),t.jsxs(Ls,{align:"end",className:"w-72",children:[t.jsxs(_t,{onSelect:()=>{Fe("visual")},disabled:d!==null,className:"flex-col items-start gap-1 py-3","data-testid":"word-export-visual",children:[t.jsx("span",{className:"font-bold",children:r==="ar"?"Word مطابق للتصميم":"Word — visual design"}),t.jsx("span",{className:"text-xs text-muted-foreground",children:r==="ar"?"نفس المظهر كصور صفحات؛ النص غير قابل للتحرير.":"Same appearance as page images; text is not editable."})]}),t.jsxs(_t,{onSelect:()=>{Fe("editable")},disabled:d!==null,className:"flex-col items-start gap-1 py-3","data-testid":"word-export-editable",children:[t.jsx("span",{className:"font-bold",children:r==="ar"?"Word قابل للتحرير":"Word — editable"}),t.jsx("span",{className:"text-xs text-muted-foreground",children:r==="ar"?"نصوص وجداول بتنسيق محسّن؛ قد يختلف توزيع الصفحات.":"Formatted text and tables; pagination may differ."})]})]})]}),t.jsxs("button",{onClick:()=>{H(),_s(a.title)},className:"px-4 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:ee},title:r==="ar"?"حفظ الورقة كملف PDF":"Save worksheet as PDF",children:[t.jsx(Os,{className:"w-3.5 h-3.5"}),r==="ar"?"حفظ PDF":"Save PDF"]})]})]}),ie&&(x||G||be)&&t.jsxs("div",{dir:Ne,className:"no-print border-b bg-white px-4 py-3","data-testid":"region-live-edit",children:[(G||be)&&t.jsxs("div",{role:G?"alert":"status",className:`mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${G?"border-red-300 bg-red-50 text-red-800":"border-amber-300 bg-amber-50 text-amber-900"}`,children:[t.jsx("span",{className:"flex-1",children:G||(r==="ar"?"لديك تعديلات غير محفوظة. الطباعة والتصدير يستخدمان آخر تعديلاتك.":"You have unsaved edits. Print and export use your latest edits.")}),t.jsx("button",{onClick:()=>{V()},disabled:C,className:"px-3 py-1 rounded-md bg-white border font-bold","data-testid":"btn-retry-save",children:G?r==="ar"?"إعادة المحاولة":"Retry":r==="ar"?"حفظ":"Save"})]}),x&&t.jsx(sr,{ar:r==="ar",settings:a.settings,onSettingsChange:Ve,meta:{title:a.title,subject:a.subject??"",gradeLevel:a.gradeLevel??""},onMetaChange:ht})]}),t.jsx(Ot,{data:a,flushRef:F,onRequestSave:ie?ye:void 0,onRequestDiscard:ie?ze:void 0,onDraftChange:ie?fe:void 0,onLayoutChange:ie?(u,k,q)=>fe({questions:u,pageBreaks:k,questionStyles:q}):void 0}),O&&t.jsx("div",{className:"no-print fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4",role:"alertdialog","aria-modal":"true","aria-labelledby":"leave-title",dir:Ne,children:t.jsxs("div",{className:"w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl",children:[t.jsx("h2",{id:"leave-title",className:"font-bold text-base mb-1",children:r==="ar"?"تعديلات غير محفوظة":"Unsaved changes"}),t.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:r==="ar"?"احفظ تعديلاتك قبل المغادرة أو تجاهلها.":"Save your edits before leaving, or discard them."}),t.jsxs("div",{className:"flex flex-wrap gap-2 justify-end",children:[t.jsx("button",{className:"px-3 py-1.5 rounded-lg border text-sm font-bold",onClick:()=>{j.current+=1,pe(null)},children:r==="ar"?"البقاء":"Stay"}),t.jsx("button",{className:"px-3 py-1.5 rounded-lg border text-sm font-bold text-red-700","data-testid":"btn-discard-leave",disabled:C,onClick:()=>{const u=O;$e.current=!1,j.current+=1,pe(null),u()},children:r==="ar"?"تجاهل وخروج":"Discard & leave"}),t.jsx("button",{className:"px-3 py-1.5 rounded-lg text-sm font-bold text-white",style:{background:ee},"data-testid":"btn-save-leave",disabled:C,onClick:async()=>{const u=O,k=++j.current,q=await V();if(k!==j.current)return;const U=m.current,L=p.current,X=!!(U&&L&&(K(U)!==L.meta||S(U)!==L.questions));pe(null),q&&!X&&($e.current=!1,u())},children:r==="ar"?"حفظ وخروج":"Save & leave"})]})]})})]})}function lt({label:e,short:s,icon:r}){return t.jsxs("div",{className:`ws-field-line ${s?"short":""}`,children:[r&&t.jsx("span",{className:"ws-field-icon",children:r}),t.jsxs("span",{className:"ws-field-label",children:[e,":"]}),t.jsx("span",{className:"ws-field-rule"})]})}function Qe({label:e,value:s,icon:r}){return t.jsxs("div",{className:"ws-school-cell",children:[t.jsx("span",{className:"ws-school-icon",children:r}),t.jsxs("div",{className:"ws-school-text",children:[t.jsx("span",{className:"ws-school-label",children:e}),t.jsx("span",{className:"ws-school-value",children:s})]})]})}function ct({note:e,goodLuck:s}){return!e&&!s?null:t.jsxs("footer",{className:"ws-footer",children:[s&&t.jsx("div",{className:"ws-footer-cheer",children:s}),e&&t.jsx("div",{className:"ws-footer-note",children:e})]})}function Rt({ar:e}){const s=e?"حصاد":"Hasaad";return t.jsx("div",{className:"ws-watermark","aria-hidden":"true",children:t.jsx("span",{className:"ws-watermark-word",children:s})})}function Ke(){return t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-corner ws-corner-tl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-tr","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-bl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-br","aria-hidden":"true"})]})}function dt({gold:e}){return t.jsxs("div",{className:`ws-divider ${e?"gold":""}`,"aria-hidden":"true",children:[t.jsx("span",{className:"ws-divider-thick"}),t.jsx("span",{className:"ws-divider-thin"})]})}function yr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),t.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function jr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}),t.jsx("path",{d:"M9 4v16M4 9h16"})]})}function kr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"3"}),t.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function vr(){return t.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:t.jsx("path",{d:"M4 7h16M4 12h16M4 17h10"})})}function $r(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"4"}),t.jsx("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"})]})}function Nr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"6",width:"18",height:"13",rx:"2"}),t.jsx("path",{d:"M8 3v6M16 3v6"})]})}function _r(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),t.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function Ar(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:I,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flex:"0 0 auto"},children:[t.jsx("path",{d:"M9 18h6M10 21h4"}),t.jsx("path",{d:"M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"})]})}function Sr(e,s){return s?{mcq:"اختيار من متعدد",true_false:"صح / خطأ",short_answer:"إجابة قصيرة",fill_blank:"أكمل الفراغ",matching:"وصّل بين العمودين",tic_tac_toe:"لوحة الاختيار (Tic-Tac-Toe)",worked_problem:"مسألة مع خطوات الحل",extended_response:"إجابة مطولة",error_correction:"اكتشف الخطأ وصححه",word_bank:"بنك الكلمات",compare:"قارن"}[e]:{mcq:"Multiple choice",true_false:"True / False",short_answer:"Short answer",fill_blank:"Fill in the blank",matching:"Matching",tic_tac_toe:"Choice Board (Tic-Tac-Toe)",worked_problem:"Worked problem",extended_response:"Extended response",error_correction:"Find & correct the error",word_bank:"Word bank",compare:"Compare"}[e]}function Cr(e,s,r){return s?{mcq:"اختر الإجابة الصحيحة من الاختيارات التالية:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:":"اختر «صح» أو «خطأ» لكل عبارة مما يلي:",short_answer:"أجب عن الأسئلة التالية إجابةً قصيرة:",fill_blank:"أكمل الفراغات التالية بالكلمة المناسبة:",matching:"صل كل عبارة بما يناسبها من العمود الثاني:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"اختر الأركان الأربعة ونفّذ مهامها:":r?.ticTacToeStrategy==="full_board"?"نفّذ جميع المهام في اللوحة التالية:":"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا:",worked_problem:"حل المسألة موضحًا خطوات العمل، ثم اكتب الإجابة النهائية:",extended_response:"اكتب إجابة موسعة تدعمها بالتفاصيل والأدلة:",error_correction:"حدّد الخطأ، ثم اكتب التصحيح واشرح سبب التعديل:",word_bank:"استخدم الكلمات في الصندوق لإكمال البنود التالية:",compare:"قارن بين العنصرين، موضحًا أوجه التشابه والاختلاف:"}[e]:{mcq:"Choose the correct answer from the following:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"Put a tick (✓) before each true statement and a cross (✗) before each false statement:":"Choose True or False for each statement:",short_answer:"Answer the following questions briefly:",fill_blank:"Fill in the blanks with the appropriate word:",matching:"Match each item with its corresponding choice in the second column:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"Choose the four corners and complete the tasks:":r?.ticTacToeStrategy==="full_board"?"Complete all tasks in the board:":"Choose three connected squares horizontally, vertically, or diagonally:",worked_problem:"Solve the problem, showing each step, then give the final answer:",extended_response:"Write an extended response supported with details and evidence:",error_correction:"Identify the error, write the correction, and explain your reasoning:",word_bank:"Use the words in the box to complete the following items:",compare:"Compare the two items, including their similarities and differences:"}[e]}function Lr(e){if(e)return{fontSize:e.fontSizePt?`${e.fontSizePt}pt`:void 0,fontWeight:e.bold?800:void 0,textAlign:e.align==="start"?"start":e.align==="end"?"end":e.align,display:e.align?"inline-block":void 0,width:e.align?"100%":void 0}}function Ut({ar:e,question:s,questionNumber:r,questionStyle:o,fieldStyle:l,onFieldChange:a,onQuestionChange:i,onQuestionTypeChange:m,onQuestionEdit:n,onResetField:p,onResetQuestion:g}){const j=l?.fontSizePt??12,F=[{value:"start",Icon:e?At:St},{value:"center",Icon:Fs},{value:"end",Icon:e?St:At}],N=e?{start:"محاذاة للبداية",center:"توسيط",end:"محاذاة للنهاية"}:{start:"Align to start",center:"Center align",end:"Align to end"},c=d=>{if(!["ArrowRight","ArrowLeft","Home","End"].includes(d.key)||d.target instanceof HTMLInputElement||d.target instanceof HTMLSelectElement)return;const y=Array.from(d.currentTarget.querySelectorAll("button:not(:disabled), select:not(:disabled), input:not(:disabled)")),D=y.indexOf(document.activeElement);if(D<0||y.length===0)return;d.preventDefault();const _=d.key===(e?"ArrowLeft":"ArrowRight"),Z=d.key==="Home"?0:d.key==="End"?y.length-1:(D+(_?1:-1)+y.length)%y.length;y[Z]?.focus()};return t.jsxs("div",{className:"no-print ws-format-toolbar",dir:e?"rtl":"ltr",role:"toolbar","aria-label":e?"تنسيق النص والسؤال المحددين":"Selected text and question formatting",onKeyDown:c,"data-testid":"toolbar-question-formatting",children:[t.jsx("div",{className:"ws-format-selection","aria-live":"polite",children:e?`تعديل السؤال ${r}`:`Editing question ${r}`}),t.jsxs("div",{className:"ws-format-group",children:[t.jsx("span",{className:"ws-format-label",children:e?"النص":"Text"}),t.jsx("button",{type:"button",onClick:()=>a({fontSizePt:Math.max(8,j-1)}),"aria-label":e?"تصغير الخط":"Decrease font size","data-testid":"button-decrease-font-size",children:t.jsx(Us,{})}),t.jsx("span",{className:"ws-format-value","aria-live":"polite","data-testid":"text-font-size",children:j}),t.jsx("button",{type:"button",onClick:()=>a({fontSizePt:Math.min(24,j+1)}),"aria-label":e?"تكبير الخط":"Increase font size","data-testid":"button-increase-font-size",children:t.jsx(mt,{})}),t.jsx("button",{type:"button",className:l?.bold?"is-active":"",onClick:()=>a({bold:!l?.bold}),"aria-label":e?"نص عريض":"Bold text","aria-pressed":!!l?.bold,"data-testid":"button-toggle-bold",children:t.jsx("strong",{children:"ب"})}),F.map(({value:d,Icon:y})=>t.jsx("button",{type:"button",className:l?.align===d?"is-active":"",onClick:()=>a({align:d}),"aria-label":N[d],"aria-pressed":l?.align===d,"data-testid":`button-align-${d}`,children:t.jsx(y,{})},d)),t.jsx("button",{type:"button",onClick:p,"aria-label":e?"إعادة تنسيق النص":"Reset text formatting","data-testid":"button-reset-text-formatting",children:t.jsx(Nt,{})})]}),t.jsxs("div",{className:"ws-format-group",children:[t.jsx("span",{className:"ws-format-label",children:e?"السؤال":"Question"}),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"نوعه":"Type"}),t.jsx("select",{value:s.type,onChange:d=>m(d.target.value),"aria-label":e?"تغيير نوع السؤال":"Change question type",children:["true_false","mcq","matching","short_answer","fill_blank"].map(d=>t.jsx("option",{value:d,children:Sr(d,e)},d))})]}),s.type==="true_false"&&t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-format-label",children:e?"طريقة الإجابة":"Answer layout"}),["mark","choices"].map(d=>t.jsx("button",{type:"button",className:(o?.trueFalseLayout??"choices")===d?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>i({trueFalseLayout:d}),children:e?d==="mark"?"قوس للعلامة":"خيارا صح وخطأ":d==="mark"?"Mark parentheses":"True / False choices"},d)),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة":"Answer"}),t.jsxs("select",{value:s.correct?"true":"false",onChange:d=>n({...s,correct:d.target.value==="true"}),"aria-label":e?"الإجابة الصحيحة":"Correct answer",children:[t.jsx("option",{value:"true",children:e?"صح":"True"}),t.jsx("option",{value:"false",children:e?"خطأ":"False"})]})]})]}),s.type==="tic_tac_toe"&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-strategy",children:[t.jsx("span",{className:"ws-format-label",children:e?"الاستراتيجية":"Strategy"}),["any_three","corners","full_board"].map(d=>t.jsx("button",{type:"button",className:(o?.ticTacToeStrategy??"any_three")===d?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>i({ticTacToeStrategy:d}),children:e?d==="any_three"?"3 متصلة":d==="corners"?"الأركان":"كامل اللوحة":d==="any_three"?"Any 3":d==="corners"?"Corners":"Full board"},d))]}),t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-response",children:[t.jsx("span",{className:"ws-format-label",children:e?"أسطر الإجابة":"Response Lines"}),[0,3,5,8,12].map(d=>t.jsx("button",{type:"button",className:(o?.ticTacToeResponseLines??0)===d?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>i({ticTacToeResponseLines:d}),children:d===0?e?"بدون":"None":d},d))]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة الصحيحة":"Correct answer"}),t.jsx("select",{value:s.correctIndex,onChange:d=>n({...s,correctIndex:Number(d.target.value)}),"aria-label":e?"اختيار الإجابة الصحيحة":"Choose the correct answer",children:s.options.map((d,y)=>t.jsxs("option",{value:y,children:["(",Ee(y,e),") ",d]},y))})]}),s.type==="error_correction"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر التصحيح":"Correction lines"}),t.jsx("select",{value:o?.errorCorrectionCorrectionLines??2,onChange:d=>i({errorCorrectionCorrectionLines:Number(d.target.value)}),"aria-label":e?"عدد أسطر التصحيح":"Number of correction lines","data-testid":"select-error-correction-lines",children:[0,1,2,3,4,6,8].map(d=>t.jsx("option",{value:d,children:d===0?e?"بدون أسطر":"No lines":d},d))})]}),t.jsx("button",{type:"button",className:o?.errorCorrectionShowExplanation??!0?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>i({errorCorrectionShowExplanation:!(o?.errorCorrectionShowExplanation??!0)}),"aria-pressed":o?.errorCorrectionShowExplanation??!0,"data-testid":"button-toggle-error-explanation",children:o?.errorCorrectionShowExplanation??!0?e?"إخفاء الشرح":"Hide explanation":e?"إظهار الشرح":"Show explanation"}),(o?.errorCorrectionShowExplanation??!0)&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر الشرح":"Explanation lines"}),t.jsx("select",{value:o?.errorCorrectionExplanationLines??2,onChange:d=>i({errorCorrectionExplanationLines:Number(d.target.value)}),"aria-label":e?"عدد أسطر الشرح":"Number of explanation lines","data-testid":"select-error-explanation-lines",children:[0,1,2,3,4,6,8].map(d=>t.jsx("option",{value:d,children:d===0?e?"بدون أسطر":"No lines":d},d))})]})]}),s.type==="compare"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان التشابه":"Similarities heading"}),t.jsx("input",{value:o?.compareSimilaritiesLabel??(e?"أوجه التشابه":"Similarities"),onChange:d=>i({compareSimilaritiesLabel:d.target.value}),"aria-label":e?"عنوان أوجه التشابه":"Similarities heading","data-testid":"input-compare-similarities-label"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان الاختلاف":"Differences heading"}),t.jsx("input",{value:o?.compareDifferencesLabel??(e?"خصائص واختلافات":"Traits and differences"),onChange:d=>i({compareDifferencesLabel:d.target.value}),"aria-label":e?"عنوان الخصائص والاختلافات":"Traits and differences heading","data-testid":"input-compare-differences-label"})]})]}),(s.type==="short_answer"||s.type==="fill_blank")&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة النموذجية":"Model answer"}),t.jsx("input",{value:s.answer??"",onChange:d=>n({...s,answer:d.target.value}),"aria-label":e?"الإجابة النموذجية":"Model answer"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"مسافة السؤال":"Question spacing"}),t.jsxs("select",{value:o?.spacing??"normal",onChange:d=>i({spacing:d.target.value}),"aria-label":e?"مسافة السؤال":"Question spacing","data-testid":"select-question-spacing",children:[t.jsx("option",{value:"compact",children:e?"مضغوط":"Compact"}),t.jsx("option",{value:"normal",children:e?"عادي":"Normal"}),t.jsx("option",{value:"relaxed",children:e?"واسع":"Wide"})]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"ترتيب الخيارات":"Option layout"}),t.jsxs("select",{value:o?.choiceColumns??2,onChange:d=>i({choiceColumns:Number(d.target.value)}),"aria-label":e?"ترتيب خيارات السؤال":"Question option layout","data-testid":"select-choice-columns",children:[t.jsx("option",{value:1,children:e?"عمودي":"Vertical"}),t.jsx("option",{value:2,children:e?"خياران في سطر":"Two per row"})]})]}),t.jsx("button",{type:"button",onClick:g,"aria-label":e?"إعادة إعدادات السؤال":"Reset question settings","data-testid":"button-reset-question-formatting",children:t.jsx(Nt,{})})]})]})}function me({text:e,editMode:s,className:r,onCommit:o,placeholder:l,style:a,onSelect:i}){const m=w.useRef(null);w.useEffect(()=>{m.current&&!s&&(m.current.textContent=e)},[e,s]);const n=Lr(a);return s?t.jsx("span",{ref:m,className:`ws-editable${r?` ${r}`:""}`,style:{...n,unicodeBidi:"plaintext"},contentEditable:!0,suppressContentEditableWarning:!0,onFocus:p=>{i?.(),p.currentTarget.textContent||(p.currentTarget.textContent=e)},onBlur:p=>{const g=p.currentTarget.textContent?.trim()??"";o(g||e)},onKeyDown:p=>{p.key==="Enter"&&(p.preventDefault(),p.currentTarget.blur())},spellCheck:!1,dir:Bs(e,"rtl"),children:e||l}):t.jsx(Ie,{text:e||l,className:r,fallbackDirection:"rtl",style:n})}function Bt({index:e,q:s,ar:r,labels:o,editMode:l,onEdit:a,showTypeHeader:i,questionStyle:m,onSelectField:n,selected:p,onSelectQuestion:g,onMatchingWidthChange:j,onQuestionStyleChange:F}){const N=l??!1,c=a??(()=>{}),d=w.useRef(null),y=s.type==="matching"?Vt(s.pairs):null,D=m?.matchingLeftWidth,_=D?{left:D/100,right:(100-D)/100}:y,Z=x=>{const f=d.current?.getBoundingClientRect();if(!f||f.width<=0)return;const C=r?(f.right-x)/f.width:(x-f.left)/f.width;j?.(Math.round(Math.min(.65,Math.max(.35,C))*100))};return t.jsxs("div",{className:`ws-question-block ws-q-spacing-${m?.spacing??"normal"}${N?" ws-q-editable":""}${p?" ws-q-selected":""}`,onClick:x=>{!N||x.target.closest(".ws-editable")||g?.()},"data-question-selected":p||void 0,children:[i&&t.jsx("div",{className:"ws-section-instr",children:Cr(s.type,r,m)}),s.type==="word_bank"&&t.jsxs("div",{className:"ws-word-bank","aria-label":r?"بنك الكلمات":"Word bank",children:[t.jsx("strong",{children:r?"بنك الكلمات":"Word bank"}),t.jsx("div",{children:Array.from(new Set(s.items.filter(Boolean))).map((x,f)=>t.jsx(Ie,{text:x,fallbackDirection:r?"rtl":"ltr"},f))})]}),t.jsxs("div",{className:"ws-q",children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num","aria-label":`${o.question} ${e}`,children:e}),t.jsxs("div",{className:"ws-q-prompt-wrap",children:[typeof s.points=="number"&&s.points>0&&t.jsx("div",{className:"ws-q-typeline",children:t.jsxs("span",{className:"ws-q-points",children:[s.points," ",r?"د":"pt"]})}),t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(me,{text:s.prompt??(s.type==="matching"?r?"صل بين العمودين بخطوط:":"Match the columns:":""),editMode:N,style:m?.fields?.find(x=>x.key==="prompt"),onSelect:()=>n?.("prompt"),onCommit:x=>c({...s,prompt:x})}),s.type==="true_false"&&(m?.trueFalseLayout??"choices")==="mark"&&t.jsx("span",{className:"ws-tf-mark","aria-hidden":"true",children:"(　　)"})]})]})]}),s.type==="mcq"&&t.jsx("ol",{className:"ws-mcq","data-choice-columns":m?.choiceColumns??2,style:{gridTemplateColumns:`repeat(${m?.choiceColumns??2}, minmax(0, 1fr))`},children:s.options.map((x,f)=>t.jsxs("li",{children:[t.jsxs("span",{className:"ws-mcq-letter",children:["(",Ee(f,r),")"]}),t.jsx("span",{className:"ws-mcq-text",children:t.jsx(me,{text:x,editMode:N,style:m?.fields?.find(C=>C.key===`option:${f}`),onSelect:()=>n?.(`option:${f}`),onCommit:C=>{const W=s.options.slice();W[f]=C,c({...s,options:W})}})})]},f))}),s.type==="true_false"&&(m?.trueFalseLayout??"choices")==="choices"&&t.jsxs("div",{className:"ws-tf-choices",children:[t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),o.true]}),t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),o.false]})]}),s.type==="short_answer"&&t.jsx("div",{className:"ws-lines",children:Array.from({length:s.lines??2}).map((x,f)=>t.jsx("span",{className:"ws-line"},f))}),s.type==="fill_blank"&&t.jsx("div",{className:"ws-fill",children:t.jsx("span",{className:"ws-fill-rule"})}),s.type==="matching"&&t.jsxs("div",{className:"ws-match",ref:d,style:{gridTemplateColumns:`minmax(0, ${_.left}fr) 6mm minmax(0, ${_.right}fr)`},"data-matching-left-share":_.left,"data-matching-right-share":_.right,children:[t.jsx("ul",{className:"ws-match-col",children:s.pairs.map((x,f)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-num",children:[f+1,"."]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(me,{text:x.left,editMode:N,style:m?.fields?.find(C=>C.key===`match-left:${f}`),onSelect:()=>n?.(`match-left:${f}`),onCommit:C=>{const W=s.pairs.map((M,G)=>G===f?{...M,left:C}:M);c({...s,pairs:W})}})})]},`l${f}`))}),t.jsx("div",{className:`ws-match-divider${N?" is-editable":""}`,role:N?"separator":void 0,"aria-label":N?r?"اسحب لتغيير عرض عمودي التوصيل":"Drag to resize matching columns":void 0,"aria-orientation":N?"vertical":void 0,"aria-valuemin":N?35:void 0,"aria-valuemax":N?65:void 0,"aria-valuenow":N?Math.round(_.left*100):void 0,tabIndex:N?0:void 0,onPointerDown:x=>{N&&(x.preventDefault(),x.stopPropagation(),x.currentTarget.setPointerCapture(x.pointerId),Z(x.clientX))},onPointerMove:x=>{!N||!x.currentTarget.hasPointerCapture(x.pointerId)||Z(x.clientX)},onKeyDown:x=>{if(!N||!["ArrowLeft","ArrowRight"].includes(x.key))return;x.preventDefault(),x.stopPropagation();const f=x.key==="ArrowRight"?2:-2,C=r?-f:f,W=Math.round(_.left*100);j?.(Math.min(65,Math.max(35,W+C)))},children:N&&t.jsx("span",{className:"ws-match-divider-handle","aria-hidden":"true",children:"↔"})}),t.jsx("ul",{className:"ws-match-col",children:Kt(s.pairs.length).map((x,f)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-letter",children:["(",Ee(f,r),")"]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(me,{text:s.pairs[x].right,editMode:N,style:m?.fields?.find(C=>C.key===`match-right:${x}`),onSelect:()=>n?.(`match-right:${x}`),onCommit:C=>{const W=s.pairs.map((M,G)=>G===x?{...M,right:C}:M);c({...s,pairs:W})}})})]},`r${f}`))})]}),s.type==="tic_tac_toe"&&t.jsx("div",{className:"ws-tic-board",role:"group","aria-label":r?"لوحة الاختيار — ثلاثة على خط":"Three-in-a-row choice board",children:s.cells.map((x,f)=>t.jsxs("div",{className:"ws-tic-cell",children:[t.jsx("span",{className:"ws-tic-check","aria-hidden":"true"}),x.imageUrl&&t.jsx("img",{className:"ws-tic-image",src:Is(x.imageUrl)??"",alt:""}),t.jsx("span",{className:"ws-tic-text",children:t.jsx(me,{text:x.text,editMode:N,style:m?.fields?.find(C=>C.key===`tic-cell:${f}`),onSelect:()=>n?.(`tic-cell:${f}`),onCommit:C=>{const W=s.cells.map((M,G)=>G===f?{...M,text:C}:M);c({...s,cells:W})}})}),t.jsxs("span",{className:"ws-tic-writing","aria-hidden":"true",children:[t.jsx("span",{}),t.jsx("span",{}),t.jsx("span",{})]})]},f))}),s.type==="tic_tac_toe"&&(m?.ticTacToeResponseLines??0)>0&&t.jsx("div",{className:"ws-short-lines mt-4","aria-hidden":"true",children:Array.from({length:m?.ticTacToeResponseLines??0}).map((x,f)=>t.jsx("div",{className:"ws-short-line"},f))}),s.type==="worked_problem"&&t.jsxs("div",{className:"ws-worked-problem",children:[t.jsx("div",{className:"ws-response-label",children:r?"خطوات الحل / مساحة العمل":"Steps / Work area"}),t.jsx("div",{className:"ws-work-steps",children:Array.from({length:Math.max(3,s.steps??4)}).map((x,f)=>t.jsxs("div",{className:"ws-work-step",children:[t.jsx("span",{className:"ws-work-step-num",children:f+1}),t.jsx("span",{className:"ws-work-step-line"})]},f))}),t.jsxs("div",{className:"ws-final-answer",children:[t.jsx("strong",{children:r?"الإجابة النهائية":"Final answer"}),t.jsx("span",{})]})]}),s.type==="extended_response"&&t.jsx("div",{className:"ws-extended-response","aria-label":r?"مساحة الإجابة الموسعة":"Extended response writing area",children:Array.from({length:Math.max(3,s.lines??6)}).map((x,f)=>t.jsx("span",{className:"ws-line"},f))}),s.type==="error_correction"&&t.jsxs("div",{className:"ws-error-correction",children:[t.jsxs("div",{className:"ws-incorrect-box",children:[t.jsx("strong",{children:r?"النص غير الصحيح:":"Incorrect text:"}),t.jsx(Ie,{text:s.incorrectText,fallbackDirection:r?"rtl":"ltr"})]}),t.jsxs("div",{className:"ws-correction-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التصحيح":"Correction"}),Array.from({length:m?.errorCorrectionCorrectionLines??2}).map((x,f)=>t.jsx("span",{className:"ws-line"},f))]}),(m?.errorCorrectionShowExplanation??!0)&&t.jsxs("div",{className:"ws-explanation-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التفسير":"Explanation"}),Array.from({length:m?.errorCorrectionExplanationLines??2}).map((x,f)=>t.jsx("span",{className:"ws-line"},f))]})]}),s.type==="compare"&&t.jsxs("div",{className:"ws-compare-organizer",children:[t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(me,{text:s.leftLabel,editMode:N,onSelect:()=>n?.("prompt"),onCommit:x=>c({...s,leftLabel:x})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(me,{text:m?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:N,onSelect:()=>n?.("prompt"),onCommit:x=>F?.({compareDifferencesLabel:x})})}),Array.from({length:3}).map((x,f)=>t.jsx("span",{className:"ws-compare-line"},f))]}),t.jsxs("div",{className:"ws-compare-panel ws-compare-similarities",children:[t.jsx("strong",{children:t.jsx(me,{text:m?.compareSimilaritiesLabel??(r?"أوجه التشابه":"Similarities"),editMode:N,onSelect:()=>n?.("prompt"),onCommit:x=>F?.({compareSimilaritiesLabel:x})})}),Array.from({length:3}).map((x,f)=>t.jsx("span",{className:"ws-compare-line"},f))]}),t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(me,{text:s.rightLabel,editMode:N,onSelect:()=>n?.("prompt"),onCommit:x=>c({...s,rightLabel:x})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(me,{text:m?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:N,onSelect:()=>n?.("prompt"),onCommit:x=>F?.({compareDifferencesLabel:x})})}),Array.from({length:3}).map((x,f)=>t.jsx("span",{className:"ws-compare-line"},f))]})]}),(s.type==="short_answer"||s.type==="tic_tac_toe")&&m?.rubric&&t.jsxs("div",{className:"ws-rubric",children:[t.jsx("strong",{children:r?"معيار النجاح:":"Success criterion:"}),t.jsx(Ie,{text:m.rubric,fallbackDirection:r?"rtl":"ltr"})]})]})]})}function Dt({item:e,ar:s,labels:r}){const{question:o,questionLabel:l,text:a,continuation:i}=e;return t.jsxs("div",{className:"ws-q ws-answer","data-answer-continuation":i||void 0,children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num",children:l}),t.jsx("div",{className:"ws-q-prompt-wrap",children:t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(Ie,{text:o.type==="matching"?s?"أزواج التوصيل":"Matching pairs":o.prompt,fallbackDirection:s?"rtl":"ltr"}),i&&t.jsxs("span",{className:"ws-answer-cont-label",children:[" (",s?"تابع":"continued",")"]})]})})]}),t.jsxs("div",{className:"ws-answer-line",children:[t.jsx("strong",{children:i?s?"تابع الإجابة:":"Answer continued:":r.correct})," ",t.jsx(Ie,{text:a,fallbackDirection:s?"rtl":"ltr"})]})]})}const Ir=["أ","ب","ج","د","هـ","و","ز","ح","ط","ي"];function Ee(e,s){return s?Ir[e]??String(e+1):String.fromCharCode(65+e)}function Tt(e,s,r=16){return Math.max(0,e-(s-r))}function Qt(e,s,r){if(e.type===s)return e;const o={id:e.id,prompt:e.prompt??"",...e.points!==void 0?{points:e.points}:{}},l=e.type==="mcq"?e.options[e.correctIndex]??"":e.type==="true_false"?e.correct?r?"صح":"True":r?"خطأ":"False":e.type==="short_answer"||e.type==="fill_blank"||e.type==="worked_problem"||e.type==="extended_response"?e.answer??"":e.type==="error_correction"?e.correction:"";if(s==="true_false")return{...o,type:s,correct:!0};if(s==="short_answer")return{...o,type:s,lines:2,answer:l};if(s==="fill_blank")return{...o,type:s,answer:l};if(s==="worked_problem")return{...o,type:s,steps:4,answer:l};if(s==="extended_response")return{...o,type:s,lines:6,answer:l};if(s==="error_correction")return{...o,type:s,incorrectText:o.prompt,correction:l,explanation:""};if(s==="word_bank")return{...o,type:s,items:[],answers:[]};if(s==="compare")return{...o,type:s,leftLabel:r?"العنصر الأول":"Item A",rightLabel:r?"العنصر الثاني":"Item B",similarities:"",differences:""};if(s==="mcq"){const m=e.type==="matching"?e.pairs.map(n=>n.right).filter(Boolean).slice(0,4):[];for(;m.length<4;)m.push(r?`الخيار ${m.length+1}`:`Option ${m.length+1}`);return{...o,type:s,options:m,correctIndex:0}}if(s==="tic_tac_toe")return{...o,type:s,prompt:r?"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا، ونفّذ المهام.":"Choose three connected squares horizontally, vertically, or diagonally, and complete the tasks.",cells:(r?["تذكّر","فسّر","طبّق","قارن","ارسم","اكتب","حلّل","أنشئ","تحدَّ"]:["Recall","Explain","Apply","Compare","Draw","Write","Analyze","Create","Challenge"]).map(n=>({category:n,text:""}))};const a=e.type==="mcq"?e.options:[],i=Array.from({length:Math.max(3,Math.min(4,a.length))},(m,n)=>({left:r?`العبارة ${n+1}`:`Item ${n+1}`,right:a[n]||(r?`الإجابة ${n+1}`:`Answer ${n+1}`)}));return{...o,type:s,pairs:i}}function Kt(e){const s=Array.from({length:e},(l,a)=>a);let r=e*2654435761>>>0;const o=()=>{r|=0,r=r+1831565813|0;let l=Math.imul(r^r>>>15,1|r);return l=l+Math.imul(l^l>>>7,61|l)^l,((l^l>>>14)>>>0)/4294967296};for(let l=e-1;l>0;l--){const a=Math.floor(o()*(l+1)),i=s[l];s[l]=s[a],s[a]=i}return e>1&&s.every((l,a)=>l===a)&&([s[0],s[1]]=[s[1],s[0]]),s}function Vt(e){const s=i=>{if(i.length===0)return 1;const m=i.map(p=>p.trim().length);return m.reduce((p,g)=>p+g,0)/m.length+Math.max(...m)*.5},r=s(e.map(i=>i.left)),o=s(e.map(i=>i.right)),l=r/(r+o),a=Math.round(Math.min(.65,Math.max(.35,l))*100)/100;return{left:a,right:Math.round((1-a)*100)/100}}function Er({fontFamily:e,headingFont:s,fontSizePt:r,lang:o,themeColor:l}){const a=o==="ar",i=a?"right":"left",m=a?"left":"right",n=l;return t.jsx("style",{children:`
      /* High-quality Arabic + Latin fonts, including elegant heading
         faces (Reem Kufi, Amiri) used for the title and section labels. */
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${e}; }
      @media screen {
        .print-host[data-responsive-preview] {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow-x: clip;
        }
        .print-host[data-responsive-preview] > .ws-page {
          zoom: var(--ws-preview-scale, 1);
          flex-shrink: 0;
        }
      }
      @media screen and (max-width: 640px) {
        .ws-action-toolbar {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          gap: 8px;
          padding: 10px 12px;
        }
        .ws-action-toolbar > .ws-actions {
          grid-column: 1 / -1;
          justify-content: flex-start;
          gap: 6px;
          min-width: 0;
        }
        .ws-action-toolbar button {
          min-height: 40px;
          justify-content: center;
        }
        .ws-actions > button {
          flex: 1 1 auto;
          padding: 8px 10px;
          white-space: nowrap;
        }
        .ws-edit-tools {
          max-width: calc(100vw - 32px);
          box-sizing: border-box;
          flex-wrap: wrap;
          justify-content: center;
          border-radius: 16px !important;
          bottom: max(16px, env(safe-area-inset-bottom)) !important;
        }
      }
      .ws-page {
        position: relative;
        box-sizing: border-box;
        width: 210mm;
        min-height: 297mm;
        background: white;
        margin: 0 auto 18px auto;
        box-shadow: 0 6px 28px rgba(34,87,57,0.12);
        color: #1a2421;
        font-size: ${r}pt;
        line-height: 1.85;
        page-break-after: always;
        break-after: page;
        break-inside: avoid;
        overflow: visible;
        border-radius: 4px;
      }
      .ws-page:last-of-type {
        page-break-after: auto;
        break-after: auto;
        margin-bottom: 0;
      }
      .ws-content {
        position: relative;
        z-index: 1;
        box-sizing: border-box;
        padding: 18mm 18mm 16mm 18mm;
        display: flex;
        flex-direction: column;
        /* Include the 34mm vertical padding inside the A4 height. Without
           border-box Chromium fragments every worksheet article and can
           repeat the first-looking fragment in Save as PDF. */
        min-height: calc(297mm - var(--ws-frame, 0px));
      }

      /* Faint Hasaad watermark behind content. */
      .ws-watermark {
        position: absolute; inset: 0; z-index: 0;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none; overflow: hidden;
      }
      .ws-watermark-word {
        font-family: ${s};
        font-weight: 800;
        font-size: 112pt;
        color: ${n};
        opacity: 0.022;
        transform: rotate(-16deg);
        white-space: nowrap;
        letter-spacing: ${a?"0":"0.035em"};
        user-select: none;
      }

      /* Decorative gold corner ornaments. */
      .ws-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${I};
        z-index: 0; pointer-events: none;
      }
      .ws-corner-tl { top: 8mm; left: 8mm; border-right: 0; border-bottom: 0; border-top-left-radius: 6px; }
      .ws-corner-tr { top: 8mm; right: 8mm; border-left: 0; border-bottom: 0; border-top-right-radius: 6px; }
      .ws-corner-bl { bottom: 8mm; left: 8mm; border-right: 0; border-top: 0; border-bottom-left-radius: 6px; }
      .ws-corner-br { bottom: 8mm; right: 8mm; border-left: 0; border-top: 0; border-bottom-right-radius: 6px; }

      /* ── Header layout ───────────────────────────────────────────
         Three fixed columns: identity (right) | title (center) | logo (left).
         Both side columns are the same width so the title is always truly
         centered and the logo sits exactly opposite the identity text. */
      .ws-header { margin-bottom: 6mm; }
      .ws-headrow {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 5mm;
      }
      .ws-headstart {
        flex: 0 0 52mm;
        display: flex; flex-direction: column; gap: 3mm;
        font-size: ${Math.max(9,r-1.5)}pt;
      }
      .ws-headend {
        flex: 0 0 52mm;
        display: flex;
        align-items: flex-start;
        justify-content: center;
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
        color: ${n};
        background: ${n}10;
        padding: 3px 12px;
        border-radius: 999px;
        letter-spacing: 0.02em;
        margin-top: 2mm;
      }

      .ws-title {
        font-family: ${s};
        font-size: ${r+12}pt;
        font-weight: 800;
        color: ${n};
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
        width: 64%; height: 2px; background: ${I};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${n} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${n}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${I} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${n}0d 0%, ${I}10 100%);
        border-${i}: 3px solid ${n};
        padding: 5px 10px;
        border-radius: 4px;
      }
      .ws-school-icon {
        display: inline-flex; align-items: center; justify-content: center;
        color: ${n};
        flex: 0 0 auto;
      }
      .ws-school-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
      .ws-school-label {
        font-weight: 700;
        color: ${n};
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
        border-bottom: 1px dashed ${n}55;
        padding: 4px 4px 6px;
      }
      .ws-field-icon { color: ${n}; flex: 0 0 auto; display: inline-flex; }
      .ws-field-label { font-weight: 700; color: ${n}; white-space: nowrap; flex: 0 0 auto; }
      .ws-field-rule { flex: 1; height: 14px; }

      .ws-instructions {
        display: flex; gap: 8px; align-items: flex-start;
        background: linear-gradient(135deg, ${I}1a 0%, ${I}08 100%);
        border-${i}: 4px solid ${I};
        padding: 8px 12px;
        font-size: ${Math.max(9,r-1)}pt;
        margin-top: 4mm;
        border-radius: 4px;
        line-height: 1.6;
      }
      .ws-instructions strong { color: ${n}; margin-${m}: 4px; }
      .ws-learning-objective {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 3mm;
        padding: 2.2mm 3mm;
        border: 0.35mm solid ${n}33;
        border-radius: 2.2mm;
        background: ${n}0D;
        font-size: 9.5pt;
      }
      .ws-learning-objective strong { color: ${n}; white-space: nowrap; }
      .ws-learning-objective small {
        margin-${i}: auto;
        white-space: nowrap;
        color: #566;
        font-weight: 700;
      }
      .ws-rubric {
        display: flex;
        gap: 1.5mm;
        margin-top: 2mm;
        padding: 1.5mm 2mm;
        border-${i}: 0.9mm solid ${n};
        background: ${n}0D;
        font-size: 8.5pt;
        line-height: 1.45;
      }
      .ws-rubric strong { color: ${n}; white-space: nowrap; }

      /* Questions */
      .ws-questions {
        column-gap: 8mm;
        flex: 1;
      }
      .ws-q {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 5mm;
        padding: 2.5mm 0 3mm;
        border-bottom: 1px solid ${n}18;
        background: transparent;
        border-radius: 0;
      }
      .ws-question-block {
        break-inside: avoid;
        page-break-inside: avoid;
        margin-bottom: 5mm;
      }
      .ws-question-block > .ws-q { margin-bottom: 0; }
      .ws-question-block.ws-q-spacing-compact {
        margin-bottom: 2mm;
      }
      .ws-question-block.ws-q-spacing-compact > .ws-q {
        padding-top: 1.5mm;
        padding-bottom: 1.5mm;
      }
      .ws-question-block.ws-q-spacing-relaxed {
        margin-bottom: 9mm;
      }
      .ws-question-block.ws-q-spacing-relaxed > .ws-q {
        padding-top: 4mm;
        padding-bottom: 5mm;
      }
      .ws-q-editable {
        cursor: pointer;
        border-radius: 8px;
        transition: outline-color 120ms ease, background-color 120ms ease;
      }
      .ws-q-editable:hover { background: ${n}08; outline: 1px dashed ${n}55; }
      .ws-q-selected {
        background: ${n}0d;
        outline: 2px solid ${n};
        outline-offset: 3px;
      }
      .ws-q-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 3mm; }
      .ws-q-num {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px;
        background: white;
        color: ${n};
        border: 1.5px solid ${n};
        border-radius: 2px;
        font-weight: 800;
        font-size: ${Math.max(9.5,r-1)}pt;
        font-family: ${s};
        box-shadow: none;
      }
      .ws-q-prompt-wrap { flex: 1; min-width: 0; }
      /* Section instruction — shown once before the first question of each type group */
      .ws-section-instr {
        font-size: ${Math.max(9,r-1.5)}pt;
        font-weight: 700;
        color: ${n};
        border-${i}: 3px solid ${n};
        padding: 2mm 4mm;
        margin: 3mm 0 2mm;
        background: ${n}08;
        border-radius: 0 4px 4px 0;
        break-inside: avoid;
      }
      /* Points badge — still shown per-question when points are assigned */
      .ws-q-typeline { display: flex; align-items: center; gap: 8px; margin-bottom: 1mm; }
      .ws-q-points {
        font-size: ${Math.max(7.5,r-3.5)}pt;
        font-weight: 800;
        color: ${I};
        background: ${I}18;
        padding: 1.5px 7px;
        border-radius: 999px;
      }
      .ws-q-prompt { font-weight: 600; color: #1a2421; line-height: 1.7; }

      /* ── Inline text editing ────────────────────────────────── */
      .ws-editable {
        outline: none;
        cursor: text;
        border-radius: 3px;
        transition: background 0.12s, box-shadow 0.12s;
        white-space: pre-wrap;
        word-break: break-word;
        display: inline;
        background: rgba(217, 165, 33, 0.10);
        box-shadow: 0 0 0 1.5px rgba(217, 165, 33, 0.35);
        padding: 0 2px;
      }
      .ws-editable:hover {
        background: rgba(217, 165, 33, 0.18);
        box-shadow: 0 0 0 2px rgba(217, 165, 33, 0.5);
      }
      .ws-editable:focus {
        background: white;
        box-shadow: 0 0 0 2px #D9A521, 0 2px 8px rgba(217, 165, 33, 0.25);
      }
      @media print { .ws-editable { background: none !important; box-shadow: none !important; } }

      .ws-mcq { list-style: none; padding-${i}: 34px; margin: 2mm 0 0; display: grid; grid-template-columns: 1fr; gap: 2mm 16px; }
      .ws-mcq li {
        display: flex; gap: 8px; align-items: baseline;
        line-height: 1.6;
        min-height: 6mm;
        border-bottom: 1px dotted ${n}24;
        padding-bottom: 1mm;
      }
      .ws-mcq-letter {
        display: inline-block;
        min-width: 24px;
        font-weight: 700;
        color: ${n};
        font-family: ${s};
      }
      .ws-mcq-text { flex: 1; }

      .ws-tf-mark {
        display: inline-block;
        direction: ltr;
        white-space: nowrap;
        min-width: 17mm;
        margin-inline-start: 2mm;
        font-family: Arial, sans-serif;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .ws-tf-choices {
        display: flex;
        align-items: center;
        gap: 14mm;
        padding-${i}: 34px;
        margin-top: 2mm;
      }
      .ws-tf-choice {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-weight: 700;
      }
      .ws-tf-box {
        display: inline-block;
        width: 15px;
        height: 15px;
        border: 1.5px solid ${n};
        border-radius: 2px;
        background: white;
      }

      .ws-lines { padding-${i}: 36px; margin-top: 2mm; }
      .ws-line {
        display: block;
        border-bottom: 1px dotted ${n}66;
        height: 8mm;
      }
      .ws-response-label {
        color: ${n};
        font-weight: 800;
        font-size: ${Math.max(8.5,r-2)}pt;
        margin-bottom: 1mm;
      }
      .ws-worked-problem, .ws-extended-response, .ws-error-correction,
      .ws-compare-organizer {
        margin-top: 2mm;
        margin-inline-start: 9mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .ws-work-steps { display: flex; flex-direction: column; gap: 1mm; }
      .ws-work-step { display: flex; align-items: flex-end; gap: 2mm; min-height: 7mm; }
      .ws-work-step-num {
        color: ${n}; font-weight: 700; font-size: 8pt;
        width: 5mm; flex: 0 0 5mm; text-align: center;
      }
      .ws-work-step-line, .ws-final-answer > span, .ws-word-bank-blank {
        flex: 1; min-width: 12mm; border-bottom: 0.3mm dotted ${n}77;
      }
      .ws-final-answer {
        display: flex; align-items: flex-end; gap: 3mm;
        margin-top: 3mm; padding: 2mm 3mm;
        border: 0.4mm solid ${n}; border-radius: 1.5mm;
      }
      .ws-final-answer strong { color: ${n}; white-space: nowrap; }
      .ws-extended-response { display: flex; flex-direction: column; }
      .ws-incorrect-box {
        padding: 2.5mm 3mm; border: 0.35mm solid #9f3434;
        border-inline-start-width: 1mm; background: #fff8f7;
        display: flex; gap: 2mm; align-items: baseline;
      }
      .ws-incorrect-box strong { color: #8b2e2e; white-space: nowrap; }
      .ws-correction-area, .ws-explanation-area { margin-top: 2.5mm; }
      .ws-word-bank {
        border: 0.4mm solid ${n}; border-radius: 2mm;
        padding: 2mm 3mm; text-align: center; background: ${n}08;
        margin: 2mm 0 3mm;
        margin-inline-start: 9mm;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .ws-word-bank > strong { display: block; color: ${n}; font-size: 8.5pt; margin-bottom: 1mm; }
      .ws-word-bank > div { display: flex; flex-wrap: wrap; justify-content: center; gap: 1mm 4mm; }
      .ws-word-bank > div > span { white-space: nowrap; font-weight: 700; }
      .ws-compare-organizer {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .8fr) minmax(0, 1fr);
        border: 0.4mm solid ${n}; border-radius: 2mm; overflow: hidden;
      }
      .ws-compare-panel {
        min-width: 0; min-height: 35mm; padding: 3mm;
        display: flex; flex-direction: column; gap: 2mm;
        border-inline-end: 0.3mm solid ${n}66;
      }
      .ws-compare-panel:last-child { border-inline-end: 0; }
      .ws-compare-panel > strong { color: ${n}; text-align: center; line-height: 1.35; }
      .ws-compare-similarities { background: ${n}0A; }
      .ws-compare-subtitle { color: #5a6663; font-size: 8pt; text-align: center; }
      .ws-compare-line { display: block; flex: 1 1 6mm; min-height: 5mm; border-bottom: 0.25mm dotted ${n}66; }

      .ws-fill { padding-${i}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${n};
      }

      .ws-match {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6mm minmax(0, 1fr);
        gap: 6mm;
        padding-${i}: 36px;
        margin-top: 3mm;
        align-items: stretch;
      }
      .ws-match-col {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: 2.5mm;
      }
      .ws-match-col li {
        display: flex; align-items: baseline; gap: 7px;
        background: transparent;
        border: 0;
        border-bottom: 1px dotted ${n}33;
        border-radius: 0;
        padding: 3px 2px 5px;
        font-weight: 500;
        min-height: 7mm;
      }
      .ws-match-bullet {
        display: inline-flex; align-items: center; justify-content: flex-start;
        min-width: 22px;
        font-weight: 700;
        font-family: ${s};
        font-size: ${Math.max(9,r-1.5)}pt;
        flex: 0 0 auto;
      }
      .ws-match-num { background: transparent; color: ${n}; }
      .ws-match-letter { background: transparent; color: ${n}; }
      .ws-match-text { flex: 1; }
      .ws-tic-board {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        border: 0.5mm solid ${n};
        border-radius: 3mm;
        overflow: hidden;
        margin-top: 3mm;
        break-inside: avoid;
      }
      .ws-tic-cell {
        position: relative;
        min-height: 55mm;
        padding: 7mm 4mm 3.5mm;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 2.5mm;
        text-align: start;
        border-inline-end: 0.3mm solid color-mix(in srgb, ${n} 45%, transparent);
        border-bottom: 0.3mm solid color-mix(in srgb, ${n} 45%, transparent);
      }
      .ws-tic-cell:nth-child(3n) { border-inline-end: 0; }
      .ws-tic-cell:nth-child(n+7) { border-bottom: 0; }
      .ws-tic-check {
        position: absolute;
        top: 2.5mm;
        inset-inline-start: 2.5mm;
        width: 4mm;
        height: 4mm;
        border: 0.35mm solid ${n};
        border-radius: 1mm;
      }
      .ws-tic-image {
        width: 100%;
        max-height: 22mm;
        object-fit: contain;
        border-radius: 1.5mm;
      }
      .ws-tic-text {
        font-size: 9.5pt;
        line-height: 1.65;
        font-weight: 700;
        text-wrap: pretty;
      }
      .ws-tic-writing {
        display: flex;
        flex: 1 1 auto;
        min-height: 17mm;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6mm;
        margin-top: auto;
      }
      .ws-tic-writing > span {
        display: block;
        height: 0;
        border-bottom: 0.25mm dotted ${n}66;
      }
      .ws-match-tab { flex: 0 0 0; }
      .ws-match-divider {
        background: ${n}22;
        width: 1px;
        margin: 0 auto;
        position: relative;
      }
      .ws-match-divider.is-editable {
        width: 6mm;
        background: transparent;
        cursor: col-resize;
        touch-action: none;
      }
      .ws-match-divider.is-editable::before {
        content: "";
        position: absolute;
        inset-block: 0;
        left: 50%;
        width: 2px;
        transform: translateX(-50%);
        background: ${n};
      }
      .ws-match-divider-handle {
        position: sticky;
        top: 50%;
        transform: translate(-50%, -50%);
        left: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 7px;
        background: ${n};
        color: white;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(20,40,32,0.25);
        font-size: 12px;
        font-weight: 900;
      }

      .ws-format-toolbar {
        position: fixed;
        left: 50%;
        bottom: 68px;
        transform: translateX(-50%);
        z-index: 50;
        width: min(760px, calc(100vw - 24px));
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 7px 12px;
        padding: 9px 12px;
        background: linear-gradient(135deg, #edf7f2 0%, #f7fbf9 100%);
        color: #22312c;
        border: 2px solid ${n};
        border-radius: 14px;
        box-shadow: 0 12px 34px rgba(20,40,32,0.28);
        font-family: ${s};
      }
      .ws-format-selection {
        flex: 0 0 auto;
        padding: 6px 10px;
        border-radius: 8px;
        background: ${n};
        color: white;
        font-size: 11px;
        font-weight: 800;
        white-space: nowrap;
      }
      .ws-format-group {
        display: flex; align-items: center; gap: 5px; flex-wrap: wrap; justify-content: center;
        padding: 5px 7px;
        background: rgba(255,255,255,0.82);
        border: 1px solid ${n}24;
        border-radius: 9px;
      }
      .ws-format-label { font-size: 10px; font-weight: 800; color: ${n}; margin-inline: 2px; }
      .ws-format-toolbar button {
        min-width: 30px; height: 30px;
        border: 1px solid ${n}28;
        border-radius: 7px;
        background: white;
        color: ${n};
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
      }
      .ws-format-toolbar button:hover, .ws-format-toolbar button.is-active {
        background: ${n};
        color: white;
        border-color: ${n};
      }
      .ws-format-toolbar button:focus-visible,
      .ws-format-toolbar input:focus-visible,
      .ws-format-toolbar select:focus-visible {
        outline: 3px solid ${I};
        outline-offset: 2px;
      }
      .ws-format-toolbar button svg { width: 14px; height: 14px; }
      .ws-format-text-btn { padding-inline: 8px; }
      .ws-format-value { min-width: 22px; text-align: center; font-size: 11px; font-weight: 800; }
      .ws-format-range { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: ${n}; }
      .ws-format-range input { width: 86px; accent-color: ${n}; }
      .ws-format-type { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: ${n}; }
      .ws-format-control { flex: 0 0 auto; white-space: nowrap; }
      .ws-format-type select, .ws-format-type input {
        height: 30px;
        max-width: 155px;
        border: 1px solid ${n}38;
        border-radius: 7px;
        background: white;
        color: ${n};
        padding-inline: 8px;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
      }
      @media (max-width: 640px) {
        .ws-format-toolbar {
          bottom: max(8px, env(safe-area-inset-bottom));
          width: calc(100vw - 16px);
          max-height: min(42vh, 250px);
          justify-content: flex-start;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 8px;
          gap: 6px;
        }
        .ws-format-group {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          justify-content: flex-start;
          flex-wrap: wrap;
          overflow-x: visible;
          padding: 3px 2px;
          gap: 6px;
        }
        .ws-format-toolbar button {
          min-width: 38px;
          height: 38px;
          flex: 0 0 auto;
        }
        .ws-format-text-btn {
          min-width: 0 !important;
          max-width: 100%;
          height: auto !important;
          min-height: 38px;
          white-space: normal;
          padding-block: 6px;
        }
        .ws-format-type { min-width: 0; max-width: 100%; flex-wrap: wrap; }
        .ws-format-control { max-width: 100%; white-space: normal; }
        .ws-format-toolbar-open {
          padding-bottom: min(46vh, 270px) !important;
        }
        .ws-editable { scroll-margin-bottom: min(46vh, 270px); }
      }

      /* Footer strip — brand line removed per teacher request; only the
         "good luck" cheer and optional teacher footer note remain. */
      .ws-footer {
        margin-top: auto;
        padding-top: 6mm;
        border-top: 1px dashed ${n}44;
        text-align: center;
        font-size: ${Math.max(8,r-2.5)}pt;
        color: #6a7370;
      }
      .ws-footer-cheer {
        font-family: ${s};
        font-weight: 700;
        color: ${I};
        font-size: ${Math.max(9.5,r-1)}pt;
        margin-bottom: 2mm;
        letter-spacing: 0.02em;
      }
      .ws-footer-note {
        color: #555;
        font-style: italic;
      }

      /* Continuation header — slim bar on pages 2+ */
      .ws-cont-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3mm 0 4mm;
        margin-bottom: 4mm;
        border-bottom: 2px solid ${n}22;
      }
      .ws-cont-title {
        font-family: ${s};
        font-weight: 800;
        font-size: ${Math.max(10,r)}pt;
        color: ${n};
      }
      .ws-cont-page {
        font-size: ${Math.max(8,r-2)}pt;
        font-weight: 700;
        color: ${n}88;
        background: ${n}0d;
        padding: 2px 8px;
        border-radius: 999px;
      }

      /* School logo — sits in ws-headend, which mirrors ws-headstart width */
      .ws-logo-img {
        max-height: 22mm; max-width: 44mm;
        width: auto; height: auto;
        object-fit: contain;
        display: block;
      }

      /* Answer key tweaks */
      .ws-answer { margin-bottom: 4mm; padding: 3mm 4mm; }
      .ws-answer .ws-q-num { background: ${I}; box-shadow: 0 0 0 2px ${n}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${i}: 36px;
        color: ${n};
        font-size: ${Math.max(9.5,r-.5)}pt;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .ws-answer-line strong { color: ${I}; margin-${m}: 4px; }
      .ws-answer-cont-label { color: ${n}88; font-size: 0.9em; }

      /* ── Page layout panel (no-print) ─────────────────────────── */
      .ws-layout-panel {
        position: sticky;
        top: 0;
        z-index: 30;
        background: #f8f9f8;
        border-bottom: 1px solid;
        padding: 10px 16px 12px;
        font-family: ${s};
      }
      .ws-layout-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .ws-layout-thumbs {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .ws-layout-thumb {
        flex: 0 0 auto;
        min-width: 140px;
        max-width: 200px;
        border: 2px solid;
        border-radius: 8px;
        padding: 8px;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .ws-layout-thumb-badge {
        color: white;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 999px;
        display: inline-block;
        margin-bottom: 7px;
        letter-spacing: 0.03em;
      }
      .ws-layout-thumb-qs {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ws-layout-chip {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 6px 3px 4px;
        border-radius: 6px;
        border: 1px solid;
        font-size: 11px;
        cursor: grab;
        user-select: none;
        transition: opacity 0.15s;
      }
      .ws-layout-chip:active { cursor: grabbing; }
      .ws-layout-chip-num {
        color: white;
        font-weight: 800;
        font-size: 10px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ws-layout-chip-icon {
        font-size: 10px;
        color: #888;
        flex-shrink: 0;
      }
      .ws-layout-chip-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10.5px;
        color: #333;
      }
      .ws-layout-break-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        padding: 0 2px;
        line-height: 1;
        flex-shrink: 0;
        opacity: 0.6;
        transition: opacity 0.12s;
      }
      .ws-layout-break-btn:hover { opacity: 1; }
      .ws-layout-drop-hint {
        border: 2px dashed;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 700;
        text-align: center;
        padding: 4px;
        letter-spacing: 0.03em;
      }

      /* ── Break-before overlay button (appears on each question
           in the printed view when the panel is open) ────────── */
      .ws-q-wrapper { position: relative; }
      .ws-break-btn {
        position: absolute;
        top: -1px;
        ${a?"right":"left"}: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px 2px 5px;
        border-radius: 0 0 6px 0;
        border: 1px solid currentColor;
        background: white;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s;
        font-family: ${s};
        white-space: nowrap;
      }
      .ws-q-wrapper:hover .ws-break-btn { opacity: 0.9; }
      .ws-break-btn:hover { opacity: 1 !important; }

      /* ── Panel toggle floating button ────────────────────────── */
      .ws-panel-toggle {
        position: fixed;
        bottom: 20px;
        ${a?"left":"right"}: 20px;
        z-index: 35;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        padding: 8px 14px;
        border-radius: 999px;
        border: 2px solid;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        transition: background 0.15s, color 0.15s;
        font-family: ${s};
      }
      .ws-panel-toggle-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #f59e0b;
        flex-shrink: 0;
      }

      @media print {
        @page { size: A4; margin: 0; }
        html, body, #root {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
        }
        .no-print { display: none !important; }
        .print-host {
          background: white !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: auto !important;
          display: block !important;
          width: 100% !important;
        }
        .ws-page {
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          width: 210mm !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          page-break-after: always !important;
          break-after: page !important;
          break-inside: avoid !important;
        }
        .ws-page:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        /* عند الطباعة نترك بضع بكسلات احتياطاً — أي صفحة يتجاوز ارتفاعها
           297mm ولو بكسراً واحداً تنقسم في PDF إلى صفحة + شريحة مكررة. */
        .ws-content {
          box-sizing: border-box !important;
          min-height: calc(297mm - var(--ws-frame, 0px) - 10px) !important;
        }
        /* Core base elements */
        .ws-watermark, .ws-watermark-word,
        .ws-corner, .ws-q, .ws-instructions, .ws-school-cell,
        .ws-q-num, .ws-q-typebadge, .ws-q-points,
        .ws-match-bullet, .ws-divider-thick, .ws-divider-thin,
        .ws-kicker-center,
        /* Theme-specific colored elements */
        .ws-band-top, .ws-play-banner, .ws-tab-sub, .ws-tab-header,
        .ws-clip-badge, .ws-clip-badge-sec,
        .ws-arb-diamond, .ws-arb-diamond-sm,
        .ws-mast-rule-thick, .ws-mast-rule-mid,
        .ws-exam-header {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `})}function Mr({worksheetId:e,page:s,total:r,ar:o}){const l=`${window.location.origin}/teacher/worksheets/${e}/grade?p=${s}&of=${r}`;return t.jsxs("div",{style:{position:"absolute",bottom:"6mm",insetInlineStart:"8mm",display:"flex",alignItems:"center",gap:"2mm",zIndex:5},children:[t.jsx("div",{style:{background:"white",padding:"1mm",border:"0.4mm solid #d4d4d4",borderRadius:"1mm",lineHeight:0},children:t.jsx(Ds,{value:l,size:52,style:{width:"13mm",height:"13mm"}})}),t.jsxs("div",{style:{fontSize:"7pt",color:"#8a8a8a",lineHeight:1.5,fontWeight:600},children:[t.jsx("div",{children:o?"امسح للتصحيح الذكي":"Scan to grade"}),r>1&&t.jsx("div",{style:{fontWeight:800,color:"#5a5a5a"},children:o?`صفحة ${s} / ${r}`:`Page ${s} / ${r}`})]})]})}function Yt(e,s,r){return e.map((o,l)=>({id:`${o.id}:answer`,question:o,questionLabel:String(l+1),text:Gt(o,s,r),continuation:!1}))}function zr(e){if(e.text.length<2)return null;const s=Math.floor(e.text.length/2),r=e.text.lastIndexOf(" ",s),o=e.text.indexOf(" ",s),l=r>s*.6?r:o>0?o:s,a=e.text.slice(0,l).trimEnd(),i=e.text.slice(l).trimStart();return!a||!i?null:[{...e,id:`${e.id}:a`,text:a},{...e,id:`${e.id}:b`,text:i,continuation:!0}]}function Gt(e,s,r){if(e.type==="mcq")return`(${Ee(e.correctIndex,s)}) ${e.options[e.correctIndex]??""}`;if(e.type==="true_false")return e.correct?r.true:r.false;if(e.type==="short_answer")return e.answer?.trim()||"—";if(e.type==="fill_blank")return e.answer;if(e.type==="worked_problem"||e.type==="extended_response")return e.answer?.trim()||"—";if(e.type==="error_correction"){const l=e.correction.trim()||"—",a=e.explanation?.trim();return a?`${s?"التصحيح:":"Correction:"} ${l} — ${s?"التفسير:":"Explanation:"} ${a}`:`${s?"التصحيح:":"Correction:"} ${l}`}if(e.type==="word_bank")return e.items.map((l,a)=>{const i=e.answers[a];return`${a+1}. ${i?.trim()||"—"}`}).join("    ");if(e.type==="compare"){const l=e.similarities,a=e.differences;return[l?.trim()?`${s?"أوجه التشابه:":"Similarities:"} ${l.trim()}`:"",a?.trim()?`${s?"أوجه الاختلاف:":"Differences:"} ${a.trim()}`:""].filter(Boolean).join(" — ")||"—"}if(e.type==="tic_tac_toe")return s?"تُقيّم المهام الثلاث المتصلة التي اختارها الطالب":"Grade the three connected tasks selected by the student";const o=Kt(e.pairs.length);return e.pairs.map((l,a)=>{const i=o.indexOf(a);return`${a+1} ← ${Ee(i>=0?i:a,s)}`}).join("    ")}const nn=Object.freeze(Object.defineProperty({__proto__:null,QuestionFormattingToolbar:Ut,WorksheetPrintView:Ot,answerText:Gt,buildAnswerItems:Yt,convertQuestionType:Qt,default:fr,matchingColumnFractions:Vt,mobileToolbarScrollOffset:Tt,optionLabel:Ee},Symbol.toStringTag,{value:"Module"}));export{sr as W,sn as a,Ot as b,tn as g,rn as s,nn as w};
