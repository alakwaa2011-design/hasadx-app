import{j as t,r as u,v as ft,k as $e,X as bs,aM as ys,u as js,b as vs,aC as ks,L as Ze,R as zt}from"./index-5YP9hbMV.js";import{P as $s,F as Ns,b as _s,S as As,I as Ss,T as Cs,V as Ls,c as Es,H as Ms,e as zs,p as Is,a as Fs,d as Bs}from"./print-export-zvDJfLGb.js";import{D as Rs,a as Ds,b as Ps,c as It}from"./dropdown-menu-D2W9xm6E.js";import{r as Hs}from"./image-url-Cm2t2lLM.js";import{I as Ws}from"./image-pA3_Wt0Q.js";import{F as qs}from"./file-text-B5-QlUvu.js";import{B as Os,a as Ft,T as Us}from"./text-align-end-CHiKh07H.js";import{S as Qs}from"./settings-COpbfYj2.js";import{a as Fe}from"./math-text-BnIRl-bM.js";import{c as Ks}from"./content-direction-DAlRqWnC.js";import{Q as Ts}from"./index-YU5nrgKL.js";import{A as Vs}from"./arrow-left-DMohGsnU.js";import{C as Ys}from"./camera-DOtD0C9F.js";import{P as bt}from"./pen-line-CcGVDddz.js";import{S as Gs}from"./save-Dd6PTIl7.js";import{F as Xs}from"./file-type-CGm1W4t2.js";import{D as Js}from"./download-BwhWZjaD.js";import{M as Zs}from"./minus-D58pwX9S.js";import{T as Bt}from"./text-align-start-r2YUGPvl.js";function Re(e){if(!e)return e;const s="/";try{const r=new URL(e,window.location.href);if(r.origin!==window.location.origin)return e;if(r.pathname===`${s}images/logo-hasaad.png`)return`${s}images/logo-hasaad-transparent.png`;if([`${s}images/logo-icon.png`,`${s}images/logo-mark.png`].includes(r.pathname))return`${s}images/logo-mark-transparent.png`}catch{return e}return e}const yt={geometric:{id:"geometric",nameAr:"هندسي",nameEn:"Geometric",description:"هيكل منظم، شبكة، وأرقام مربعة — للرياضيات والفيزياء",headerLayout:"tabular",defaultColor:"#1B2D6B",swatchColors:["#1B2D6B","#E07B20"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){return`
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
          border-${a}: 0;
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
          text-align: ${i?"left":"right"};
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
      `}},arabic_ink:{id:"arabic_ink",nameAr:"خط عربي",nameEn:"Arabic Ink",description:"أناقة كلاسيكية، خلفية كريمية، زخارف عربية",headerLayout:"arabesque",defaultColor:"#1B4D3E",swatchColors:["#1B4D3E","#C9972A"],headingFontOverride:"'Amiri', 'Scheherazade New', 'Cairo', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:i,isAr:a,startSide:o}){return`
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
          border-${o}: 3.5px solid ${s};
          background: none;
          border-radius: 0;
          padding: 3mm ${a?"12px":"4mm"} 4mm ${a?"4mm":"12px"};
          margin-bottom: 6mm;
        }
        /* Circle badge in teal */
        .ws-theme-arabic_ink .ws-q-num { background: ${e}; box-shadow: 0 0 0 2px ${s}55; }
        /* Larger question text for Arabic readability */
        .ws-theme-arabic_ink .ws-q-prompt {
          font-size: ${i+.5}pt;
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
          background: linear-gradient(to ${a?"left":"right"}, transparent, ${s}, transparent);
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
          font-size: ${i+13}pt;
          font-weight: 700;
          color: ${e};
          line-height: 1.3;
          letter-spacing: 0.03em;
          margin: 2mm 0;
        }
        .ws-arb-kicker {
          font-size: ${Math.max(9,i-1)}pt;
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
          font-size: ${Math.max(8.5,i-2)}pt;
          font-weight: 600;
          color: ${e};
        }
        .ws-arb-cell-label { color: ${e}88; font-weight: 500; }
        .ws-cont-header { border-bottom-color: ${s}55; }
      `}},modern_band:{id:"modern_band",nameAr:"شريط عصري",nameEn:"Modern Band",description:"شريط لوني علوي، بطاقات بيضاء، تصميم ناشر حديث",headerLayout:"band",defaultColor:"#1D4ED8",swatchColors:["#1D4ED8","#ffffff"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){return`
        .ws-theme-modern_band.ws-page {
          background: white;
          border-radius: 4px;
        }
        .ws-theme-modern_band .ws-content { padding: 0 0 13mm; }
        /* No corner ornaments */
        .ws-theme-modern_band .ws-corner { display: none; }
        /* Questions: floating card style */
        .ws-theme-modern_band .ws-q {
          border-${a}: 0;
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
          transform: skewX(${i?"":"-"}15deg) translateX(${i?"-":""}10mm);
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
          border-${a}: 4px solid ${e};
          padding: 6px 10px;
          font-size: ${Math.max(9,r-1)}pt;
          border-radius: 4px;
        }
        .ws-band-instr strong { color: ${e}; margin-${a==="right"?"left":"right"}: 4px; }
        .ws-questions-band { padding: 0 18mm; }
        .ws-theme-modern_band .ws-questions { column-gap: 6mm; }
        .ws-theme-modern_band .ws-footer { padding: 5mm 18mm 0; border-top: 1px solid ${e}22; }
        .ws-theme-modern_band .ws-cont-header { margin: 0 18mm 4mm; }
      `}},exam_paper:{id:"exam_paper",nameAr:"ورقة امتحان",nameEn:"Exam Paper",description:"رسمي، جدول منظم، أسلوب امتحانات وزارية",headerLayout:"tabular",defaultColor:"#1A1A1A",swatchColors:["#1A1A1A","#888888"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){return`
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
          border-${a}: 0;
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
          text-align: ${i?"left":"right"};
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
      `}},kids_play:{id:"kids_play",nameAr:"مرح الأطفال",nameEn:"Kids Play",description:"ألوان زاهية، حروف كبيرة، مرح وودود للمراحل الأولى",headerLayout:"playful",defaultColor:"#E84393",swatchColors:["#E84393","#FFC107"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){const o="#2196F3",l="#4CAF50";return`
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
          border-${a}: 0;
          border-radius: 12px;
          border: 2.5px solid ${e}33;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
          box-shadow: 0 2px 6px ${e}14;
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+1) { border-color: ${e}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) { border-color: ${o}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) { border-color: ${l}44; }
        /* Very large circle number badges */
        .ws-theme-kids_play .ws-q-num {
          width: 32px; height: 32px;
          border-radius: 50%;
          box-shadow: none;
          font-size: ${Math.max(12,r+1)}pt;
          background: ${e};
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) .ws-q-num { background: ${o}; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) .ws-q-num { background: ${l}; }
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
      `}},science_lab:{id:"science_lab",nameAr:"مختبر علوم",nameEn:"Science Lab",description:"ورق مربعات خفيف، شارة المادة، أسلوب مفكرة العالم",headerLayout:"clipboard",defaultColor:"#0A6B6B",swatchColors:["#0A6B6B","#4FC3F7"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){return`
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
          border-${a}: 4mm solid ${e};
          box-shadow: 0 3px 14px ${e}18;
        }
        .ws-theme-science_lab .ws-content { padding: 14mm 16mm 13mm; }
        .ws-theme-science_lab .ws-corner { display: none; }
        .ws-theme-science_lab .ws-watermark-word { opacity: 0.018; }
        /* Lab-notebook question boxes */
        .ws-theme-science_lab .ws-q {
          border-${a}: 0;
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
      `}},editorial:{id:"editorial",nameAr:"أسلوب تحريري",nameEn:"Editorial",description:"رأسية صحفية، خط سيريف، لإسلاميات والأدب والتاريخ",headerLayout:"masthead",defaultColor:"#4A1042",swatchColors:["#4A1042","#C8952A"],headingFontOverride:"'Amiri', 'Georgia', 'Times New Roman', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:i,isAr:a,startSide:o}){return`
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
          border-${o}: 0;
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
          font-size: ${i+5}pt;
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
          font-size: ${i+.5}pt;
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
          font-size: ${i+13}pt;
          font-weight: 700;
          color: ${e};
          margin: 0 0 2mm;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
        .ws-mast-meta {
          font-size: ${Math.max(9,i-1)}pt;
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
          font-size: ${Math.max(8.5,i-2)}pt;
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
      `}}},Tt="ws_last_theme";function dn(){try{return localStorage.getItem(Tt)??null}catch{return null}}function mn(e){try{localStorage.setItem(Tt,e)}catch{}}function pn(e,s,r,i,a){const o=(e??"").trim().toLowerCase(),l=(s??"").trim().toLowerCase();if(/روض|kg|kind|التمهيد|kinder|grade 1\b|1st grade|first grade|الأول الابتدائي|الصف الأول/.test(l))return"kids_play";const m=[[/رياض|math|حساب|جبر|هندس|algebra|geometry|trigon|calculus|statistics/,"geometric"],[/فيزياء|physics/,"science_lab"],[/علوم|science|biology|chemistry|أحياء|كيمياء|بيولوجيا|biolog|chem|lab/,"science_lab"],[/اللغة العربية|عرب|arabic lang|لغة عرب|نحو|إملاء|صرف|بلاغ/,"arabic_ink"],[/إسلام|دين|قرآن|تلاوة|فقه|حديث|سيرة|Islamic|religion|quran|fiqh|hadith|seerah/,"editorial"],[/english|اللغة الإنجليزية|لغة إنجليزية|grammar|vocabulary|reading/,"modern_band"],[/تاريخ|جغرافيا|اجتماع|وطني|history|geography|social stud|civics/,"editorial"],[/أدب|literature|poetry|قصة|رواية|شعر|نثر/,"editorial"],[/تقنية|حاسوب|حاسب|technology|computer|ict/,"modern_band"]];for(const[v,b]of m)if(v.test(o))return b===a?{geometric:"science_lab",science_lab:"geometric",arabic_ink:"editorial",editorial:"arabic_ink",modern_band:"exam_paper",exam_paper:"modern_band",kids_play:"modern_band"}[b]:b;if(/ثانو|secondary|high school|grade 1[0-2]|10th|11th|12th|عاشر|الحادي عشر|الثاني عشر/.test(l)){const b=["exam_paper","editorial","modern_band"].filter(_=>_!==a);return b[i%b.length]}const p=["geometric","modern_band","editorial","exam_paper","science_lab"].filter(v=>v!==a);return p[i%p.length]}const er={geometric:"white",arabic_ink:"#FDFAF4",modern_band:"white",exam_paper:"white",kids_play:"#FFFBF0",science_lab:"white",editorial:"#FDF8F5"};function tr({data:e,labels:s,TC:r,ar:i,hasIdentity:a,customFields:o}){const l=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),m=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...o.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-tab-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"3mm",justifyContent:i?"flex-end":"flex-start"},children:t.jsx("img",{src:Re(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsxs("div",{className:"ws-tab-toprow",children:[t.jsx("div",{className:"",style:{textAlign:i?"right":"left"},children:m.map((n,p)=>t.jsx("div",{className:"ws-tab-school",children:n},p))}),t.jsx("h1",{className:"ws-tab-title",lang:e.language,children:e.title}),t.jsx("div",{className:"ws-tab-meta",children:l&&t.jsx("div",{children:l})})]}),t.jsx("div",{className:"ws-tab-inner-rule"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsx(sr,{data:e,labels:s,TC:r}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#555",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`4px solid ${r}`,fontSize:"90%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function sr({data:e,labels:s,TC:r}){const i=[e.settings.includeName&&{label:s.name,flex:2},e.settings.includeClass&&{label:s.clazz,flex:1},e.settings.includeDate&&{label:s.date,flex:1}].filter(Boolean);return t.jsx("div",{style:{display:"grid",gridTemplateColumns:i.map(a=>`${a.flex}fr`).join(" "),gap:"5mm",marginTop:"3mm"},children:i.map((a,o)=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${r}55`,paddingBottom:"3mm",fontWeight:700,color:r,fontSize:"90%"},children:[a.label,t.jsx("span",{style:{flex:1}})]},o))})}function rr({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:l}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName&&{label:s.school,value:e.settings.schoolName},e.settings.teacherName&&{label:s.teacher,value:e.settings.teacherName},e.settings.section&&{label:s.section,value:e.settings.section},...l.map(p=>({label:p.label.trim(),value:p.value}))].filter(Boolean);return t.jsxs("div",{className:"ws-arb-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"4mm"},children:t.jsx("img",{src:Re(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsx(Rt,{GOLD:i}),m&&t.jsx("div",{className:"ws-arb-kicker",children:m}),t.jsx("h1",{className:"ws-arb-title",lang:e.language,children:e.title}),t.jsx(Rt,{GOLD:i}),n.length>0&&t.jsx("div",{className:"ws-arb-identity",children:n.map((p,v)=>t.jsxs("div",{className:"ws-arb-cell",children:[t.jsxs("span",{className:"ws-arb-cell-label",children:[p.label,":"]}),t.jsx("span",{children:p.value})]},v))}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"5mm",marginTop:"4mm"},children:[e.settings.includeName&&t.jsx(lt,{label:s.name,TC:r,GOLD:i}),e.settings.includeClass&&t.jsx(lt,{label:s.clazz,TC:r,GOLD:i}),e.settings.includeDate&&t.jsx(lt,{label:s.date,TC:r,GOLD:i})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#6a5c3a",margin:"3mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${i}12`,borderInlineStart:`4px solid ${i}`,fontSize:"90%",lineHeight:1.7,borderRadius:"4px"},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function Rt({GOLD:e}){return t.jsxs("div",{className:"ws-arb-ornament",children:[t.jsx("div",{className:"ws-arb-ornament-line"}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-diamond",style:{background:e}}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-ornament-line"})]})}function lt({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px dashed ${r}88`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function nr({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:l}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...l.map(p=>`${p.label}: ${p.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-band-header",children:[t.jsxs("div",{className:"ws-band-top",children:[e.settings.logoUrl&&t.jsx("div",{style:{position:"absolute",top:"4mm",[a?"left":"right"]:"16mm"},children:t.jsx("img",{src:Re(e.settings.logoUrl),alt:"",style:{height:"12mm",width:"auto",objectFit:"contain",filter:"brightness(10)"}})}),n.length>0&&t.jsx("div",{className:"ws-band-chips",children:n.map((p,v)=>t.jsx("span",{className:"ws-band-chip",children:p},v))}),t.jsx("h1",{className:"ws-band-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-band-sub",children:m})]}),t.jsxs("div",{className:"ws-band-body",children:[(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-band-fields",children:[e.settings.includeName&&t.jsx(ct,{label:s.name,TC:r,flex:2}),e.settings.includeClass&&t.jsx(ct,{label:s.clazz,TC:r,flex:1}),e.settings.includeDate&&t.jsx(ct,{label:s.date,TC:r,flex:1})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"90%",color:"#555",margin:"0 0 3mm",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{className:"ws-band-instr",children:[t.jsxs("strong",{children:[s.instructions,":"]})," ",e.settings.instructions]})]})]})}function ct({label:e,TC:s,flex:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%",flex:r},children:[e,t.jsx("span",{style:{flex:1}})]})}function ir({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:l}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName,e.settings.section,...l.map(p=>p.value)].filter(Boolean);return t.jsxs("div",{className:"ws-play-header",children:[t.jsxs("div",{className:"ws-play-banner",children:[t.jsx("div",{className:"ws-play-stars",children:"★ ☆ ★"}),t.jsx("h1",{className:"ws-play-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-play-sub",children:m}),n.length>0&&t.jsx("div",{className:"ws-play-chips",children:n.map((p,v)=>t.jsx("span",{className:"ws-play-chip",children:p},v))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-play-fields",children:[e.settings.includeName&&t.jsx(dt,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(dt,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(dt,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontWeight:700,color:r,margin:"2mm 0",fontSize:"105%"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{background:`${r}12`,borderRadius:"10px",padding:"6px 12px",fontSize:"95%",fontWeight:700,color:r,marginBottom:"4mm"},children:["⭐ ",e.settings.instructions]})]})}function dt({label:e,TC:s}){return t.jsxs("div",{className:"ws-play-field",children:[e,t.jsx("span",{className:"ws-play-field-rule"})]})}function or({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:l}){[e.subject,e.gradeLevel].filter(Boolean).join(" · ");const m=[e.settings.schoolName&&`${s.school}: ${e.settings.schoolName}`,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...l.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-clip-header",children:[t.jsxs("div",{className:"ws-clip-badges",children:[e.settings.logoUrl&&t.jsx("img",{src:Re(e.settings.logoUrl),alt:"",style:{height:"10mm",width:"auto",objectFit:"contain"}}),e.subject&&t.jsx("span",{className:"ws-clip-badge",children:e.subject}),e.gradeLevel&&t.jsx("span",{className:"ws-clip-badge-sec",children:e.gradeLevel})]}),t.jsxs("div",{className:"ws-clip-title-row",children:[t.jsx("h1",{className:"ws-clip-title",lang:e.language,children:e.title}),m.length>0&&t.jsx("div",{className:"ws-clip-identity",children:m.map((n,p)=>t.jsx("div",{className:"ws-clip-id-row",children:n},p))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-clip-fields",children:[e.settings.includeName&&t.jsx(mt,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(mt,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(mt,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"88%",color:"#4a7a7a",margin:"2mm 0 0"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"4px 9px",background:`${r}08`,border:`1.5px solid ${r}33`,borderRadius:"3px",fontSize:"88%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function mt({label:e,TC:s}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}55`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function ar({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:l}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...l.map(p=>`${p.label}: ${p.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-mast-header",children:[t.jsx("div",{className:"ws-mast-rule-thick"}),t.jsx("div",{className:"ws-mast-rule-mid"}),e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{margin:"2mm auto"},children:t.jsx("img",{src:Re(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsx("h1",{className:"ws-mast-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-mast-meta",children:m}),n.length>0&&t.jsx("div",{className:"ws-mast-identity",children:n.map((p,v)=>t.jsx("span",{children:p},v))}),t.jsx("div",{className:"ws-mast-rule-thin"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-mast-fields",children:[e.settings.includeName&&t.jsx(pt,{label:s.name,TC:r,GOLD:i}),e.settings.includeClass&&t.jsx(pt,{label:s.clazz,TC:r,GOLD:i}),e.settings.includeDate&&t.jsx(pt,{label:s.date,TC:r,GOLD:i})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"88%",color:"#6a4a5a",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`3px solid ${i}`,fontSize:"88%",lineHeight:1.7},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function pt({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function lr(e,s){return e?yt[e]?.headingFontOverride??s:s}const cr=["display","position","top","right","bottom","left","box-sizing","width","height","min-width","min-height","max-width","max-height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","border-top","border-right","border-bottom","border-left","border-radius","background-color","background-image","background-size","background-position","background-repeat","background-clip","color","opacity","visibility","font-family","font-size","font-weight","font-style","font-variant","line-height","letter-spacing","word-spacing","text-align","text-indent","text-decoration","text-transform","text-shadow","white-space","word-break","overflow-wrap","direction","unicode-bidi","vertical-align","writing-mode","transform","transform-origin","z-index","overflow-x","overflow-y","clip-path","box-shadow","filter","mix-blend-mode","flex-direction","flex-wrap","flex-grow","flex-shrink","flex-basis","align-items","align-self","align-content","justify-content","order","gap","grid-template-columns","grid-template-rows","grid-column","grid-row","column-count","column-width","column-gap","column-fill","column-rule","list-style-type","list-style-position","object-fit","object-position","fill","fill-opacity","stroke","stroke-width","stroke-linecap","stroke-linejoin"];function Dt(e){return cr.map(s=>{const r=e.getPropertyValue(s);return r?`${s}:${r};`:""}).join("")}function dr(e){const s=e.cloneNode(!0),r=[];let i=0;const a=(o,l)=>{if(o.matches(".no-print, script, iframe, object, embed, link")){l.remove();return}const m=`ws-export-${i++}`;l.setAttribute("data-ws-export-node",m),l.setAttribute("style",Dt(getComputedStyle(o))),l.removeAttribute("contenteditable"),l.removeAttribute("autofocus"),Array.from(l.attributes).forEach(p=>{/^on/i.test(p.name)&&l.removeAttribute(p.name)});for(const p of["::before","::after"]){const v=getComputedStyle(o,p),b=v.getPropertyValue("content");b&&b!=="none"&&b!=="normal"&&r.push(`[data-ws-export-node="${m}"]${p}{${Dt(v)}content:${b};}`)}l instanceof HTMLElement&&(o.matches(".ws-editable")&&(l.style.backgroundColor="transparent",l.style.boxShadow="none",l.style.outline="none"),o.matches(".ws-q-selected")&&(l.style.backgroundColor="transparent",l.style.outline="none"));const n=Array.from(l.children);Array.from(o.children).forEach((p,v)=>a(p,n[v]))};if(a(e,s),s.style.setProperty("zoom","1"),s.style.margin="0",s.style.boxShadow="none",s.style.width=`${e.offsetWidth||210/25.4*96}px`,s.style.height="auto",r.length){const o=document.createElement("style");o.textContent=r.join(`
`),s.appendChild(o)}return s}const Vt="[data-worksheet-page], [data-answer-key-page]",Pt=11906,Ht=16838;class Z extends Error{constructor(s){super(`Visual Word export failed: ${s}`),this.code=s}}function mr(e,s,r="ar"){if(!e.length)throw new Z("pages");return new Ns({creator:"Hasad",title:s,description:r==="ar"?"نسخة مطابقة بصريًا؛ صفحات مصورة غير قابلة لتحرير النص":"Visual copy; page images, not editable text",sections:e.map((i,a)=>{const o=Math.min(Pt/15/i.width,Ht/15/i.height);return{properties:{type:As.NEXT_PAGE,page:{size:{width:Pt,height:Ht},margin:{top:0,bottom:0,left:0,right:0,header:0,footer:0}}},children:[new _s({spacing:{before:0,after:0,line:20},children:[new Ss({type:"png",data:i.data,transformation:{width:i.width*o,height:i.height*o},altText:{name:`Worksheet page ${a+1}`,title:`${s} — ${a+1}`,description:r==="ar"?"صفحة مصورة للحفاظ على التصميم":"Page image preserving the design"},floating:{horizontalPosition:{relative:zs.PAGE,align:Ms.CENTER},verticalPosition:{relative:Es.PAGE,align:Ls.TOP},wrap:{type:Cs.NONE},allowOverlap:!0,behindDocument:!1}})]})]}})})}function pr(e){return new Promise((s,r)=>{const i=new FileReader;i.onload=()=>s(String(i.result)),i.onerror=()=>r(new Z("image")),i.readAsDataURL(e)})}async function hr(e,s){const r=Array.from(e.querySelectorAll("img")).filter(o=>!o.closest(".no-print")),i=Array.from(s.querySelectorAll("img")),a=new Map;await Promise.all(r.map(async(o,l)=>{const m=o.currentSrc||o.src;if(!m||!i[l])throw new Z("image");a.has(m)||a.set(m,(async()=>{try{const p=await fetch(m,{credentials:"same-origin",signal:AbortSignal.timeout(2e4)});if(!p.ok)throw new Z("image");return await pr(await p.blob())}catch{throw new Z("image")}})());const n=i[l];n.removeAttribute("srcset"),n.removeAttribute("crossorigin"),n.loading="eager",n.src=await a.get(m),typeof n.decode=="function"&&await n.decode().catch(()=>{throw new Z("image")})}))}async function ur(e){if("fonts"in document){let i;try{await Promise.race([document.fonts.ready.catch(()=>{}),new Promise(a=>{i=setTimeout(a,8e3)})])}finally{clearTimeout(i)}}let s="",r=0;for(let i=0;i<20&&r<3;i+=1){await new Promise(o=>requestAnimationFrame(()=>o()));const a=Array.from(e.querySelectorAll(Vt)).map(o=>`${o.scrollHeight}:${o.textContent?.length}`).join("|");r=a===s?r+1:0,s=a}}async function gr(e){await Promise.all(Array.from(e.querySelectorAll("img")).filter(s=>!s.closest(".no-print")).map(s=>new Promise((r,i)=>{const a=s.getAttribute("loading"),o=p=>{clearTimeout(n),s.removeEventListener("load",l),s.removeEventListener("error",m),a===null?s.removeAttribute("loading"):s.setAttribute("loading",a),p?i(new Z("image")):r()},l=()=>o(!1),m=()=>o(!0),n=setTimeout(m,2e4);s.addEventListener("load",l,{once:!0}),s.addEventListener("error",m,{once:!0}),s.loading="eager",s.complete&&o(s.naturalWidth===0)})))}async function xr(e,s,r){if(!Number.isSafeInteger(s)||s<=0)throw new Z("pages");await gr(e),await ur(e);try{const i=Array.from(e.querySelectorAll(Vt));if(!i.length)throw new Z("pages");const a=i.map(dr);await Promise.all(i.map((l,m)=>hr(l,a[m])));const o=[];for(const[l,m]of a.entries()){const n=i[l].offsetWidth||793.7007874015749,p=i[l].offsetHeight||297/25.4*96,v=await fetch(`/api/worksheets/${s}/render-page`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(9e4),body:JSON.stringify({html:m.outerHTML,width:n,height:p})});if(v.status===429)throw new Z("busy");if(!v.ok||!v.headers.get("content-type")?.includes("image/png"))throw new Z("capture");o.push({data:new Uint8Array(await v.arrayBuffer()),width:n,height:p}),r?.(l+1,a.length)}return o}catch(i){throw i instanceof Z?i:new Z("capture")}}async function wr(e){const s=await xr(e.element,e.worksheetId,e.onProgress),r=await $s.toBlob(mr(s,e.title,e.lang)),i=e.title.replace(/[\\/:*?"<>|\x00-\x1f]+/g,"-").trim().slice(0,80)||"worksheet",a=URL.createObjectURL(r),o=document.createElement("a");o.href=a,o.download=`${i} - ${e.lang==="en"?"Visual design":"مطابق للتصميم"}.docx`,document.body.appendChild(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(a),1500)}const Yt=210/25.4*96;function fr(e,s=Yt){return e<=0||s<=0?1:Math.min(1,e/s)}function br(){const e=u.useRef(null);return u.useLayoutEffect(()=>{const s=e.current;if(!s)return;const r=()=>{const a=getComputedStyle(s),o=s.clientWidth-(parseFloat(a.paddingLeft)||0)-(parseFloat(a.paddingRight)||0),l=s.querySelector(":scope > .ws-page"),m=fr(o,l?.offsetWidth||Yt),n=String(m);s.style.getPropertyValue("--ws-preview-scale")!==n&&s.style.setProperty("--ws-preview-scale",n),s.style.setProperty("--ws-fit-inv-scale",String(1/m))};r();const i=typeof ResizeObserver=="function"?new ResizeObserver(r):null;return i?.observe(s),window.addEventListener("resize",r),()=>{i?.disconnect(),window.removeEventListener("resize",r)}},[]),e}const ht="#225739";function yr({layout:e}){return e?.elements?.length?t.jsx(t.Fragment,{children:e.elements.map(s=>{const r={position:"absolute",left:`${s.x}%`,top:`${s.y}%`,width:`${s.width}%`,height:s.kind==="line"?`${s.strokeWidth??2}px`:`${s.height}%`,pointerEvents:"none",boxSizing:"border-box",zIndex:2,opacity:s.opacity??1};return s.kind==="text"?t.jsx("div",{style:{...r,fontSize:`${s.fontSize??14}pt`,fontWeight:s.bold?800:400,fontStyle:s.italic?"italic":"normal",color:s.fontColor??"#1a2421",textAlign:s.align??"right",padding:"2px 4px",whiteSpace:"pre-wrap",wordBreak:"break-word",overflow:"hidden"},children:s.text??""},s.id):s.kind==="rect"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??ht}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:`${s.borderRadius??2}px`,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="circle"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??ht}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:"50%",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="line"?t.jsx("div",{style:{...r,background:s.strokeColor??ht,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):null})}):null}const ut=6,jr=[{color:"#225739",label:"أخضر حصاد"},{color:"#1a3a6b",label:"أزرق رسمي"},{color:"#5C2D0E",label:"بني دافئ"},{color:"#4a1a6b",label:"أرجواني"},{color:"#1A1A2E",label:"أسود راقٍ"},{color:"#7b1a1a",label:"أحمر"}],me="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";function ne({label:e,children:s,className:r}){return t.jsxs("label",{className:`block ${r??""}`,children:[t.jsx("span",{className:"block text-[11px] font-bold mb-1 text-muted-foreground",children:e}),s]})}function Ue({label:e,value:s,onChange:r,testId:i}){return t.jsx("button",{type:"button",role:"switch","aria-checked":!!s,"data-testid":i,onClick:()=>r(!s),className:`px-3 h-8 rounded-full border text-xs font-bold transition-colors ${s?"bg-primary text-primary-foreground border-primary":"bg-background text-muted-foreground hover:bg-muted"}`,children:e})}function vr({ar:e,settings:s,onSettingsChange:r,meta:i,onMetaChange:a,onClearProfile:o,showProfileNote:l,readOnly:m,gradeSuggestions:n}){const[p,v]=u.useState(null),b=c=>r(j=>({...j,...c})),_=s.customFields??[],U=!!(s.schoolName||s.section||s.teacherName||s.logoUrl||_.length),y=[{id:"info",label:e?"بيانات الورقة":"Details",icon:t.jsx(qs,{className:"w-3.5 h-3.5"})},{id:"header",label:e?"الترويسة":"Header",icon:t.jsx(Os,{className:"w-3.5 h-3.5"})},{id:"design",label:e?"التصميم":"Design",icon:t.jsx(Qs,{className:"w-3.5 h-3.5"})}];return t.jsxs("fieldset",{disabled:m,className:"min-w-0 border-0 p-0 m-0","data-testid":"panel-worksheet-format",children:[t.jsx("div",{role:"tablist",className:`flex gap-1 p-1 bg-muted/50 rounded-lg w-full sm:w-auto sm:inline-flex ${p?"mb-3":""}`,children:y.map(c=>t.jsxs("button",{role:"tab",type:"button","aria-selected":p===c.id,"aria-expanded":p===c.id,"data-testid":`tab-format-${c.id}`,onClick:()=>v(j=>j===c.id?null:c.id),className:`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${p===c.id?"bg-background shadow-sm text-primary":"text-muted-foreground"}`,children:[c.icon,c.label]},c.id))}),p==="info"&&t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[t.jsx(ne,{label:e?"عنوان الورقة":"Title",className:"sm:col-span-3",children:t.jsx("input",{"data-testid":"input-ws-title",value:i.title,maxLength:200,onChange:c=>a({title:c.target.value}),className:me})}),t.jsx(ne,{label:e?"المادة":"Subject",className:"sm:col-span-2",children:t.jsx("input",{"data-testid":"input-ws-subject",value:i.subject,maxLength:100,onChange:c=>a({subject:c.target.value}),className:me})}),t.jsx(ne,{label:e?"الصف":"Grade",children:t.jsx("input",{"data-testid":"input-ws-grade",list:n?.length?"ws-grade-suggestions":void 0,value:i.gradeLevel,maxLength:100,onChange:c=>a({gradeLevel:c.target.value}),className:me})}),n?.length?t.jsx("datalist",{id:"ws-grade-suggestions",children:n.map(c=>t.jsx("option",{value:c},c))}):null]}),p==="header"&&t.jsxs("div",{className:"space-y-4",children:[t.jsxs("div",{className:"flex items-center justify-between gap-2",children:[t.jsx("p",{className:"text-[11px] text-muted-foreground",children:l?e?"تُحفظ تلقائياً لكل أوراقك القادمة":"Saved automatically for future sheets":""}),o&&U&&t.jsx("button",{type:"button",onClick:o,className:"text-[11px] font-bold text-destructive hover:underline",children:e?"مسح المحفوظ":"Clear saved"})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[t.jsx(ne,{label:e?"اسم المدرسة":"School name",children:t.jsx("input",{"data-testid":"input-ws-school",value:s.schoolName??"",maxLength:200,onChange:c=>b({schoolName:c.target.value}),className:me})}),t.jsx(ne,{label:e?"اسم المعلم":"Teacher",children:t.jsx("input",{"data-testid":"input-ws-teacher",value:s.teacherName??"",maxLength:100,onChange:c=>b({teacherName:c.target.value}),className:me})}),t.jsx(ne,{label:e?"القسم":"Department",className:"sm:col-span-2",children:t.jsx("input",{"data-testid":"input-ws-section",value:s.section??"",maxLength:100,onChange:c=>b({section:c.target.value}),className:me})})]}),t.jsxs("div",{className:"pt-2 border-t border-border/50",children:[t.jsxs("div",{className:"flex items-center justify-between mb-2",children:[t.jsx("span",{className:"text-[11px] font-bold",children:e?"حقول إضافية (اختياري)":"Extra fields"}),t.jsxs("button",{type:"button","data-testid":"button-add-custom-field",onClick:()=>{if(_.length>=ut){$e.error(e?`الحد الأقصى ${ut} حقول`:`Max ${ut} fields`);return}b({customFields:[..._,{label:"",value:""}]})},className:"text-[11px] font-bold px-2 py-1 rounded bg-muted hover:bg-muted/80 flex items-center gap-1",children:[t.jsx(ft,{className:"w-3 h-3"})," ",e?"إضافة":"Add"]})]}),_.length===0?t.jsx("p",{className:"text-[11px] text-muted-foreground",children:e?"مثال: العام الدراسي، الدرجة، الفصل…":"e.g., Academic Year, Marks, Term…"}):t.jsx("div",{className:"space-y-2",children:_.map((c,j)=>t.jsxs("div",{className:"flex gap-2 items-center",children:[t.jsx("input",{"aria-label":e?"اسم الحقل":"Label",value:c.label,maxLength:40,placeholder:e?"اسم الحقل":"Label",onChange:R=>b({customFields:_.map((I,D)=>D===j?{...I,label:R.target.value}:I)}),className:"w-1/3 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"}),t.jsx("input",{"aria-label":e?"القيمة":"Value",value:c.value,maxLength:120,placeholder:e?"القيمة":"Value",onChange:R=>b({customFields:_.map((I,D)=>D===j?{...I,value:R.target.value}:I)}),className:"flex-1 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"}),t.jsx("button",{type:"button","aria-label":e?"حذف الحقل":"Remove field",onClick:()=>b({customFields:_.filter((R,I)=>I!==j)}),className:"p-1 rounded text-destructive hover:bg-destructive/10",children:t.jsx(bs,{className:"w-4 h-4"})})]},j))})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[t.jsx(ne,{label:e?"ملاحظة الترويسة":"Header note",children:t.jsx("input",{"data-testid":"input-ws-header-note",value:s.headerNote??"",maxLength:300,onChange:c=>b({headerNote:c.target.value}),className:me})}),t.jsx(ne,{label:e?"ملاحظة التذييل":"Footer note",children:t.jsx("input",{"data-testid":"input-ws-footer-note",value:s.footerNote??"",maxLength:300,onChange:c=>b({footerNote:c.target.value}),className:me})})]}),t.jsx(ne,{label:e?"تعليمات الطالب":"Instructions",children:t.jsx("textarea",{"data-testid":"input-ws-instructions",rows:2,value:s.instructions??"",onChange:c=>b({instructions:c.target.value}),className:"w-full p-2 rounded-lg border bg-background text-sm outline-none focus:border-primary"})}),t.jsx(ne,{label:e?"جملة الختام":"Closing line",children:t.jsx("input",{"data-testid":"input-ws-goodluck",value:s.goodLuck??"",maxLength:200,placeholder:e?"نتمنى لك التوفيق (الافتراضي)":"Good luck! (default)",onChange:c=>b({goodLuck:c.target.value}),className:me})}),t.jsxs("div",{className:"flex flex-wrap gap-2 pt-2 border-t border-border/50",children:[t.jsx(Ue,{testId:"toggle-ws-name",label:e?"الاسم":"Name",value:s.includeName,onChange:c=>b({includeName:c})}),t.jsx(Ue,{testId:"toggle-ws-date",label:e?"التاريخ":"Date",value:s.includeDate,onChange:c=>b({includeDate:c})}),t.jsx(Ue,{testId:"toggle-ws-class",label:e?"الصف":"Class",value:s.includeClass,onChange:c=>b({includeClass:c})}),t.jsx(Ue,{testId:"toggle-ws-answers",label:e?"ورقة الإجابات":"Answer key",value:s.includeAnswerKey,onChange:c=>b({includeAnswerKey:c})}),t.jsx(Ue,{testId:"toggle-ws-watermark",label:e?"علامة مائية":"Watermark",value:s.showWatermark,onChange:c=>b({showWatermark:c})})]})]}),p==="design"&&t.jsxs("div",{className:"space-y-5",children:[t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-2 text-muted-foreground",children:e?"القالب المرئي":"Visual template"}),t.jsxs("div",{className:"grid grid-cols-4 sm:grid-cols-7 gap-2",children:[t.jsx("button",{type:"button","aria-pressed":!s.template,"data-testid":"theme-classic",onClick:()=>b({template:void 0}),className:`p-1.5 rounded-lg border-2 ${s.template?"border-transparent hover:bg-muted":"border-primary bg-primary/5"}`,children:t.jsx("div",{className:"h-8 rounded flex items-center justify-center border border-dashed border-primary/40 bg-background text-[9px] font-bold text-primary",children:e?"كلاسيك":"Classic"})}),Object.values(yt).map(c=>{const j=s.template===c.id,[R]=c.swatchColors;return t.jsxs("button",{type:"button","aria-pressed":j,"data-testid":`theme-${c.id}`,title:e?`${c.nameAr}: ${c.description}`:c.nameEn,onClick:()=>b({template:j?void 0:c.id}),className:"p-1.5 rounded-lg border-2 transition-colors",style:{borderColor:j?R:"transparent",background:j?`${R}10`:void 0},children:[t.jsxs("div",{className:"h-8 rounded overflow-hidden shadow-sm",style:{background:R},children:[t.jsx("div",{className:"h-[40%]",style:{background:R}}),t.jsx("div",{className:"h-[60%] bg-white",children:t.jsx("div",{className:"mx-1 mt-0.5 h-px",style:{background:`${R}44`}})})]}),t.jsx("span",{className:"block mt-1 text-[9px] font-bold truncate",children:e?c.nameAr:c.nameEn})]},c.id)})]})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[t.jsx(ne,{label:e?"الأعمدة":"Columns",children:t.jsx("div",{className:"flex gap-1",role:"group",children:[1,2].map(c=>t.jsx("button",{type:"button","aria-pressed":s.columns===c,"data-testid":`columns-${c}`,onClick:()=>b({columns:c}),className:`flex-1 h-9 rounded-lg border text-sm font-bold ${s.columns===c?"bg-primary text-primary-foreground border-primary":"bg-background"}`,children:c},c))})}),t.jsx(ne,{label:e?"نوع الخط":"Font",children:t.jsxs("select",{"data-testid":"select-ws-font",value:s.fontFamily,onChange:c=>b({fontFamily:c.target.value}),className:me,children:[t.jsx("option",{value:"default",children:e?"افتراضي":"Default"}),t.jsx("option",{value:"cairo",children:"Cairo"}),t.jsx("option",{value:"tajawal",children:"Tajawal"}),t.jsx("option",{value:"amiri",children:"Amiri"}),t.jsx("option",{value:"noto-naskh",children:"Noto Naskh"}),t.jsx("option",{value:"inter",children:"Inter"}),t.jsx("option",{value:"georgia",children:"Georgia"})]})}),t.jsx(ne,{label:e?`حجم الخط (${s.fontSizePt}pt)`:`Font size (${s.fontSizePt}pt)`,children:t.jsx("input",{"data-testid":"range-ws-fontsize",type:"range",min:9,max:18,step:1,value:s.fontSizePt,onChange:c=>b({fontSizePt:parseInt(c.target.value,10)}),className:"w-full mt-2"})})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-1.5 text-muted-foreground",children:e?"لون الورقة":"Accent color"}),t.jsxs("div",{className:"flex flex-wrap gap-2 items-center",children:[jr.map(c=>t.jsx("button",{type:"button",title:c.label,"aria-label":c.label,"aria-pressed":s.themeColor===c.color,onClick:()=>b({themeColor:s.themeColor===c.color?void 0:c.color}),className:"w-6 h-6 rounded-full border-2",style:{background:c.color,borderColor:s.themeColor===c.color?"#fff":"transparent",boxShadow:s.themeColor===c.color?`0 0 0 2px ${c.color}`:"none"}},c.color)),t.jsxs("label",{className:"w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer bg-background",title:e?"لون مخصص":"Custom",children:[t.jsx("input",{type:"color",className:"sr-only","aria-label":e?"لون مخصص":"Custom color",value:s.themeColor??"#225739",onChange:c=>b({themeColor:c.target.value})}),t.jsx(ft,{className:"w-3 h-3 text-muted-foreground"})]}),s.themeColor&&t.jsx("button",{type:"button",onClick:()=>b({themeColor:void 0}),className:"text-[11px] text-muted-foreground hover:underline",children:e?"افتراضي":"Reset"})]})]}),t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-1.5 text-muted-foreground",children:e?"الشعار (اختياري)":"Logo"}),s.logoUrl?t.jsxs("div",{className:"flex items-center gap-3",children:[t.jsx("img",{src:s.logoUrl,alt:e?"الشعار":"Logo",className:"h-8 w-auto rounded border object-contain bg-white"}),t.jsx("button",{type:"button",onClick:()=>b({logoUrl:void 0}),className:"text-[11px] text-destructive hover:underline",children:e?"إزالة":"Remove"})]}):t.jsxs("label",{className:"flex items-center justify-center gap-2 cursor-pointer h-8 rounded-lg border border-dashed border-border bg-background hover:bg-muted text-xs text-muted-foreground",children:[t.jsx(Ws,{className:"w-3.5 h-3.5"}),t.jsx("span",{children:e?"رفع صورة (PNG/JPG)":"Upload (PNG/JPG)"}),t.jsx("input",{type:"file",accept:"image/png,image/jpeg,image/webp",className:"sr-only","data-testid":"input-ws-logo",onChange:c=>{const j=c.target.files?.[0];if(c.target.value="",!j)return;if(j.size>500*1024){$e.error(e?"الحجم يجب أن يكون أقل من 500KB":"Under 500KB");return}const R=new FileReader;R.onload=I=>b({logoUrl:I.target?.result}),R.readAsDataURL(j)}})]})]})]})]})]})}const Wt="",te="#225739",P="#D9A521";function kr(e,s){const r="'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif",i="'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";switch(e){case"cairo":return`'Cairo', ${r}`;case"tajawal":return`'Tajawal', ${r}`;case"amiri":return`'Amiri', 'Scheherazade New', ${r}`;case"noto-naskh":return`'Noto Naskh Arabic', ${r}`;case"inter":return`'Inter', ${i}`;case"georgia":return"Georgia, 'Times New Roman', serif";default:return s==="ar"?r:i}}function $r(e){return e==="ar"?"'Cairo', 'Noto Naskh Arabic', 'Tajawal', sans-serif":"'Inter', 'Source Sans Pro', sans-serif"}function qt(e,s,r,i,a,o){if(e.length===0)return[[]];const l=s*.352778*1.85,m=r===2?22:44,n=5,p=y=>{const j=10+Math.max(1,Math.ceil((y.prompt?.length??0)/m))*l;switch(y.type){case"mcq":return j+y.options.filter(Boolean).length*l*1.3;case"true_false":return j+l*1.1;case"short_answer":return j+(y.lines??2)*9;case"fill_blank":return j+3;case"matching":return j+y.pairs.length*l*1.3;case"tic_tac_toe":return Math.max(185,j+165);case"worked_problem":return j+Math.max(4,y.steps??4)*8+12;case"extended_response":return j+Math.max(3,y.lines??6)*8;case"error_correction":return j+16+16+12;case"word_bank":return j+18;case"compare":return j+42}},v=[];let b=[],_=0,U=i;if(r===2)for(let y=0;y<e.length;y+=2){const c=o?.has(e[y].id)||y+1<e.length&&o?.has(e[y+1].id),j=Math.max(p(e[y]),y+1<e.length?p(e[y+1]):0)+n;b.length>0&&(c||_+j>U)&&(v.push(b),b=[],_=0,U=a),b.push(e[y]),y+1<e.length&&b.push(e[y+1]),_+=j}else for(const y of e){const c=o?.has(y.id),j=p(y)+n;b.length>0&&(c||_+j>U)&&(v.push(b),b=[],_=0,U=a),b.push(y),_+=j}return b.length>0&&v.push(b),v.length>0?v:[e]}function Nr({theme:e,TC:s,GOLD:r,BG:i,fontFamily:a,headingFont:o,fontSizePt:l,lang:m}){const n=m==="ar",p=n?"right":"left",v=n?"left":"right";return t.jsx("style",{children:e.css({TC:s,GOLD:r,BG:i,fontFamily:a,headingFont:o,fontSizePt:l,isAr:n,startSide:p,endSide:v})})}function _r({theme:e,data:s,labels:r,TC:i,GOLD:a,ar:o,hasIdentity:l,customFields:m,classicFallback:n}){if(!e)return n;const p={data:s,labels:r,TC:i,GOLD:a,ar:o,hasIdentity:l,customFields:m,IdentityCell:()=>null,FieldLine:()=>null,DoubleDivider:()=>null,IconUser:()=>null,IconClass:()=>null,IconDate:()=>null,IconLightbulb:()=>null,IconSchool:()=>null,IconSection:()=>null,IconTeacher:()=>null,IconField:()=>null};switch(e.headerLayout){case"tabular":return t.jsx(tr,{...p});case"arabesque":return t.jsx(rr,{...p});case"band":return t.jsx(nr,{...p});case"playful":return t.jsx(ir,{...p});case"clipboard":return t.jsx(or,{...p});case"masthead":return t.jsx(ar,{...p});default:return n}}const Ot=[];function Gt({data:e,onLayoutChange:s,onDraftChange:r,flushRef:i,onRequestSave:a,onRequestDiscard:o,onRequestEdit:l,initialEditQuestionId:m}){const n=e.language==="ar",p=n?"rtl":"ltr",v=kr(e.settings.fontFamily,e.language),b=$r(e.language),_=e.settings.template,U=_?yt[_]:void 0,y=_?er[_]??"white":"white",c=lr(_,b),j=Math.min(18,Math.max(9,e.settings.fontSizePt??12)),R=e.settings.showWatermark!==!1,I=e.settings.themeColor??U?.defaultColor??te,D=Re(e.settings.logoUrl),[d,g]=u.useState(e.questions),w=u.useRef(e.questions),[A,H]=u.useState(()=>new Set(e.settings.pageBreaks??[])),W=u.useRef(A),C=u.useCallback(h=>{const f=typeof h=="function"?h(W.current):h;W.current=f,H(f)},[]),xe=u.useRef(r);xe.current=r;const he=u.useCallback(()=>({questions:w.current,pageBreaks:[...W.current],questionStyles:ee.current}),[]),q=u.useCallback(()=>{xe.current?.(he())},[he]);i&&(i.current=()=>{const h=document.activeElement;return h&&h!==document.body&&h.closest("#ws-printable-root")&&h.blur(),he()});const[we,fe]=u.useState(()=>e.settings.questionStyles??[]),ee=u.useRef(e.settings.questionStyles??[]),[F,Y]=u.useState(m&&s?{questionId:m,key:"prompt"}:null),[ue,Qe]=u.useState(()=>{try{return localStorage.getItem("hasad:ws:edit-hint-seen")==="1"}catch{return!0}}),ie=u.useCallback(()=>{Qe(!0);try{localStorage.setItem("hasad:ws:edit-hint-seen","1")}catch{}},[]),be=u.useCallback(h=>{s?(Ce(!0),Y({questionId:h,key:"prompt"}),ie()):l?.(h)},[s,l,ie]),ye=u.useMemo(()=>{const h=new Set;let f=null;for(const k of d)k.type!==f&&(h.add(k.id),f=k.type);return h},[d]),[De,Ne]=u.useState(!1),[Ke,V]=u.useState(!1),[oe,Ce]=u.useState(!!m&&!!s),[je,st]=u.useState(null),[jt,Le]=u.useState(null),Pe=u.useRef(e.questions),x=u.useRef(e.settings.questionStyles??Ot),$=u.useRef((e.settings.pageBreaks??[]).join(","));u.useEffect(()=>{const h=e.settings.questionStyles??Ot,f=(e.settings.pageBreaks??[]).join(",");let k=!1;Pe.current!==e.questions&&(Pe.current=e.questions,e.questions!==w.current&&(w.current=e.questions,g(e.questions),k=!0)),x.current!==h&&(x.current=h,h!==ee.current&&(ee.current=h,fe(h),k=!0)),$.current!==f&&($.current=f,[...W.current].join(",")!==f&&(C(new Set(e.settings.pageBreaks??[])),k=!0)),k&&(Y(null),V(!1))},[e,C]),u.useCallback(h=>{C(f=>{const k=new Set(f);return k.add(h),k}),V(!0),q()},[q,C]),u.useCallback(h=>{C(f=>{const k=new Set(f);return k.delete(h),k}),V(!0),q()},[q,C]),u.useCallback(()=>{if(a){a();return}s?.(w.current,[...W.current],ee.current),V(!1)},[s,a]);const Q=u.useCallback(()=>{if(o){o(),Y(null),V(!1),Ce(!1);return}w.current=e.questions,g(e.questions),C(new Set(e.settings.pageBreaks??[]));const h=e.settings.questionStyles??[];ee.current=h,fe(h),Y(null),V(!1),Ce(!1)},[e,o]),G=u.useCallback(h=>{const f=w.current.map(k=>k.id===h.id?h:k);w.current=f,g(f),C(new Set),V(!0),q()},[q,C]),L=u.useCallback((h,f)=>{const k=ee.current,S=k.find(M=>M.questionId===h)??{questionId:h},B=f(S),N=[...k.filter(M=>M.questionId!==h),B];ee.current=N,fe(N),C(new Set),V(!0),q()},[q,C]),J=u.useCallback((h,f,k)=>{L(h,S=>{const B=S.fields??[],N=B.find(M=>M.key===f)??{key:f};return{...S,fields:[...B.filter(M=>M.key!==f),{...N,...k}]}})},[L]),ve=u.useCallback(()=>{F&&L(F.questionId,h=>({...h,fields:(h.fields??[]).filter(f=>f.key!==F.key)}))},[F,L]);u.useCallback(h=>{if(!je)return;Le(null),st(null);const f=w.current,S=qt(f,j,e.settings.columns,190,250,A)[h];if(!S||S.length===0)return;const B=S[0].id;if(B===je)return;const N=f.find(z=>z.id===je);if(!N)return;const M=f.filter(z=>z.id!==je),K=M.findIndex(z=>z.id===B),T=K===-1?[...M,N]:[...M.slice(0,K),N,...M.slice(K)];w.current=T,g(T),V(!0),q()},[je,j,e.settings.columns,A,q]);const E=n?{name:"الاسم",date:"التاريخ",clazz:"الصف",section:"القسم",school:"المدرسة",teacher:"المعلم",instructions:"تعليمات",answerKey:"صفحة الإجابات",question:"س",true:"صح",false:"خطأ",correct:"الإجابة:",goodLuck:"نتمنى لك التوفيق ✦"}:{name:"Name",date:"Date",clazz:"Class",section:"Section",school:"School",teacher:"Teacher",instructions:"Instructions",answerKey:"Answer Key",question:"Q",true:"True",false:"False",correct:"Answer:",goodLuck:"✦ Good luck!"},He=(e.settings.customFields??[]).filter(h=>(h?.label?.trim()??"")||(h?.value?.trim()??"")),ns=!!e.settings.schoolName||!!e.settings.section||!!e.settings.teacherName||!!D||He.length>0,We=e.settings.columns,[_e,vt]=u.useState(()=>qt(e.questions,j,We,190,250)),Ee=ss(d,n,E),[kt,rt]=u.useState(()=>[Ee]),$t=u.useRef(null),is=br(),Nt=u.useRef(""),[nt,os]=u.useState(0),Te=`${v}|${c}`;u.useEffect(()=>{const h=typeof document<"u"?document.fonts:void 0;if(!h)return;let f=!0;const k=()=>{f&&os(S=>S+1)};return h.ready.then(k).catch(()=>{}),h.addEventListener?.("loadingdone",k),()=>{f=!1,h.removeEventListener?.("loadingdone",k)}},[Te]),u.useLayoutEffect(()=>{const h=[JSON.stringify(d),e.title,e.subject??"",e.gradeLevel??"",We,j,e.settings.schoolName??"",e.settings.section??"",e.settings.teacherName??"",D?"logo":"",e.settings.includeName?"n":"",e.settings.includeDate?"d":"",e.settings.includeClass?"c":"",e.settings.instructions??"",e.settings.headerNote??"",e.settings.footerNote??"",e.settings.goodLuck??"",JSON.stringify(He),e.settings.learningObjective??"",e.settings.activityDuration??"",_??"",[...A].sort().join(","),JSON.stringify(we),Te,nt].join("|");if(h===Nt.current)return;const f=$t.current;if(!f)return;const k=Array.from(f.querySelectorAll("[data-q-measure]"));if(k.length!==d.length)return;const S=f.querySelector("[data-header-measure]"),B=f.querySelector("[data-continuation-measure]"),N=f.querySelector("[data-footer-measure]"),M=Array.from(f.querySelectorAll("[data-answer-measure]")),K=f.querySelector("[data-answer-header-measure]"),T=f.querySelector("[data-answer-continuation-measure]");Nt.current=h;const z=3.7795,Ve=263*z,ms=S?S.offsetHeight:60*z,ps=B?B.offsetHeight:12*z,Ye=N?N.offsetHeight:18*z,hs=12*z,us=8*z,gs=Math.max(Ve-ms-Ye-hs,80*z),Ct=Math.max(Ve-Ye-ps-us,150*z),Lt=4*z,ot=k.map(O=>O.offsetHeight+Lt),qe=[];let ae=[],Me=0,Ge=gs;if(We===2)for(let O=0;O<d.length;O+=2){const Ae=Math.max(ot[O]??0,ot[O+1]??0),at=A.has(d[O].id)||O+1<d.length&&A.has(d[O+1].id);ae.length>0&&(at||Me+Ae>Ge)&&(qe.push(ae),ae=[],Me=0,Ge=Ct),ae.push(d[O]),O+1<d.length&&ae.push(d[O+1]),Me+=Ae}else for(let O=0;O<d.length;O++){const Ae=ot[O];ae.length>0&&(A.has(d[O].id)||Me+Ae>Ge)&&(qe.push(ae),ae=[],Me=0,Ge=Ct),ae.push(d[O]),Me+=Ae}if(ae.length>0&&qe.push(ae),qe.length>0&&vt(qe),M.length===Ee.length&&Ee.length>0){const O=K?K.offsetHeight:38*z,Ae=T?T.offsetHeight:12*z,at=4*z,xs=3*z,ws=Math.max(Ve-O-Ye-at,80*z),Et=Math.max(Ve-Ae-Ye-xs,150*z),Xe=[];let le=[],Oe=0,Je=ws;const Mt=(ke,se,Se)=>{const X=ke.cloneNode(!0),ce=X.querySelector(".ws-answer-line"),de=X.querySelector(".ws-q-prompt");ce&&(ce.textContent=`${Se?n?"تابع الإجابة:":"Answer continued:":E.correct} ${se}`),Se&&de&&de.append(` (${n?"تابع":"continued"})`),f.appendChild(X);const re=X.offsetHeight+Lt;return X.remove(),re},fs=(ke,se,Se,X)=>{let ce=1,de=se.length,re=0;for(;ce<=de;){const Ie=Math.floor((ce+de)/2);Mt(ke,se.slice(0,Ie),Se)<=X?(re=Ie,ce=Ie+1):de=Ie-1}if(re<=0)return 0;const ze=Math.max(se.lastIndexOf(" ",re),se.lastIndexOf(`
`,re),se.lastIndexOf("	",re));let ge=ze>=Math.floor(re*.6)?ze:re;return ge>0&&/[\uD800-\uDBFF]/.test(se[ge-1]??"")&&(ge-=1),Math.max(1,ge)};for(let ke=0;ke<Ee.length;ke++){const se=Ee[ke],Se=M[ke];let X=se.text,ce=0;for(;X;){const de=se.continuation||ce>0,re={...se,id:`${se.id}:${ce}`,text:X,continuation:de},ze=Mt(Se,X,de);if(Oe+ze<=Je){le.push(re),Oe+=ze;break}if(le.length>0){Xe.push(le),le=[],Oe=0,Je=Et;continue}const ge=fs(Se,X,de,Je);if(ge<=0||ge>=X.length){le.push(re),Oe=ze;break}const Ie=X.slice(0,ge).trimEnd();le.push({...re,text:Ie}),Xe.push(le),le=[],Oe=0,Je=Et,X=X.slice(ge).trimStart(),ce+=1}}le.length>0&&Xe.push(le),rt(Xe)}else d.length===0&&rt([[]])}),u.useLayoutEffect(()=>{const h=document.getElementById("ws-printable-root");if(!h)return;const f=Array.from(h.querySelectorAll("[data-worksheet-page]")),k=297/25.4*96,S=f.findIndex(N=>N.offsetHeight>k+2);if(S<0)return;const B=S===0&&_e[0]?.length===1;(_e[S]?.length??0)<=1&&!B||vt(N=>{const M=N.map(T=>[...T]),K=M[S].pop();return K?(M[S+1]?M[S+1].unshift(K):M.push([K]),M):N})},[_e,nt,Te]),u.useLayoutEffect(()=>{if(!e.settings.includeAnswerKey)return;const h=document.getElementById("ws-printable-root");if(!h)return;const f=Array.from(h.querySelectorAll("[data-answer-key-page]")),k=297/25.4*96,S=f.findIndex(B=>B.offsetHeight>k+2);S<0||rt(B=>{const N=B.map(K=>[...K]);if(N[S].length===1){const K=Or(N[S][0]);return K?(N[S]=[K[0]],N[S+1]?N[S+1].unshift(K[1]):N.push([K[1]]),N):B}const M=N[S].pop();return M?(N[S+1]?N[S+1].unshift(M):N.push([M]),N):B})},[kt,e.settings.includeAnswerKey,nt,Te]);const as=t.jsxs("header",{className:"ws-header",children:[t.jsxs("div",{className:`ws-headrow${!D&&!e.settings.schoolName&&!e.settings.section&&!e.settings.teacherName&&He.length===0?" ws-headrow-title-only":""}`,dir:n?"rtl":"ltr",children:[t.jsxs("div",{className:"ws-headstart",children:[e.settings.schoolName&&t.jsx(et,{label:E.school,value:e.settings.schoolName,icon:t.jsx(Sr,{})}),e.settings.section&&t.jsx(et,{label:E.section,value:e.settings.section,icon:t.jsx(Cr,{})}),e.settings.teacherName&&t.jsx(et,{label:E.teacher,value:e.settings.teacherName,icon:t.jsx(Lr,{})}),He.map((h,f)=>t.jsx(et,{label:h.label.trim()||(n?"حقل":"Field"),value:h.value,icon:t.jsx(Er,{})},`cf-${f}`))]}),t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",children:e.title}),(e.subject||e.gradeLevel)&&t.jsx("div",{className:"ws-kicker-center",children:[e.subject,e.gradeLevel].filter(Boolean).join(" · ")}),t.jsx(wt,{})]}),t.jsx("div",{className:"ws-headend",children:D&&t.jsx("img",{src:D,alt:n?"شعار المدرسة":"School logo",className:"ws-logo-img"})})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-fields",children:[e.settings.includeName&&t.jsx(gt,{label:E.name,icon:t.jsx(Mr,{})}),e.settings.includeClass&&t.jsx(gt,{label:E.clazz,icon:t.jsx(zr,{}),short:!0}),e.settings.includeDate&&t.jsx(gt,{label:E.date,icon:t.jsx(Ir,{}),short:!0})]}),e.settings.headerNote&&t.jsx("p",{className:"ws-subtitle",children:e.settings.headerNote}),e.settings.learningObjective&&t.jsxs("div",{className:"ws-learning-objective",children:[t.jsx("strong",{children:n?"هدف الورقة:":"Learning objective:"}),t.jsx("span",{children:e.settings.learningObjective}),e.settings.activityDuration&&t.jsx("small",{children:n?`${e.settings.activityDuration} دقيقة`:`${e.settings.activityDuration} min`})]}),e.settings.instructions&&t.jsxs("div",{className:"ws-instructions",children:[t.jsx(Fr,{}),t.jsxs("div",{children:[t.jsx("strong",{children:E.instructions}),t.jsxs("span",{children:[" ",e.settings.instructions]})]})]})]}),_t=t.jsx(_r,{theme:U,data:e,labels:E,TC:I,GOLD:P,ar:n,hasIdentity:ns,customFields:He,classicFallback:as}),ls=We===2?"calc((174mm - 8mm) / 2)":"174mm",At=`ws-page${_?` ws-theme-${_}`:""}`,cs="bg-neutral-200",it=F?d.find(h=>h.id===F.questionId):void 0,St=F?we.find(h=>h.questionId===F.questionId):void 0,ds=F?St?.fields?.find(h=>h.key===F.key):void 0;return u.useEffect(()=>{if(!F)return;const h=window.requestAnimationFrame(()=>{if(!window.matchMedia("(max-width: 640px)").matches)return;const f=document.activeElement,k=document.querySelector(".ws-format-toolbar");if(!(f instanceof HTMLElement)||!f.matches(".ws-editable")||!k)return;const S=f.getBoundingClientRect(),B=k.getBoundingClientRect(),N=Jt(S.bottom,B.top);N>0&&window.scrollBy({top:N,behavior:"smooth"})});return()=>window.cancelAnimationFrame(h)},[F]),t.jsxs(t.Fragment,{children:[t.jsx(Wr,{fontFamily:v,headingFont:c,fontSizePt:j,lang:e.language,themeColor:I}),t.jsx(Hr,{TC:I}),U&&t.jsx(Nr,{theme:U,TC:I,GOLD:P,BG:y,fontFamily:v,headingFont:c,fontSizePt:j,lang:e.language}),t.jsxs("div",{ref:$t,"aria-hidden":"true",className:`no-print print-host${_?` ws-theme-${_}`:""}`,style:{position:"fixed",left:0,top:0,width:"210mm",height:0,overflow:"hidden",visibility:"hidden",pointerEvents:"none"},dir:p,children:[t.jsx("div",{"data-header-measure":!0,style:{width:"174mm"},children:_t}),t.jsx("div",{"data-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:n?"صفحة 2":"Page 2"})]})}),d.map((h,f)=>t.jsx("div",{"data-q-measure":!0,style:{width:ls},children:t.jsx(Qt,{index:String(f+1),q:h,ar:n,labels:E,showTypeHeader:ye.has(h.id),questionStyle:we.find(k=>k.questionId===h.id)})},h.id)),t.jsx("div",{"data-footer-measure":!0,style:{width:"174mm"},children:t.jsx(xt,{note:e.settings.footerNote,goodLuck:e.settings.goodLuck?.trim()||E.goodLuck})}),t.jsx("div",{"data-answer-header-measure":!0,style:{width:"174mm"},children:t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:P},children:E.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:P,background:`${P}1f`},children:e.title}),t.jsx(wt,{gold:!0})]})})})}),t.jsx("div",{"data-answer-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsxs("span",{className:"ws-cont-title",children:[E.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:n?"صفحة متابعة":"Continued"})]})}),Ee.map(h=>t.jsx("div",{"data-answer-measure":!0,style:{width:"174mm"},children:t.jsx(Kt,{item:h,ar:n,labels:E})},`answer-${h.id}`))]}),s&&t.jsxs("div",{className:"no-print ws-edit-strip",dir:p,role:"group","aria-label":n?"أدوات التعديل":"Edit tools","data-testid":"strip-worksheet-edit",children:[t.jsxs("button",{type:"button",className:`ws-strip-btn ${oe?"is-primary":""}`,"data-testid":"button-toggle-edit-mode","aria-pressed":oe,onClick:()=>{Ce(h=>(h&&Y(null),!h)),ie()},children:[t.jsx(bt,{style:{width:14,height:14}}),oe?n?"إنهاء التعديل":"Done editing":n?"تحرير الورقة":"Edit worksheet"]}),oe&&Ke&&t.jsx("button",{type:"button",className:"ws-strip-btn",onClick:Q,"data-testid":"button-strip-discard",title:n?"إلغاء تعديلات هذه الجلسة والعودة إلى آخر نسخة محفوظة":"Discard this session's changes",children:n?"تجاهل التعديلات":"Discard"}),oe&&A.size>0&&t.jsx("button",{type:"button",className:"ws-strip-btn","data-testid":"button-auto-layout",onClick:()=>{C(new Set),V(!0),q()},title:n?"إزالة فواصل الصفحات اليدوية وإعادة توزيع الأسئلة":"Remove manual page breaks and repaginate",children:n?"توزيع تلقائي":"Auto layout"}),!ue&&!oe&&t.jsxs("span",{className:"ws-edit-hint",role:"note","data-testid":"hint-edit-first-use",children:[n?"انقر على أي نص في الورقة لتعديله مباشرة، أو على القلم بجانب السؤال.":"Click any text on the paper to edit it, or use the pencil beside a question.",t.jsx("button",{type:"button",onClick:ie,"aria-label":n?"إخفاء التلميح":"Dismiss hint","data-testid":"button-dismiss-edit-hint",children:n?"فهمت":"Got it"})]})]}),oe&&F&&it&&t.jsx(Xt,{ar:n,question:it,questionNumber:d.findIndex(h=>h.id===it.id)+1,questionStyle:St,fieldStyle:ds,onFieldChange:h=>J(F.questionId,F.key,h),onQuestionChange:h=>L(F.questionId,f=>({...f,...h})),onQuestionTypeChange:h=>{const f=w.current.map(k=>k.id===F.questionId?Zt(k,h,n):k);w.current=f,g(f),C(new Set),Y({questionId:F.questionId,key:"prompt"}),V(!0),q()},onQuestionEdit:G,onResetField:ve,onResetQuestion:()=>{const h=ee.current.filter(f=>f.questionId!==F.questionId);ee.current=h,fe(h),V(!0),q()}}),t.jsxs("div",{id:"ws-printable-root",ref:is,"data-responsive-preview":!0,className:`print-host ${F?"ws-format-toolbar-open ":""}${cs} min-h-screen py-6 px-2 flex flex-col items-center`,dir:p,style:oe?{outline:"none"}:void 0,children:[_e.map((h,f)=>{const k=f+1,S=f===0,B=f===_e.length-1;return t.jsxs("article",{"data-worksheet-page":!0,className:At,lang:e.language,style:{background:y},children:[R&&t.jsx(Ut,{ar:n}),!_&&t.jsx(tt,{}),_==="arabic_ink"&&t.jsx(tt,{}),S&&t.jsx(yr,{layout:e.settings.layout}),t.jsxs("div",{className:"ws-content",children:[S?_t:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:n?`صفحة ${k}`:`Page ${k}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:We===2?2:1},children:h.map(N=>{const M=d.find(T=>T.id===N.id)??N,K=d.findIndex(T=>T.id===N.id);return t.jsx(Qt,{index:String(K+1),q:M,ar:n,labels:E,editMode:oe,onEdit:G,showTypeHeader:ye.has(N.id),questionStyle:we.find(T=>T.questionId===N.id),onSelectField:T=>Y({questionId:N.id,key:T}),selected:F?.questionId===N.id,onStartEdit:s||l?()=>be(N.id):void 0,onSelectQuestion:()=>Y({questionId:N.id,key:"prompt"}),onMatchingWidthChange:T=>{L(N.id,z=>({...z,matchingLeftWidth:T})),Y({questionId:N.id,key:"prompt"})},onQuestionStyleChange:T=>{L(N.id,z=>({...z,...T})),Y({questionId:N.id,key:"prompt"})}},N.id)})}),t.jsx(xt,{note:B?e.settings.footerNote:void 0,goodLuck:B?e.settings.goodLuck?.trim()||E.goodLuck:""})]}),e.linkedAssignmentId!=null&&t.jsx(qr,{worksheetId:e.id,page:k,total:_e.length,ar:n})]},k)}),e.settings.includeAnswerKey&&kt.map((h,f)=>{const k=_e.length+f+1;return t.jsxs("article",{"data-answer-key-page":!0,"data-answer-key-page-number":f+1,className:At,lang:e.language,style:{background:y},children:[R&&t.jsx(Ut,{ar:n}),!_&&t.jsx(tt,{}),_==="arabic_ink"&&t.jsx(tt,{}),t.jsxs("div",{className:"ws-content",children:[f===0?t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:P},children:E.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:P,background:`${P}1f`},children:e.title}),t.jsx(wt,{gold:!0})]})})}):t.jsxs("div",{className:"ws-cont-header","data-answer-key-continuation":!0,children:[t.jsxs("span",{className:"ws-cont-title",children:[E.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:n?`صفحة ${k}`:`Page ${k}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:1},children:h.map(S=>t.jsx(Kt,{item:S,ar:n,labels:E},S.id))}),t.jsx(xt,{goodLuck:""})]})]},`answer-page-${f+1}`)})]})]})}function Ar(){const s=ys()?.id,{lang:r}=js(),[,i]=vs(),a=ks("/teacher/worksheets/create"),[o,l]=u.useState(null),m=u.useRef(null),n=u.useCallback(x=>{const $=typeof x=="function"?x(m.current):x;m.current=$,l($)},[]),p=u.useRef(null),v=u.useRef(null),b=u.useRef(0),_=u.useRef(null),[U,y]=u.useState(!0),[c,j]=u.useState(null),[R,I]=u.useState(""),D=u.useRef(!1),[d,g]=u.useState(!1),[w,A]=u.useState(!1),[H,W]=u.useState(null),[C,xe]=u.useState(!1),he=u.useRef(!1),[q,we]=u.useState(""),[fe,ee]=u.useState(null),[,F]=u.useState(0),Y=x=>JSON.stringify({t:x.title,s:x.subject,g:x.gradeLevel,st:{...x.settings,pageBreaks:x.settings.pageBreaks??[],questionStyles:x.settings.questionStyles??[]}}),ue=x=>JSON.stringify(x.questions),Qe=u.useRef(r);Qe.current=r,u.useEffect(()=>{if(!s)return;const x=new AbortController;return y(!0),fetch(`${Wt}/api/worksheets/${s}`,{credentials:"include",signal:x.signal}).then($=>{if(!$.ok)throw new Error("load failed");return $.json()}).then($=>{x.signal.aborted||(p.current={meta:Y($),questions:ue($)},v.current=$,n($))}).catch(()=>{x.signal.aborted||$e.error(Qe.current==="ar"?"تعذّر تحميل ورقة العمل":"Failed to load worksheet")}).finally(()=>{x.signal.aborted||y(!1)}),()=>x.abort()},[s,n]);const ie=o?.isOwner!==!1,be=!!(o&&p.current&&ie&&(Y(o)!==p.current.meta||ue(o)!==p.current.questions)),ye=u.useRef(!1);ye.current=be,u.useEffect(()=>{const x=$=>{const Q=m.current,G=p.current,L=_.current?.(),J=Q&&L?{...Q,questions:L.questions,settings:{...Q.settings,pageBreaks:L.pageBreaks,questionStyles:L.questionStyles}}:Q,ve=J&&G&&J.isOwner!==!1&&(Y(J)!==G.meta||ue(J)!==G.questions);(ye.current||ve)&&($.preventDefault(),$.returnValue="")};return window.addEventListener("beforeunload",x),()=>window.removeEventListener("beforeunload",x)},[]);const De=u.useCallback(x=>{n($=>$&&{...$,questions:x.questions,settings:{...$.settings,pageBreaks:x.pageBreaks,questionStyles:x.questionStyles}})},[n]),Ne=u.useCallback(()=>{const x=_.current?.();x&&De(x);const $=m.current;return!$||!x?$:{...$,questions:x.questions,settings:{...$.settings,pageBreaks:x.pageBreaks,questionStyles:x.questionStyles}}},[De]),Ke=async()=>{if(!w){A(!0),W(null);try{Ne(),await Is(m.current?.title??"")}catch(x){W(Fs(x,r==="ar"))}finally{A(!1)}}},V=u.useCallback(async()=>{if(he.current)return!1;const x=Ne(),$=p.current;if(!x||!$||x.isOwner===!1)return!1;he.current=!0,xe(!0),we("");const Q=ue(x)!==$.questions,G={title:x.title,language:x.language,gradeLevel:x.gradeLevel,subject:x.subject,questions:x.questions,settings:x.settings};Q&&x.linkedAssignmentId!=null&&(G.smartGrading=!0);try{const L=await fetch(`${Wt}/api/worksheets/${x.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(G)});if(!L.ok){const E=await L.json().catch(()=>({}));throw new Error(E?.message||"save failed")}const J=await L.json().catch(()=>null),ve=Array.isArray(J)?J[0]:J;return p.current={meta:Y(x),questions:ue(x)},v.current=x,n(E=>E&&{...E,linkedAssignmentId:ve&&"linkedAssignmentId"in ve?ve.linkedAssignmentId??null:E.linkedAssignmentId}),$e.success(ve?.gradingVersioned?r==="ar"?"تم الحفظ وإنشاء نسخة جديدة للتصحيح":"Saved; grading version updated":r==="ar"?"تم حفظ تعديلات الورقة":"Worksheet changes saved"),!0}catch(L){const J=(L instanceof Error&&L.message!=="save failed"?L.message:"")||(r==="ar"?"تعذّر الحفظ. تعديلاتك محفوظة هنا؛ أعد المحاولة.":"Save failed. Your edits are kept here; retry.");return we(J),$e.error(J),!1}finally{he.current=!1,xe(!1),F(L=>L+1)}},[Ne,n,r]),oe=u.useCallback(()=>{const x=v.current;x&&(we(""),n($=>$?{...x,linkedAssignmentId:$.linkedAssignmentId,isOwner:$.isOwner}:x))},[n]),Ce=u.useCallback(()=>{V()},[V]),je=u.useCallback(x=>{Ne(),b.current+=1,queueMicrotask(()=>{ye.current||m.current&&p.current&&m.current.isOwner!==!1&&(Y(m.current)!==p.current.meta||ue(m.current)!==p.current.questions)?ee(()=>x):x()})},[Ne]),st=u.useCallback(x=>{n($=>$&&{...$,...x.title!==void 0?{title:x.title}:{},...x.subject!==void 0?{subject:x.subject.trim()?x.subject:null}:{},...x.gradeLevel!==void 0?{gradeLevel:x.gradeLevel.trim()?x.gradeLevel:null}:{}})},[n]),jt=u.useCallback(x=>{n($=>$&&{...$,settings:x($.settings)})},[n]);if(U)return t.jsx("div",{className:"min-h-screen flex items-center justify-center",children:t.jsx(Ze,{className:"w-8 h-8 animate-spin",style:{color:te}})});if(!o)return t.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:r==="ar"?"لم يتم العثور على ورقة العمل.":"Worksheet not found."});const Le=o.language==="ar"?"rtl":"ltr",Pe=async x=>{if(D.current)return;Ne();const $=document.getElementById("ws-printable-root");if(!$){$e.error(r==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}D.current=!0,j(x),I("");try{x==="visual"?await wr({element:$,title:o.title,lang:o.language,worksheetId:o.id,onProgress:(Q,G)=>I(`${Q}/${G}`)}):await Bs({element:$,title:`${o.title} - ${r==="ar"?"قابل للتحرير":"Editable"}`,lang:o.language}),$e.success(r==="ar"?"تم تجهيز ملف Word للتنزيل":"Word file ready for download")}catch(Q){const G=Q instanceof Z&&Q.code==="image",L=Q instanceof Z&&Q.code==="busy";$e.error(L?r==="ar"?"خدمة التصدير مشغولة الآن؛ أعد المحاولة بعد قليل.":"The export service is busy. Please retry shortly.":G?r==="ar"?"تعذّر تحميل إحدى صور التصميم. لم يُصدّر ملف ناقص؛ أعد المحاولة بعد اكتمال تحميل الصور.":"A design image could not be loaded. No incomplete file was exported; retry after images finish loading.":r==="ar"?"تعذّر تصدير ملف Word. يرجى المحاولة مرة أخرى.":"Could not export the Word file. Please try again.")}finally{D.current=!1,j(null),I("")}};return t.jsxs(t.Fragment,{children:[t.jsxs("div",{dir:Le,className:"no-print ws-action-toolbar sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[t.jsxs("button",{onClick:()=>je(a),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${te}55`,color:te},children:[t.jsx(Vs,{className:"w-3.5 h-3.5"}),r==="ar"?"رجوع":"Back"]}),t.jsx("div",{className:"text-xs font-bold truncate flex-1 text-center",style:{color:te},children:o.title}),t.jsxs("div",{className:"ws-actions flex gap-1.5 flex-wrap justify-end",children:[o.isOwner!==!1&&o.linkedAssignmentId!=null&&t.jsxs("button",{onClick:()=>je(()=>i(`/teacher/worksheets/${o.id}/grade`)),className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:"#2f684d"},title:r==="ar"?"تصحيح الأوراق بالكاميرا":"Grade papers with camera","data-testid":"btn-open-grading",children:[t.jsx(Ys,{className:"w-3.5 h-3.5"}),r==="ar"?"تصحيح":"Grade"]}),ie&&t.jsxs(t.Fragment,{children:[t.jsxs("button",{onClick:()=>g(x=>!x),"aria-expanded":d,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${te}55`,color:te,background:d?`${te}12`:void 0},"data-testid":"btn-toggle-format-panel",children:[t.jsx(bt,{className:"w-3.5 h-3.5"}),r==="ar"?"الترويسة والتنسيق":"Header & format"]}),t.jsxs("button",{onClick:()=>{V()},disabled:C||!be,className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm disabled:opacity-50",style:{background:be?te:"#2f684d"},"data-testid":"btn-save-worksheet",children:[C?t.jsx(Ze,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(Gs,{className:"w-3.5 h-3.5"}),C?r==="ar"?"جار الحفظ":"Saving":be?r==="ar"?"حفظ التعديلات":"Save changes":r==="ar"?"محفوظ":"Saved"]})]}),t.jsxs(Rs,{dir:r==="ar"?"rtl":"ltr",children:[t.jsx(Ds,{asChild:!0,children:t.jsxs("button",{disabled:c!==null,"aria-busy":c!==null,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 disabled:opacity-60",style:{borderColor:`${te}55`,color:te},title:r==="ar"?"اختر نسخة Word":"Choose a Word version","data-testid":"btn-word-export",children:[c?t.jsx(Ze,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(Xs,{className:"w-3.5 h-3.5"}),t.jsx("span",{"aria-live":"polite",children:c?`${r==="ar"?"جار التجهيز":"Preparing"} ${R}`:r==="ar"?"وورد":"Word"})]})}),t.jsxs(Ps,{align:"end",className:"w-72",children:[t.jsxs(It,{onSelect:()=>{Pe("visual")},disabled:c!==null,className:"flex-col items-start gap-1 py-3","data-testid":"word-export-visual",children:[t.jsx("span",{className:"font-bold",children:r==="ar"?"Word مطابق للتصميم":"Word — visual design"}),t.jsx("span",{className:"text-xs text-muted-foreground",children:r==="ar"?"نفس المظهر كصور صفحات؛ النص غير قابل للتحرير.":"Same appearance as page images; text is not editable."})]}),t.jsxs(It,{onSelect:()=>{Pe("editable")},disabled:c!==null,className:"flex-col items-start gap-1 py-3","data-testid":"word-export-editable",children:[t.jsx("span",{className:"font-bold",children:r==="ar"?"Word قابل للتحرير":"Word — editable"}),t.jsx("span",{className:"text-xs text-muted-foreground",children:r==="ar"?"نصوص وجداول بتنسيق محسّن؛ قد يختلف توزيع الصفحات.":"Formatted text and tables; pagination may differ."})]})]})]}),t.jsxs("button",{onClick:()=>{Ke()},disabled:w,"aria-busy":w,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${te}55`,color:te},"data-testid":"btn-pdf-export",title:r==="ar"?"حفظ الورقة كملف PDF":"Save worksheet as PDF",children:[w?t.jsx(Ze,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(Js,{className:"w-3.5 h-3.5"}),w?r==="ar"?"جار تجهيز PDF":"Preparing PDF":r==="ar"?"حفظ PDF":"Save PDF"]})]})]}),H&&t.jsxs("div",{role:"alert",dir:Le,className:"no-print mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800","data-testid":"alert-pdf-error",children:[t.jsx("span",{className:"flex-1",children:H}),t.jsx("button",{onClick:()=>{Ke()},disabled:w,className:"px-3 py-1 rounded-md bg-white border font-bold","data-testid":"btn-retry-pdf",children:r==="ar"?"إعادة المحاولة":"Retry"})]}),ie&&(d||q||be)&&t.jsxs("div",{dir:Le,className:"no-print border-b bg-white px-4 py-3","data-testid":"region-live-edit",children:[(q||be)&&t.jsxs("div",{role:q?"alert":"status",className:`mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${q?"border-red-300 bg-red-50 text-red-800":"border-amber-300 bg-amber-50 text-amber-900"}`,children:[t.jsx("span",{className:"flex-1",children:q||(r==="ar"?"لديك تعديلات غير محفوظة. الطباعة والتصدير يستخدمان آخر تعديلاتك.":"You have unsaved edits. Print and export use your latest edits.")}),q&&t.jsx("button",{onClick:()=>{V()},disabled:C,className:"px-3 py-1 rounded-md bg-white border font-bold","data-testid":"btn-retry-save",children:r==="ar"?"إعادة المحاولة":"Retry"})]}),d&&t.jsx(vr,{ar:r==="ar",settings:o.settings,onSettingsChange:jt,meta:{title:o.title,subject:o.subject??"",gradeLevel:o.gradeLevel??""},onMetaChange:st})]}),t.jsx(Gt,{data:o,flushRef:_,onRequestSave:ie?Ce:void 0,onRequestDiscard:ie?oe:void 0,onDraftChange:ie?De:void 0,onLayoutChange:ie?(x,$,Q)=>De({questions:x,pageBreaks:$,questionStyles:Q}):void 0}),fe&&t.jsx("div",{className:"no-print fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4",role:"alertdialog","aria-modal":"true","aria-labelledby":"leave-title",dir:Le,children:t.jsxs("div",{className:"w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl",children:[t.jsx("h2",{id:"leave-title",className:"font-bold text-base mb-1",children:r==="ar"?"تعديلات غير محفوظة":"Unsaved changes"}),t.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:r==="ar"?"احفظ تعديلاتك قبل المغادرة أو تجاهلها.":"Save your edits before leaving, or discard them."}),t.jsxs("div",{className:"flex flex-wrap gap-2 justify-end",children:[t.jsx("button",{className:"px-3 py-1.5 rounded-lg border text-sm font-bold",onClick:()=>{b.current+=1,ee(null)},children:r==="ar"?"البقاء":"Stay"}),t.jsx("button",{className:"px-3 py-1.5 rounded-lg border text-sm font-bold text-red-700","data-testid":"btn-discard-leave",disabled:C,onClick:()=>{const x=fe;ye.current=!1,b.current+=1,ee(null),x()},children:r==="ar"?"تجاهل وخروج":"Discard & leave"}),t.jsx("button",{className:"px-3 py-1.5 rounded-lg text-sm font-bold text-white",style:{background:te},"data-testid":"btn-save-leave",disabled:C,onClick:async()=>{const x=fe,$=++b.current,Q=await V();if($!==b.current)return;const G=m.current,L=p.current,J=!!(G&&L&&(Y(G)!==L.meta||ue(G)!==L.questions));ee(null),Q&&!J&&(ye.current=!1,x())},children:r==="ar"?"حفظ وخروج":"Save & leave"})]})]})})]})}function gt({label:e,short:s,icon:r}){return t.jsxs("div",{className:`ws-field-line ${s?"short":""}`,children:[r&&t.jsx("span",{className:"ws-field-icon",children:r}),t.jsxs("span",{className:"ws-field-label",children:[e,":"]}),t.jsx("span",{className:"ws-field-rule"})]})}function et({label:e,value:s,icon:r}){return t.jsxs("div",{className:"ws-school-cell",children:[t.jsx("span",{className:"ws-school-icon",children:r}),t.jsxs("div",{className:"ws-school-text",children:[t.jsx("span",{className:"ws-school-label",children:e}),t.jsx("span",{className:"ws-school-value",children:s})]})]})}function xt({note:e,goodLuck:s}){return!e&&!s?null:t.jsxs("footer",{className:"ws-footer",children:[s&&t.jsx("div",{className:"ws-footer-cheer",children:s}),e&&t.jsx("div",{className:"ws-footer-note",children:e})]})}function Ut({ar:e}){const s=e?"حصاد":"Hasaad";return t.jsx("div",{className:"ws-watermark","aria-hidden":"true",children:t.jsx("span",{className:"ws-watermark-word",children:s})})}function tt(){return t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-corner ws-corner-tl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-tr","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-bl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-br","aria-hidden":"true"})]})}function wt({gold:e}){return t.jsxs("div",{className:`ws-divider ${e?"gold":""}`,"aria-hidden":"true",children:[t.jsx("span",{className:"ws-divider-thick"}),t.jsx("span",{className:"ws-divider-thin"})]})}function Sr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),t.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function Cr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}),t.jsx("path",{d:"M9 4v16M4 9h16"})]})}function Lr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"3"}),t.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function Er(){return t.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:t.jsx("path",{d:"M4 7h16M4 12h16M4 17h10"})})}function Mr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"4"}),t.jsx("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"})]})}function zr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"6",width:"18",height:"13",rx:"2"}),t.jsx("path",{d:"M8 3v6M16 3v6"})]})}function Ir(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),t.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function Fr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:P,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flex:"0 0 auto"},children:[t.jsx("path",{d:"M9 18h6M10 21h4"}),t.jsx("path",{d:"M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"})]})}function Br(e,s){return s?{mcq:"اختيار من متعدد",true_false:"صح / خطأ",short_answer:"إجابة قصيرة",fill_blank:"أكمل الفراغ",matching:"وصّل بين العمودين",tic_tac_toe:"لوحة الاختيار (Tic-Tac-Toe)",worked_problem:"مسألة مع خطوات الحل",extended_response:"إجابة مطولة",error_correction:"اكتشف الخطأ وصححه",word_bank:"بنك الكلمات",compare:"قارن"}[e]:{mcq:"Multiple choice",true_false:"True / False",short_answer:"Short answer",fill_blank:"Fill in the blank",matching:"Matching",tic_tac_toe:"Choice Board (Tic-Tac-Toe)",worked_problem:"Worked problem",extended_response:"Extended response",error_correction:"Find & correct the error",word_bank:"Word bank",compare:"Compare"}[e]}function Rr(e,s,r){return s?{mcq:"اختر الإجابة الصحيحة من الاختيارات التالية:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:":"اختر «صح» أو «خطأ» لكل عبارة مما يلي:",short_answer:"أجب عن الأسئلة التالية إجابةً قصيرة:",fill_blank:"أكمل الفراغات التالية بالكلمة المناسبة:",matching:"صل كل عبارة بما يناسبها من العمود الثاني:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"اختر الأركان الأربعة ونفّذ مهامها:":r?.ticTacToeStrategy==="full_board"?"نفّذ جميع المهام في اللوحة التالية:":"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا:",worked_problem:"حل المسألة موضحًا خطوات العمل، ثم اكتب الإجابة النهائية:",extended_response:"اكتب إجابة موسعة تدعمها بالتفاصيل والأدلة:",error_correction:"حدّد الخطأ، ثم اكتب التصحيح واشرح سبب التعديل:",word_bank:"استخدم الكلمات في الصندوق لإكمال البنود التالية:",compare:"قارن بين العنصرين، موضحًا أوجه التشابه والاختلاف:"}[e]:{mcq:"Choose the correct answer from the following:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"Put a tick (✓) before each true statement and a cross (✗) before each false statement:":"Choose True or False for each statement:",short_answer:"Answer the following questions briefly:",fill_blank:"Fill in the blanks with the appropriate word:",matching:"Match each item with its corresponding choice in the second column:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"Choose the four corners and complete the tasks:":r?.ticTacToeStrategy==="full_board"?"Complete all tasks in the board:":"Choose three connected squares horizontally, vertically, or diagonally:",worked_problem:"Solve the problem, showing each step, then give the final answer:",extended_response:"Write an extended response supported with details and evidence:",error_correction:"Identify the error, write the correction, and explain your reasoning:",word_bank:"Use the words in the box to complete the following items:",compare:"Compare the two items, including their similarities and differences:"}[e]}function Dr(e){if(e)return{fontSize:e.fontSizePt?`${e.fontSizePt}pt`:void 0,fontWeight:e.bold?800:void 0,textAlign:e.align==="start"?"start":e.align==="end"?"end":e.align,display:e.align?"inline-block":void 0,width:e.align?"100%":void 0}}function Xt({ar:e,question:s,questionNumber:r,questionStyle:i,fieldStyle:a,onFieldChange:o,onQuestionChange:l,onQuestionTypeChange:m,onQuestionEdit:n,onResetField:p,onResetQuestion:v}){const[b,_]=u.useState(!1),[U,y]=u.useState(void 0),c=u.useRef(null);u.useLayoutEffect(()=>{const d=()=>{const g=document.querySelector("[data-question-selected]"),w=c.current;if(!g||!w||window.innerWidth<768){y(void 0);return}const A=g.getBoundingClientRect(),H=Math.min(620,window.innerWidth-24),W=w.offsetHeight||48,C=Math.min(Math.max(12,A.left+A.width/2-H/2),window.innerWidth-H-12),xe=A.bottom+8,he=xe+W<=window.innerHeight-8?xe:Math.max(8,Math.min(A.top-W-8,window.innerHeight-W-8));y({position:"fixed",top:he,left:C,bottom:"auto",transform:"none",width:H})};return d(),window.addEventListener("scroll",d,!0),window.addEventListener("resize",d),()=>{window.removeEventListener("scroll",d,!0),window.removeEventListener("resize",d)}},[r,b]);const j=a?.fontSizePt??12,R=[{value:"start",Icon:e?Ft:Bt},{value:"center",Icon:Us},{value:"end",Icon:e?Bt:Ft}],I=e?{start:"محاذاة للبداية",center:"توسيط",end:"محاذاة للنهاية"}:{start:"Align to start",center:"Center align",end:"Align to end"},D=d=>{if(!["ArrowRight","ArrowLeft","Home","End"].includes(d.key)||d.target instanceof HTMLInputElement||d.target instanceof HTMLSelectElement)return;const g=Array.from(d.currentTarget.querySelectorAll("button:not(:disabled), select:not(:disabled), input:not(:disabled)")),w=g.indexOf(document.activeElement);if(w<0||g.length===0)return;d.preventDefault();const A=d.key===(e?"ArrowLeft":"ArrowRight"),H=d.key==="Home"?0:d.key==="End"?g.length-1:(w+(A?1:-1)+g.length)%g.length;g[H]?.focus()};return t.jsxs("div",{ref:c,style:U,className:"no-print ws-format-toolbar",dir:e?"rtl":"ltr",role:"toolbar","aria-label":e?"تنسيق النص والسؤال المحددين":"Selected text and question formatting",onKeyDown:D,"data-testid":"toolbar-question-formatting",children:[t.jsx("div",{className:"ws-format-selection","aria-live":"polite",children:e?`تعديل السؤال ${r}`:`Editing question ${r}`}),t.jsx("button",{type:"button",className:`ws-format-details-toggle${b?" is-active":""}`,"aria-expanded":b,onClick:()=>_(d=>!d),"data-testid":"button-toggle-question-details",children:e?"تفاصيل السؤال":"Question details"}),t.jsxs("div",{className:"ws-format-group",children:[t.jsx("span",{className:"ws-format-label",children:e?"النص":"Text"}),t.jsx("button",{type:"button",onClick:()=>o({fontSizePt:Math.max(8,j-1)}),"aria-label":e?"تصغير الخط":"Decrease font size","data-testid":"button-decrease-font-size",children:t.jsx(Zs,{})}),t.jsx("span",{className:"ws-format-value","aria-live":"polite","data-testid":"text-font-size",children:j}),t.jsx("button",{type:"button",onClick:()=>o({fontSizePt:Math.min(24,j+1)}),"aria-label":e?"تكبير الخط":"Increase font size","data-testid":"button-increase-font-size",children:t.jsx(ft,{})}),t.jsx("button",{type:"button",className:a?.bold?"is-active":"",onClick:()=>o({bold:!a?.bold}),"aria-label":e?"نص عريض":"Bold text","aria-pressed":!!a?.bold,"data-testid":"button-toggle-bold",children:t.jsx("strong",{children:"ب"})}),R.map(({value:d,Icon:g})=>t.jsx("button",{type:"button",className:a?.align===d?"is-active":"",onClick:()=>o({align:d}),"aria-label":I[d],"aria-pressed":a?.align===d,"data-testid":`button-align-${d}`,children:t.jsx(g,{})},d)),t.jsx("button",{type:"button",onClick:p,"aria-label":e?"إعادة تنسيق النص":"Reset text formatting","data-testid":"button-reset-text-formatting",children:t.jsx(zt,{})})]}),b&&t.jsxs("div",{className:"ws-format-group ws-format-details",children:[t.jsx("span",{className:"ws-format-label",children:e?"السؤال":"Question"}),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"نوعه":"Type"}),t.jsx("select",{value:s.type,onChange:d=>m(d.target.value),"aria-label":e?"تغيير نوع السؤال":"Change question type",children:["true_false","mcq","matching","short_answer","fill_blank"].map(d=>t.jsx("option",{value:d,children:Br(d,e)},d))})]}),s.type==="true_false"&&t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-format-label",children:e?"طريقة الإجابة":"Answer layout"}),["mark","choices"].map(d=>t.jsx("button",{type:"button",className:(i?.trueFalseLayout??"choices")===d?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>l({trueFalseLayout:d}),children:e?d==="mark"?"قوس للعلامة":"خيارا صح وخطأ":d==="mark"?"Mark parentheses":"True / False choices"},d)),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة":"Answer"}),t.jsxs("select",{value:s.correct?"true":"false",onChange:d=>n({...s,correct:d.target.value==="true"}),"aria-label":e?"الإجابة الصحيحة":"Correct answer",children:[t.jsx("option",{value:"true",children:e?"صح":"True"}),t.jsx("option",{value:"false",children:e?"خطأ":"False"})]})]})]}),s.type==="tic_tac_toe"&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-strategy",children:[t.jsx("span",{className:"ws-format-label",children:e?"الاستراتيجية":"Strategy"}),["any_three","corners","full_board"].map(d=>t.jsx("button",{type:"button",className:(i?.ticTacToeStrategy??"any_three")===d?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>l({ticTacToeStrategy:d}),children:e?d==="any_three"?"3 متصلة":d==="corners"?"الأركان":"كامل اللوحة":d==="any_three"?"Any 3":d==="corners"?"Corners":"Full board"},d))]}),t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-response",children:[t.jsx("span",{className:"ws-format-label",children:e?"أسطر الإجابة":"Response Lines"}),[0,3,5,8,12].map(d=>t.jsx("button",{type:"button",className:(i?.ticTacToeResponseLines??0)===d?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>l({ticTacToeResponseLines:d}),children:d===0?e?"بدون":"None":d},d))]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة الصحيحة":"Correct answer"}),t.jsx("select",{value:s.correctIndex,onChange:d=>n({...s,correctIndex:Number(d.target.value)}),"aria-label":e?"اختيار الإجابة الصحيحة":"Choose the correct answer",children:s.options.map((d,g)=>t.jsxs("option",{value:g,children:["(",Be(g,e),") ",d]},g))})]}),s.type==="error_correction"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر التصحيح":"Correction lines"}),t.jsx("select",{value:i?.errorCorrectionCorrectionLines??2,onChange:d=>l({errorCorrectionCorrectionLines:Number(d.target.value)}),"aria-label":e?"عدد أسطر التصحيح":"Number of correction lines","data-testid":"select-error-correction-lines",children:[0,1,2,3,4,6,8].map(d=>t.jsx("option",{value:d,children:d===0?e?"بدون أسطر":"No lines":d},d))})]}),t.jsx("button",{type:"button",className:i?.errorCorrectionShowExplanation??!0?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>l({errorCorrectionShowExplanation:!(i?.errorCorrectionShowExplanation??!0)}),"aria-pressed":i?.errorCorrectionShowExplanation??!0,"data-testid":"button-toggle-error-explanation",children:i?.errorCorrectionShowExplanation??!0?e?"إخفاء الشرح":"Hide explanation":e?"إظهار الشرح":"Show explanation"}),(i?.errorCorrectionShowExplanation??!0)&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر الشرح":"Explanation lines"}),t.jsx("select",{value:i?.errorCorrectionExplanationLines??2,onChange:d=>l({errorCorrectionExplanationLines:Number(d.target.value)}),"aria-label":e?"عدد أسطر الشرح":"Number of explanation lines","data-testid":"select-error-explanation-lines",children:[0,1,2,3,4,6,8].map(d=>t.jsx("option",{value:d,children:d===0?e?"بدون أسطر":"No lines":d},d))})]})]}),s.type==="compare"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان التشابه":"Similarities heading"}),t.jsx("input",{value:i?.compareSimilaritiesLabel??(e?"أوجه التشابه":"Similarities"),onChange:d=>l({compareSimilaritiesLabel:d.target.value}),"aria-label":e?"عنوان أوجه التشابه":"Similarities heading","data-testid":"input-compare-similarities-label"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان الاختلاف":"Differences heading"}),t.jsx("input",{value:i?.compareDifferencesLabel??(e?"خصائص واختلافات":"Traits and differences"),onChange:d=>l({compareDifferencesLabel:d.target.value}),"aria-label":e?"عنوان الخصائص والاختلافات":"Traits and differences heading","data-testid":"input-compare-differences-label"})]})]}),(s.type==="short_answer"||s.type==="fill_blank")&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة النموذجية":"Model answer"}),t.jsx("input",{value:s.answer??"",onChange:d=>n({...s,answer:d.target.value}),"aria-label":e?"الإجابة النموذجية":"Model answer"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"مسافة السؤال":"Question spacing"}),t.jsxs("select",{value:i?.spacing??"normal",onChange:d=>l({spacing:d.target.value}),"aria-label":e?"مسافة السؤال":"Question spacing","data-testid":"select-question-spacing",children:[t.jsx("option",{value:"compact",children:e?"مضغوط":"Compact"}),t.jsx("option",{value:"normal",children:e?"عادي":"Normal"}),t.jsx("option",{value:"relaxed",children:e?"واسع":"Wide"})]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"ترتيب الخيارات":"Option layout"}),t.jsxs("select",{value:i?.choiceColumns??2,onChange:d=>l({choiceColumns:Number(d.target.value)}),"aria-label":e?"ترتيب خيارات السؤال":"Question option layout","data-testid":"select-choice-columns",children:[t.jsx("option",{value:1,children:e?"عمودي":"Vertical"}),t.jsx("option",{value:2,children:e?"خياران في سطر":"Two per row"})]})]}),t.jsx("button",{type:"button",onClick:v,"aria-label":e?"إعادة إعدادات السؤال":"Reset question settings","data-testid":"button-reset-question-formatting",children:t.jsx(zt,{})})]})]})}function pe({text:e,editMode:s,className:r,onCommit:i,placeholder:a,style:o,onSelect:l}){const m=u.useRef(null);u.useEffect(()=>{m.current&&!s&&(m.current.textContent=e)},[e,s]);const n=Dr(o);return s?t.jsx("span",{ref:m,className:`ws-editable${r?` ${r}`:""}`,style:{...n,unicodeBidi:"plaintext"},contentEditable:!0,suppressContentEditableWarning:!0,onFocus:p=>{l?.(),p.currentTarget.textContent||(p.currentTarget.textContent=e)},onBlur:p=>{const v=p.currentTarget.textContent?.trim()??"";i(v||e)},onKeyDown:p=>{p.key==="Enter"&&(p.preventDefault(),p.currentTarget.blur())},spellCheck:!1,dir:Ks(e,"rtl"),children:e||a}):t.jsx(Fe,{text:e||a,className:r,fallbackDirection:"rtl",style:n})}function Qt({index:e,q:s,ar:r,labels:i,editMode:a,onEdit:o,showTypeHeader:l,questionStyle:m,onSelectField:n,selected:p,onStartEdit:v,onSelectQuestion:b,onMatchingWidthChange:_,onQuestionStyleChange:U}){const y=a??!1,c=o??(()=>{}),j=u.useRef(null),R=s.type==="matching"?ts(s.pairs):null,I=m?.matchingLeftWidth,D=I?{left:I/100,right:(100-I)/100}:R,d=g=>{const w=j.current?.getBoundingClientRect();if(!w||w.width<=0)return;const A=r?(w.right-g)/w.width:(g-w.left)/w.width;_?.(Math.round(Math.min(.65,Math.max(.35,A))*100))};return t.jsxs("div",{className:`ws-question-block ws-q-spacing-${m?.spacing??"normal"}${y?" ws-q-editable":""}${p?" ws-q-selected":""}`,onClick:g=>{const w=g.target;if(!y){if(!v||w.closest("button, a, input, select, textarea, [contenteditable='true']"))return;const A=typeof window<"u"?window.getSelection():null;if(A&&!A.isCollapsed)return;v();return}w.closest(".ws-editable")||b?.()},"data-question-selected":p||void 0,children:[v&&!y&&t.jsx("button",{type:"button",className:"no-print ws-q-pencil",onClick:g=>{g.stopPropagation(),v()},"aria-label":r?`تعديل السؤال ${e}`:`Edit question ${e}`,"data-testid":`button-edit-question-${e}`,children:t.jsx(bt,{})}),l&&t.jsx("div",{className:"ws-section-instr",children:Rr(s.type,r,m)}),s.type==="word_bank"&&t.jsxs("div",{className:"ws-word-bank","aria-label":r?"بنك الكلمات":"Word bank",children:[t.jsx("strong",{children:r?"بنك الكلمات":"Word bank"}),t.jsx("div",{children:Array.from(new Set(s.items.filter(Boolean))).map((g,w)=>t.jsx(Fe,{text:g,fallbackDirection:r?"rtl":"ltr"},w))})]}),t.jsxs("div",{className:"ws-q",children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num","aria-label":`${i.question} ${e}`,children:e}),t.jsxs("div",{className:"ws-q-prompt-wrap",children:[typeof s.points=="number"&&s.points>0&&t.jsx("div",{className:"ws-q-typeline",children:t.jsxs("span",{className:"ws-q-points",children:[s.points," ",r?"د":"pt"]})}),t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(pe,{text:s.prompt??(s.type==="matching"?r?"صل بين العمودين بخطوط:":"Match the columns:":""),editMode:y,style:m?.fields?.find(g=>g.key==="prompt"),onSelect:()=>n?.("prompt"),onCommit:g=>c({...s,prompt:g})}),s.type==="true_false"&&(m?.trueFalseLayout??"choices")==="mark"&&t.jsx("span",{className:"ws-tf-mark","aria-hidden":"true",children:"(　　)"})]})]})]}),s.type==="mcq"&&t.jsx("ol",{className:"ws-mcq","data-choice-columns":m?.choiceColumns??2,style:{gridTemplateColumns:`repeat(${m?.choiceColumns??2}, minmax(0, 1fr))`},children:s.options.map((g,w)=>t.jsxs("li",{children:[t.jsxs("span",{className:"ws-mcq-letter",children:["(",Be(w,r),")"]}),t.jsx("span",{className:"ws-mcq-text",children:t.jsx(pe,{text:g,editMode:y,style:m?.fields?.find(A=>A.key===`option:${w}`),onSelect:()=>n?.(`option:${w}`),onCommit:A=>{const H=s.options.slice();H[w]=A,c({...s,options:H})}})})]},w))}),s.type==="true_false"&&(m?.trueFalseLayout??"choices")==="choices"&&t.jsxs("div",{className:"ws-tf-choices",children:[t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),i.true]}),t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),i.false]})]}),s.type==="short_answer"&&t.jsx("div",{className:"ws-lines",children:Array.from({length:s.lines??2}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))}),s.type==="fill_blank"&&t.jsx("div",{className:"ws-fill",children:t.jsx("span",{className:"ws-fill-rule"})}),s.type==="matching"&&t.jsxs("div",{className:"ws-match",ref:j,style:{gridTemplateColumns:`minmax(0, ${D.left}fr) 6mm minmax(0, ${D.right}fr)`},"data-matching-left-share":D.left,"data-matching-right-share":D.right,children:[t.jsx("ul",{className:"ws-match-col",children:s.pairs.map((g,w)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-num",children:[w+1,"."]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(pe,{text:g.left,editMode:y,style:m?.fields?.find(A=>A.key===`match-left:${w}`),onSelect:()=>n?.(`match-left:${w}`),onCommit:A=>{const H=s.pairs.map((W,C)=>C===w?{...W,left:A}:W);c({...s,pairs:H})}})})]},`l${w}`))}),t.jsx("div",{className:`ws-match-divider${y?" is-editable":""}`,role:y?"separator":void 0,"aria-label":y?r?"اسحب لتغيير عرض عمودي التوصيل":"Drag to resize matching columns":void 0,"aria-orientation":y?"vertical":void 0,"aria-valuemin":y?35:void 0,"aria-valuemax":y?65:void 0,"aria-valuenow":y?Math.round(D.left*100):void 0,tabIndex:y?0:void 0,onPointerDown:g=>{y&&(g.preventDefault(),g.stopPropagation(),g.currentTarget.setPointerCapture(g.pointerId),d(g.clientX))},onPointerMove:g=>{!y||!g.currentTarget.hasPointerCapture(g.pointerId)||d(g.clientX)},onKeyDown:g=>{if(!y||!["ArrowLeft","ArrowRight"].includes(g.key))return;g.preventDefault(),g.stopPropagation();const w=g.key==="ArrowRight"?2:-2,A=r?-w:w,H=Math.round(D.left*100);_?.(Math.min(65,Math.max(35,H+A)))},children:y&&t.jsx("span",{className:"ws-match-divider-handle","aria-hidden":"true",children:"↔"})}),t.jsx("ul",{className:"ws-match-col",children:es(s.pairs.length).map((g,w)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-letter",children:["(",Be(w,r),")"]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(pe,{text:s.pairs[g].right,editMode:y,style:m?.fields?.find(A=>A.key===`match-right:${g}`),onSelect:()=>n?.(`match-right:${g}`),onCommit:A=>{const H=s.pairs.map((W,C)=>C===g?{...W,right:A}:W);c({...s,pairs:H})}})})]},`r${w}`))})]}),s.type==="tic_tac_toe"&&t.jsx("div",{className:"ws-tic-board",role:"group","aria-label":r?"لوحة الاختيار — ثلاثة على خط":"Three-in-a-row choice board",children:s.cells.map((g,w)=>t.jsxs("div",{className:"ws-tic-cell",children:[t.jsx("span",{className:"ws-tic-check","aria-hidden":"true"}),g.imageUrl&&t.jsx("img",{className:"ws-tic-image",src:Hs(g.imageUrl)??"",alt:""}),t.jsx("span",{className:"ws-tic-text",children:t.jsx(pe,{text:g.text,editMode:y,style:m?.fields?.find(A=>A.key===`tic-cell:${w}`),onSelect:()=>n?.(`tic-cell:${w}`),onCommit:A=>{const H=s.cells.map((W,C)=>C===w?{...W,text:A}:W);c({...s,cells:H})}})}),t.jsxs("span",{className:"ws-tic-writing","aria-hidden":"true",children:[t.jsx("span",{}),t.jsx("span",{}),t.jsx("span",{})]})]},w))}),s.type==="tic_tac_toe"&&(m?.ticTacToeResponseLines??0)>0&&t.jsx("div",{className:"ws-short-lines mt-4","aria-hidden":"true",children:Array.from({length:m?.ticTacToeResponseLines??0}).map((g,w)=>t.jsx("div",{className:"ws-short-line"},w))}),s.type==="worked_problem"&&t.jsxs("div",{className:"ws-worked-problem",children:[t.jsx("div",{className:"ws-response-label",children:r?"خطوات الحل / مساحة العمل":"Steps / Work area"}),t.jsx("div",{className:"ws-work-steps",children:Array.from({length:Math.max(3,s.steps??4)}).map((g,w)=>t.jsxs("div",{className:"ws-work-step",children:[t.jsx("span",{className:"ws-work-step-num",children:w+1}),t.jsx("span",{className:"ws-work-step-line"})]},w))}),t.jsxs("div",{className:"ws-final-answer",children:[t.jsx("strong",{children:r?"الإجابة النهائية":"Final answer"}),t.jsx("span",{})]})]}),s.type==="extended_response"&&t.jsx("div",{className:"ws-extended-response","aria-label":r?"مساحة الإجابة الموسعة":"Extended response writing area",children:Array.from({length:Math.max(3,s.lines??6)}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))}),s.type==="error_correction"&&t.jsxs("div",{className:"ws-error-correction",children:[t.jsxs("div",{className:"ws-incorrect-box",children:[t.jsx("strong",{children:r?"النص غير الصحيح:":"Incorrect text:"}),t.jsx(Fe,{text:s.incorrectText,fallbackDirection:r?"rtl":"ltr"})]}),t.jsxs("div",{className:"ws-correction-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التصحيح":"Correction"}),Array.from({length:m?.errorCorrectionCorrectionLines??2}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))]}),(m?.errorCorrectionShowExplanation??!0)&&t.jsxs("div",{className:"ws-explanation-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التفسير":"Explanation"}),Array.from({length:m?.errorCorrectionExplanationLines??2}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))]})]}),s.type==="compare"&&t.jsxs("div",{className:"ws-compare-organizer",children:[t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(pe,{text:s.leftLabel,editMode:y,onSelect:()=>n?.("prompt"),onCommit:g=>c({...s,leftLabel:g})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(pe,{text:m?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:y,onSelect:()=>n?.("prompt"),onCommit:g=>U?.({compareDifferencesLabel:g})})}),Array.from({length:3}).map((g,w)=>t.jsx("span",{className:"ws-compare-line"},w))]}),t.jsxs("div",{className:"ws-compare-panel ws-compare-similarities",children:[t.jsx("strong",{children:t.jsx(pe,{text:m?.compareSimilaritiesLabel??(r?"أوجه التشابه":"Similarities"),editMode:y,onSelect:()=>n?.("prompt"),onCommit:g=>U?.({compareSimilaritiesLabel:g})})}),Array.from({length:3}).map((g,w)=>t.jsx("span",{className:"ws-compare-line"},w))]}),t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(pe,{text:s.rightLabel,editMode:y,onSelect:()=>n?.("prompt"),onCommit:g=>c({...s,rightLabel:g})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(pe,{text:m?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:y,onSelect:()=>n?.("prompt"),onCommit:g=>U?.({compareDifferencesLabel:g})})}),Array.from({length:3}).map((g,w)=>t.jsx("span",{className:"ws-compare-line"},w))]})]}),(s.type==="short_answer"||s.type==="tic_tac_toe")&&m?.rubric&&t.jsxs("div",{className:"ws-rubric",children:[t.jsx("strong",{children:r?"معيار النجاح:":"Success criterion:"}),t.jsx(Fe,{text:m.rubric,fallbackDirection:r?"rtl":"ltr"})]})]})]})}function Kt({item:e,ar:s,labels:r}){const{question:i,questionLabel:a,text:o,continuation:l}=e;return t.jsxs("div",{className:"ws-q ws-answer","data-answer-continuation":l||void 0,children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num",children:a}),t.jsx("div",{className:"ws-q-prompt-wrap",children:t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(Fe,{text:i.type==="matching"?s?"أزواج التوصيل":"Matching pairs":i.prompt,fallbackDirection:s?"rtl":"ltr"}),l&&t.jsxs("span",{className:"ws-answer-cont-label",children:[" (",s?"تابع":"continued",")"]})]})})]}),t.jsxs("div",{className:"ws-answer-line",children:[t.jsx("strong",{children:l?s?"تابع الإجابة:":"Answer continued:":r.correct})," ",t.jsx(Fe,{text:o,fallbackDirection:s?"rtl":"ltr"})]})]})}const Pr=["أ","ب","ج","د","هـ","و","ز","ح","ط","ي"];function Be(e,s){return s?Pr[e]??String(e+1):String.fromCharCode(65+e)}function Jt(e,s,r=16){return Math.max(0,e-(s-r))}function Zt(e,s,r){if(e.type===s)return e;const i={id:e.id,prompt:e.prompt??"",...e.points!==void 0?{points:e.points}:{}},a=e.type==="mcq"?e.options[e.correctIndex]??"":e.type==="true_false"?e.correct?r?"صح":"True":r?"خطأ":"False":e.type==="short_answer"||e.type==="fill_blank"||e.type==="worked_problem"||e.type==="extended_response"?e.answer??"":e.type==="error_correction"?e.correction:"";if(s==="true_false")return{...i,type:s,correct:!0};if(s==="short_answer")return{...i,type:s,lines:2,answer:a};if(s==="fill_blank")return{...i,type:s,answer:a};if(s==="worked_problem")return{...i,type:s,steps:4,answer:a};if(s==="extended_response")return{...i,type:s,lines:6,answer:a};if(s==="error_correction")return{...i,type:s,incorrectText:i.prompt,correction:a,explanation:""};if(s==="word_bank")return{...i,type:s,items:[],answers:[]};if(s==="compare")return{...i,type:s,leftLabel:r?"العنصر الأول":"Item A",rightLabel:r?"العنصر الثاني":"Item B",similarities:"",differences:""};if(s==="mcq"){const m=e.type==="matching"?e.pairs.map(n=>n.right).filter(Boolean).slice(0,4):[];for(;m.length<4;)m.push(r?`الخيار ${m.length+1}`:`Option ${m.length+1}`);return{...i,type:s,options:m,correctIndex:0}}if(s==="tic_tac_toe")return{...i,type:s,prompt:r?"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا، ونفّذ المهام.":"Choose three connected squares horizontally, vertically, or diagonally, and complete the tasks.",cells:(r?["تذكّر","فسّر","طبّق","قارن","ارسم","اكتب","حلّل","أنشئ","تحدَّ"]:["Recall","Explain","Apply","Compare","Draw","Write","Analyze","Create","Challenge"]).map(n=>({category:n,text:""}))};const o=e.type==="mcq"?e.options:[],l=Array.from({length:Math.max(3,Math.min(4,o.length))},(m,n)=>({left:r?`العبارة ${n+1}`:`Item ${n+1}`,right:o[n]||(r?`الإجابة ${n+1}`:`Answer ${n+1}`)}));return{...i,type:s,pairs:l}}function es(e){const s=Array.from({length:e},(a,o)=>o);let r=e*2654435761>>>0;const i=()=>{r|=0,r=r+1831565813|0;let a=Math.imul(r^r>>>15,1|r);return a=a+Math.imul(a^a>>>7,61|a)^a,((a^a>>>14)>>>0)/4294967296};for(let a=e-1;a>0;a--){const o=Math.floor(i()*(a+1)),l=s[a];s[a]=s[o],s[o]=l}return e>1&&s.every((a,o)=>a===o)&&([s[0],s[1]]=[s[1],s[0]]),s}function ts(e){const s=l=>{if(l.length===0)return 1;const m=l.map(p=>p.trim().length);return m.reduce((p,v)=>p+v,0)/m.length+Math.max(...m)*.5},r=s(e.map(l=>l.left)),i=s(e.map(l=>l.right)),a=r/(r+i),o=Math.round(Math.min(.65,Math.max(.35,a))*100)/100;return{left:o,right:Math.round((1-o)*100)/100}}function Hr({TC:e}){return t.jsx("style",{children:`
    @media screen {
      .ws-edit-strip { position: sticky; top: 52px; z-index: 30; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; padding: 6px 12px; background: #fbfaf5; border-bottom: 1px solid ${e}22; }
      .ws-strip-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 10px; border: 1px solid ${e}44; background: #fff; color: ${e}; font-size: 12px; font-weight: 800; cursor: pointer; }
      .ws-strip-btn:hover { background: ${e}0f; }
      .ws-strip-btn.is-primary { background: ${e}; color: #fff; border-color: ${e}; }
      .ws-edit-hint { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #4b5a53; }
      .ws-edit-hint button { border: 0; background: transparent; color: ${e}; font-weight: 800; text-decoration: underline; cursor: pointer; }
      .ws-question-block { position: relative; }
      .ws-q-pencil { position: absolute; top: 2px; inset-inline-end: -4px; z-index: 5; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; border: 1px solid ${e}44; background: #fff; color: ${e}; cursor: pointer; opacity: 0; transition: opacity 120ms ease; }
      .ws-q-pencil svg { width: 14px; height: 14px; }
      .ws-question-block:hover .ws-q-pencil, .ws-q-pencil:focus-visible { opacity: 1; }
      .ws-q-pencil { width: calc(28px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); height: calc(28px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); }
      @media (hover: none) { .ws-q-pencil { opacity: 1; width: calc(44px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); height: calc(44px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); top: -4px; } .ws-q-pencil svg { width: calc(20px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); height: calc(20px * var(--ws-inv-scale, 1) * var(--ws-fit-inv-scale, 1)); } }
      .ws-q-selected { outline: 1px solid ${e}77 !important; outline-offset: 3px; background: ${e}07 !important; }
      .ws-format-toolbar { padding: 6px 8px !important; border-width: 1px !important; gap: 5px 8px !important; box-shadow: 0 6px 20px rgba(20,40,32,0.2) !important; }
      .ws-format-details-toggle { height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid ${e}44; background: #fff; color: ${e}; font-size: 11px; font-weight: 800; cursor: pointer; }
      .ws-format-details-toggle.is-active { background: ${e}14; }
    }
  `})}function Wr({fontFamily:e,headingFont:s,fontSizePt:r,lang:i,themeColor:a}){const o=i==="ar",l=o?"right":"left",m=o?"left":"right",n=a;return t.jsx("style",{children:`
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
        letter-spacing: ${o?"0":"0.035em"};
        user-select: none;
      }

      /* Decorative gold corner ornaments. */
      .ws-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${P};
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
      .ws-headrow-title-only .ws-headstart,
      .ws-headrow-title-only .ws-headend {
        display: none;
      }
      .ws-headrow-title-only .ws-headcenter {
        flex: 1;
        min-width: 0;
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
        width: 64%; height: 2px; background: ${P};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${n} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${n}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${P} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${n}0d 0%, ${P}10 100%);
        border-${l}: 3px solid ${n};
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
        background: linear-gradient(135deg, ${P}1a 0%, ${P}08 100%);
        border-${l}: 4px solid ${P};
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
        margin-${l}: auto;
        white-space: nowrap;
        color: #566;
        font-weight: 700;
      }
      .ws-rubric {
        display: flex;
        gap: 1.5mm;
        margin-top: 2mm;
        padding: 1.5mm 2mm;
        border-${l}: 0.9mm solid ${n};
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
        border-${l}: 3px solid ${n};
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
        color: ${P};
        background: ${P}18;
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

      .ws-mcq { list-style: none; padding-${l}: 34px; margin: 2mm 0 0; display: grid; grid-template-columns: 1fr; gap: 2mm 16px; }
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
        padding-${l}: 34px;
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

      .ws-lines { padding-${l}: 36px; margin-top: 2mm; }
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

      .ws-fill { padding-${l}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${n};
      }

      .ws-match {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6mm minmax(0, 1fr);
        gap: 6mm;
        padding-${l}: 36px;
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
        outline: 3px solid ${P};
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
        color: ${P};
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
      .ws-answer .ws-q-num { background: ${P}; box-shadow: 0 0 0 2px ${n}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${l}: 36px;
        color: ${n};
        font-size: ${Math.max(9.5,r-.5)}pt;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .ws-answer-line strong { color: ${P}; margin-${m}: 4px; }
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
        ${o?"right":"left"}: 0;
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
        ${o?"left":"right"}: 20px;
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
          /* Keep the unscaled A4 box inside its page when a long header and
             near-full-page question leave only a pixel-scale safety margin. */
          padding-bottom: calc(16mm - 4px) !important;
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
    `})}function qr({worksheetId:e,page:s,total:r,ar:i}){const a=`${window.location.origin}/teacher/worksheets/${e}/grade?p=${s}&of=${r}`;return t.jsxs("div",{style:{position:"absolute",bottom:"6mm",insetInlineStart:"8mm",display:"flex",alignItems:"center",gap:"2mm",zIndex:5},children:[t.jsx("div",{style:{background:"white",padding:"1mm",border:"0.4mm solid #d4d4d4",borderRadius:"1mm",lineHeight:0},children:t.jsx(Ts,{value:a,size:52,style:{width:"13mm",height:"13mm"}})}),t.jsxs("div",{style:{fontSize:"7pt",color:"#8a8a8a",lineHeight:1.5,fontWeight:600},children:[t.jsx("div",{children:i?"امسح للتصحيح الذكي":"Scan to grade"}),r>1&&t.jsx("div",{style:{fontWeight:800,color:"#5a5a5a"},children:i?`صفحة ${s} / ${r}`:`Page ${s} / ${r}`})]})]})}function ss(e,s,r){return e.map((i,a)=>({id:`${i.id}:answer`,question:i,questionLabel:String(a+1),text:rs(i,s,r),continuation:!1}))}function Or(e){if(e.text.length<2)return null;const s=Math.floor(e.text.length/2),r=e.text.lastIndexOf(" ",s),i=e.text.indexOf(" ",s),a=r>s*.6?r:i>0?i:s,o=e.text.slice(0,a).trimEnd(),l=e.text.slice(a).trimStart();return!o||!l?null:[{...e,id:`${e.id}:a`,text:o},{...e,id:`${e.id}:b`,text:l,continuation:!0}]}function rs(e,s,r){if(e.type==="mcq")return`(${Be(e.correctIndex,s)}) ${e.options[e.correctIndex]??""}`;if(e.type==="true_false")return e.correct?r.true:r.false;if(e.type==="short_answer")return e.answer?.trim()||"—";if(e.type==="fill_blank")return e.answer;if(e.type==="worked_problem"||e.type==="extended_response")return e.answer?.trim()||"—";if(e.type==="error_correction"){const a=e.correction.trim()||"—",o=e.explanation?.trim();return o?`${s?"التصحيح:":"Correction:"} ${a} — ${s?"التفسير:":"Explanation:"} ${o}`:`${s?"التصحيح:":"Correction:"} ${a}`}if(e.type==="word_bank")return e.items.map((a,o)=>{const l=e.answers[o];return`${o+1}. ${l?.trim()||"—"}`}).join("    ");if(e.type==="compare"){const a=e.similarities,o=e.differences;return[a?.trim()?`${s?"أوجه التشابه:":"Similarities:"} ${a.trim()}`:"",o?.trim()?`${s?"أوجه الاختلاف:":"Differences:"} ${o.trim()}`:""].filter(Boolean).join(" — ")||"—"}if(e.type==="tic_tac_toe")return s?"تُقيّم المهام الثلاث المتصلة التي اختارها الطالب":"Grade the three connected tasks selected by the student";const i=es(e.pairs.length);return e.pairs.map((a,o)=>{const l=i.indexOf(o);return`${o+1} ← ${Be(l>=0?l:o,s)}`}).join("    ")}const hn=Object.freeze(Object.defineProperty({__proto__:null,QuestionFormattingToolbar:Xt,WorksheetPrintView:Gt,answerText:rs,buildAnswerItems:ss,convertQuestionType:Zt,default:Ar,matchingColumnFractions:ts,mobileToolbarScrollOffset:Jt,optionLabel:Be},Symbol.toStringTag,{value:"Module"}));export{Gt as W,vr as a,mn as b,dn as g,pn as s,hn as w};
