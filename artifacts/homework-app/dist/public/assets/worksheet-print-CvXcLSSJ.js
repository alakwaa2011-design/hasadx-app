import{j as t,r as u,v as $t,k as Se,X as As,aN as Ss,u as Cs,b as Ls,aD as Es,L as rt,R as Pt}from"./index-Bo0qczhm.js";import{P as Ms,F as zs,b as Is,S as Fs,I as Rs,T as Bs,V as Ds,c as Ps,H as Ws,e as Hs,p as qs,a as Os,d as Us}from"./print-export-zvDJfLGb.js";import{D as Qs,a as Ks,b as Ts,c as Wt}from"./dropdown-menu-1TSks3Qn.js";import{r as Vs}from"./image-url-Cm2t2lLM.js";import{I as Ys}from"./image-BBcFZmna.js";import{F as Gs}from"./file-text-B9ww_DKw.js";import{B as Xs,a as Ht,T as Js}from"./text-align-end-BqwFnqO-.js";import{S as Zs}from"./settings-kzjbfX57.js";import{P as Nt}from"./pen-line-BRykAyxS.js";import{E as er}from"./eye-BgeMEESD.js";import{a as We}from"./math-text-DGZnUJ2S.js";import{c as tr}from"./content-direction-DAlRqWnC.js";import{Q as sr}from"./index-qfikUPAe.js";import{A as rr}from"./arrow-left-Dntrpg-j.js";import{C as nr}from"./camera-BfNk-j0f.js";import{S as ir}from"./save-Cqc-gfQk.js";import{F as or}from"./file-type-EmHbh2hn.js";import{D as ar}from"./download-Dd9m7CBp.js";import{M as lr}from"./minus-CcH9IYGf.js";import{T as qt}from"./text-align-start-fn_lAWzQ.js";function qe(e){if(!e)return e;const s="/";try{const r=new URL(e,window.location.href);if(r.origin!==window.location.origin)return e;if(r.pathname===`${s}images/logo-hasaad.png`)return`${s}images/logo-hasaad-transparent.png`;if([`${s}images/logo-icon.png`,`${s}images/logo-mark.png`].includes(r.pathname))return`${s}images/logo-mark-transparent.png`}catch{return e}return e}const _t={geometric:{id:"geometric",nameAr:"هندسي",nameEn:"Geometric",description:"هيكل منظم، شبكة، وأرقام مربعة — للرياضيات والفيزياء",headerLayout:"tabular",defaultColor:"#1B2D6B",swatchColors:["#1B2D6B","#E07B20"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){return`
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
        /* This theme's ws-content has no top/side padding; keep the band
           inside that full-width box rather than bleeding past the A4 page. */
        .ws-band-top {
          background: ${e};
          padding: 8mm 18mm 6mm;
          margin: 0 0 5mm;
          width: 100%;
          box-sizing: border-box;
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
      `}},kids_play:{id:"kids_play",nameAr:"مرح الأطفال",nameEn:"Kids Play",description:"ألوان زاهية، حروف كبيرة، مرح وودود للمراحل الأولى",headerLayout:"playful",defaultColor:"#E84393",swatchColors:["#E84393","#FFC107"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:a}){const o="#2196F3",c="#4CAF50";return`
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
        .ws-theme-kids_play .ws-q:nth-child(3n+3) { border-color: ${c}44; }
        /* Very large circle number badges */
        .ws-theme-kids_play .ws-q-num {
          width: 32px; height: 32px;
          border-radius: 50%;
          box-shadow: none;
          font-size: ${Math.max(12,r+1)}pt;
          background: ${e};
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) .ws-q-num { background: ${o}; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) .ws-q-num { background: ${c}; }
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
      `}}},Zt="ws_last_theme";function jn(){try{return localStorage.getItem(Zt)??null}catch{return null}}function vn(e){try{localStorage.setItem(Zt,e)}catch{}}function kn(e,s,r,i,a){const o=(e??"").trim().toLowerCase(),c=(s??"").trim().toLowerCase();if(/روض|kg|kind|التمهيد|kinder|grade 1\b|1st grade|first grade|الأول الابتدائي|الصف الأول/.test(c))return"kids_play";const x=[[/رياض|math|حساب|جبر|هندس|algebra|geometry|trigon|calculus|statistics/,"geometric"],[/فيزياء|physics/,"science_lab"],[/علوم|science|biology|chemistry|أحياء|كيمياء|بيولوجيا|biolog|chem|lab/,"science_lab"],[/اللغة العربية|عرب|arabic lang|لغة عرب|نحو|إملاء|صرف|بلاغ/,"arabic_ink"],[/إسلام|دين|قرآن|تلاوة|فقه|حديث|سيرة|Islamic|religion|quran|fiqh|hadith|seerah/,"editorial"],[/english|اللغة الإنجليزية|لغة إنجليزية|grammar|vocabulary|reading/,"modern_band"],[/تاريخ|جغرافيا|اجتماع|وطني|history|geography|social stud|civics/,"editorial"],[/أدب|literature|poetry|قصة|رواية|شعر|نثر/,"editorial"],[/تقنية|حاسوب|حاسب|technology|computer|ict/,"modern_band"]];for(const[w,b]of x)if(w.test(o))return b===a?{geometric:"science_lab",science_lab:"geometric",arabic_ink:"editorial",editorial:"arabic_ink",modern_band:"exam_paper",exam_paper:"modern_band",kids_play:"modern_band"}[b]:b;if(/ثانو|secondary|high school|grade 1[0-2]|10th|11th|12th|عاشر|الحادي عشر|الثاني عشر/.test(c)){const b=["exam_paper","editorial","modern_band"].filter(S=>S!==a);return b[i%b.length]}const d=["geometric","modern_band","editorial","exam_paper","science_lab"].filter(w=>w!==a);return d[i%d.length]}const cr={geometric:"white",arabic_ink:"#FDFAF4",modern_band:"white",exam_paper:"white",kids_play:"#FFFBF0",science_lab:"white",editorial:"#FDF8F5"};function dr({data:e,labels:s,TC:r,ar:i,hasIdentity:a,customFields:o}){const c=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),x=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...o.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-tab-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"3mm",justifyContent:i?"flex-end":"flex-start"},children:t.jsx("img",{src:qe(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsxs("div",{className:"ws-tab-toprow",children:[t.jsx("div",{className:"",style:{textAlign:i?"right":"left"},children:x.map((n,d)=>t.jsx("div",{className:"ws-tab-school",children:n},d))}),t.jsx("h1",{className:"ws-tab-title",lang:e.language,children:e.title}),t.jsx("div",{className:"ws-tab-meta",children:c&&t.jsx("div",{children:c})})]}),t.jsx("div",{className:"ws-tab-inner-rule"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsx(mr,{data:e,labels:s,TC:r}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#555",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`4px solid ${r}`,fontSize:"90%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function mr({data:e,labels:s,TC:r}){const i=[e.settings.includeName&&{label:s.name,flex:2},e.settings.includeClass&&{label:s.clazz,flex:1},e.settings.includeDate&&{label:s.date,flex:1}].filter(Boolean);return t.jsx("div",{style:{display:"grid",gridTemplateColumns:i.map(a=>`${a.flex}fr`).join(" "),gap:"5mm",marginTop:"3mm"},children:i.map((a,o)=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${r}55`,paddingBottom:"3mm",fontWeight:700,color:r,fontSize:"90%"},children:[a.label,t.jsx("span",{style:{flex:1}})]},o))})}function pr({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:c}){const x=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName&&{label:s.school,value:e.settings.schoolName},e.settings.teacherName&&{label:s.teacher,value:e.settings.teacherName},e.settings.section&&{label:s.section,value:e.settings.section},...c.map(d=>({label:d.label.trim(),value:d.value}))].filter(Boolean);return t.jsxs("div",{className:"ws-arb-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"4mm"},children:t.jsx("img",{src:qe(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsx(Ot,{GOLD:i}),x&&t.jsx("div",{className:"ws-arb-kicker",children:x}),t.jsx("h1",{className:"ws-arb-title",lang:e.language,children:e.title}),t.jsx(Ot,{GOLD:i}),n.length>0&&t.jsx("div",{className:"ws-arb-identity",children:n.map((d,w)=>t.jsxs("div",{className:"ws-arb-cell",children:[t.jsxs("span",{className:"ws-arb-cell-label",children:[d.label,":"]}),t.jsx("span",{children:d.value})]},w))}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"5mm",marginTop:"4mm"},children:[e.settings.includeName&&t.jsx(ht,{label:s.name,TC:r,GOLD:i}),e.settings.includeClass&&t.jsx(ht,{label:s.clazz,TC:r,GOLD:i}),e.settings.includeDate&&t.jsx(ht,{label:s.date,TC:r,GOLD:i})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#6a5c3a",margin:"3mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${i}12`,borderInlineStart:`4px solid ${i}`,fontSize:"90%",lineHeight:1.7,borderRadius:"4px"},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function Ot({GOLD:e}){return t.jsxs("div",{className:"ws-arb-ornament",children:[t.jsx("div",{className:"ws-arb-ornament-line"}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-diamond",style:{background:e}}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-ornament-line"})]})}function ht({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px dashed ${r}88`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function hr({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:c}){const x=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...c.map(d=>`${d.label}: ${d.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-band-header",children:[t.jsxs("div",{className:"ws-band-top",children:[e.settings.logoUrl&&t.jsx("div",{style:{position:"absolute",top:"4mm",[a?"left":"right"]:"16mm"},children:t.jsx("img",{src:qe(e.settings.logoUrl),alt:"",style:{height:"12mm",width:"auto",objectFit:"contain",filter:"brightness(10)"}})}),n.length>0&&t.jsx("div",{className:"ws-band-chips",children:n.map((d,w)=>t.jsx("span",{className:"ws-band-chip",children:d},w))}),t.jsx("h1",{className:"ws-band-title",lang:e.language,children:e.title}),x&&t.jsx("div",{className:"ws-band-sub",children:x})]}),t.jsxs("div",{className:"ws-band-body",children:[(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-band-fields",children:[e.settings.includeName&&t.jsx(ut,{label:s.name,TC:r,flex:2}),e.settings.includeClass&&t.jsx(ut,{label:s.clazz,TC:r,flex:1}),e.settings.includeDate&&t.jsx(ut,{label:s.date,TC:r,flex:1})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"90%",color:"#555",margin:"0 0 3mm",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{className:"ws-band-instr",children:[t.jsxs("strong",{children:[s.instructions,":"]})," ",e.settings.instructions]})]})]})}function ut({label:e,TC:s,flex:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%",flex:r},children:[e,t.jsx("span",{style:{flex:1}})]})}function ur({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:c}){const x=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName,e.settings.section,...c.map(d=>d.value)].filter(Boolean);return t.jsxs("div",{className:"ws-play-header",children:[t.jsxs("div",{className:"ws-play-banner",children:[t.jsx("div",{className:"ws-play-stars",children:"★ ☆ ★"}),t.jsx("h1",{className:"ws-play-title",lang:e.language,children:e.title}),x&&t.jsx("div",{className:"ws-play-sub",children:x}),n.length>0&&t.jsx("div",{className:"ws-play-chips",children:n.map((d,w)=>t.jsx("span",{className:"ws-play-chip",children:d},w))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-play-fields",children:[e.settings.includeName&&t.jsx(gt,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(gt,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(gt,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontWeight:700,color:r,margin:"2mm 0",fontSize:"105%"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{background:`${r}12`,borderRadius:"10px",padding:"6px 12px",fontSize:"95%",fontWeight:700,color:r,marginBottom:"4mm"},children:["⭐ ",e.settings.instructions]})]})}function gt({label:e,TC:s}){return t.jsxs("div",{className:"ws-play-field",children:[e,t.jsx("span",{className:"ws-play-field-rule"})]})}function gr({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:c}){[e.subject,e.gradeLevel].filter(Boolean).join(" · ");const x=[e.settings.schoolName&&`${s.school}: ${e.settings.schoolName}`,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...c.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-clip-header",children:[t.jsxs("div",{className:"ws-clip-badges",children:[e.settings.logoUrl&&t.jsx("img",{src:qe(e.settings.logoUrl),alt:"",style:{height:"10mm",width:"auto",objectFit:"contain"}}),e.subject&&t.jsx("span",{className:"ws-clip-badge",children:e.subject}),e.gradeLevel&&t.jsx("span",{className:"ws-clip-badge-sec",children:e.gradeLevel})]}),t.jsxs("div",{className:"ws-clip-title-row",children:[t.jsx("h1",{className:"ws-clip-title",lang:e.language,children:e.title}),x.length>0&&t.jsx("div",{className:"ws-clip-identity",children:x.map((n,d)=>t.jsx("div",{className:"ws-clip-id-row",children:n},d))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-clip-fields",children:[e.settings.includeName&&t.jsx(xt,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(xt,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(xt,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"88%",color:"#4a7a7a",margin:"2mm 0 0"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"4px 9px",background:`${r}08`,border:`1.5px solid ${r}33`,borderRadius:"3px",fontSize:"88%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function xt({label:e,TC:s}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}55`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function xr({data:e,labels:s,TC:r,GOLD:i,ar:a,hasIdentity:o,customFields:c}){const x=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...c.map(d=>`${d.label}: ${d.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-mast-header",children:[t.jsx("div",{className:"ws-mast-rule-thick"}),t.jsx("div",{className:"ws-mast-rule-mid"}),e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{margin:"2mm auto"},children:t.jsx("img",{src:qe(e.settings.logoUrl),alt:"",className:"ws-logo-img"})}),t.jsx("h1",{className:"ws-mast-title",lang:e.language,children:e.title}),x&&t.jsx("div",{className:"ws-mast-meta",children:x}),n.length>0&&t.jsx("div",{className:"ws-mast-identity",children:n.map((d,w)=>t.jsx("span",{children:d},w))}),t.jsx("div",{className:"ws-mast-rule-thin"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-mast-fields",children:[e.settings.includeName&&t.jsx(wt,{label:s.name,TC:r,GOLD:i}),e.settings.includeClass&&t.jsx(wt,{label:s.clazz,TC:r,GOLD:i}),e.settings.includeDate&&t.jsx(wt,{label:s.date,TC:r,GOLD:i})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"88%",color:"#6a4a5a",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`3px solid ${i}`,fontSize:"88%",lineHeight:1.7},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function wt({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function wr(e,s){return e?_t[e]?.headingFontOverride??s:s}const fr=["display","position","top","right","bottom","left","box-sizing","width","height","min-width","min-height","max-width","max-height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","border-top","border-right","border-bottom","border-left","border-radius","background-color","background-image","background-size","background-position","background-repeat","background-clip","color","opacity","visibility","font-family","font-size","font-weight","font-style","font-variant","line-height","letter-spacing","word-spacing","text-align","text-indent","text-decoration","text-transform","text-shadow","white-space","word-break","overflow-wrap","direction","unicode-bidi","vertical-align","writing-mode","transform","transform-origin","z-index","overflow-x","overflow-y","clip-path","box-shadow","filter","mix-blend-mode","flex-direction","flex-wrap","flex-grow","flex-shrink","flex-basis","align-items","align-self","align-content","justify-content","order","gap","grid-template-columns","grid-template-rows","grid-column","grid-row","column-count","column-width","column-gap","column-fill","column-rule","list-style-type","list-style-position","object-fit","object-position","fill","fill-opacity","stroke","stroke-width","stroke-linecap","stroke-linejoin"];function Ut(e){return fr.map(s=>{const r=e.getPropertyValue(s);return r?`${s}:${r};`:""}).join("")}function br(e){const s=e.cloneNode(!0),r=[];let i=0;const a=(o,c)=>{if(o.matches(".no-print, script, iframe, object, embed, link")){c.remove();return}const x=`ws-export-${i++}`;c.setAttribute("data-ws-export-node",x),c.setAttribute("style",Ut(getComputedStyle(o))),c.removeAttribute("contenteditable"),c.removeAttribute("autofocus"),Array.from(c.attributes).forEach(d=>{/^on/i.test(d.name)&&c.removeAttribute(d.name)});for(const d of["::before","::after"]){const w=getComputedStyle(o,d),b=w.getPropertyValue("content");b&&b!=="none"&&b!=="normal"&&r.push(`[data-ws-export-node="${x}"]${d}{${Ut(w)}content:${b};}`)}c instanceof HTMLElement&&(o.matches(".ws-editable")&&(c.style.backgroundColor="transparent",c.style.boxShadow="none",c.style.outline="none"),o.matches(".ws-q-selected")&&(c.style.backgroundColor="transparent",c.style.outline="none"));const n=Array.from(c.children);Array.from(o.children).forEach((d,w)=>a(d,n[w]))};if(a(e,s),s.style.setProperty("zoom","1"),s.style.margin="0",s.style.boxShadow="none",s.style.width=`${e.offsetWidth||210/25.4*96}px`,s.style.height="auto",r.length){const o=document.createElement("style");o.textContent=r.join(`
`),s.appendChild(o)}return s}const es="[data-worksheet-page], [data-answer-key-page]",Qt=11906,Kt=16838;class te extends Error{constructor(s){super(`Visual Word export failed: ${s}`),this.code=s}}function yr(e,s,r="ar"){if(!e.length)throw new te("pages");return new zs({creator:"Hasad",title:s,description:r==="ar"?"نسخة مطابقة بصريًا؛ صفحات مصورة غير قابلة لتحرير النص":"Visual copy; page images, not editable text",sections:e.map((i,a)=>{const o=Math.min(Qt/15/i.width,Kt/15/i.height);return{properties:{type:Fs.NEXT_PAGE,page:{size:{width:Qt,height:Kt},margin:{top:0,bottom:0,left:0,right:0,header:0,footer:0}}},children:[new Is({spacing:{before:0,after:0,line:20},children:[new Rs({type:"png",data:i.data,transformation:{width:i.width*o,height:i.height*o},altText:{name:`Worksheet page ${a+1}`,title:`${s} — ${a+1}`,description:r==="ar"?"صفحة مصورة للحفاظ على التصميم":"Page image preserving the design"},floating:{horizontalPosition:{relative:Hs.PAGE,align:Ws.CENTER},verticalPosition:{relative:Ps.PAGE,align:Ds.TOP},wrap:{type:Bs.NONE},allowOverlap:!0,behindDocument:!1}})]})]}})})}function jr(e){return new Promise((s,r)=>{const i=new FileReader;i.onload=()=>s(String(i.result)),i.onerror=()=>r(new te("image")),i.readAsDataURL(e)})}async function vr(e,s){const r=Array.from(e.querySelectorAll("img")).filter(o=>!o.closest(".no-print")),i=Array.from(s.querySelectorAll("img")),a=new Map;await Promise.all(r.map(async(o,c)=>{const x=o.currentSrc||o.src;if(!x||!i[c])throw new te("image");a.has(x)||a.set(x,(async()=>{try{const d=await fetch(x,{credentials:"same-origin",signal:AbortSignal.timeout(2e4)});if(!d.ok)throw new te("image");return await jr(await d.blob())}catch{throw new te("image")}})());const n=i[c];n.removeAttribute("srcset"),n.removeAttribute("crossorigin"),n.loading="eager",n.src=await a.get(x),typeof n.decode=="function"&&await n.decode().catch(()=>{throw new te("image")})}))}async function kr(e){if("fonts"in document){let i;try{await Promise.race([document.fonts.ready.catch(()=>{}),new Promise(a=>{i=setTimeout(a,8e3)})])}finally{clearTimeout(i)}}let s="",r=0;for(let i=0;i<20&&r<3;i+=1){await new Promise(o=>requestAnimationFrame(()=>o()));const a=Array.from(e.querySelectorAll(es)).map(o=>`${o.scrollHeight}:${o.textContent?.length}`).join("|");r=a===s?r+1:0,s=a}}async function $r(e){await Promise.all(Array.from(e.querySelectorAll("img")).filter(s=>!s.closest(".no-print")).map(s=>new Promise((r,i)=>{const a=s.getAttribute("loading"),o=d=>{clearTimeout(n),s.removeEventListener("load",c),s.removeEventListener("error",x),a===null?s.removeAttribute("loading"):s.setAttribute("loading",a),d?i(new te("image")):r()},c=()=>o(!1),x=()=>o(!0),n=setTimeout(x,2e4);s.addEventListener("load",c,{once:!0}),s.addEventListener("error",x,{once:!0}),s.loading="eager",s.complete&&o(s.naturalWidth===0)})))}async function Nr(e,s,r){if(!Number.isSafeInteger(s)||s<=0)throw new te("pages");await $r(e),await kr(e);try{const i=Array.from(e.querySelectorAll(es));if(!i.length)throw new te("pages");const a=i.map(br);await Promise.all(i.map((c,x)=>vr(c,a[x])));const o=[];for(const[c,x]of a.entries()){const n=i[c].offsetWidth||793.7007874015749,d=i[c].offsetHeight||297/25.4*96,w=await fetch(`/api/worksheets/${s}/render-page`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(9e4),body:JSON.stringify({html:x.outerHTML,width:n,height:d})});if(w.status===429)throw new te("busy");if(!w.ok||!w.headers.get("content-type")?.includes("image/png"))throw new te("capture");o.push({data:new Uint8Array(await w.arrayBuffer()),width:n,height:d}),r?.(c+1,a.length)}return o}catch(i){throw i instanceof te?i:new te("capture")}}async function _r(e){const s=await Nr(e.element,e.worksheetId,e.onProgress),r=await Ms.toBlob(yr(s,e.title,e.lang)),i=e.title.replace(/[\\/:*?"<>|\x00-\x1f]+/g,"-").trim().slice(0,80)||"worksheet",a=URL.createObjectURL(r),o=document.createElement("a");o.href=a,o.download=`${i} - ${e.lang==="en"?"Visual design":"مطابق للتصميم"}.docx`,document.body.appendChild(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(a),1500)}const ts=210/25.4*96;function Ar(e,s=ts){return e<=0||s<=0?1:Math.min(1,e/s)}function Sr(){const e=u.useRef(null);return u.useLayoutEffect(()=>{const s=e.current;if(!s)return;const r=()=>{const a=getComputedStyle(s),o=s.clientWidth-(parseFloat(a.paddingLeft)||0)-(parseFloat(a.paddingRight)||0),c=s.querySelector(":scope > .ws-page"),x=Ar(o,c?.offsetWidth||ts),n=String(x);s.style.getPropertyValue("--ws-preview-scale")!==n&&s.style.setProperty("--ws-preview-scale",n),s.style.setProperty("--ws-fit-inv-scale",String(1/x))};r();const i=typeof ResizeObserver=="function"?new ResizeObserver(r):null;return i?.observe(s),window.addEventListener("resize",r),()=>{i?.disconnect(),window.removeEventListener("resize",r)}},[]),e}const ft="#225739";function Cr({layout:e}){return e?.elements?.length?t.jsx(t.Fragment,{children:e.elements.map(s=>{const r={position:"absolute",left:`${s.x}%`,top:`${s.y}%`,width:`${s.width}%`,height:s.kind==="line"?`${s.strokeWidth??2}px`:`${s.height}%`,pointerEvents:"none",boxSizing:"border-box",zIndex:2,opacity:s.opacity??1};return s.kind==="text"?t.jsx("div",{style:{...r,fontSize:`${s.fontSize??14}pt`,fontWeight:s.bold?800:400,fontStyle:s.italic?"italic":"normal",color:s.fontColor??"#1a2421",textAlign:s.align??"right",padding:"2px 4px",whiteSpace:"pre-wrap",wordBreak:"break-word",overflow:"hidden"},children:s.text??""},s.id):s.kind==="rect"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??ft}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:`${s.borderRadius??2}px`,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="circle"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??ft}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:"50%",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="line"?t.jsx("div",{style:{...r,background:s.strokeColor??ft,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):null})}):null}const bt=6,Lr=[{color:"#225739",label:"أخضر حصاد"},{color:"#1a3a6b",label:"أزرق رسمي"},{color:"#5C2D0E",label:"بني دافئ"},{color:"#4a1a6b",label:"أرجواني"},{color:"#1A1A2E",label:"أسود راقٍ"},{color:"#7b1a1a",label:"أحمر"}],xe="w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";function ie({label:e,children:s,className:r}){return t.jsxs("label",{className:`block ${r??""}`,children:[t.jsx("span",{className:"block text-[11px] font-bold mb-1 text-muted-foreground",children:e}),s]})}function Te({label:e,value:s,onChange:r,testId:i}){return t.jsx("button",{type:"button",role:"switch","aria-checked":!!s,"data-testid":i,onClick:()=>r(!s),className:`px-3 h-8 rounded-full border text-xs font-bold transition-colors ${s?"bg-primary text-primary-foreground border-primary":"bg-background text-muted-foreground hover:bg-muted"}`,children:e})}function Er({ar:e,settings:s,onSettingsChange:r,meta:i,onMetaChange:a,onClearProfile:o,showProfileNote:c,readOnly:x,gradeSuggestions:n}){const[d,w]=u.useState(null),b=l=>r(j=>({...j,...l})),S=s.customFields??[],ee=!!(s.schoolName||s.section||s.teacherName||s.logoUrl||S.length),k=[{id:"info",label:e?"بيانات الورقة":"Details",icon:t.jsx(Gs,{className:"w-3.5 h-3.5"})},{id:"header",label:e?"الترويسة":"Header",icon:t.jsx(Xs,{className:"w-3.5 h-3.5"})},{id:"design",label:e?"التصميم":"Design",icon:t.jsx(Zs,{className:"w-3.5 h-3.5"})}];return t.jsxs("fieldset",{disabled:x,className:"min-w-0 border-0 p-0 m-0","data-testid":"panel-worksheet-format",children:[t.jsx("div",{role:"tablist",className:`flex gap-1 p-1 bg-muted/50 rounded-lg w-full sm:w-auto sm:inline-flex ${d?"mb-3":""}`,children:k.map(l=>t.jsxs("button",{role:"tab",type:"button","aria-selected":d===l.id,"aria-expanded":d===l.id,"data-testid":`tab-format-${l.id}`,onClick:()=>w(j=>j===l.id?null:l.id),className:`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold ${d===l.id?"bg-background shadow-sm text-primary":"text-muted-foreground"}`,children:[l.icon,l.label]},l.id))}),d==="info"&&t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[t.jsx(ie,{label:e?"عنوان الورقة":"Title",className:"sm:col-span-3",children:t.jsx("input",{"data-testid":"input-ws-title",value:i.title,maxLength:200,onChange:l=>a({title:l.target.value}),className:xe})}),t.jsx(ie,{label:e?"المادة":"Subject",className:"sm:col-span-2",children:t.jsx("input",{"data-testid":"input-ws-subject",value:i.subject,maxLength:100,onChange:l=>a({subject:l.target.value}),className:xe})}),t.jsx(ie,{label:e?"الصف":"Grade",children:t.jsx("input",{"data-testid":"input-ws-grade",list:n?.length?"ws-grade-suggestions":void 0,value:i.gradeLevel,maxLength:100,onChange:l=>a({gradeLevel:l.target.value}),className:xe})}),n?.length?t.jsx("datalist",{id:"ws-grade-suggestions",children:n.map(l=>t.jsx("option",{value:l},l))}):null]}),d==="header"&&t.jsxs("div",{className:"space-y-4",children:[t.jsxs("div",{className:"flex items-center justify-between gap-2",children:[t.jsx("p",{className:"text-[11px] text-muted-foreground",children:c?e?"تُحفظ تلقائياً لكل أوراقك القادمة":"Saved automatically for future sheets":""}),o&&ee&&t.jsx("button",{type:"button",onClick:o,className:"text-[11px] font-bold text-destructive hover:underline",children:e?"مسح المحفوظ":"Clear saved"})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[t.jsx(ie,{label:e?"اسم المدرسة":"School name",children:t.jsx("input",{"data-testid":"input-ws-school",value:s.schoolName??"",maxLength:200,onChange:l=>b({schoolName:l.target.value}),className:xe})}),t.jsx(ie,{label:e?"اسم المعلم":"Teacher",children:t.jsx("input",{"data-testid":"input-ws-teacher",value:s.teacherName??"",maxLength:100,onChange:l=>b({teacherName:l.target.value}),className:xe})}),t.jsx(ie,{label:e?"القسم":"Department",className:"sm:col-span-2",children:t.jsx("input",{"data-testid":"input-ws-section",value:s.section??"",maxLength:100,onChange:l=>b({section:l.target.value}),className:xe})})]}),t.jsxs("div",{className:"pt-2 border-t border-border/50",children:[t.jsxs("div",{className:"flex items-center justify-between mb-2",children:[t.jsx("span",{className:"text-[11px] font-bold",children:e?"حقول إضافية (اختياري)":"Extra fields"}),t.jsxs("button",{type:"button","data-testid":"button-add-custom-field",onClick:()=>{if(S.length>=bt){Se.error(e?`الحد الأقصى ${bt} حقول`:`Max ${bt} fields`);return}b({customFields:[...S,{label:"",value:""}]})},className:"text-[11px] font-bold px-2 py-1 rounded bg-muted hover:bg-muted/80 flex items-center gap-1",children:[t.jsx($t,{className:"w-3 h-3"})," ",e?"إضافة":"Add"]})]}),S.length===0?t.jsx("p",{className:"text-[11px] text-muted-foreground",children:e?"مثال: العام الدراسي، الدرجة، الفصل…":"e.g., Academic Year, Marks, Term…"}):t.jsx("div",{className:"space-y-2",children:S.map((l,j)=>t.jsxs("div",{className:"flex gap-2 items-center",children:[t.jsx("input",{"aria-label":e?"اسم الحقل":"Label",value:l.label,maxLength:40,placeholder:e?"اسم الحقل":"Label",onChange:F=>b({customFields:S.map((R,W)=>W===j?{...R,label:F.target.value}:R)}),className:"w-1/3 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"}),t.jsx("input",{"aria-label":e?"القيمة":"Value",value:l.value,maxLength:120,placeholder:e?"القيمة":"Value",onChange:F=>b({customFields:S.map((R,W)=>W===j?{...R,value:F.target.value}:R)}),className:"flex-1 h-8 px-2 rounded border bg-background text-xs outline-none focus:border-primary"}),t.jsx("button",{type:"button","aria-label":e?"حذف الحقل":"Remove field",onClick:()=>b({customFields:S.filter((F,R)=>R!==j)}),className:"p-1 rounded text-destructive hover:bg-destructive/10",children:t.jsx(As,{className:"w-4 h-4"})})]},j))})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3",children:[t.jsx(ie,{label:e?"ملاحظة الترويسة":"Header note",children:t.jsx("input",{"data-testid":"input-ws-header-note",value:s.headerNote??"",maxLength:300,onChange:l=>b({headerNote:l.target.value}),className:xe})}),t.jsx(ie,{label:e?"ملاحظة التذييل":"Footer note",children:t.jsx("input",{"data-testid":"input-ws-footer-note",value:s.footerNote??"",maxLength:300,onChange:l=>b({footerNote:l.target.value}),className:xe})})]}),t.jsx(ie,{label:e?"تعليمات الطالب":"Instructions",children:t.jsx("textarea",{"data-testid":"input-ws-instructions",rows:2,value:s.instructions??"",onChange:l=>b({instructions:l.target.value}),className:"w-full p-2 rounded-lg border bg-background text-sm outline-none focus:border-primary"})}),t.jsx(ie,{label:e?"جملة الختام":"Closing line",children:t.jsx("input",{"data-testid":"input-ws-goodluck",value:s.goodLuck??"",maxLength:200,placeholder:e?"نتمنى لك التوفيق (الافتراضي)":"Good luck! (default)",onChange:l=>b({goodLuck:l.target.value}),className:xe})}),t.jsxs("div",{className:"flex flex-wrap gap-2 pt-2 border-t border-border/50",children:[t.jsx(Te,{testId:"toggle-ws-name",label:e?"الاسم":"Name",value:s.includeName,onChange:l=>b({includeName:l})}),t.jsx(Te,{testId:"toggle-ws-date",label:e?"التاريخ":"Date",value:s.includeDate,onChange:l=>b({includeDate:l})}),t.jsx(Te,{testId:"toggle-ws-class",label:e?"الصف":"Class",value:s.includeClass,onChange:l=>b({includeClass:l})}),t.jsx(Te,{testId:"toggle-ws-answers",label:e?"ورقة الإجابات":"Answer key",value:s.includeAnswerKey,onChange:l=>b({includeAnswerKey:l})}),t.jsx(Te,{testId:"toggle-ws-watermark",label:e?"علامة مائية":"Watermark",value:s.showWatermark,onChange:l=>b({showWatermark:l})})]})]}),d==="design"&&t.jsxs("div",{className:"space-y-5",children:[t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-2 text-muted-foreground",children:e?"القالب المرئي":"Visual template"}),t.jsxs("div",{className:"grid grid-cols-4 sm:grid-cols-7 gap-2",children:[t.jsx("button",{type:"button","aria-pressed":!s.template,"data-testid":"theme-classic",onClick:()=>b({template:void 0}),className:`p-1.5 rounded-lg border-2 ${s.template?"border-transparent hover:bg-muted":"border-primary bg-primary/5"}`,children:t.jsx("div",{className:"h-8 rounded flex items-center justify-center border border-dashed border-primary/40 bg-background text-[9px] font-bold text-primary",children:e?"كلاسيك":"Classic"})}),Object.values(_t).map(l=>{const j=s.template===l.id,[F]=l.swatchColors;return t.jsxs("button",{type:"button","aria-pressed":j,"data-testid":`theme-${l.id}`,title:e?`${l.nameAr}: ${l.description}`:l.nameEn,onClick:()=>b({template:j?void 0:l.id}),className:"p-1.5 rounded-lg border-2 transition-colors",style:{borderColor:j?F:"transparent",background:j?`${F}10`:void 0},children:[t.jsxs("div",{className:"h-8 rounded overflow-hidden shadow-sm",style:{background:F},children:[t.jsx("div",{className:"h-[40%]",style:{background:F}}),t.jsx("div",{className:"h-[60%] bg-white",children:t.jsx("div",{className:"mx-1 mt-0.5 h-px",style:{background:`${F}44`}})})]}),t.jsx("span",{className:"block mt-1 text-[9px] font-bold truncate",children:e?l.nameAr:l.nameEn})]},l.id)})]})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-3 gap-3",children:[t.jsx(ie,{label:e?"الأعمدة":"Columns",children:t.jsx("div",{className:"flex gap-1",role:"group",children:[1,2].map(l=>t.jsx("button",{type:"button","aria-pressed":s.columns===l,"data-testid":`columns-${l}`,onClick:()=>b({columns:l}),className:`flex-1 h-9 rounded-lg border text-sm font-bold ${s.columns===l?"bg-primary text-primary-foreground border-primary":"bg-background"}`,children:l},l))})}),t.jsx(ie,{label:e?"نوع الخط":"Font",children:t.jsxs("select",{"data-testid":"select-ws-font",value:s.fontFamily,onChange:l=>b({fontFamily:l.target.value}),className:xe,children:[t.jsx("option",{value:"default",children:e?"افتراضي":"Default"}),t.jsx("option",{value:"cairo",children:"Cairo"}),t.jsx("option",{value:"tajawal",children:"Tajawal"}),t.jsx("option",{value:"amiri",children:"Amiri"}),t.jsx("option",{value:"noto-naskh",children:"Noto Naskh"}),t.jsx("option",{value:"inter",children:"Inter"}),t.jsx("option",{value:"georgia",children:"Georgia"})]})}),t.jsx(ie,{label:e?`حجم الخط (${s.fontSizePt}pt)`:`Font size (${s.fontSizePt}pt)`,children:t.jsx("input",{"data-testid":"range-ws-fontsize",type:"range",min:9,max:18,step:1,value:s.fontSizePt,onChange:l=>b({fontSizePt:parseInt(l.target.value,10)}),className:"w-full mt-2"})})]}),t.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-1.5 text-muted-foreground",children:e?"لون الورقة":"Accent color"}),t.jsxs("div",{className:"flex flex-wrap gap-2 items-center",children:[Lr.map(l=>t.jsx("button",{type:"button",title:l.label,"aria-label":l.label,"aria-pressed":s.themeColor===l.color,onClick:()=>b({themeColor:s.themeColor===l.color?void 0:l.color}),className:"w-6 h-6 rounded-full border-2",style:{background:l.color,borderColor:s.themeColor===l.color?"#fff":"transparent",boxShadow:s.themeColor===l.color?`0 0 0 2px ${l.color}`:"none"}},l.color)),t.jsxs("label",{className:"w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer bg-background",title:e?"لون مخصص":"Custom",children:[t.jsx("input",{type:"color",className:"sr-only","aria-label":e?"لون مخصص":"Custom color",value:s.themeColor??"#225739",onChange:l=>b({themeColor:l.target.value})}),t.jsx($t,{className:"w-3 h-3 text-muted-foreground"})]}),s.themeColor&&t.jsx("button",{type:"button",onClick:()=>b({themeColor:void 0}),className:"text-[11px] text-muted-foreground hover:underline",children:e?"افتراضي":"Reset"})]})]}),t.jsxs("div",{children:[t.jsx("div",{className:"text-[11px] font-bold mb-1.5 text-muted-foreground",children:e?"الشعار (اختياري)":"Logo"}),s.logoUrl?t.jsxs("div",{className:"flex items-center gap-3",children:[t.jsx("img",{src:s.logoUrl,alt:e?"الشعار":"Logo",className:"h-8 w-auto rounded border object-contain bg-white"}),t.jsx("button",{type:"button",onClick:()=>b({logoUrl:void 0}),className:"text-[11px] text-destructive hover:underline",children:e?"إزالة":"Remove"})]}):t.jsxs("label",{className:"flex items-center justify-center gap-2 cursor-pointer h-8 rounded-lg border border-dashed border-border bg-background hover:bg-muted text-xs text-muted-foreground",children:[t.jsx(Ys,{className:"w-3.5 h-3.5"}),t.jsx("span",{children:e?"رفع صورة (PNG/JPG)":"Upload (PNG/JPG)"}),t.jsx("input",{type:"file",accept:"image/png,image/jpeg,image/webp",className:"sr-only","data-testid":"input-ws-logo",onChange:l=>{const j=l.target.files?.[0];if(l.target.value="",!j)return;if(j.size>500*1024){Se.error(e?"الحجم يجب أن يكون أقل من 500KB":"Under 500KB");return}const F=new FileReader;F.onload=R=>b({logoUrl:R.target?.result}),F.readAsDataURL(j)}})]})]})]})]})]})}const yt="#225739";function Mr({ar:e,mode:s,onChange:r,disabled:i}){const a=[{id:"edit",label:e?"تعديل الورقة":"Edit",icon:t.jsx(Nt,{className:"w-4 h-4"})},{id:"preview",label:e?"المعاينة النهائية":"Final preview",icon:t.jsx(er,{className:"w-4 h-4"})}];return t.jsx("div",{role:"group","aria-label":e?"وضع الورقة":"Worksheet mode",className:"no-print inline-flex items-center gap-1 rounded-xl border p-1 bg-white",style:{borderColor:`${yt}55`},"data-testid":"switch-worksheet-mode",children:a.map(o=>{const c=s===o.id;return t.jsxs("button",{type:"button",disabled:i,"aria-pressed":c,"data-testid":`button-worksheet-mode-${o.id}`,onClick:()=>{c||r(o.id)},className:"flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-bold transition-colors disabled:opacity-50",style:c?{background:yt,color:"#fff"}:{color:yt},children:[o.icon,t.jsx("span",{children:o.label})]},o.id)})})}const Tt="",me="#225739",H="#D9A521";function zr(e,s){const r="'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif",i="'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";switch(e){case"cairo":return`'Cairo', ${r}`;case"tajawal":return`'Tajawal', ${r}`;case"amiri":return`'Amiri', 'Scheherazade New', ${r}`;case"noto-naskh":return`'Noto Naskh Arabic', ${r}`;case"inter":return`'Inter', ${i}`;case"georgia":return"Georgia, 'Times New Roman', serif";default:return s==="ar"?r:i}}function Ir(e){return e==="ar"?"'Cairo', 'Noto Naskh Arabic', 'Tajawal', sans-serif":"'Inter', 'Source Sans Pro', sans-serif"}function Vt(e,s,r,i,a,o){if(e.length===0)return[[]];const c=s*.352778*1.85,x=r===2?22:44,n=5,d=k=>{const j=10+Math.max(1,Math.ceil((k.prompt?.length??0)/x))*c;switch(k.type){case"mcq":return j+k.options.filter(Boolean).length*c*1.3;case"true_false":return j+c*1.1;case"short_answer":return j+(k.lines??2)*9;case"fill_blank":return j+3;case"matching":return j+k.pairs.length*c*1.3;case"tic_tac_toe":return Math.max(185,j+165);case"worked_problem":return j+Math.max(4,k.steps??4)*8+12;case"extended_response":return j+Math.max(3,k.lines??6)*8;case"error_correction":return j+16+16+12;case"word_bank":return j+18;case"compare":return j+42}},w=[];let b=[],S=0,ee=i;if(r===2)for(let k=0;k<e.length;k+=2){const l=o?.has(e[k].id)||k+1<e.length&&o?.has(e[k+1].id),j=Math.max(d(e[k]),k+1<e.length?d(e[k+1]):0)+n;b.length>0&&(l||S+j>ee)&&(w.push(b),b=[],S=0,ee=a),b.push(e[k]),k+1<e.length&&b.push(e[k+1]),S+=j}else for(const k of e){const l=o?.has(k.id),j=d(k)+n;b.length>0&&(l||S+j>ee)&&(w.push(b),b=[],S=0,ee=a),b.push(k),S+=j}return b.length>0&&w.push(b),w.length>0?w:[e]}function Fr({theme:e,TC:s,GOLD:r,BG:i,fontFamily:a,headingFont:o,fontSizePt:c,lang:x}){const n=x==="ar",d=n?"right":"left",w=n?"left":"right";return t.jsx("style",{children:e.css({TC:s,GOLD:r,BG:i,fontFamily:a,headingFont:o,fontSizePt:c,isAr:n,startSide:d,endSide:w})})}function Rr({theme:e,data:s,labels:r,TC:i,GOLD:a,ar:o,hasIdentity:c,customFields:x,classicFallback:n}){if(!e)return n;const d={data:s,labels:r,TC:i,GOLD:a,ar:o,hasIdentity:c,customFields:x,IdentityCell:()=>null,FieldLine:()=>null,DoubleDivider:()=>null,IconUser:()=>null,IconClass:()=>null,IconDate:()=>null,IconLightbulb:()=>null,IconSchool:()=>null,IconSection:()=>null,IconTeacher:()=>null,IconField:()=>null};switch(e.headerLayout){case"tabular":return t.jsx(dr,{...d});case"arabesque":return t.jsx(pr,{...d});case"band":return t.jsx(hr,{...d});case"playful":return t.jsx(ur,{...d});case"clipboard":return t.jsx(gr,{...d});case"masthead":return t.jsx(xr,{...d});default:return n}}const Yt=[];function ss({data:e,onLayoutChange:s,onDraftChange:r,flushRef:i,onRequestSave:a,onRequestDiscard:o,onRequestEdit:c,initialEditQuestionId:x,editing:n,onEditingChange:d}){const w=e.language==="ar",b=w?"rtl":"ltr",S=zr(e.settings.fontFamily,e.language),ee=Ir(e.language),k=e.settings.template,l=k?_t[k]:void 0,j=k?cr[k]??"white":"white",F=wr(k,ee),R=Math.min(18,Math.max(9,e.settings.fontSizePt??12)),W=e.settings.showWatermark!==!1,p=e.settings.themeColor??l?.defaultColor??me,E=qe(e.settings.logoUrl),[h,y]=u.useState(e.questions),_=u.useRef(e.questions),[z,B]=u.useState(()=>new Set(e.settings.pageBreaks??[])),Y=u.useRef(z),C=u.useCallback(m=>{const f=typeof m=="function"?m(Y.current):m;Y.current=f,B(f)},[]),je=u.useRef(r);je.current=r;const pe=u.useCallback(()=>({questions:_.current,pageBreaks:[...Y.current],questionStyles:ae.current}),[]),G=u.useCallback(()=>{je.current?.(pe())},[pe]);i&&(i.current=()=>{const m=document.activeElement;return m&&m!==document.body&&m.closest("#ws-printable-root")&&m.blur(),pe()});const[ve,fe]=u.useState(()=>e.settings.questionStyles??[]),ae=u.useRef(e.settings.questionStyles??[]),[L,Q]=u.useState(x&&s?{questionId:x,key:"prompt"}:null),[Ve,oe]=u.useState(()=>{try{return localStorage.getItem("hasad:ws:edit-hint-seen")==="1"}catch{return!0}}),le=u.useCallback(()=>{oe(!0);try{localStorage.setItem("hasad:ws:edit-hint-seen","1")}catch{}},[]),Ce=u.useCallback(m=>{s?(Ne(!0),Q({questionId:m,key:"prompt"}),le()):c?.(m)},[s,c,le]),Le=u.useMemo(()=>{const m=new Set;let f=null;for(const v of h)v.type!==f&&(m.add(v.id),f=v.type);return m},[h]),[ke,ot]=u.useState(!1),[Ee,se]=u.useState(!1),ce=n!==void 0,[Ye,at]=u.useState(!!x&&!!s),q=ce?!!n:Ye,$e=u.useRef(q);$e.current=q;const Ge=u.useRef(d);Ge.current=d;const Ne=u.useCallback(m=>{const f=typeof m=="function"?m($e.current):m;$e.current=f,at(f),Ge.current?.(f)},[]);u.useEffect(()=>{q||Q(null)},[q]);const[g,$]=u.useState(null),[V,X]=u.useState(null),D=u.useRef(e.questions),J=u.useRef(e.settings.questionStyles??Yt),be=u.useRef((e.settings.pageBreaks??[]).join(","));u.useEffect(()=>{const m=e.settings.questionStyles??Yt,f=(e.settings.pageBreaks??[]).join(",");let v=!1;D.current!==e.questions&&(D.current=e.questions,e.questions!==_.current&&(_.current=e.questions,y(e.questions),v=!0)),J.current!==m&&(J.current=m,m!==ae.current&&(ae.current=m,fe(m),v=!0)),be.current!==f&&(be.current=f,[...Y.current].join(",")!==f&&(C(new Set(e.settings.pageBreaks??[])),v=!0)),v&&(Q(null),se(!1))},[e,C]),u.useCallback(m=>{C(f=>{const v=new Set(f);return v.add(m),v}),se(!0),G()},[G,C]),u.useCallback(m=>{C(f=>{const v=new Set(f);return v.delete(m),v}),se(!0),G()},[G,C]),u.useCallback(()=>{if(a){a();return}s?.(_.current,[...Y.current],ae.current),se(!1)},[s,a]);const _e=u.useCallback(()=>{if(o){o(),Q(null),se(!1),ce||Ne(!1);return}_.current=e.questions,y(e.questions),C(new Set(e.settings.pageBreaks??[]));const m=e.settings.questionStyles??[];ae.current=m,fe(m),Q(null),se(!1),ce||Ne(!1)},[e,o,ce,Ne]),At=u.useCallback(m=>{const f=_.current.map(v=>v.id===m.id?m:v);_.current=f,y(f),C(new Set),se(!0),G()},[G,C]),Me=u.useCallback((m,f)=>{const v=ae.current,A=v.find(M=>M.questionId===m)??{questionId:m},P=f(A),N=[...v.filter(M=>M.questionId!==m),P];ae.current=N,fe(N),C(new Set),se(!0),G()},[G,C]),ds=u.useCallback((m,f,v)=>{Me(m,A=>{const P=A.fields??[],N=P.find(M=>M.key===f)??{key:f};return{...A,fields:[...P.filter(M=>M.key!==f),{...N,...v}]}})},[Me]),ms=u.useCallback(()=>{L&&Me(L.questionId,m=>({...m,fields:(m.fields??[]).filter(f=>f.key!==L.key)}))},[L,Me]);u.useCallback(m=>{if(!g)return;X(null),$(null);const f=_.current,A=Vt(f,R,e.settings.columns,190,250,z)[m];if(!A||A.length===0)return;const P=A[0].id;if(P===g)return;const N=f.find(I=>I.id===g);if(!N)return;const M=f.filter(I=>I.id!==g),K=M.findIndex(I=>I.id===P),T=K===-1?[...M,N]:[...M.slice(0,K),N,...M.slice(K)];_.current=T,y(T),se(!0),G()},[g,R,e.settings.columns,z,G]);const O=w?{name:"الاسم",date:"التاريخ",clazz:"الصف",section:"القسم",school:"المدرسة",teacher:"المعلم",instructions:"تعليمات",answerKey:"صفحة الإجابات",question:"س",true:"صح",false:"خطأ",correct:"الإجابة:",goodLuck:"نتمنى لك التوفيق ✦"}:{name:"Name",date:"Date",clazz:"Class",section:"Section",school:"School",teacher:"Teacher",instructions:"Instructions",answerKey:"Answer Key",question:"Q",true:"True",false:"False",correct:"Answer:",goodLuck:"✦ Good luck!"},Oe=(e.settings.customFields??[]).filter(m=>(m?.label?.trim()??"")||(m?.value?.trim()??"")),ps=!!e.settings.schoolName||!!e.settings.section||!!e.settings.teacherName||!!E||Oe.length>0,Ue=e.settings.columns,[ze,St]=u.useState(()=>Vt(e.questions,R,Ue,190,250)),Re=ls(h,w,O),[Ct,lt]=u.useState(()=>[Re]),Lt=u.useRef(null),hs=Sr(),Et=u.useRef(""),[ct,us]=u.useState(0),Xe=`${S}|${F}`;u.useEffect(()=>{const m=typeof document<"u"?document.fonts:void 0;if(!m)return;let f=!0;const v=()=>{f&&us(A=>A+1)};return m.ready.then(v).catch(()=>{}),m.addEventListener?.("loadingdone",v),()=>{f=!1,m.removeEventListener?.("loadingdone",v)}},[Xe]),u.useLayoutEffect(()=>{const m=[JSON.stringify(h),e.title,e.subject??"",e.gradeLevel??"",Ue,R,e.settings.schoolName??"",e.settings.section??"",e.settings.teacherName??"",E?"logo":"",e.settings.includeName?"n":"",e.settings.includeDate?"d":"",e.settings.includeClass?"c":"",e.settings.instructions??"",e.settings.headerNote??"",e.settings.footerNote??"",e.settings.goodLuck??"",JSON.stringify(Oe),e.settings.learningObjective??"",e.settings.activityDuration??"",k??"",[...z].sort().join(","),JSON.stringify(ve),Xe,ct].join("|");if(m===Et.current)return;const f=Lt.current;if(!f)return;const v=Array.from(f.querySelectorAll("[data-q-measure]"));if(v.length!==h.length)return;const A=f.querySelector("[data-header-measure]"),P=f.querySelector("[data-continuation-measure]"),N=f.querySelector("[data-footer-measure]"),M=Array.from(f.querySelectorAll("[data-answer-measure]")),K=f.querySelector("[data-answer-header-measure]"),T=f.querySelector("[data-answer-continuation-measure]");Et.current=m;const I=3.7795,Je=263*I,bs=A?A.offsetHeight:60*I,ys=P?P.offsetHeight:12*I,Ze=N?N.offsetHeight:18*I,js=12*I,vs=8*I,ks=Math.max(Je-bs-Ze-js,80*I),Ft=Math.max(Je-Ze-ys-vs,150*I),Rt=4*I,mt=v.map(U=>U.offsetHeight+Rt),Qe=[];let de=[],Be=0,et=ks;if(Ue===2)for(let U=0;U<h.length;U+=2){const Ie=Math.max(mt[U]??0,mt[U+1]??0),pt=z.has(h[U].id)||U+1<h.length&&z.has(h[U+1].id);de.length>0&&(pt||Be+Ie>et)&&(Qe.push(de),de=[],Be=0,et=Ft),de.push(h[U]),U+1<h.length&&de.push(h[U+1]),Be+=Ie}else for(let U=0;U<h.length;U++){const Ie=mt[U];de.length>0&&(z.has(h[U].id)||Be+Ie>et)&&(Qe.push(de),de=[],Be=0,et=Ft),de.push(h[U]),Be+=Ie}if(de.length>0&&Qe.push(de),Qe.length>0&&St(Qe),M.length===Re.length&&Re.length>0){const U=K?K.offsetHeight:38*I,Ie=T?T.offsetHeight:12*I,pt=4*I,$s=3*I,Ns=Math.max(Je-U-Ze-pt,80*I),Bt=Math.max(Je-Ie-Ze-$s,150*I),tt=[];let he=[],Ke=0,st=Ns;const Dt=(Ae,re,Fe)=>{const Z=Ae.cloneNode(!0),ue=Z.querySelector(".ws-answer-line"),ge=Z.querySelector(".ws-q-prompt");ue&&(ue.textContent=`${Fe?w?"تابع الإجابة:":"Answer continued:":O.correct} ${re}`),Fe&&ge&&ge.append(` (${w?"تابع":"continued"})`),f.appendChild(Z);const ne=Z.offsetHeight+Rt;return Z.remove(),ne},_s=(Ae,re,Fe,Z)=>{let ue=1,ge=re.length,ne=0;for(;ue<=ge;){const Pe=Math.floor((ue+ge)/2);Dt(Ae,re.slice(0,Pe),Fe)<=Z?(ne=Pe,ue=Pe+1):ge=Pe-1}if(ne<=0)return 0;const De=Math.max(re.lastIndexOf(" ",ne),re.lastIndexOf(`
`,ne),re.lastIndexOf("	",ne));let ye=De>=Math.floor(ne*.6)?De:ne;return ye>0&&/[\uD800-\uDBFF]/.test(re[ye-1]??"")&&(ye-=1),Math.max(1,ye)};for(let Ae=0;Ae<Re.length;Ae++){const re=Re[Ae],Fe=M[Ae];let Z=re.text,ue=0;for(;Z;){const ge=re.continuation||ue>0,ne={...re,id:`${re.id}:${ue}`,text:Z,continuation:ge},De=Dt(Fe,Z,ge);if(Ke+De<=st){he.push(ne),Ke+=De;break}if(he.length>0){tt.push(he),he=[],Ke=0,st=Bt;continue}const ye=_s(Fe,Z,ge,st);if(ye<=0||ye>=Z.length){he.push(ne),Ke=De;break}const Pe=Z.slice(0,ye).trimEnd();he.push({...ne,text:Pe}),tt.push(he),he=[],Ke=0,st=Bt,Z=Z.slice(ye).trimStart(),ue+=1}}he.length>0&&tt.push(he),lt(tt)}else h.length===0&&lt([[]])}),u.useLayoutEffect(()=>{const m=document.getElementById("ws-printable-root");if(!m)return;const f=Array.from(m.querySelectorAll("[data-worksheet-page]")),v=297/25.4*96,A=f.findIndex(N=>N.offsetHeight>v+2);if(A<0)return;const P=A===0&&ze[0]?.length===1;(ze[A]?.length??0)<=1&&!P||St(N=>{const M=N.map(T=>[...T]),K=M[A].pop();return K?(M[A+1]?M[A+1].unshift(K):M.push([K]),M):N})},[ze,ct,Xe]),u.useLayoutEffect(()=>{if(!e.settings.includeAnswerKey)return;const m=document.getElementById("ws-printable-root");if(!m)return;const f=Array.from(m.querySelectorAll("[data-answer-key-page]")),v=297/25.4*96,A=f.findIndex(P=>P.offsetHeight>v+2);A<0||lt(P=>{const N=P.map(K=>[...K]);if(N[A].length===1){const K=Zr(N[A][0]);return K?(N[A]=[K[0]],N[A+1]?N[A+1].unshift(K[1]):N.push([K[1]]),N):P}const M=N[A].pop();return M?(N[A+1]?N[A+1].unshift(M):N.push([M]),N):P})},[Ct,e.settings.includeAnswerKey,ct,Xe]);const gs=t.jsxs("header",{className:"ws-header",children:[t.jsxs("div",{className:`ws-headrow${!E&&!e.settings.schoolName&&!e.settings.section&&!e.settings.teacherName&&Oe.length===0?" ws-headrow-title-only":""}`,dir:w?"rtl":"ltr",children:[t.jsxs("div",{className:"ws-headstart",children:[e.settings.schoolName&&t.jsx(nt,{label:O.school,value:e.settings.schoolName,icon:t.jsx(Dr,{})}),e.settings.section&&t.jsx(nt,{label:O.section,value:e.settings.section,icon:t.jsx(Pr,{})}),e.settings.teacherName&&t.jsx(nt,{label:O.teacher,value:e.settings.teacherName,icon:t.jsx(Wr,{})}),Oe.map((m,f)=>t.jsx(nt,{label:m.label.trim()||(w?"حقل":"Field"),value:m.value,icon:t.jsx(Hr,{})},`cf-${f}`))]}),t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",children:e.title}),(e.subject||e.gradeLevel)&&t.jsx("div",{className:"ws-kicker-center",children:[e.subject,e.gradeLevel].filter(Boolean).join(" · ")}),t.jsx(kt,{})]}),t.jsx("div",{className:"ws-headend",children:E&&t.jsx("img",{src:E,alt:w?"شعار المدرسة":"School logo",className:"ws-logo-img"})})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-fields",children:[e.settings.includeName&&t.jsx(jt,{label:O.name,icon:t.jsx(qr,{})}),e.settings.includeClass&&t.jsx(jt,{label:O.clazz,icon:t.jsx(Or,{}),short:!0}),e.settings.includeDate&&t.jsx(jt,{label:O.date,icon:t.jsx(Ur,{}),short:!0})]}),e.settings.headerNote&&t.jsx("p",{className:"ws-subtitle",children:e.settings.headerNote}),e.settings.learningObjective&&t.jsxs("div",{className:"ws-learning-objective",children:[t.jsx("strong",{children:w?"هدف الورقة:":"Learning objective:"}),t.jsx("span",{children:e.settings.learningObjective}),e.settings.activityDuration&&t.jsx("small",{children:w?`${e.settings.activityDuration} دقيقة`:`${e.settings.activityDuration} min`})]}),e.settings.instructions&&t.jsxs("div",{className:"ws-instructions",children:[t.jsx(Qr,{}),t.jsxs("div",{children:[t.jsx("strong",{children:O.instructions}),t.jsxs("span",{children:[" ",e.settings.instructions]})]})]})]}),Mt=t.jsx(Rr,{theme:l,data:e,labels:O,TC:p,GOLD:H,ar:w,hasIdentity:ps,customFields:Oe,classicFallback:gs}),xs=Ue===2?"calc((174mm - 8mm) / 2)":"174mm",zt=`ws-page${k?` ws-theme-${k}`:""}`,ws="bg-neutral-200",dt=L?h.find(m=>m.id===L.questionId):void 0,It=L?ve.find(m=>m.questionId===L.questionId):void 0,fs=L?It?.fields?.find(m=>m.key===L.key):void 0;return u.useEffect(()=>{if(!L)return;const m=window.requestAnimationFrame(()=>{if(!window.matchMedia("(max-width: 640px)").matches)return;const f=document.activeElement,v=document.querySelector(".ws-format-toolbar");if(!(f instanceof HTMLElement)||!f.matches(".ws-editable")||!v)return;const A=f.getBoundingClientRect(),P=v.getBoundingClientRect(),N=ns(A.bottom,P.top);N>0&&window.scrollBy({top:N,behavior:"smooth"})});return()=>window.cancelAnimationFrame(m)},[L]),t.jsxs(t.Fragment,{children:[t.jsx(Xr,{fontFamily:S,headingFont:F,fontSizePt:R,lang:e.language,themeColor:p}),t.jsx(Gr,{TC:p}),l&&t.jsx(Fr,{theme:l,TC:p,GOLD:H,BG:j,fontFamily:S,headingFont:F,fontSizePt:R,lang:e.language}),t.jsxs("div",{ref:Lt,"aria-hidden":"true",className:`no-print print-host${k?` ws-theme-${k}`:""}`,style:{position:"fixed",left:0,top:0,width:"210mm",height:0,overflow:"hidden",visibility:"hidden",pointerEvents:"none"},dir:b,children:[t.jsx("div",{"data-header-measure":!0,style:{width:"174mm"},children:Mt}),t.jsx("div",{"data-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:w?"صفحة 2":"Page 2"})]})}),h.map((m,f)=>t.jsx("div",{"data-q-measure":!0,style:{width:xs},children:t.jsx(Xt,{index:String(f+1),q:m,ar:w,labels:O,showTypeHeader:Le.has(m.id),questionStyle:ve.find(v=>v.questionId===m.id)})},m.id)),t.jsx("div",{"data-footer-measure":!0,style:{width:"174mm"},children:t.jsx(vt,{note:e.settings.footerNote,goodLuck:e.settings.goodLuck?.trim()||O.goodLuck})}),t.jsx("div",{"data-answer-header-measure":!0,style:{width:"174mm"},children:t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:H},children:O.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:H,background:`${H}1f`},children:e.title}),t.jsx(kt,{gold:!0})]})})})}),t.jsx("div",{"data-answer-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsxs("span",{className:"ws-cont-title",children:[O.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:w?"صفحة متابعة":"Continued"})]})}),Re.map(m=>t.jsx("div",{"data-answer-measure":!0,style:{width:"174mm"},children:t.jsx(Jt,{item:m,ar:w,labels:O})},`answer-${m.id}`))]}),s&&(!ce||q)&&t.jsxs("div",{className:"no-print ws-edit-strip",dir:b,role:"group","aria-label":w?"أدوات التعديل":"Edit tools","data-testid":"strip-worksheet-edit",children:[!ce&&t.jsxs("button",{type:"button",className:`ws-strip-btn ${q?"is-primary":""}`,"data-testid":"button-toggle-edit-mode","aria-pressed":q,onClick:()=>{Ne(m=>(m&&Q(null),!m)),le()},children:[t.jsx(Nt,{style:{width:14,height:14}}),q?w?"إنهاء التعديل":"Done editing":w?"تحرير الورقة":"Edit worksheet"]}),q&&Ee&&t.jsx("button",{type:"button",className:"ws-strip-btn",onClick:_e,"data-testid":"button-strip-discard",title:w?"إلغاء تعديلات هذه الجلسة والعودة إلى آخر نسخة محفوظة":"Discard this session's changes",children:w?"تجاهل التعديلات":"Discard"}),q&&z.size>0&&t.jsx("button",{type:"button",className:"ws-strip-btn","data-testid":"button-auto-layout",onClick:()=>{C(new Set),se(!0),G()},title:w?"إزالة فواصل الصفحات اليدوية وإعادة توزيع الأسئلة":"Remove manual page breaks and repaginate",children:w?"توزيع تلقائي":"Auto layout"}),!Ve&&(ce?q:!q)&&t.jsxs("span",{className:"ws-edit-hint",role:"note","data-testid":"hint-edit-first-use",children:[w?"انقر على أي نص في الورقة لتعديله مباشرة، أو على القلم بجانب السؤال.":"Click any text on the paper to edit it, or use the pencil beside a question.",t.jsx("button",{type:"button",onClick:le,"aria-label":w?"إخفاء التلميح":"Dismiss hint","data-testid":"button-dismiss-edit-hint",children:w?"فهمت":"Got it"})]})]}),q&&L&&dt&&t.jsx(rs,{ar:w,question:dt,questionNumber:h.findIndex(m=>m.id===dt.id)+1,questionStyle:It,fieldStyle:fs,onFieldChange:m=>ds(L.questionId,L.key,m),onQuestionChange:m=>Me(L.questionId,f=>({...f,...m})),onQuestionTypeChange:m=>{const f=_.current.map(v=>v.id===L.questionId?is(v,m,w):v);_.current=f,y(f),C(new Set),Q({questionId:L.questionId,key:"prompt"}),se(!0),G()},onQuestionEdit:At,onResetField:ms,onResetQuestion:()=>{const m=ae.current.filter(f=>f.questionId!==L.questionId);ae.current=m,fe(m),se(!0),G()}}),t.jsxs("div",{id:"ws-printable-root",ref:hs,"data-responsive-preview":!0,className:`print-host ${q&&L?"ws-format-toolbar-open ":""}${ws} min-h-screen py-6 px-2 flex flex-col items-center`,dir:b,style:q?{outline:"none"}:void 0,children:[ze.map((m,f)=>{const v=f+1,A=f===0,P=f===ze.length-1;return t.jsxs("article",{"data-worksheet-page":!0,className:zt,lang:e.language,style:{background:j},children:[W&&t.jsx(Gt,{ar:w}),!k&&t.jsx(it,{}),k==="arabic_ink"&&t.jsx(it,{}),A&&t.jsx(Cr,{layout:e.settings.layout}),t.jsxs("div",{className:"ws-content",children:[A?Mt:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:w?`صفحة ${v}`:`Page ${v}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:Ue===2?2:1},children:m.map(N=>{const M=h.find(T=>T.id===N.id)??N,K=h.findIndex(T=>T.id===N.id);return t.jsx(Xt,{index:String(K+1),q:M,ar:w,labels:O,editMode:q,showPencil:ce&&q,onEdit:At,showTypeHeader:Le.has(N.id),questionStyle:ve.find(T=>T.questionId===N.id),onSelectField:T=>Q({questionId:N.id,key:T}),selected:q&&L?.questionId===N.id,onStartEdit:(s||c)&&!(ce&&!q)?()=>Ce(N.id):void 0,onSelectQuestion:()=>Q({questionId:N.id,key:"prompt"}),onMatchingWidthChange:T=>{Me(N.id,I=>({...I,matchingLeftWidth:T})),Q({questionId:N.id,key:"prompt"})},onQuestionStyleChange:T=>{Me(N.id,I=>({...I,...T})),Q({questionId:N.id,key:"prompt"})}},N.id)})}),t.jsx(vt,{note:P?e.settings.footerNote:void 0,goodLuck:P?e.settings.goodLuck?.trim()||O.goodLuck:""})]}),e.linkedAssignmentId!=null&&t.jsx(Jr,{worksheetId:e.id,page:v,total:ze.length,ar:w})]},v)}),e.settings.includeAnswerKey&&Ct.map((m,f)=>{const v=ze.length+f+1;return t.jsxs("article",{"data-answer-key-page":!0,"data-answer-key-page-number":f+1,className:zt,lang:e.language,style:{background:j},children:[W&&t.jsx(Gt,{ar:w}),!k&&t.jsx(it,{}),k==="arabic_ink"&&t.jsx(it,{}),t.jsxs("div",{className:"ws-content",children:[f===0?t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:H},children:O.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:H,background:`${H}1f`},children:e.title}),t.jsx(kt,{gold:!0})]})})}):t.jsxs("div",{className:"ws-cont-header","data-answer-key-continuation":!0,children:[t.jsxs("span",{className:"ws-cont-title",children:[O.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:w?`صفحة ${v}`:`Page ${v}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:1},children:m.map(A=>t.jsx(Jt,{item:A,ar:w,labels:O},A.id))}),t.jsx(vt,{goodLuck:""})]})]},`answer-page-${f+1}`)})]})]})}function Br(){const s=Ss()?.id,{lang:r}=Cs(),[,i]=Ls(),a=Es("/teacher/worksheets/create"),[o,c]=u.useState(null),x=u.useRef(null),n=u.useCallback(g=>{const $=typeof g=="function"?g(x.current):g;x.current=$,c($)},[]),d=u.useRef(null),w=u.useRef(null),b=u.useRef(0),S=u.useRef(null),[ee,k]=u.useState(!0),[l,j]=u.useState(null),[F,R]=u.useState(""),W=u.useRef(!1),[p,E]=u.useState("edit"),[h,y]=u.useState(!1),[_,z]=u.useState(null),[B,Y]=u.useState(!1),C=h||l!==null,je=u.useRef(!1),[pe,G]=u.useState(""),[ve,fe]=u.useState(null),[,ae]=u.useState(0),L=g=>JSON.stringify({t:g.title,s:g.subject,g:g.gradeLevel,st:{...g.settings,pageBreaks:g.settings.pageBreaks??[],questionStyles:g.settings.questionStyles??[]}}),Q=g=>JSON.stringify(g.questions),Ve=u.useRef(r);Ve.current=r,u.useEffect(()=>{if(!s)return;const g=new AbortController;return k(!0),fetch(`${Tt}/api/worksheets/${s}`,{credentials:"include",signal:g.signal}).then($=>{if(!$.ok)throw new Error("load failed");return $.json()}).then($=>{g.signal.aborted||(d.current={meta:L($),questions:Q($)},w.current=$,n($))}).catch(()=>{g.signal.aborted||Se.error(Ve.current==="ar"?"تعذّر تحميل ورقة العمل":"Failed to load worksheet")}).finally(()=>{g.signal.aborted||k(!1)}),()=>g.abort()},[s,n]);const oe=o?.isOwner!==!1,le=!!(o&&d.current&&oe&&(L(o)!==d.current.meta||Q(o)!==d.current.questions)),Ce=u.useRef(!1);Ce.current=le,u.useEffect(()=>{const g=$=>{const V=x.current,X=d.current,D=S.current?.(),J=V&&D?{...V,questions:D.questions,settings:{...V.settings,pageBreaks:D.pageBreaks,questionStyles:D.questionStyles}}:V,be=J&&X&&J.isOwner!==!1&&(L(J)!==X.meta||Q(J)!==X.questions);(Ce.current||be)&&($.preventDefault(),$.returnValue="")};return window.addEventListener("beforeunload",g),()=>window.removeEventListener("beforeunload",g)},[]);const Le=u.useCallback(g=>{n($=>$&&{...$,questions:g.questions,settings:{...$.settings,pageBreaks:g.pageBreaks,questionStyles:g.questionStyles}})},[n]),ke=u.useCallback(()=>{const g=S.current?.();g&&Le(g);const $=x.current;return!$||!g?$:{...$,questions:g.questions,settings:{...$.settings,pageBreaks:g.pageBreaks,questionStyles:g.questionStyles}}},[Le]),ot=async()=>{if(!(W.current||je.current)){W.current=!0,y(!0),z(null);try{ke(),await qs(x.current?.title??"")}catch(g){z(Os(g,r==="ar"))}finally{W.current=!1,y(!1)}}},Ee=u.useCallback(async()=>{if(je.current||W.current)return!1;const g=ke(),$=d.current;if(!g||!$||g.isOwner===!1)return!1;je.current=!0,Y(!0),G("");const V=Q(g)!==$.questions,X={title:g.title,language:g.language,gradeLevel:g.gradeLevel,subject:g.subject,questions:g.questions,settings:g.settings};V&&g.linkedAssignmentId!=null&&(X.smartGrading=!0);try{const D=await fetch(`${Tt}/api/worksheets/${g.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(X)});if(!D.ok){const _e=await D.json().catch(()=>({}));throw new Error(_e?.message||"save failed")}const J=await D.json().catch(()=>null),be=Array.isArray(J)?J[0]:J;return d.current={meta:L(g),questions:Q(g)},w.current=g,n(_e=>_e&&{..._e,linkedAssignmentId:be&&"linkedAssignmentId"in be?be.linkedAssignmentId??null:_e.linkedAssignmentId}),Se.success(be?.gradingVersioned?r==="ar"?"تم الحفظ وإنشاء نسخة جديدة للتصحيح":"Saved; grading version updated":r==="ar"?"تم حفظ تعديلات الورقة":"Worksheet changes saved"),!0}catch(D){const J=(D instanceof Error&&D.message!=="save failed"?D.message:"")||(r==="ar"?"تعذّر الحفظ. تعديلاتك محفوظة هنا؛ أعد المحاولة.":"Save failed. Your edits are kept here; retry.");return G(J),Se.error(J),!1}finally{je.current=!1,Y(!1),ae(D=>D+1)}},[ke,n,r]),se=u.useCallback(()=>{const g=w.current;g&&(G(""),n($=>$?{...g,linkedAssignmentId:$.linkedAssignmentId,isOwner:$.isOwner}:g))},[n]),ce=u.useCallback(()=>{Ee()},[Ee]),Ye=u.useCallback(g=>{W.current||(ke(),b.current+=1,queueMicrotask(()=>{Ce.current||x.current&&d.current&&x.current.isOwner!==!1&&(L(x.current)!==d.current.meta||Q(x.current)!==d.current.questions)?fe(()=>g):g()}))},[ke]),at=u.useCallback(g=>{n($=>$&&{...$,...g.title!==void 0?{title:g.title}:{},...g.subject!==void 0?{subject:g.subject.trim()?g.subject:null}:{},...g.gradeLevel!==void 0?{gradeLevel:g.gradeLevel.trim()?g.gradeLevel:null}:{}})},[n]),q=u.useCallback(g=>{n($=>$&&{...$,settings:g($.settings)})},[n]);if(ee)return t.jsx("div",{className:"min-h-screen flex items-center justify-center",children:t.jsx(rt,{className:"w-8 h-8 animate-spin",style:{color:me}})});if(!o)return t.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:r==="ar"?"لم يتم العثور على ورقة العمل.":"Worksheet not found."});const $e=o.language==="ar"?"rtl":"ltr",Ge=g=>{g===p||W.current||(ke(),E(g))},Ne=async g=>{if(W.current||je.current)return;ke();const $=document.getElementById("ws-printable-root");if(!$){Se.error(r==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}W.current=!0,j(g),R("");try{g==="visual"?await _r({element:$,title:o.title,lang:o.language,worksheetId:o.id,onProgress:(V,X)=>R(`${V}/${X}`)}):await Us({element:$,title:`${o.title} - ${r==="ar"?"قابل للتحرير":"Editable"}`,lang:o.language}),Se.success(r==="ar"?"تم تجهيز ملف Word للتنزيل":"Word file ready for download")}catch(V){const X=V instanceof te&&V.code==="image",D=V instanceof te&&V.code==="busy";Se.error(D?r==="ar"?"خدمة التصدير مشغولة الآن؛ أعد المحاولة بعد قليل.":"The export service is busy. Please retry shortly.":X?r==="ar"?"تعذّر تحميل إحدى صور التصميم. لم يُصدّر ملف ناقص؛ أعد المحاولة بعد اكتمال تحميل الصور.":"A design image could not be loaded. No incomplete file was exported; retry after images finish loading.":r==="ar"?"تعذّر تصدير ملف Word. يرجى المحاولة مرة أخرى.":"Could not export the Word file. Please try again.")}finally{W.current=!1,j(null),R("")}};return t.jsxs(t.Fragment,{children:[t.jsxs("div",{dir:$e,className:"no-print ws-action-toolbar sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[t.jsxs("button",{onClick:()=>Ye(a),disabled:C,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${me}55`,color:me},children:[t.jsx(rr,{className:"w-3.5 h-3.5"}),r==="ar"?"رجوع":"Back"]}),t.jsx("div",{className:"text-xs font-bold truncate flex-1 text-center",style:{color:me},children:o.title}),oe&&t.jsx(Mr,{ar:r==="ar",mode:p,onChange:Ge,disabled:C}),t.jsxs("div",{className:"ws-actions flex gap-1.5 flex-wrap justify-end",children:[o.isOwner!==!1&&o.linkedAssignmentId!=null&&t.jsxs("button",{onClick:()=>Ye(()=>i(`/teacher/worksheets/${o.id}/grade`)),disabled:C,className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:"#2f684d"},title:r==="ar"?"تصحيح الأوراق بالكاميرا":"Grade papers with camera","data-testid":"btn-open-grading",children:[t.jsx(nr,{className:"w-3.5 h-3.5"}),r==="ar"?"تصحيح":"Grade"]}),oe&&t.jsx(t.Fragment,{children:t.jsxs("button",{onClick:()=>{Ee()},disabled:B||C||!le,className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm disabled:opacity-50",style:{background:le?me:"#2f684d"},"data-testid":"btn-save-worksheet",children:[B?t.jsx(rt,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(ir,{className:"w-3.5 h-3.5"}),B?r==="ar"?"جار الحفظ":"Saving":le?r==="ar"?"حفظ التعديلات":"Save changes":r==="ar"?"محفوظ":"Saved"]})}),t.jsxs(Qs,{dir:r==="ar"?"rtl":"ltr",children:[t.jsx(Ks,{asChild:!0,children:t.jsxs("button",{disabled:C||B,"aria-busy":l!==null,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5 disabled:opacity-60",style:{borderColor:`${me}55`,color:me},title:r==="ar"?"اختر نسخة Word":"Choose a Word version","data-testid":"btn-word-export",children:[l?t.jsx(rt,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(or,{className:"w-3.5 h-3.5"}),t.jsx("span",{"aria-live":"polite",children:l?`${r==="ar"?"جار التجهيز":"Preparing"} ${F}`:r==="ar"?"وورد":"Word"})]})}),t.jsxs(Ts,{align:"end",className:"w-72",children:[t.jsxs(Wt,{onSelect:()=>{Ne("visual")},disabled:C||B,className:"flex-col items-start gap-1 py-3","data-testid":"word-export-visual",children:[t.jsx("span",{className:"font-bold",children:r==="ar"?"Word مطابق للتصميم":"Word — visual design"}),t.jsx("span",{className:"text-xs text-muted-foreground",children:r==="ar"?"نفس المظهر كصور صفحات؛ النص غير قابل للتحرير.":"Same appearance as page images; text is not editable."})]}),t.jsxs(Wt,{onSelect:()=>{Ne("editable")},disabled:C||B,className:"flex-col items-start gap-1 py-3","data-testid":"word-export-editable",children:[t.jsx("span",{className:"font-bold",children:r==="ar"?"Word قابل للتحرير":"Word — editable"}),t.jsx("span",{className:"text-xs text-muted-foreground",children:r==="ar"?"نصوص وجداول بتنسيق محسّن؛ قد يختلف توزيع الصفحات.":"Formatted text and tables; pagination may differ."})]})]})]}),t.jsxs("button",{onClick:()=>{ot()},disabled:C||B,"aria-busy":h,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${me}55`,color:me},"data-testid":"btn-pdf-export",title:r==="ar"?"حفظ الورقة كملف PDF":"Save worksheet as PDF",children:[h?t.jsx(rt,{className:"w-3.5 h-3.5 animate-spin"}):t.jsx(ar,{className:"w-3.5 h-3.5"}),h?r==="ar"?"جار تجهيز PDF":"Preparing PDF":r==="ar"?"حفظ PDF":"Save PDF"]})]})]}),_&&t.jsxs("div",{role:"alert",dir:$e,className:"no-print mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800","data-testid":"alert-pdf-error",children:[t.jsx("span",{className:"flex-1",children:_}),t.jsx("button",{onClick:()=>{ot()},disabled:C||B,className:"px-3 py-1 rounded-md bg-white border font-bold","data-testid":"btn-retry-pdf",children:r==="ar"?"إعادة المحاولة":"Retry"})]}),oe&&t.jsxs("div",{inert:C||void 0,dir:$e,hidden:p==="preview"&&!pe&&!le,className:"no-print border-b bg-white px-4 py-3","data-testid":"region-live-edit",children:[(pe||le)&&t.jsxs("div",{role:pe?"alert":"status",className:`mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${pe?"border-red-300 bg-red-50 text-red-800":"border-amber-300 bg-amber-50 text-amber-900"}`,children:[t.jsx("span",{className:"flex-1",children:pe||(r==="ar"?"لديك تعديلات غير محفوظة. الطباعة والتصدير يستخدمان آخر تعديلاتك.":"You have unsaved edits. Print and export use your latest edits.")}),pe&&t.jsx("button",{onClick:()=>{Ee()},disabled:B,className:"px-3 py-1 rounded-md bg-white border font-bold","data-testid":"btn-retry-save",children:r==="ar"?"إعادة المحاولة":"Retry"})]}),t.jsx("div",{hidden:p!=="edit",children:t.jsx(Er,{ar:r==="ar",settings:o.settings,onSettingsChange:q,meta:{title:o.title,subject:o.subject??"",gradeLevel:o.gradeLevel??""},onMetaChange:at})})]}),t.jsx("div",{inert:C||void 0,"aria-busy":C,children:t.jsx(ss,{data:o,flushRef:S,editing:oe?p==="edit":void 0,onEditingChange:oe?g=>E(g?"edit":"preview"):void 0,onRequestSave:oe?ce:void 0,onRequestDiscard:oe?se:void 0,onDraftChange:oe?Le:void 0,onLayoutChange:oe?(g,$,V)=>Le({questions:g,pageBreaks:$,questionStyles:V}):void 0})}),ve&&t.jsx("div",{className:"no-print fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4",role:"alertdialog","aria-modal":"true","aria-labelledby":"leave-title",dir:$e,children:t.jsxs("div",{className:"w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl",children:[t.jsx("h2",{id:"leave-title",className:"font-bold text-base mb-1",children:r==="ar"?"تعديلات غير محفوظة":"Unsaved changes"}),t.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:r==="ar"?"احفظ تعديلاتك قبل المغادرة أو تجاهلها.":"Save your edits before leaving, or discard them."}),t.jsxs("div",{className:"flex flex-wrap gap-2 justify-end",children:[t.jsx("button",{className:"px-3 py-1.5 rounded-lg border text-sm font-bold",onClick:()=>{b.current+=1,fe(null)},children:r==="ar"?"البقاء":"Stay"}),t.jsx("button",{className:"px-3 py-1.5 rounded-lg border text-sm font-bold text-red-700","data-testid":"btn-discard-leave",disabled:B,onClick:()=>{const g=ve;Ce.current=!1,b.current+=1,fe(null),g()},children:r==="ar"?"تجاهل وخروج":"Discard & leave"}),t.jsx("button",{className:"px-3 py-1.5 rounded-lg text-sm font-bold text-white",style:{background:me},"data-testid":"btn-save-leave",disabled:B,onClick:async()=>{const g=ve,$=++b.current,V=await Ee();if($!==b.current)return;const X=x.current,D=d.current,J=!!(X&&D&&(L(X)!==D.meta||Q(X)!==D.questions));fe(null),V&&!J&&(Ce.current=!1,g())},children:r==="ar"?"حفظ وخروج":"Save & leave"})]})]})})]})}function jt({label:e,short:s,icon:r}){return t.jsxs("div",{className:`ws-field-line ${s?"short":""}`,children:[r&&t.jsx("span",{className:"ws-field-icon",children:r}),t.jsxs("span",{className:"ws-field-label",children:[e,":"]}),t.jsx("span",{className:"ws-field-rule"})]})}function nt({label:e,value:s,icon:r}){return t.jsxs("div",{className:"ws-school-cell",children:[t.jsx("span",{className:"ws-school-icon",children:r}),t.jsxs("div",{className:"ws-school-text",children:[t.jsx("span",{className:"ws-school-label",children:e}),t.jsx("span",{className:"ws-school-value",children:s})]})]})}function vt({note:e,goodLuck:s}){return!e&&!s?null:t.jsxs("footer",{className:"ws-footer",children:[s&&t.jsx("div",{className:"ws-footer-cheer",children:s}),e&&t.jsx("div",{className:"ws-footer-note",children:e})]})}function Gt({ar:e}){const s=e?"حصاد":"Hasaad";return t.jsx("div",{className:"ws-watermark","aria-hidden":"true",children:t.jsx("span",{className:"ws-watermark-word",children:s})})}function it(){return t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-corner ws-corner-tl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-tr","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-bl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-br","aria-hidden":"true"})]})}function kt({gold:e}){return t.jsxs("div",{className:`ws-divider ${e?"gold":""}`,"aria-hidden":"true",children:[t.jsx("span",{className:"ws-divider-thick"}),t.jsx("span",{className:"ws-divider-thin"})]})}function Dr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),t.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function Pr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}),t.jsx("path",{d:"M9 4v16M4 9h16"})]})}function Wr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"3"}),t.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function Hr(){return t.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:t.jsx("path",{d:"M4 7h16M4 12h16M4 17h10"})})}function qr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"4"}),t.jsx("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"})]})}function Or(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"6",width:"18",height:"13",rx:"2"}),t.jsx("path",{d:"M8 3v6M16 3v6"})]})}function Ur(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),t.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function Qr(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:H,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flex:"0 0 auto"},children:[t.jsx("path",{d:"M9 18h6M10 21h4"}),t.jsx("path",{d:"M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"})]})}function Kr(e,s){return s?{mcq:"اختيار من متعدد",true_false:"صح / خطأ",short_answer:"إجابة قصيرة",fill_blank:"أكمل الفراغ",matching:"وصّل بين العمودين",tic_tac_toe:"لوحة الاختيار (Tic-Tac-Toe)",worked_problem:"مسألة مع خطوات الحل",extended_response:"إجابة مطولة",error_correction:"اكتشف الخطأ وصححه",word_bank:"بنك الكلمات",compare:"قارن"}[e]:{mcq:"Multiple choice",true_false:"True / False",short_answer:"Short answer",fill_blank:"Fill in the blank",matching:"Matching",tic_tac_toe:"Choice Board (Tic-Tac-Toe)",worked_problem:"Worked problem",extended_response:"Extended response",error_correction:"Find & correct the error",word_bank:"Word bank",compare:"Compare"}[e]}function Tr(e,s,r){return s?{mcq:"اختر الإجابة الصحيحة من الاختيارات التالية:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:":"اختر «صح» أو «خطأ» لكل عبارة مما يلي:",short_answer:"أجب عن الأسئلة التالية إجابةً قصيرة:",fill_blank:"أكمل الفراغات التالية بالكلمة المناسبة:",matching:"صل كل عبارة بما يناسبها من العمود الثاني:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"اختر الأركان الأربعة ونفّذ مهامها:":r?.ticTacToeStrategy==="full_board"?"نفّذ جميع المهام في اللوحة التالية:":"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا:",worked_problem:"حل المسألة موضحًا خطوات العمل، ثم اكتب الإجابة النهائية:",extended_response:"اكتب إجابة موسعة تدعمها بالتفاصيل والأدلة:",error_correction:"حدّد الخطأ، ثم اكتب التصحيح واشرح سبب التعديل:",word_bank:"استخدم الكلمات في الصندوق لإكمال البنود التالية:",compare:"قارن بين العنصرين، موضحًا أوجه التشابه والاختلاف:"}[e]:{mcq:"Choose the correct answer from the following:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"Put a tick (✓) before each true statement and a cross (✗) before each false statement:":"Choose True or False for each statement:",short_answer:"Answer the following questions briefly:",fill_blank:"Fill in the blanks with the appropriate word:",matching:"Match each item with its corresponding choice in the second column:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"Choose the four corners and complete the tasks:":r?.ticTacToeStrategy==="full_board"?"Complete all tasks in the board:":"Choose three connected squares horizontally, vertically, or diagonally:",worked_problem:"Solve the problem, showing each step, then give the final answer:",extended_response:"Write an extended response supported with details and evidence:",error_correction:"Identify the error, write the correction, and explain your reasoning:",word_bank:"Use the words in the box to complete the following items:",compare:"Compare the two items, including their similarities and differences:"}[e]}function Vr(e){if(e)return{fontSize:e.fontSizePt?`${e.fontSizePt}pt`:void 0,fontWeight:e.bold?800:void 0,textAlign:e.align==="start"?"start":e.align==="end"?"end":e.align,display:e.align?"inline-block":void 0,width:e.align?"100%":void 0}}function rs({ar:e,question:s,questionNumber:r,questionStyle:i,fieldStyle:a,onFieldChange:o,onQuestionChange:c,onQuestionTypeChange:x,onQuestionEdit:n,onResetField:d,onResetQuestion:w}){const[b,S]=u.useState(!1),[ee,k]=u.useState(void 0),l=u.useRef(null);u.useLayoutEffect(()=>{const p=()=>{const E=document.querySelector("[data-question-selected]"),h=l.current;if(!E||!h||window.innerWidth<768){k(void 0);return}const y=E.getBoundingClientRect(),_=Math.min(620,window.innerWidth-24),z=h.offsetHeight||48,B=Math.min(Math.max(12,y.left+y.width/2-_/2),window.innerWidth-_-12),Y=y.bottom+8,C=Y+z<=window.innerHeight-8?Y:Math.max(8,Math.min(y.top-z-8,window.innerHeight-z-8));k({position:"fixed",top:C,left:B,bottom:"auto",transform:"none",width:_})};return p(),window.addEventListener("scroll",p,!0),window.addEventListener("resize",p),()=>{window.removeEventListener("scroll",p,!0),window.removeEventListener("resize",p)}},[r,b]);const j=a?.fontSizePt??12,F=[{value:"start",Icon:e?Ht:qt},{value:"center",Icon:Js},{value:"end",Icon:e?qt:Ht}],R=e?{start:"محاذاة للبداية",center:"توسيط",end:"محاذاة للنهاية"}:{start:"Align to start",center:"Center align",end:"Align to end"},W=p=>{if(!["ArrowRight","ArrowLeft","Home","End"].includes(p.key)||p.target instanceof HTMLInputElement||p.target instanceof HTMLSelectElement)return;const E=Array.from(p.currentTarget.querySelectorAll("button:not(:disabled), select:not(:disabled), input:not(:disabled)")),h=E.indexOf(document.activeElement);if(h<0||E.length===0)return;p.preventDefault();const y=p.key===(e?"ArrowLeft":"ArrowRight"),_=p.key==="Home"?0:p.key==="End"?E.length-1:(h+(y?1:-1)+E.length)%E.length;E[_]?.focus()};return t.jsxs("div",{ref:l,style:ee,className:"no-print ws-format-toolbar",dir:e?"rtl":"ltr",role:"toolbar","aria-label":e?"تنسيق النص والسؤال المحددين":"Selected text and question formatting",onKeyDown:W,"data-testid":"toolbar-question-formatting",children:[t.jsx("div",{className:"ws-format-selection","aria-live":"polite",children:e?`تعديل السؤال ${r}`:`Editing question ${r}`}),t.jsx("button",{type:"button",className:`ws-format-details-toggle${b?" is-active":""}`,"aria-expanded":b,onClick:()=>S(p=>!p),"data-testid":"button-toggle-question-details",children:e?"تفاصيل السؤال":"Question details"}),t.jsxs("div",{className:"ws-format-group",children:[t.jsx("span",{className:"ws-format-label",children:e?"النص":"Text"}),t.jsx("button",{type:"button",onClick:()=>o({fontSizePt:Math.max(8,j-1)}),"aria-label":e?"تصغير الخط":"Decrease font size","data-testid":"button-decrease-font-size",children:t.jsx(lr,{})}),t.jsx("span",{className:"ws-format-value","aria-live":"polite","data-testid":"text-font-size",children:j}),t.jsx("button",{type:"button",onClick:()=>o({fontSizePt:Math.min(24,j+1)}),"aria-label":e?"تكبير الخط":"Increase font size","data-testid":"button-increase-font-size",children:t.jsx($t,{})}),t.jsx("button",{type:"button",className:a?.bold?"is-active":"",onClick:()=>o({bold:!a?.bold}),"aria-label":e?"نص عريض":"Bold text","aria-pressed":!!a?.bold,"data-testid":"button-toggle-bold",children:t.jsx("strong",{children:"ب"})}),F.map(({value:p,Icon:E})=>t.jsx("button",{type:"button",className:a?.align===p?"is-active":"",onClick:()=>o({align:p}),"aria-label":R[p],"aria-pressed":a?.align===p,"data-testid":`button-align-${p}`,children:t.jsx(E,{})},p)),t.jsx("button",{type:"button",onClick:d,"aria-label":e?"إعادة تنسيق النص":"Reset text formatting","data-testid":"button-reset-text-formatting",children:t.jsx(Pt,{})})]}),b&&t.jsxs("div",{className:"ws-format-group ws-format-details",children:[t.jsx("span",{className:"ws-format-label",children:e?"السؤال":"Question"}),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"نوعه":"Type"}),t.jsx("select",{value:s.type,onChange:p=>x(p.target.value),"aria-label":e?"تغيير نوع السؤال":"Change question type",children:["true_false","mcq","matching","short_answer","fill_blank"].map(p=>t.jsx("option",{value:p,children:Kr(p,e)},p))})]}),s.type==="true_false"&&t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-format-label",children:e?"طريقة الإجابة":"Answer layout"}),["mark","choices"].map(p=>t.jsx("button",{type:"button",className:(i?.trueFalseLayout??"choices")===p?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>c({trueFalseLayout:p}),children:e?p==="mark"?"قوس للعلامة":"خيارا صح وخطأ":p==="mark"?"Mark parentheses":"True / False choices"},p)),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة":"Answer"}),t.jsxs("select",{value:s.correct?"true":"false",onChange:p=>n({...s,correct:p.target.value==="true"}),"aria-label":e?"الإجابة الصحيحة":"Correct answer",children:[t.jsx("option",{value:"true",children:e?"صح":"True"}),t.jsx("option",{value:"false",children:e?"خطأ":"False"})]})]})]}),s.type==="tic_tac_toe"&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-strategy",children:[t.jsx("span",{className:"ws-format-label",children:e?"الاستراتيجية":"Strategy"}),["any_three","corners","full_board"].map(p=>t.jsx("button",{type:"button",className:(i?.ticTacToeStrategy??"any_three")===p?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>c({ticTacToeStrategy:p}),children:e?p==="any_three"?"3 متصلة":p==="corners"?"الأركان":"كامل اللوحة":p==="any_three"?"Any 3":p==="corners"?"Corners":"Full board"},p))]}),t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-response",children:[t.jsx("span",{className:"ws-format-label",children:e?"أسطر الإجابة":"Response Lines"}),[0,3,5,8,12].map(p=>t.jsx("button",{type:"button",className:(i?.ticTacToeResponseLines??0)===p?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>c({ticTacToeResponseLines:p}),children:p===0?e?"بدون":"None":p},p))]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة الصحيحة":"Correct answer"}),t.jsx("select",{value:s.correctIndex,onChange:p=>n({...s,correctIndex:Number(p.target.value)}),"aria-label":e?"اختيار الإجابة الصحيحة":"Choose the correct answer",children:s.options.map((p,E)=>t.jsxs("option",{value:E,children:["(",He(E,e),") ",p]},E))})]}),s.type==="error_correction"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر التصحيح":"Correction lines"}),t.jsx("select",{value:i?.errorCorrectionCorrectionLines??2,onChange:p=>c({errorCorrectionCorrectionLines:Number(p.target.value)}),"aria-label":e?"عدد أسطر التصحيح":"Number of correction lines","data-testid":"select-error-correction-lines",children:[0,1,2,3,4,6,8].map(p=>t.jsx("option",{value:p,children:p===0?e?"بدون أسطر":"No lines":p},p))})]}),t.jsx("button",{type:"button",className:i?.errorCorrectionShowExplanation??!0?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>c({errorCorrectionShowExplanation:!(i?.errorCorrectionShowExplanation??!0)}),"aria-pressed":i?.errorCorrectionShowExplanation??!0,"data-testid":"button-toggle-error-explanation",children:i?.errorCorrectionShowExplanation??!0?e?"إخفاء الشرح":"Hide explanation":e?"إظهار الشرح":"Show explanation"}),(i?.errorCorrectionShowExplanation??!0)&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر الشرح":"Explanation lines"}),t.jsx("select",{value:i?.errorCorrectionExplanationLines??2,onChange:p=>c({errorCorrectionExplanationLines:Number(p.target.value)}),"aria-label":e?"عدد أسطر الشرح":"Number of explanation lines","data-testid":"select-error-explanation-lines",children:[0,1,2,3,4,6,8].map(p=>t.jsx("option",{value:p,children:p===0?e?"بدون أسطر":"No lines":p},p))})]})]}),s.type==="compare"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان التشابه":"Similarities heading"}),t.jsx("input",{value:i?.compareSimilaritiesLabel??(e?"أوجه التشابه":"Similarities"),onChange:p=>c({compareSimilaritiesLabel:p.target.value}),"aria-label":e?"عنوان أوجه التشابه":"Similarities heading","data-testid":"input-compare-similarities-label"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان الاختلاف":"Differences heading"}),t.jsx("input",{value:i?.compareDifferencesLabel??(e?"خصائص واختلافات":"Traits and differences"),onChange:p=>c({compareDifferencesLabel:p.target.value}),"aria-label":e?"عنوان الخصائص والاختلافات":"Traits and differences heading","data-testid":"input-compare-differences-label"})]})]}),(s.type==="short_answer"||s.type==="fill_blank")&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة النموذجية":"Model answer"}),t.jsx("input",{value:s.answer??"",onChange:p=>n({...s,answer:p.target.value}),"aria-label":e?"الإجابة النموذجية":"Model answer"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"مسافة السؤال":"Question spacing"}),t.jsxs("select",{value:i?.spacing??"normal",onChange:p=>c({spacing:p.target.value}),"aria-label":e?"مسافة السؤال":"Question spacing","data-testid":"select-question-spacing",children:[t.jsx("option",{value:"compact",children:e?"مضغوط":"Compact"}),t.jsx("option",{value:"normal",children:e?"عادي":"Normal"}),t.jsx("option",{value:"relaxed",children:e?"واسع":"Wide"})]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"ترتيب الخيارات":"Option layout"}),t.jsxs("select",{value:i?.choiceColumns??2,onChange:p=>c({choiceColumns:Number(p.target.value)}),"aria-label":e?"ترتيب خيارات السؤال":"Question option layout","data-testid":"select-choice-columns",children:[t.jsx("option",{value:1,children:e?"عمودي":"Vertical"}),t.jsx("option",{value:2,children:e?"خياران في سطر":"Two per row"})]})]}),t.jsx("button",{type:"button",onClick:w,"aria-label":e?"إعادة إعدادات السؤال":"Reset question settings","data-testid":"button-reset-question-formatting",children:t.jsx(Pt,{})})]})]})}function we({text:e,editMode:s,className:r,onCommit:i,placeholder:a,style:o,onSelect:c}){const x=u.useRef(null);u.useEffect(()=>{x.current&&!s&&(x.current.textContent=e)},[e,s]);const n=Vr(o);return s?t.jsx("span",{ref:x,className:`ws-editable${r?` ${r}`:""}`,style:{...n,unicodeBidi:"plaintext"},contentEditable:!0,suppressContentEditableWarning:!0,onFocus:d=>{c?.(),d.currentTarget.textContent||(d.currentTarget.textContent=e)},onBlur:d=>{const w=d.currentTarget.textContent?.trim()??"";i(w||e)},onKeyDown:d=>{d.key==="Enter"&&(d.preventDefault(),d.currentTarget.blur())},spellCheck:!1,dir:tr(e,"rtl"),children:e||a}):t.jsx(We,{text:e||a,className:r,fallbackDirection:"rtl",style:n})}function Xt({index:e,q:s,ar:r,labels:i,editMode:a,showPencil:o,onEdit:c,showTypeHeader:x,questionStyle:n,onSelectField:d,selected:w,onStartEdit:b,onSelectQuestion:S,onMatchingWidthChange:ee,onQuestionStyleChange:k}){const l=a??!1,j=c??(()=>{}),F=u.useRef(null),R=s.type==="matching"?as(s.pairs):null,W=n?.matchingLeftWidth,p=W?{left:W/100,right:(100-W)/100}:R,E=h=>{const y=F.current?.getBoundingClientRect();if(!y||y.width<=0)return;const _=r?(y.right-h)/y.width:(h-y.left)/y.width;ee?.(Math.round(Math.min(.65,Math.max(.35,_))*100))};return t.jsxs("div",{className:`ws-question-block ws-q-spacing-${n?.spacing??"normal"}${l?" ws-q-editable":""}${w?" ws-q-selected":""}`,onClick:h=>{const y=h.target;if(!l){if(!b||y.closest("button, a, input, select, textarea, [contenteditable='true']"))return;const _=typeof window<"u"?window.getSelection():null;if(_&&!_.isCollapsed)return;b();return}y.closest(".ws-editable")||S?.()},"data-question-selected":w||void 0,children:[b&&(!l||o)&&t.jsx("button",{type:"button",className:"no-print ws-q-pencil",onClick:h=>{h.stopPropagation(),b()},"aria-label":r?`تعديل السؤال ${e}`:`Edit question ${e}`,"data-testid":`button-edit-question-${e}`,children:t.jsx(Nt,{})}),x&&t.jsx("div",{className:"ws-section-instr",children:Tr(s.type,r,n)}),s.type==="word_bank"&&t.jsxs("div",{className:"ws-word-bank","aria-label":r?"بنك الكلمات":"Word bank",children:[t.jsx("strong",{children:r?"بنك الكلمات":"Word bank"}),t.jsx("div",{children:Array.from(new Set(s.items.filter(Boolean))).map((h,y)=>t.jsx(We,{text:h,fallbackDirection:r?"rtl":"ltr"},y))})]}),t.jsxs("div",{className:"ws-q",children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num","aria-label":`${i.question} ${e}`,children:e}),t.jsxs("div",{className:"ws-q-prompt-wrap",children:[typeof s.points=="number"&&s.points>0&&t.jsx("div",{className:"ws-q-typeline",children:t.jsxs("span",{className:"ws-q-points",children:[s.points," ",r?"د":"pt"]})}),t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(we,{text:s.prompt??(s.type==="matching"?r?"صل بين العمودين بخطوط:":"Match the columns:":""),editMode:l,style:n?.fields?.find(h=>h.key==="prompt"),onSelect:()=>d?.("prompt"),onCommit:h=>j({...s,prompt:h})}),s.type==="true_false"&&(n?.trueFalseLayout??"choices")==="mark"&&t.jsx("span",{className:"ws-tf-mark","aria-hidden":"true",children:"(　　)"})]})]})]}),s.type==="mcq"&&t.jsx("ol",{className:"ws-mcq","data-choice-columns":n?.choiceColumns??2,style:{gridTemplateColumns:`repeat(${n?.choiceColumns??2}, minmax(0, 1fr))`},children:s.options.map((h,y)=>t.jsxs("li",{children:[t.jsxs("span",{className:"ws-mcq-letter",children:["(",He(y,r),")"]}),t.jsx("span",{className:"ws-mcq-text",children:t.jsx(we,{text:h,editMode:l,style:n?.fields?.find(_=>_.key===`option:${y}`),onSelect:()=>d?.(`option:${y}`),onCommit:_=>{const z=s.options.slice();z[y]=_,j({...s,options:z})}})})]},y))}),s.type==="true_false"&&(n?.trueFalseLayout??"choices")==="choices"&&t.jsxs("div",{className:"ws-tf-choices",children:[t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),i.true]}),t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),i.false]})]}),s.type==="short_answer"&&t.jsx("div",{className:"ws-lines",children:Array.from({length:s.lines??2}).map((h,y)=>t.jsx("span",{className:"ws-line"},y))}),s.type==="fill_blank"&&t.jsx("div",{className:"ws-fill",children:t.jsx("span",{className:"ws-fill-rule"})}),s.type==="matching"&&t.jsxs("div",{className:"ws-match",ref:F,style:{gridTemplateColumns:`minmax(0, ${p.left}fr) 6mm minmax(0, ${p.right}fr)`},"data-matching-left-share":p.left,"data-matching-right-share":p.right,children:[t.jsx("ul",{className:"ws-match-col",children:s.pairs.map((h,y)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-num",children:[y+1,"."]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(we,{text:h.left,editMode:l,style:n?.fields?.find(_=>_.key===`match-left:${y}`),onSelect:()=>d?.(`match-left:${y}`),onCommit:_=>{const z=s.pairs.map((B,Y)=>Y===y?{...B,left:_}:B);j({...s,pairs:z})}})})]},`l${y}`))}),t.jsx("div",{className:`ws-match-divider${l?" is-editable":""}`,role:l?"separator":void 0,"aria-label":l?r?"اسحب لتغيير عرض عمودي التوصيل":"Drag to resize matching columns":void 0,"aria-orientation":l?"vertical":void 0,"aria-valuemin":l?35:void 0,"aria-valuemax":l?65:void 0,"aria-valuenow":l?Math.round(p.left*100):void 0,tabIndex:l?0:void 0,onPointerDown:h=>{l&&(h.preventDefault(),h.stopPropagation(),h.currentTarget.setPointerCapture(h.pointerId),E(h.clientX))},onPointerMove:h=>{!l||!h.currentTarget.hasPointerCapture(h.pointerId)||E(h.clientX)},onKeyDown:h=>{if(!l||!["ArrowLeft","ArrowRight"].includes(h.key))return;h.preventDefault(),h.stopPropagation();const y=h.key==="ArrowRight"?2:-2,_=r?-y:y,z=Math.round(p.left*100);ee?.(Math.min(65,Math.max(35,z+_)))},children:l&&t.jsx("span",{className:"ws-match-divider-handle","aria-hidden":"true",children:"↔"})}),t.jsx("ul",{className:"ws-match-col",children:os(s.pairs.length).map((h,y)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-letter",children:["(",He(y,r),")"]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(we,{text:s.pairs[h].right,editMode:l,style:n?.fields?.find(_=>_.key===`match-right:${h}`),onSelect:()=>d?.(`match-right:${h}`),onCommit:_=>{const z=s.pairs.map((B,Y)=>Y===h?{...B,right:_}:B);j({...s,pairs:z})}})})]},`r${y}`))})]}),s.type==="tic_tac_toe"&&t.jsx("div",{className:"ws-tic-board",role:"group","aria-label":r?"لوحة الاختيار — ثلاثة على خط":"Three-in-a-row choice board",children:s.cells.map((h,y)=>t.jsxs("div",{className:"ws-tic-cell",children:[t.jsx("span",{className:"ws-tic-check","aria-hidden":"true"}),h.imageUrl&&t.jsx("img",{className:"ws-tic-image",src:Vs(h.imageUrl)??"",alt:""}),t.jsx("span",{className:"ws-tic-text",children:t.jsx(we,{text:h.text,editMode:l,style:n?.fields?.find(_=>_.key===`tic-cell:${y}`),onSelect:()=>d?.(`tic-cell:${y}`),onCommit:_=>{const z=s.cells.map((B,Y)=>Y===y?{...B,text:_}:B);j({...s,cells:z})}})}),t.jsxs("span",{className:"ws-tic-writing","aria-hidden":"true",children:[t.jsx("span",{}),t.jsx("span",{}),t.jsx("span",{})]})]},y))}),s.type==="tic_tac_toe"&&(n?.ticTacToeResponseLines??0)>0&&t.jsx("div",{className:"ws-short-lines mt-4","aria-hidden":"true",children:Array.from({length:n?.ticTacToeResponseLines??0}).map((h,y)=>t.jsx("div",{className:"ws-short-line"},y))}),s.type==="worked_problem"&&t.jsxs("div",{className:"ws-worked-problem",children:[t.jsx("div",{className:"ws-response-label",children:r?"خطوات الحل / مساحة العمل":"Steps / Work area"}),t.jsx("div",{className:"ws-work-steps",children:Array.from({length:Math.max(3,s.steps??4)}).map((h,y)=>t.jsxs("div",{className:"ws-work-step",children:[t.jsx("span",{className:"ws-work-step-num",children:y+1}),t.jsx("span",{className:"ws-work-step-line"})]},y))}),t.jsxs("div",{className:"ws-final-answer",children:[t.jsx("strong",{children:r?"الإجابة النهائية":"Final answer"}),t.jsx("span",{})]})]}),s.type==="extended_response"&&t.jsx("div",{className:"ws-extended-response","aria-label":r?"مساحة الإجابة الموسعة":"Extended response writing area",children:Array.from({length:Math.max(3,s.lines??6)}).map((h,y)=>t.jsx("span",{className:"ws-line"},y))}),s.type==="error_correction"&&t.jsxs("div",{className:"ws-error-correction",children:[t.jsxs("div",{className:"ws-incorrect-box",children:[t.jsx("strong",{children:r?"النص غير الصحيح:":"Incorrect text:"}),t.jsx(We,{text:s.incorrectText,fallbackDirection:r?"rtl":"ltr"})]}),t.jsxs("div",{className:"ws-correction-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التصحيح":"Correction"}),Array.from({length:n?.errorCorrectionCorrectionLines??2}).map((h,y)=>t.jsx("span",{className:"ws-line"},y))]}),(n?.errorCorrectionShowExplanation??!0)&&t.jsxs("div",{className:"ws-explanation-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التفسير":"Explanation"}),Array.from({length:n?.errorCorrectionExplanationLines??2}).map((h,y)=>t.jsx("span",{className:"ws-line"},y))]})]}),s.type==="compare"&&t.jsxs("div",{className:"ws-compare-organizer",children:[t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(we,{text:s.leftLabel,editMode:l,onSelect:()=>d?.("prompt"),onCommit:h=>j({...s,leftLabel:h})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(we,{text:n?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:l,onSelect:()=>d?.("prompt"),onCommit:h=>k?.({compareDifferencesLabel:h})})}),Array.from({length:3}).map((h,y)=>t.jsx("span",{className:"ws-compare-line"},y))]}),t.jsxs("div",{className:"ws-compare-panel ws-compare-similarities",children:[t.jsx("strong",{children:t.jsx(we,{text:n?.compareSimilaritiesLabel??(r?"أوجه التشابه":"Similarities"),editMode:l,onSelect:()=>d?.("prompt"),onCommit:h=>k?.({compareSimilaritiesLabel:h})})}),Array.from({length:3}).map((h,y)=>t.jsx("span",{className:"ws-compare-line"},y))]}),t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(we,{text:s.rightLabel,editMode:l,onSelect:()=>d?.("prompt"),onCommit:h=>j({...s,rightLabel:h})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(we,{text:n?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:l,onSelect:()=>d?.("prompt"),onCommit:h=>k?.({compareDifferencesLabel:h})})}),Array.from({length:3}).map((h,y)=>t.jsx("span",{className:"ws-compare-line"},y))]})]}),(s.type==="short_answer"||s.type==="tic_tac_toe")&&n?.rubric&&t.jsxs("div",{className:"ws-rubric",children:[t.jsx("strong",{children:r?"معيار النجاح:":"Success criterion:"}),t.jsx(We,{text:n.rubric,fallbackDirection:r?"rtl":"ltr"})]})]})]})}function Jt({item:e,ar:s,labels:r}){const{question:i,questionLabel:a,text:o,continuation:c}=e;return t.jsxs("div",{className:"ws-q ws-answer","data-answer-continuation":c||void 0,children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num",children:a}),t.jsx("div",{className:"ws-q-prompt-wrap",children:t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(We,{text:i.type==="matching"?s?"أزواج التوصيل":"Matching pairs":i.prompt,fallbackDirection:s?"rtl":"ltr"}),c&&t.jsxs("span",{className:"ws-answer-cont-label",children:[" (",s?"تابع":"continued",")"]})]})})]}),t.jsxs("div",{className:"ws-answer-line",children:[t.jsx("strong",{children:c?s?"تابع الإجابة:":"Answer continued:":r.correct})," ",t.jsx(We,{text:o,fallbackDirection:s?"rtl":"ltr"})]})]})}const Yr=["أ","ب","ج","د","هـ","و","ز","ح","ط","ي"];function He(e,s){return s?Yr[e]??String(e+1):String.fromCharCode(65+e)}function ns(e,s,r=16){return Math.max(0,e-(s-r))}function is(e,s,r){if(e.type===s)return e;const i={id:e.id,prompt:e.prompt??"",...e.points!==void 0?{points:e.points}:{}},a=e.type==="mcq"?e.options[e.correctIndex]??"":e.type==="true_false"?e.correct?r?"صح":"True":r?"خطأ":"False":e.type==="short_answer"||e.type==="fill_blank"||e.type==="worked_problem"||e.type==="extended_response"?e.answer??"":e.type==="error_correction"?e.correction:"";if(s==="true_false")return{...i,type:s,correct:!0};if(s==="short_answer")return{...i,type:s,lines:2,answer:a};if(s==="fill_blank")return{...i,type:s,answer:a};if(s==="worked_problem")return{...i,type:s,steps:4,answer:a};if(s==="extended_response")return{...i,type:s,lines:6,answer:a};if(s==="error_correction")return{...i,type:s,incorrectText:i.prompt,correction:a,explanation:""};if(s==="word_bank")return{...i,type:s,items:[],answers:[]};if(s==="compare")return{...i,type:s,leftLabel:r?"العنصر الأول":"Item A",rightLabel:r?"العنصر الثاني":"Item B",similarities:"",differences:""};if(s==="mcq"){const x=e.type==="matching"?e.pairs.map(n=>n.right).filter(Boolean).slice(0,4):[];for(;x.length<4;)x.push(r?`الخيار ${x.length+1}`:`Option ${x.length+1}`);return{...i,type:s,options:x,correctIndex:0}}if(s==="tic_tac_toe")return{...i,type:s,prompt:r?"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا، ونفّذ المهام.":"Choose three connected squares horizontally, vertically, or diagonally, and complete the tasks.",cells:(r?["تذكّر","فسّر","طبّق","قارن","ارسم","اكتب","حلّل","أنشئ","تحدَّ"]:["Recall","Explain","Apply","Compare","Draw","Write","Analyze","Create","Challenge"]).map(n=>({category:n,text:""}))};const o=e.type==="mcq"?e.options:[],c=Array.from({length:Math.max(3,Math.min(4,o.length))},(x,n)=>({left:r?`العبارة ${n+1}`:`Item ${n+1}`,right:o[n]||(r?`الإجابة ${n+1}`:`Answer ${n+1}`)}));return{...i,type:s,pairs:c}}function os(e){const s=Array.from({length:e},(a,o)=>o);let r=e*2654435761>>>0;const i=()=>{r|=0,r=r+1831565813|0;let a=Math.imul(r^r>>>15,1|r);return a=a+Math.imul(a^a>>>7,61|a)^a,((a^a>>>14)>>>0)/4294967296};for(let a=e-1;a>0;a--){const o=Math.floor(i()*(a+1)),c=s[a];s[a]=s[o],s[o]=c}return e>1&&s.every((a,o)=>a===o)&&([s[0],s[1]]=[s[1],s[0]]),s}function as(e){const s=c=>{if(c.length===0)return 1;const x=c.map(d=>d.trim().length);return x.reduce((d,w)=>d+w,0)/x.length+Math.max(...x)*.5},r=s(e.map(c=>c.left)),i=s(e.map(c=>c.right)),a=r/(r+i),o=Math.round(Math.min(.65,Math.max(.35,a))*100)/100;return{left:o,right:Math.round((1-o)*100)/100}}function Gr({TC:e}){return t.jsx("style",{children:`
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
  `})}function Xr({fontFamily:e,headingFont:s,fontSizePt:r,lang:i,themeColor:a}){const o=i==="ar",c=o?"right":"left",x=o?"left":"right",n=a;return t.jsx("style",{children:`
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
        border: 1.4px solid ${H};
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
        width: 64%; height: 2px; background: ${H};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${n} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${n}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${H} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${n}0d 0%, ${H}10 100%);
        border-${c}: 3px solid ${n};
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
        background: linear-gradient(135deg, ${H}1a 0%, ${H}08 100%);
        border-${c}: 4px solid ${H};
        padding: 8px 12px;
        font-size: ${Math.max(9,r-1)}pt;
        margin-top: 4mm;
        border-radius: 4px;
        line-height: 1.6;
      }
      .ws-instructions strong { color: ${n}; margin-${x}: 4px; }
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
        margin-${c}: auto;
        white-space: nowrap;
        color: #566;
        font-weight: 700;
      }
      .ws-rubric {
        display: flex;
        gap: 1.5mm;
        margin-top: 2mm;
        padding: 1.5mm 2mm;
        border-${c}: 0.9mm solid ${n};
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
        border-${c}: 3px solid ${n};
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
        color: ${H};
        background: ${H}18;
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

      .ws-mcq { list-style: none; padding-${c}: 34px; margin: 2mm 0 0; display: grid; grid-template-columns: 1fr; gap: 2mm 16px; }
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
        padding-${c}: 34px;
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

      .ws-lines { padding-${c}: 36px; margin-top: 2mm; }
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

      .ws-fill { padding-${c}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${n};
      }

      .ws-match {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6mm minmax(0, 1fr);
        gap: 6mm;
        padding-${c}: 36px;
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
        outline: 3px solid ${H};
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
        color: ${H};
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
      .ws-answer .ws-q-num { background: ${H}; box-shadow: 0 0 0 2px ${n}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${c}: 36px;
        color: ${n};
        font-size: ${Math.max(9.5,r-.5)}pt;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .ws-answer-line strong { color: ${H}; margin-${x}: 4px; }
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
    `})}function Jr({worksheetId:e,page:s,total:r,ar:i}){const a=`${window.location.origin}/teacher/worksheets/${e}/grade?p=${s}&of=${r}`;return t.jsxs("div",{style:{position:"absolute",bottom:"6mm",insetInlineStart:"8mm",display:"flex",alignItems:"center",gap:"2mm",zIndex:5},children:[t.jsx("div",{style:{background:"white",padding:"1mm",border:"0.4mm solid #d4d4d4",borderRadius:"1mm",lineHeight:0},children:t.jsx(sr,{value:a,size:52,style:{width:"13mm",height:"13mm"}})}),t.jsxs("div",{style:{fontSize:"7pt",color:"#8a8a8a",lineHeight:1.5,fontWeight:600},children:[t.jsx("div",{children:i?"امسح للتصحيح الذكي":"Scan to grade"}),r>1&&t.jsx("div",{style:{fontWeight:800,color:"#5a5a5a"},children:i?`صفحة ${s} / ${r}`:`Page ${s} / ${r}`})]})]})}function ls(e,s,r){return e.map((i,a)=>({id:`${i.id}:answer`,question:i,questionLabel:String(a+1),text:cs(i,s,r),continuation:!1}))}function Zr(e){if(e.text.length<2)return null;const s=Math.floor(e.text.length/2),r=e.text.lastIndexOf(" ",s),i=e.text.indexOf(" ",s),a=r>s*.6?r:i>0?i:s,o=e.text.slice(0,a).trimEnd(),c=e.text.slice(a).trimStart();return!o||!c?null:[{...e,id:`${e.id}:a`,text:o},{...e,id:`${e.id}:b`,text:c,continuation:!0}]}function cs(e,s,r){if(e.type==="mcq")return`(${He(e.correctIndex,s)}) ${e.options[e.correctIndex]??""}`;if(e.type==="true_false")return e.correct?r.true:r.false;if(e.type==="short_answer")return e.answer?.trim()||"—";if(e.type==="fill_blank")return e.answer;if(e.type==="worked_problem"||e.type==="extended_response")return e.answer?.trim()||"—";if(e.type==="error_correction"){const a=e.correction.trim()||"—",o=e.explanation?.trim();return o?`${s?"التصحيح:":"Correction:"} ${a} — ${s?"التفسير:":"Explanation:"} ${o}`:`${s?"التصحيح:":"Correction:"} ${a}`}if(e.type==="word_bank")return e.items.map((a,o)=>{const c=e.answers[o];return`${o+1}. ${c?.trim()||"—"}`}).join("    ");if(e.type==="compare"){const a=e.similarities,o=e.differences;return[a?.trim()?`${s?"أوجه التشابه:":"Similarities:"} ${a.trim()}`:"",o?.trim()?`${s?"أوجه الاختلاف:":"Differences:"} ${o.trim()}`:""].filter(Boolean).join(" — ")||"—"}if(e.type==="tic_tac_toe")return s?"تُقيّم المهام الثلاث المتصلة التي اختارها الطالب":"Grade the three connected tasks selected by the student";const i=os(e.pairs.length);return e.pairs.map((a,o)=>{const c=i.indexOf(o);return`${o+1} ← ${He(c>=0?c:o,s)}`}).join("    ")}const $n=Object.freeze(Object.defineProperty({__proto__:null,QuestionFormattingToolbar:rs,WorksheetPrintView:ss,answerText:cs,buildAnswerItems:ls,convertQuestionType:is,default:Br,matchingColumnFractions:as,mobileToolbarScrollOffset:ns,optionLabel:He},Symbol.toStringTag,{value:"Module"}));export{ss as W,Er as a,vn as b,Mr as c,jn as g,kn as s,$n as w};
