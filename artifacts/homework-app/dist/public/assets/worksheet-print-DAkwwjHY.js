import{j as t,aL as Ft,u as Dt,b as Rt,aB as Ht,r as $,k as fe,L as Wt,v as Pt,R as Te}from"./index-CEXi_xOL.js";import{p as Qt,d as Ot}from"./print-export-DZta7bn0.js";import{r as Ut}from"./image-url-Cm2t2lLM.js";import{a as le}from"./math-text-Ch7Cafjn.js";import{c as Kt}from"./content-direction-DAlRqWnC.js";import{Q as qt}from"./index-Bg6OKjaY.js";import{A as Yt}from"./arrow-left-D9W653V5.js";import{C as Xt}from"./camera-DMnxUbas.js";import{P as ot}from"./pen-line-CJngEpDN.js";import{F as Vt}from"./file-type-B_cHnzlK.js";import{D as Jt}from"./download-DR1iq6fI.js";import{M as Tt}from"./minus-B_OEDh0D.js";import{a as Ze,T as Zt}from"./text-align-end-CNg3xiij.js";import{T as Ge}from"./text-align-start-U-yujKYa.js";import{C as Gt}from"./check-check-Cju-1wDZ.js";const at={geometric:{id:"geometric",nameAr:"هندسي",nameEn:"Geometric",description:"هيكل منظم، شبكة، وأرقام مربعة — للرياضيات والفيزياء",headerLayout:"tabular",defaultColor:"#1B2D6B",swatchColors:["#1B2D6B","#E07B20"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:o}){return`
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
          border-${o}: 0;
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
      `}},arabic_ink:{id:"arabic_ink",nameAr:"خط عربي",nameEn:"Arabic Ink",description:"أناقة كلاسيكية، خلفية كريمية، زخارف عربية",headerLayout:"arabesque",defaultColor:"#1B4D3E",swatchColors:["#1B4D3E","#C9972A"],headingFontOverride:"'Amiri', 'Scheherazade New', 'Cairo', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:i,isAr:o,startSide:l}){return`
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
          border-${l}: 3.5px solid ${s};
          background: none;
          border-radius: 0;
          padding: 3mm ${o?"12px":"4mm"} 4mm ${o?"4mm":"12px"};
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
          background: linear-gradient(to ${o?"left":"right"}, transparent, ${s}, transparent);
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
      `}},modern_band:{id:"modern_band",nameAr:"شريط عصري",nameEn:"Modern Band",description:"شريط لوني علوي، بطاقات بيضاء، تصميم ناشر حديث",headerLayout:"band",defaultColor:"#1D4ED8",swatchColors:["#1D4ED8","#ffffff"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:o}){return`
        .ws-theme-modern_band.ws-page {
          background: white;
          border-radius: 4px;
        }
        .ws-theme-modern_band .ws-content { padding: 0 0 13mm; }
        /* No corner ornaments */
        .ws-theme-modern_band .ws-corner { display: none; }
        /* Questions: floating card style */
        .ws-theme-modern_band .ws-q {
          border-${o}: 0;
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
          border-${o}: 4px solid ${e};
          padding: 6px 10px;
          font-size: ${Math.max(9,r-1)}pt;
          border-radius: 4px;
        }
        .ws-band-instr strong { color: ${e}; margin-${o==="right"?"left":"right"}: 4px; }
        .ws-questions-band { padding: 0 18mm; }
        .ws-theme-modern_band .ws-questions { column-gap: 6mm; }
        .ws-theme-modern_band .ws-footer { padding: 5mm 18mm 0; border-top: 1px solid ${e}22; }
        .ws-theme-modern_band .ws-cont-header { margin: 0 18mm 4mm; }
      `}},exam_paper:{id:"exam_paper",nameAr:"ورقة امتحان",nameEn:"Exam Paper",description:"رسمي، جدول منظم، أسلوب امتحانات وزارية",headerLayout:"tabular",defaultColor:"#1A1A1A",swatchColors:["#1A1A1A","#888888"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:o}){return`
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
          border-${o}: 0;
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
      `}},kids_play:{id:"kids_play",nameAr:"مرح الأطفال",nameEn:"Kids Play",description:"ألوان زاهية، حروف كبيرة، مرح وودود للمراحل الأولى",headerLayout:"playful",defaultColor:"#E84393",swatchColors:["#E84393","#FFC107"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:o}){const l="#2196F3",a="#4CAF50";return`
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
          border-${o}: 0;
          border-radius: 12px;
          border: 2.5px solid ${e}33;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
          box-shadow: 0 2px 6px ${e}14;
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+1) { border-color: ${e}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) { border-color: ${l}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) { border-color: ${a}44; }
        /* Very large circle number badges */
        .ws-theme-kids_play .ws-q-num {
          width: 32px; height: 32px;
          border-radius: 50%;
          box-shadow: none;
          font-size: ${Math.max(12,r+1)}pt;
          background: ${e};
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) .ws-q-num { background: ${l}; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) .ws-q-num { background: ${a}; }
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
      `}},science_lab:{id:"science_lab",nameAr:"مختبر علوم",nameEn:"Science Lab",description:"ورق مربعات خفيف، شارة المادة، أسلوب مفكرة العالم",headerLayout:"clipboard",defaultColor:"#0A6B6B",swatchColors:["#0A6B6B","#4FC3F7"],css({TC:e,GOLD:s,fontSizePt:r,isAr:i,startSide:o}){return`
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
          border-${o}: 4mm solid ${e};
          box-shadow: 0 3px 14px ${e}18;
        }
        .ws-theme-science_lab .ws-content { padding: 14mm 16mm 13mm; }
        .ws-theme-science_lab .ws-corner { display: none; }
        .ws-theme-science_lab .ws-watermark-word { opacity: 0.018; }
        /* Lab-notebook question boxes */
        .ws-theme-science_lab .ws-q {
          border-${o}: 0;
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
      `}},editorial:{id:"editorial",nameAr:"أسلوب تحريري",nameEn:"Editorial",description:"رأسية صحفية، خط سيريف، لإسلاميات والأدب والتاريخ",headerLayout:"masthead",defaultColor:"#4A1042",swatchColors:["#4A1042","#C8952A"],headingFontOverride:"'Amiri', 'Georgia', 'Times New Roman', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:i,isAr:o,startSide:l}){return`
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
          border-${l}: 0;
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
      `}}},lt="ws_last_theme";function Ys(){try{return localStorage.getItem(lt)??null}catch{return null}}function Xs(e){try{localStorage.setItem(lt,e)}catch{}}function Vs(e,s,r,i,o){const l=(e??"").trim().toLowerCase(),a=(s??"").trim().toLowerCase();if(/روض|kg|kind|التمهيد|kinder|grade 1\b|1st grade|first grade|الأول الابتدائي|الصف الأول/.test(a))return"kids_play";const d=[[/رياض|math|حساب|جبر|هندس|algebra|geometry|trigon|calculus|statistics/,"geometric"],[/فيزياء|physics/,"science_lab"],[/علوم|science|biology|chemistry|أحياء|كيمياء|بيولوجيا|biolog|chem|lab/,"science_lab"],[/اللغة العربية|عرب|arabic lang|لغة عرب|نحو|إملاء|صرف|بلاغ/,"arabic_ink"],[/إسلام|دين|قرآن|تلاوة|فقه|حديث|سيرة|Islamic|religion|quran|fiqh|hadith|seerah/,"editorial"],[/english|اللغة الإنجليزية|لغة إنجليزية|grammar|vocabulary|reading/,"modern_band"],[/تاريخ|جغرافيا|اجتماع|وطني|history|geography|social stud|civics/,"editorial"],[/أدب|literature|poetry|قصة|رواية|شعر|نثر/,"editorial"],[/تقنية|حاسوب|حاسب|technology|computer|ict/,"modern_band"]];for(const[k,v]of d)if(k.test(l))return v===o?{geometric:"science_lab",science_lab:"geometric",arabic_ink:"editorial",editorial:"arabic_ink",modern_band:"exam_paper",exam_paper:"modern_band",kids_play:"modern_band"}[v]:v;if(/ثانو|secondary|high school|grade 1[0-2]|10th|11th|12th|عاشر|الحادي عشر|الثاني عشر/.test(a)){const v=["exam_paper","editorial","modern_band"].filter(I=>I!==o);return v[i%v.length]}const h=["geometric","modern_band","editorial","exam_paper","science_lab"].filter(k=>k!==o);return h[i%h.length]}const es={geometric:"white",arabic_ink:"#FDFAF4",modern_band:"white",exam_paper:"white",kids_play:"#FFFBF0",science_lab:"white",editorial:"#FDF8F5"};function ts({data:e,labels:s,TC:r,ar:i,hasIdentity:o,customFields:l}){const a=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),d=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...l.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-tab-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"3mm",justifyContent:i?"flex-end":"flex-start"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",className:"ws-logo-img"})}),t.jsxs("div",{className:"ws-tab-toprow",children:[t.jsx("div",{className:"",style:{textAlign:i?"right":"left"},children:d.map((n,h)=>t.jsx("div",{className:"ws-tab-school",children:n},h))}),t.jsx("h1",{className:"ws-tab-title",lang:e.language,children:e.title}),t.jsx("div",{className:"ws-tab-meta",children:a&&t.jsx("div",{children:a})})]}),t.jsx("div",{className:"ws-tab-inner-rule"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsx(ss,{data:e,labels:s,TC:r}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#555",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`4px solid ${r}`,fontSize:"90%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function ss({data:e,labels:s,TC:r}){const i=[e.settings.includeName&&{label:s.name,flex:2},e.settings.includeClass&&{label:s.clazz,flex:1},e.settings.includeDate&&{label:s.date,flex:1}].filter(Boolean);return t.jsx("div",{style:{display:"grid",gridTemplateColumns:i.map(o=>`${o.flex}fr`).join(" "),gap:"5mm",marginTop:"3mm"},children:i.map((o,l)=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${r}55`,paddingBottom:"3mm",fontWeight:700,color:r,fontSize:"90%"},children:[o.label,t.jsx("span",{style:{flex:1}})]},l))})}function rs({data:e,labels:s,TC:r,GOLD:i,ar:o,hasIdentity:l,customFields:a}){const d=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName&&{label:s.school,value:e.settings.schoolName},e.settings.teacherName&&{label:s.teacher,value:e.settings.teacherName},e.settings.section&&{label:s.section,value:e.settings.section},...a.map(h=>({label:h.label.trim(),value:h.value}))].filter(Boolean);return t.jsxs("div",{className:"ws-arb-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"4mm"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",className:"ws-logo-img"})}),t.jsx(et,{GOLD:i}),d&&t.jsx("div",{className:"ws-arb-kicker",children:d}),t.jsx("h1",{className:"ws-arb-title",lang:e.language,children:e.title}),t.jsx(et,{GOLD:i}),n.length>0&&t.jsx("div",{className:"ws-arb-identity",children:n.map((h,k)=>t.jsxs("div",{className:"ws-arb-cell",children:[t.jsxs("span",{className:"ws-arb-cell-label",children:[h.label,":"]}),t.jsx("span",{children:h.value})]},k))}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"5mm",marginTop:"4mm"},children:[e.settings.includeName&&t.jsx(Ae,{label:s.name,TC:r,GOLD:i}),e.settings.includeClass&&t.jsx(Ae,{label:s.clazz,TC:r,GOLD:i}),e.settings.includeDate&&t.jsx(Ae,{label:s.date,TC:r,GOLD:i})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#6a5c3a",margin:"3mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${i}12`,borderInlineStart:`4px solid ${i}`,fontSize:"90%",lineHeight:1.7,borderRadius:"4px"},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function et({GOLD:e}){return t.jsxs("div",{className:"ws-arb-ornament",children:[t.jsx("div",{className:"ws-arb-ornament-line"}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-diamond",style:{background:e}}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-ornament-line"})]})}function Ae({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px dashed ${r}88`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function ns({data:e,labels:s,TC:r,GOLD:i,ar:o,hasIdentity:l,customFields:a}){const d=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(h=>`${h.label}: ${h.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-band-header",children:[t.jsxs("div",{className:"ws-band-top",children:[e.settings.logoUrl&&t.jsx("div",{style:{position:"absolute",top:"4mm",[o?"left":"right"]:"16mm"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",style:{height:"12mm",width:"auto",objectFit:"contain",filter:"brightness(10)"}})}),n.length>0&&t.jsx("div",{className:"ws-band-chips",children:n.map((h,k)=>t.jsx("span",{className:"ws-band-chip",children:h},k))}),t.jsx("h1",{className:"ws-band-title",lang:e.language,children:e.title}),d&&t.jsx("div",{className:"ws-band-sub",children:d})]}),t.jsxs("div",{className:"ws-band-body",children:[(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-band-fields",children:[e.settings.includeName&&t.jsx(Me,{label:s.name,TC:r,flex:2}),e.settings.includeClass&&t.jsx(Me,{label:s.clazz,TC:r,flex:1}),e.settings.includeDate&&t.jsx(Me,{label:s.date,TC:r,flex:1})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"90%",color:"#555",margin:"0 0 3mm",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{className:"ws-band-instr",children:[t.jsxs("strong",{children:[s.instructions,":"]})," ",e.settings.instructions]})]})]})}function Me({label:e,TC:s,flex:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%",flex:r},children:[e,t.jsx("span",{style:{flex:1}})]})}function is({data:e,labels:s,TC:r,GOLD:i,ar:o,hasIdentity:l,customFields:a}){const d=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName,e.settings.section,...a.map(h=>h.value)].filter(Boolean);return t.jsxs("div",{className:"ws-play-header",children:[t.jsxs("div",{className:"ws-play-banner",children:[t.jsx("div",{className:"ws-play-stars",children:"★ ☆ ★"}),t.jsx("h1",{className:"ws-play-title",lang:e.language,children:e.title}),d&&t.jsx("div",{className:"ws-play-sub",children:d}),n.length>0&&t.jsx("div",{className:"ws-play-chips",children:n.map((h,k)=>t.jsx("span",{className:"ws-play-chip",children:h},k))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-play-fields",children:[e.settings.includeName&&t.jsx(Se,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(Se,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(Se,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontWeight:700,color:r,margin:"2mm 0",fontSize:"105%"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{background:`${r}12`,borderRadius:"10px",padding:"6px 12px",fontSize:"95%",fontWeight:700,color:r,marginBottom:"4mm"},children:["⭐ ",e.settings.instructions]})]})}function Se({label:e,TC:s}){return t.jsxs("div",{className:"ws-play-field",children:[e,t.jsx("span",{className:"ws-play-field-rule"})]})}function os({data:e,labels:s,TC:r,GOLD:i,ar:o,hasIdentity:l,customFields:a}){[e.subject,e.gradeLevel].filter(Boolean).join(" · ");const d=[e.settings.schoolName&&`${s.school}: ${e.settings.schoolName}`,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(n=>`${n.label}: ${n.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-clip-header",children:[t.jsxs("div",{className:"ws-clip-badges",children:[e.settings.logoUrl&&t.jsx("img",{src:e.settings.logoUrl,alt:"",style:{height:"10mm",width:"auto",objectFit:"contain"}}),e.subject&&t.jsx("span",{className:"ws-clip-badge",children:e.subject}),e.gradeLevel&&t.jsx("span",{className:"ws-clip-badge-sec",children:e.gradeLevel})]}),t.jsxs("div",{className:"ws-clip-title-row",children:[t.jsx("h1",{className:"ws-clip-title",lang:e.language,children:e.title}),d.length>0&&t.jsx("div",{className:"ws-clip-identity",children:d.map((n,h)=>t.jsx("div",{className:"ws-clip-id-row",children:n},h))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-clip-fields",children:[e.settings.includeName&&t.jsx(Ie,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(Ie,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(Ie,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"88%",color:"#4a7a7a",margin:"2mm 0 0"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"4px 9px",background:`${r}08`,border:`1.5px solid ${r}33`,borderRadius:"3px",fontSize:"88%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function Ie({label:e,TC:s}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}55`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function as({data:e,labels:s,TC:r,GOLD:i,ar:o,hasIdentity:l,customFields:a}){const d=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),n=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(h=>`${h.label}: ${h.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-mast-header",children:[t.jsx("div",{className:"ws-mast-rule-thick"}),t.jsx("div",{className:"ws-mast-rule-mid"}),e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{margin:"2mm auto"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",className:"ws-logo-img"})}),t.jsx("h1",{className:"ws-mast-title",lang:e.language,children:e.title}),d&&t.jsx("div",{className:"ws-mast-meta",children:d}),n.length>0&&t.jsx("div",{className:"ws-mast-identity",children:n.map((h,k)=>t.jsx("span",{children:h},k))}),t.jsx("div",{className:"ws-mast-rule-thin"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-mast-fields",children:[e.settings.includeName&&t.jsx(ze,{label:s.name,TC:r,GOLD:i}),e.settings.includeClass&&t.jsx(ze,{label:s.clazz,TC:r,GOLD:i}),e.settings.includeDate&&t.jsx(ze,{label:s.date,TC:r,GOLD:i})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"88%",color:"#6a4a5a",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`3px solid ${i}`,fontSize:"88%",lineHeight:1.7},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function ze({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function ls(e,s){return e?at[e]?.headingFontOverride??s:s}const Le="#225739";function cs({layout:e}){return e?.elements?.length?t.jsx(t.Fragment,{children:e.elements.map(s=>{const r={position:"absolute",left:`${s.x}%`,top:`${s.y}%`,width:`${s.width}%`,height:s.kind==="line"?`${s.strokeWidth??2}px`:`${s.height}%`,pointerEvents:"none",boxSizing:"border-box",zIndex:2,opacity:s.opacity??1};return s.kind==="text"?t.jsx("div",{style:{...r,fontSize:`${s.fontSize??14}pt`,fontWeight:s.bold?800:400,fontStyle:s.italic?"italic":"normal",color:s.fontColor??"#1a2421",textAlign:s.align??"right",padding:"2px 4px",whiteSpace:"pre-wrap",wordBreak:"break-word",overflow:"hidden"},children:s.text??""},s.id):s.kind==="rect"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??Le}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:`${s.borderRadius??2}px`,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="circle"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px ${s.strokeStyle??"solid"} ${s.strokeColor??Le}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:"50%",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="line"?t.jsx("div",{style:{...r,background:s.strokeColor??Le,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):null})}):null}const tt="",P="#225739",_="#D9A521";function ds(e,s){const r="'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif",i="'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";switch(e){case"cairo":return`'Cairo', ${r}`;case"tajawal":return`'Tajawal', ${r}`;case"amiri":return`'Amiri', 'Scheherazade New', ${r}`;case"noto-naskh":return`'Noto Naskh Arabic', ${r}`;case"inter":return`'Inter', ${i}`;case"georgia":return"Georgia, 'Times New Roman', serif";default:return s==="ar"?r:i}}function ms(e){return e==="ar"?"'Cairo', 'Noto Naskh Arabic', 'Tajawal', sans-serif":"'Inter', 'Source Sans Pro', sans-serif"}function st(e,s,r,i,o,l){if(e.length===0)return[[]];const a=s*.352778*1.85,d=r===2?22:44,n=5,h=p=>{const b=10+Math.max(1,Math.ceil((p.prompt?.length??0)/d))*a;switch(p.type){case"mcq":return b+p.options.filter(Boolean).length*a*1.3;case"true_false":return b+a*1.1;case"short_answer":return b+(p.lines??2)*9;case"fill_blank":return b+3;case"matching":return b+p.pairs.length*a*1.3;case"tic_tac_toe":return Math.max(185,b+165);case"worked_problem":return b+Math.max(4,p.steps??4)*8+12;case"extended_response":return b+Math.max(3,p.lines??6)*8;case"error_correction":return b+16+16+12;case"word_bank":return b+18;case"compare":return b+42}},k=[];let v=[],I=0,j=i;if(r===2)for(let p=0;p<e.length;p+=2){const c=l?.has(e[p].id)||p+1<e.length&&l?.has(e[p+1].id),b=Math.max(h(e[p]),p+1<e.length?h(e[p+1]):0)+n;v.length>0&&(c||I+b>j)&&(k.push(v),v=[],I=0,j=o),v.push(e[p]),p+1<e.length&&v.push(e[p+1]),I+=b}else for(const p of e){const c=l?.has(p.id),b=h(p)+n;v.length>0&&(c||I+b>j)&&(k.push(v),v=[],I=0,j=o),v.push(p),I+=b}return v.length>0&&k.push(v),k.length>0?k:[e]}function ps({theme:e,TC:s,GOLD:r,BG:i,fontFamily:o,headingFont:l,fontSizePt:a,lang:d}){const n=d==="ar",h=n?"right":"left",k=n?"left":"right";return t.jsx("style",{children:e.css({TC:s,GOLD:r,BG:i,fontFamily:o,headingFont:l,fontSizePt:a,isAr:n,startSide:h,endSide:k})})}function hs({theme:e,data:s,labels:r,TC:i,GOLD:o,ar:l,hasIdentity:a,customFields:d,classicFallback:n}){if(!e)return n;const h={data:s,labels:r,TC:i,GOLD:o,ar:l,hasIdentity:a,customFields:d,IdentityCell:()=>null,FieldLine:()=>null,DoubleDivider:()=>null,IconUser:()=>null,IconClass:()=>null,IconDate:()=>null,IconLightbulb:()=>null,IconSchool:()=>null,IconSection:()=>null,IconTeacher:()=>null,IconField:()=>null};switch(e.headerLayout){case"tabular":return t.jsx(ts,{...h});case"arabesque":return t.jsx(rs,{...h});case"band":return t.jsx(ns,{...h});case"playful":return t.jsx(is,{...h});case"clipboard":return t.jsx(os,{...h});case"masthead":return t.jsx(as,{...h});default:return n}}function ct({data:e,onLayoutChange:s}){const r=e.language==="ar",i=r?"rtl":"ltr",o=ds(e.settings.fontFamily,e.language),l=ms(e.language),a=e.settings.template,d=a?at[a]:void 0,n=a?es[a]??"white":"white",h=ls(a,l),k=Math.min(18,Math.max(9,e.settings.fontSizePt??12)),v=e.settings.showWatermark!==!1,I=e.settings.themeColor??d?.defaultColor??P,j=e.settings.logoUrl,[p,c]=$.useState(e.questions),b=$.useRef(e.questions),[D,C]=$.useState(()=>new Set(e.settings.pageBreaks??[])),[J,g]=$.useState(()=>e.settings.questionStyles??[]),w=$.useRef(e.settings.questionStyles??[]),[y,E]=$.useState(null),Q=$.useMemo(()=>{const m=new Set;let x=null;for(const f of p)f.type!==x&&(m.add(f.id),x=f.type);return m},[p]),[se,Is]=$.useState(!1),[Fe,O]=$.useState(!1),[K,De]=$.useState(!1),[de,ut]=$.useState(null),[zs,bt]=$.useState(null),Re=$.useRef(e);$.useEffect(()=>{if(Re.current===e)return;Re.current=e,b.current=e.questions,c(e.questions),C(new Set(e.settings.pageBreaks??[]));const m=e.settings.questionStyles??[];w.current=m,g(m),E(null),O(!1)},[e]),$.useCallback(m=>{C(x=>{const f=new Set(x);return f.add(m),f}),O(!0)},[]),$.useCallback(m=>{C(x=>{const f=new Set(x);return f.delete(m),f}),O(!0)},[]);const ft=$.useCallback(()=>{s?.(b.current,[...D],w.current),O(!1)},[D,s]),yt=$.useCallback(()=>{b.current=e.questions,c(e.questions),C(new Set(e.settings.pageBreaks??[]));const m=e.settings.questionStyles??[];w.current=m,g(m),E(null),O(!1),De(!1)},[e]),He=$.useCallback(m=>{const x=b.current.map(f=>f.id===m.id?m:f);b.current=x,c(x),C(new Set),O(!0)},[]),G=$.useCallback((m,x)=>{const f=w.current,N=f.find(M=>M.questionId===m)??{questionId:m},A=x(N),u=[...f.filter(M=>M.questionId!==m),A];w.current=u,g(u),C(new Set),O(!0)},[]),jt=$.useCallback((m,x,f)=>{G(m,N=>{const A=N.fields??[],u=A.find(M=>M.key===x)??{key:x};return{...N,fields:[...A.filter(M=>M.key!==x),{...u,...f}]}})},[G]),kt=$.useCallback(()=>{y&&G(y.questionId,m=>({...m,fields:(m.fields??[]).filter(x=>x.key!==y.key)}))},[y,G]);$.useCallback(m=>{if(!de)return;bt(null),ut(null);const x=b.current,N=st(x,k,e.settings.columns,190,250,D)[m];if(!N||N.length===0)return;const A=N[0].id;if(A===de)return;const u=x.find(S=>S.id===de);if(!u)return;const M=x.filter(S=>S.id!==de),B=M.findIndex(S=>S.id===A),F=B===-1?[...M,u]:[...M.slice(0,B),u,...M.slice(B)];b.current=F,c(F),O(!0)},[de,k,e.settings.columns,D]);const z=r?{name:"الاسم",date:"التاريخ",clazz:"الصف",section:"القسم",school:"المدرسة",teacher:"المعلم",instructions:"تعليمات",answerKey:"صفحة الإجابات",question:"س",true:"صح",false:"خطأ",correct:"الإجابة:",goodLuck:"نتمنى لك التوفيق ✦"}:{name:"Name",date:"Date",clazz:"Class",section:"Section",school:"School",teacher:"Teacher",instructions:"Instructions",answerKey:"Answer Key",question:"Q",true:"True",false:"False",correct:"Answer:",goodLuck:"✦ Good luck!"},ke=(e.settings.customFields??[]).filter(m=>(m?.label?.trim()??"")||(m?.value?.trim()??"")),$t=!!e.settings.schoolName||!!e.settings.section||!!e.settings.teacherName||!!j||ke.length>0,me=e.settings.columns,[re,We]=$.useState(()=>st(e.questions,k,me,190,250)),ne=xt(p,r,z),[Pe,$e]=$.useState(()=>[ne]),Qe=$.useRef(null),Oe=$.useRef("");$.useLayoutEffect(()=>{const m=[JSON.stringify(p),me,k,e.settings.schoolName??"",e.settings.section??"",e.settings.teacherName??"",j?"logo":"",e.settings.includeName?"n":"",e.settings.includeDate?"d":"",e.settings.includeClass?"c":"",e.settings.instructions??"",a??"",[...D].sort().join(","),JSON.stringify(J)].join("|");if(m===Oe.current)return;const x=Qe.current;if(!x)return;const f=Array.from(x.querySelectorAll("[data-q-measure]"));if(f.length!==p.length)return;const N=x.querySelector("[data-header-measure]"),A=x.querySelector("[data-continuation-measure]"),u=x.querySelector("[data-footer-measure]"),M=Array.from(x.querySelectorAll("[data-answer-measure]")),B=x.querySelector("[data-answer-header-measure]"),F=x.querySelector("[data-answer-continuation-measure]");Oe.current=m;const S=3.7795,ge=263*S,Mt=N?N.offsetHeight:60*S,St=A?A.offsetHeight:12*S,xe=u?u.offsetHeight:18*S,It=12*S,zt=8*S,Lt=Math.max(ge-Mt-xe-It,80*S),Ye=Math.max(ge-xe-St-zt,150*S),Xe=4*S,Ne=f.map(L=>L.offsetHeight+Xe),pe=[];let U=[],ie=0,we=Lt;if(me===2)for(let L=0;L<p.length;L+=2){const ee=Math.max(Ne[L]??0,Ne[L+1]??0),_e=D.has(p[L].id)||L+1<p.length&&D.has(p[L+1].id);U.length>0&&(_e||ie+ee>we)&&(pe.push(U),U=[],ie=0,we=Ye),U.push(p[L]),L+1<p.length&&U.push(p[L+1]),ie+=ee}else for(let L=0;L<p.length;L++){const ee=Ne[L];U.length>0&&(D.has(p[L].id)||ie+ee>we)&&(pe.push(U),U=[],ie=0,we=Ye),U.push(p[L]),ie+=ee}if(U.length>0&&pe.push(U),pe.length>0&&We(pe),M.length===ne.length&&ne.length>0){const L=B?B.offsetHeight:38*S,ee=F?F.offsetHeight:12*S,_e=4*S,Et=3*S,Ct=Math.max(ge-L-xe-_e,80*S),Ve=Math.max(ge-ee-xe-Et,150*S),ue=[];let q=[],he=0,be=Ct;const Je=(Z,H,te)=>{const R=Z.cloneNode(!0),Y=R.querySelector(".ws-answer-line"),X=R.querySelector(".ws-q-prompt");Y&&(Y.textContent=`${te?r?"تابع الإجابة:":"Answer continued:":z.correct} ${H}`),te&&X&&X.append(` (${r?"تابع":"continued"})`),x.appendChild(R);const W=R.offsetHeight+Xe;return R.remove(),W},Bt=(Z,H,te,R)=>{let Y=1,X=H.length,W=0;for(;Y<=X;){const ae=Math.floor((Y+X)/2);Je(Z,H.slice(0,ae),te)<=R?(W=ae,Y=ae+1):X=ae-1}if(W<=0)return 0;const oe=Math.max(H.lastIndexOf(" ",W),H.lastIndexOf(`
`,W),H.lastIndexOf("	",W));let T=oe>=Math.floor(W*.6)?oe:W;return T>0&&/[\uD800-\uDBFF]/.test(H[T-1]??"")&&(T-=1),Math.max(1,T)};for(let Z=0;Z<ne.length;Z++){const H=ne[Z],te=M[Z];let R=H.text,Y=0;for(;R;){const X=H.continuation||Y>0,W={...H,id:`${H.id}:${Y}`,text:R,continuation:X},oe=Je(te,R,X);if(he+oe<=be){q.push(W),he+=oe;break}if(q.length>0){ue.push(q),q=[],he=0,be=Ve;continue}const T=Bt(te,R,X,be);if(T<=0||T>=R.length){q.push(W),he=oe;break}const ae=R.slice(0,T).trimEnd();q.push({...W,text:ae}),ue.push(q),q=[],he=0,be=Ve,R=R.slice(T).trimStart(),Y+=1}}q.length>0&&ue.push(q),$e(ue)}else p.length===0&&$e([[]])}),$.useLayoutEffect(()=>{const m=document.getElementById("ws-printable-root");if(!m)return;const x=Array.from(m.querySelectorAll("[data-worksheet-page]")),f=297/25.4*96,N=x.findIndex(A=>A.getBoundingClientRect().height>f+2);N<0||(re[N]?.length??0)<=1||We(A=>{const u=A.map(B=>[...B]),M=u[N].pop();return M?(u[N+1]?u[N+1].unshift(M):u.push([M]),u):A})},[re]),$.useLayoutEffect(()=>{if(!e.settings.includeAnswerKey)return;const m=document.getElementById("ws-printable-root");if(!m)return;const x=Array.from(m.querySelectorAll("[data-answer-key-page]")),f=297/25.4*96,N=x.findIndex(A=>A.getBoundingClientRect().height>f+2);N<0||$e(A=>{const u=A.map(B=>[...B]);if(u[N].length===1){const B=Ss(u[N][0]);return B?(u[N]=[B[0]],u[N+1]?u[N+1].unshift(B[1]):u.push([B[1]]),u):A}const M=u[N].pop();return M?(u[N+1]?u[N+1].unshift(M):u.push([M]),u):A})},[Pe,e.settings.includeAnswerKey]);const vt=t.jsxs("header",{className:"ws-header",children:[t.jsxs("div",{className:"ws-headrow",dir:r?"rtl":"ltr",children:[t.jsxs("div",{className:"ws-headstart",children:[e.settings.schoolName&&t.jsx(ye,{label:z.school,value:e.settings.schoolName,icon:t.jsx(xs,{})}),e.settings.section&&t.jsx(ye,{label:z.section,value:e.settings.section,icon:t.jsx(ws,{})}),e.settings.teacherName&&t.jsx(ye,{label:z.teacher,value:e.settings.teacherName,icon:t.jsx(us,{})}),ke.map((m,x)=>t.jsx(ye,{label:m.label.trim()||(r?"حقل":"Field"),value:m.value,icon:t.jsx(bs,{})},`cf-${x}`))]}),t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",children:e.title}),(e.subject||e.gradeLevel)&&t.jsx("div",{className:"ws-kicker-center",children:[e.subject,e.gradeLevel].filter(Boolean).join(" · ")}),t.jsx(Be,{})]}),t.jsx("div",{className:"ws-headend",children:j&&t.jsx("img",{src:j,alt:r?"شعار المدرسة":"School logo",className:"ws-logo-img"})})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-fields",children:[e.settings.includeName&&t.jsx(Ee,{label:z.name,icon:t.jsx(fs,{})}),e.settings.includeClass&&t.jsx(Ee,{label:z.clazz,icon:t.jsx(ys,{}),short:!0}),e.settings.includeDate&&t.jsx(Ee,{label:z.date,icon:t.jsx(js,{}),short:!0})]}),e.settings.headerNote&&t.jsx("p",{className:"ws-subtitle",children:e.settings.headerNote}),e.settings.learningObjective&&t.jsxs("div",{className:"ws-learning-objective",children:[t.jsx("strong",{children:r?"هدف الورقة:":"Learning objective:"}),t.jsx("span",{children:e.settings.learningObjective}),e.settings.activityDuration&&t.jsx("small",{children:r?`${e.settings.activityDuration} دقيقة`:`${e.settings.activityDuration} min`})]}),e.settings.instructions&&t.jsxs("div",{className:"ws-instructions",children:[t.jsx(ks,{}),t.jsxs("div",{children:[t.jsx("strong",{children:z.instructions}),t.jsxs("span",{children:[" ",e.settings.instructions]})]})]})]}),Ue=t.jsx(hs,{theme:d,data:e,labels:z,TC:I,GOLD:_,ar:r,hasIdentity:$t,customFields:ke,classicFallback:vt}),Nt=me===2?"calc((174mm - 8mm) / 2)":"174mm",Ke=`ws-page${a?` ws-theme-${a}`:""}`,_t="bg-neutral-200",ve=y?p.find(m=>m.id===y.questionId):void 0,qe=y?J.find(m=>m.questionId===y.questionId):void 0,At=y?qe?.fields?.find(m=>m.key===y.key):void 0;return $.useEffect(()=>{if(!y)return;const m=window.requestAnimationFrame(()=>{if(!window.matchMedia("(max-width: 640px)").matches)return;const x=document.activeElement,f=document.querySelector(".ws-format-toolbar");if(!(x instanceof HTMLElement)||!x.matches(".ws-editable")||!f)return;const N=x.getBoundingClientRect(),A=f.getBoundingClientRect(),u=mt(N.bottom,A.top);u>0&&window.scrollBy({top:u,behavior:"smooth"})});return()=>window.cancelAnimationFrame(m)},[y]),t.jsxs(t.Fragment,{children:[t.jsx(As,{fontFamily:o,headingFont:h,fontSizePt:k,lang:e.language,themeColor:I}),d&&t.jsx(ps,{theme:d,TC:I,GOLD:_,BG:n,fontFamily:o,headingFont:h,fontSizePt:k,lang:e.language}),t.jsxs("div",{ref:Qe,"aria-hidden":"true",className:`print-host${a?` ws-theme-${a}`:""}`,style:{position:"absolute",left:"-9999px",top:0,visibility:"hidden",pointerEvents:"none"},dir:i,children:[t.jsx("div",{"data-header-measure":!0,style:{width:"174mm"},children:Ue}),t.jsx("div",{"data-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:r?"صفحة 2":"Page 2"})]})}),p.map((m,x)=>t.jsx("div",{"data-q-measure":!0,style:{width:Nt},children:t.jsx(nt,{index:String(x+1),q:m,ar:r,labels:z,showTypeHeader:Q.has(m.id),questionStyle:J.find(f=>f.questionId===m.id)})},m.id)),t.jsx("div",{"data-footer-measure":!0,style:{width:"174mm"},children:t.jsx(Ce,{note:e.settings.footerNote,goodLuck:e.settings.goodLuck?.trim()||z.goodLuck})}),t.jsx("div",{"data-answer-header-measure":!0,style:{width:"174mm"},children:t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:_},children:z.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:_,background:`${_}1f`},children:e.title}),t.jsx(Be,{gold:!0})]})})})}),t.jsx("div",{"data-answer-continuation-measure":!0,style:{width:"174mm"},children:t.jsxs("div",{className:"ws-cont-header",children:[t.jsxs("span",{className:"ws-cont-title",children:[z.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:r?"صفحة متابعة":"Continued"})]})}),ne.map(m=>t.jsx("div",{"data-answer-measure":!0,style:{width:"174mm"},children:t.jsx(it,{item:m,ar:r,labels:z})},`answer-${m.id}`))]}),s&&t.jsxs("div",{className:"no-print",style:{position:"fixed",bottom:16,[r?"left":"right"]:16,zIndex:40,display:"flex",gap:8,alignItems:"center",background:K?_:"white",border:`2px solid ${K?_:P}`,borderRadius:999,padding:"7px 14px",boxShadow:"0 4px 16px rgba(0,0,0,0.18)",fontFamily:"inherit",fontWeight:700,fontSize:13,color:K?"white":P,cursor:"pointer",transition:"all 0.18s"},role:"group","aria-label":r?"أدوات التعديل":"Edit tools",children:[K&&Fe&&t.jsxs("button",{onClick:ft,style:{background:"white",color:P,border:"none",borderRadius:999,padding:"3px 12px",fontWeight:800,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5},children:[t.jsx(Gt,{style:{width:14,height:14}}),r?"حفظ":"Save"]}),K&&Fe&&t.jsx("button",{type:"button",onClick:yt,title:r?"إلغاء تعديلات هذه الجلسة والعودة إلى آخر نسخة محفوظة":"Discard this session's changes",style:{background:"transparent",color:"white",border:"1px solid rgba(255,255,255,0.75)",borderRadius:999,padding:"3px 10px",fontWeight:800,fontSize:12,cursor:"pointer"},children:r?"تجاهل التعديلات":"Discard"}),K&&D.size>0&&t.jsx("button",{type:"button",onClick:()=>{C(new Set),O(!0)},title:r?"إزالة فواصل الصفحات اليدوية وإعادة توزيع الأسئلة":"Remove manual page breaks and repaginate",style:{background:"white",color:P,border:"none",borderRadius:999,padding:"3px 12px",fontWeight:800,fontSize:12,cursor:"pointer"},children:r?"توزيع تلقائي":"Auto layout"}),t.jsxs("button",{onClick:()=>{De(m=>(m&&E(null),!m))},style:{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:"inherit",fontWeight:700,fontSize:13,padding:0},children:[t.jsx(ot,{style:{width:15,height:15}}),K?r?"إنهاء التعديل":"Done editing":r?"تحرير الورقة":"Edit worksheet"]})]}),K&&y&&ve&&t.jsx(dt,{ar:r,question:ve,questionNumber:p.findIndex(m=>m.id===ve.id)+1,questionStyle:qe,fieldStyle:At,onFieldChange:m=>jt(y.questionId,y.key,m),onQuestionChange:m=>G(y.questionId,x=>({...x,...m})),onQuestionTypeChange:m=>{const x=b.current.map(f=>f.id===y.questionId?pt(f,m,r):f);b.current=x,c(x),C(new Set),E({questionId:y.questionId,key:"prompt"}),O(!0)},onQuestionEdit:He,onResetField:kt,onResetQuestion:()=>{const m=w.current.filter(x=>x.questionId!==y.questionId);w.current=m,g(m),O(!0)}}),t.jsxs("div",{id:"ws-printable-root",className:`print-host ${y?"ws-format-toolbar-open ":""}${_t} min-h-screen py-6 px-2 flex flex-col items-center`,dir:i,style:K?{outline:"none"}:void 0,children:[re.map((m,x)=>{const f=x+1,N=x===0,A=x===re.length-1;return t.jsxs("article",{"data-worksheet-page":!0,className:Ke,lang:e.language,style:{background:n},children:[v&&t.jsx(rt,{ar:r}),!a&&t.jsx(je,{}),a==="arabic_ink"&&t.jsx(je,{}),N&&t.jsx(cs,{layout:e.settings.layout}),t.jsxs("div",{className:"ws-content",children:[N?Ue:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:r?`صفحة ${f}`:`Page ${f}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:me===2?2:1},children:m.map(u=>{const M=p.find(F=>F.id===u.id)??u,B=p.findIndex(F=>F.id===u.id);return t.jsx(nt,{index:String(B+1),q:M,ar:r,labels:z,editMode:K,onEdit:He,showTypeHeader:Q.has(u.id),questionStyle:J.find(F=>F.questionId===u.id),onSelectField:F=>E({questionId:u.id,key:F}),selected:y?.questionId===u.id,onSelectQuestion:()=>E({questionId:u.id,key:"prompt"}),onMatchingWidthChange:F=>{G(u.id,S=>({...S,matchingLeftWidth:F})),E({questionId:u.id,key:"prompt"})},onQuestionStyleChange:F=>{G(u.id,S=>({...S,...F})),E({questionId:u.id,key:"prompt"})}},u.id)})}),t.jsx(Ce,{note:A?e.settings.footerNote:void 0,goodLuck:A?e.settings.goodLuck?.trim()||z.goodLuck:""})]}),e.linkedAssignmentId!=null&&t.jsx(Ms,{worksheetId:e.id,page:f,total:re.length,ar:r})]},f)}),e.settings.includeAnswerKey&&Pe.map((m,x)=>{const f=re.length+x+1;return t.jsxs("article",{"data-answer-key-page":!0,"data-answer-key-page-number":x+1,className:Ke,lang:e.language,style:{background:n},children:[v&&t.jsx(rt,{ar:r}),!a&&t.jsx(je,{}),a==="arabic_ink"&&t.jsx(je,{}),t.jsxs("div",{className:"ws-content",children:[x===0?t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:_},children:z.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:_,background:`${_}1f`},children:e.title}),t.jsx(Be,{gold:!0})]})})}):t.jsxs("div",{className:"ws-cont-header","data-answer-key-continuation":!0,children:[t.jsxs("span",{className:"ws-cont-title",children:[z.answerKey," · ",e.title]}),t.jsx("span",{className:"ws-cont-page",children:r?`صفحة ${f}`:`Page ${f}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:1},children:m.map(N=>t.jsx(it,{item:N,ar:r,labels:z},N.id))}),t.jsx(Ce,{goodLuck:""})]})]},`answer-page-${x+1}`)})]})]})}function gs(){const s=Ft()?.id,{lang:r}=Dt(),[,i]=Rt(),o=Ht("/teacher/worksheets/create"),[l,a]=$.useState(null),[d,n]=$.useState(!0);if($.useEffect(()=>{s&&fetch(`${tt}/api/worksheets/${s}`,{credentials:"include"}).then(v=>{if(!v.ok)throw new Error("load failed");return v.json()}).then(a).catch(()=>fe.error(r==="ar"?"تعذّر تحميل ورقة العمل":"Failed to load worksheet")).finally(()=>n(!1))},[s,r]),d)return t.jsx("div",{className:"min-h-screen flex items-center justify-center",children:t.jsx(Wt,{className:"w-8 h-8 animate-spin",style:{color:P}})});if(!l)return t.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:r==="ar"?"لم يتم العثور على ورقة العمل.":"Worksheet not found."});const h=l.language==="ar"?"rtl":"ltr",k=()=>{const v=document.getElementById("ws-printable-root");if(!v){fe.error(r==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}Ot({element:v,title:l.title,lang:l.language})};return t.jsxs(t.Fragment,{children:[t.jsxs("div",{dir:h,className:"no-print sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[t.jsxs("button",{onClick:o,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${P}55`,color:P},children:[t.jsx(Yt,{className:"w-3.5 h-3.5"}),r==="ar"?"رجوع":"Back"]}),t.jsx("div",{className:"text-xs font-bold truncate flex-1 text-center",style:{color:P},children:l.title}),t.jsxs("div",{className:"flex gap-1.5 flex-wrap justify-end",children:[l.isOwner!==!1&&l.linkedAssignmentId!=null&&t.jsxs("button",{onClick:()=>i(`/teacher/worksheets/${l.id}/grade`),className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:"#2f684d"},title:r==="ar"?"تصحيح الأوراق بالكاميرا":"Grade papers with camera","data-testid":"btn-open-grading",children:[t.jsx(Xt,{className:"w-3.5 h-3.5"}),r==="ar"?"تصحيح":"Grade"]}),l.isOwner!==!1&&t.jsxs("button",{onClick:()=>i(`/teacher/worksheets/create?edit=${l.id}`),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${P}55`,color:P},title:r==="ar"?"تحرير هذه الورقة":"Edit this worksheet",children:[t.jsx(ot,{className:"w-3.5 h-3.5"}),r==="ar"?"تحرير":"Edit"]}),t.jsxs("button",{onClick:k,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${_}88`,color:_,background:`${_}10`},title:r==="ar"?"تنزيل كملف وورد":"Download as Word",children:[t.jsx(Vt,{className:"w-3.5 h-3.5"}),r==="ar"?"وورد":"Word"]}),t.jsxs("button",{onClick:()=>Qt(l.title),className:"px-4 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:P},title:r==="ar"?"حفظ الورقة كملف PDF":"Save worksheet as PDF",children:[t.jsx(Jt,{className:"w-3.5 h-3.5"}),r==="ar"?"حفظ PDF":"Save PDF"]})]})]}),t.jsx(ct,{data:l,onLayoutChange:l.isOwner!==!1?async(v,I,j)=>{const p={...l,questions:v,settings:{...l.settings,pageBreaks:I,questionStyles:j}};try{if(!(await fetch(`${tt}/api/worksheets/${l.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:p.title,language:p.language,gradeLevel:p.gradeLevel,subject:p.subject,questions:p.questions,settings:p.settings})})).ok)throw new Error("save failed");a(p),fe.success(r==="ar"?"تم حفظ تعديلات الورقة":"Worksheet changes saved")}catch{fe.error(r==="ar"?"تعذّر الحفظ":"Save failed")}}:void 0})]})}function Ee({label:e,short:s,icon:r}){return t.jsxs("div",{className:`ws-field-line ${s?"short":""}`,children:[r&&t.jsx("span",{className:"ws-field-icon",children:r}),t.jsxs("span",{className:"ws-field-label",children:[e,":"]}),t.jsx("span",{className:"ws-field-rule"})]})}function ye({label:e,value:s,icon:r}){return t.jsxs("div",{className:"ws-school-cell",children:[t.jsx("span",{className:"ws-school-icon",children:r}),t.jsxs("div",{className:"ws-school-text",children:[t.jsx("span",{className:"ws-school-label",children:e}),t.jsx("span",{className:"ws-school-value",children:s})]})]})}function Ce({note:e,goodLuck:s}){return!e&&!s?null:t.jsxs("footer",{className:"ws-footer",children:[s&&t.jsx("div",{className:"ws-footer-cheer",children:s}),e&&t.jsx("div",{className:"ws-footer-note",children:e})]})}function rt({ar:e}){const s=e?"حصاد":"Hasaad";return t.jsx("div",{className:"ws-watermark","aria-hidden":"true",children:t.jsx("span",{className:"ws-watermark-word",children:s})})}function je(){return t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-corner ws-corner-tl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-tr","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-bl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-br","aria-hidden":"true"})]})}function Be({gold:e}){return t.jsxs("div",{className:`ws-divider ${e?"gold":""}`,"aria-hidden":"true",children:[t.jsx("span",{className:"ws-divider-thick"}),t.jsx("span",{className:"ws-divider-thin"})]})}function xs(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),t.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function ws(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}),t.jsx("path",{d:"M9 4v16M4 9h16"})]})}function us(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"3"}),t.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function bs(){return t.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:t.jsx("path",{d:"M4 7h16M4 12h16M4 17h10"})})}function fs(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"4"}),t.jsx("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"})]})}function ys(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"6",width:"18",height:"13",rx:"2"}),t.jsx("path",{d:"M8 3v6M16 3v6"})]})}function js(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),t.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function ks(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:_,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flex:"0 0 auto"},children:[t.jsx("path",{d:"M9 18h6M10 21h4"}),t.jsx("path",{d:"M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"})]})}function $s(e,s){return s?{mcq:"اختيار من متعدد",true_false:"صح / خطأ",short_answer:"إجابة قصيرة",fill_blank:"أكمل الفراغ",matching:"وصّل بين العمودين",tic_tac_toe:"لوحة الاختيار (Tic-Tac-Toe)",worked_problem:"مسألة مع خطوات الحل",extended_response:"إجابة مطولة",error_correction:"اكتشف الخطأ وصححه",word_bank:"بنك الكلمات",compare:"قارن"}[e]:{mcq:"Multiple choice",true_false:"True / False",short_answer:"Short answer",fill_blank:"Fill in the blank",matching:"Matching",tic_tac_toe:"Choice Board (Tic-Tac-Toe)",worked_problem:"Worked problem",extended_response:"Extended response",error_correction:"Find & correct the error",word_bank:"Word bank",compare:"Compare"}[e]}function vs(e,s,r){return s?{mcq:"اختر الإجابة الصحيحة من الاختيارات التالية:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:":"اختر «صح» أو «خطأ» لكل عبارة مما يلي:",short_answer:"أجب عن الأسئلة التالية إجابةً قصيرة:",fill_blank:"أكمل الفراغات التالية بالكلمة المناسبة:",matching:"صل كل عبارة بما يناسبها من العمود الثاني:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"اختر الأركان الأربعة ونفّذ مهامها:":r?.ticTacToeStrategy==="full_board"?"نفّذ جميع المهام في اللوحة التالية:":"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا:",worked_problem:"حل المسألة موضحًا خطوات العمل، ثم اكتب الإجابة النهائية:",extended_response:"اكتب إجابة موسعة تدعمها بالتفاصيل والأدلة:",error_correction:"حدّد الخطأ، ثم اكتب التصحيح واشرح سبب التعديل:",word_bank:"استخدم الكلمات في الصندوق لإكمال البنود التالية:",compare:"قارن بين العنصرين، موضحًا أوجه التشابه والاختلاف:"}[e]:{mcq:"Choose the correct answer from the following:",true_false:(r?.trueFalseLayout??"choices")==="mark"?"Put a tick (✓) before each true statement and a cross (✗) before each false statement:":"Choose True or False for each statement:",short_answer:"Answer the following questions briefly:",fill_blank:"Fill in the blanks with the appropriate word:",matching:"Match each item with its corresponding choice in the second column:",tic_tac_toe:(r?.ticTacToeStrategy??"any_three")==="corners"?"Choose the four corners and complete the tasks:":r?.ticTacToeStrategy==="full_board"?"Complete all tasks in the board:":"Choose three connected squares horizontally, vertically, or diagonally:",worked_problem:"Solve the problem, showing each step, then give the final answer:",extended_response:"Write an extended response supported with details and evidence:",error_correction:"Identify the error, write the correction, and explain your reasoning:",word_bank:"Use the words in the box to complete the following items:",compare:"Compare the two items, including their similarities and differences:"}[e]}function Ns(e){if(e)return{fontSize:e.fontSizePt?`${e.fontSizePt}pt`:void 0,fontWeight:e.bold?800:void 0,textAlign:e.align==="start"?"start":e.align==="end"?"end":e.align,display:e.align?"inline-block":void 0,width:e.align?"100%":void 0}}function dt({ar:e,question:s,questionNumber:r,questionStyle:i,fieldStyle:o,onFieldChange:l,onQuestionChange:a,onQuestionTypeChange:d,onQuestionEdit:n,onResetField:h,onResetQuestion:k}){const v=o?.fontSizePt??12,I=[{value:"start",Icon:e?Ze:Ge},{value:"center",Icon:Zt},{value:"end",Icon:e?Ge:Ze}],j=e?{start:"محاذاة للبداية",center:"توسيط",end:"محاذاة للنهاية"}:{start:"Align to start",center:"Center align",end:"Align to end"},p=c=>{if(!["ArrowRight","ArrowLeft","Home","End"].includes(c.key)||c.target instanceof HTMLInputElement||c.target instanceof HTMLSelectElement)return;const b=Array.from(c.currentTarget.querySelectorAll("button:not(:disabled), select:not(:disabled), input:not(:disabled)")),D=b.indexOf(document.activeElement);if(D<0||b.length===0)return;c.preventDefault();const C=c.key===(e?"ArrowLeft":"ArrowRight"),J=c.key==="Home"?0:c.key==="End"?b.length-1:(D+(C?1:-1)+b.length)%b.length;b[J]?.focus()};return t.jsxs("div",{className:"no-print ws-format-toolbar",dir:e?"rtl":"ltr",role:"toolbar","aria-label":e?"تنسيق النص والسؤال المحددين":"Selected text and question formatting",onKeyDown:p,"data-testid":"toolbar-question-formatting",children:[t.jsx("div",{className:"ws-format-selection","aria-live":"polite",children:e?`تعديل السؤال ${r}`:`Editing question ${r}`}),t.jsxs("div",{className:"ws-format-group",children:[t.jsx("span",{className:"ws-format-label",children:e?"النص":"Text"}),t.jsx("button",{type:"button",onClick:()=>l({fontSizePt:Math.max(8,v-1)}),"aria-label":e?"تصغير الخط":"Decrease font size","data-testid":"button-decrease-font-size",children:t.jsx(Tt,{})}),t.jsx("span",{className:"ws-format-value","aria-live":"polite","data-testid":"text-font-size",children:v}),t.jsx("button",{type:"button",onClick:()=>l({fontSizePt:Math.min(24,v+1)}),"aria-label":e?"تكبير الخط":"Increase font size","data-testid":"button-increase-font-size",children:t.jsx(Pt,{})}),t.jsx("button",{type:"button",className:o?.bold?"is-active":"",onClick:()=>l({bold:!o?.bold}),"aria-label":e?"نص عريض":"Bold text","aria-pressed":!!o?.bold,"data-testid":"button-toggle-bold",children:t.jsx("strong",{children:"ب"})}),I.map(({value:c,Icon:b})=>t.jsx("button",{type:"button",className:o?.align===c?"is-active":"",onClick:()=>l({align:c}),"aria-label":j[c],"aria-pressed":o?.align===c,"data-testid":`button-align-${c}`,children:t.jsx(b,{})},c)),t.jsx("button",{type:"button",onClick:h,"aria-label":e?"إعادة تنسيق النص":"Reset text formatting","data-testid":"button-reset-text-formatting",children:t.jsx(Te,{})})]}),t.jsxs("div",{className:"ws-format-group",children:[t.jsx("span",{className:"ws-format-label",children:e?"السؤال":"Question"}),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"نوعه":"Type"}),t.jsx("select",{value:s.type,onChange:c=>d(c.target.value),"aria-label":e?"تغيير نوع السؤال":"Change question type",children:["true_false","mcq","matching","short_answer","fill_blank"].map(c=>t.jsx("option",{value:c,children:$s(c,e)},c))})]}),s.type==="true_false"&&t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-format-label",children:e?"طريقة الإجابة":"Answer layout"}),["mark","choices"].map(c=>t.jsx("button",{type:"button",className:(i?.trueFalseLayout??"choices")===c?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>a({trueFalseLayout:c}),children:e?c==="mark"?"قوس للعلامة":"خيارا صح وخطأ":c==="mark"?"Mark parentheses":"True / False choices"},c)),t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة":"Answer"}),t.jsxs("select",{value:s.correct?"true":"false",onChange:c=>n({...s,correct:c.target.value==="true"}),"aria-label":e?"الإجابة الصحيحة":"Correct answer",children:[t.jsx("option",{value:"true",children:e?"صح":"True"}),t.jsx("option",{value:"false",children:e?"خطأ":"False"})]})]})]}),s.type==="tic_tac_toe"&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-strategy",children:[t.jsx("span",{className:"ws-format-label",children:e?"الاستراتيجية":"Strategy"}),["any_three","corners","full_board"].map(c=>t.jsx("button",{type:"button",className:(i?.ticTacToeStrategy??"any_three")===c?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>a({ticTacToeStrategy:c}),children:e?c==="any_three"?"3 متصلة":c==="corners"?"الأركان":"كامل اللوحة":c==="any_three"?"Any 3":c==="corners"?"Corners":"Full board"},c))]}),t.jsxs("div",{className:"ws-format-control ws-format-radio","data-testid":"select-tic-response",children:[t.jsx("span",{className:"ws-format-label",children:e?"أسطر الإجابة":"Response Lines"}),[0,3,5,8,12].map(c=>t.jsx("button",{type:"button",className:(i?.ticTacToeResponseLines??0)===c?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>a({ticTacToeResponseLines:c}),children:c===0?e?"بدون":"None":c},c))]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة الصحيحة":"Correct answer"}),t.jsx("select",{value:s.correctIndex,onChange:c=>n({...s,correctIndex:Number(c.target.value)}),"aria-label":e?"اختيار الإجابة الصحيحة":"Choose the correct answer",children:s.options.map((c,b)=>t.jsxs("option",{value:b,children:["(",ce(b,e),") ",c]},b))})]}),s.type==="error_correction"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر التصحيح":"Correction lines"}),t.jsx("select",{value:i?.errorCorrectionCorrectionLines??2,onChange:c=>a({errorCorrectionCorrectionLines:Number(c.target.value)}),"aria-label":e?"عدد أسطر التصحيح":"Number of correction lines","data-testid":"select-error-correction-lines",children:[0,1,2,3,4,6,8].map(c=>t.jsx("option",{value:c,children:c===0?e?"بدون أسطر":"No lines":c},c))})]}),t.jsx("button",{type:"button",className:i?.errorCorrectionShowExplanation??!0?"is-active ws-format-text-btn":"ws-format-text-btn",onClick:()=>a({errorCorrectionShowExplanation:!(i?.errorCorrectionShowExplanation??!0)}),"aria-pressed":i?.errorCorrectionShowExplanation??!0,"data-testid":"button-toggle-error-explanation",children:i?.errorCorrectionShowExplanation??!0?e?"إخفاء الشرح":"Hide explanation":e?"إظهار الشرح":"Show explanation"}),(i?.errorCorrectionShowExplanation??!0)&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"أسطر الشرح":"Explanation lines"}),t.jsx("select",{value:i?.errorCorrectionExplanationLines??2,onChange:c=>a({errorCorrectionExplanationLines:Number(c.target.value)}),"aria-label":e?"عدد أسطر الشرح":"Number of explanation lines","data-testid":"select-error-explanation-lines",children:[0,1,2,3,4,6,8].map(c=>t.jsx("option",{value:c,children:c===0?e?"بدون أسطر":"No lines":c},c))})]})]}),s.type==="compare"&&t.jsxs(t.Fragment,{children:[t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان التشابه":"Similarities heading"}),t.jsx("input",{value:i?.compareSimilaritiesLabel??(e?"أوجه التشابه":"Similarities"),onChange:c=>a({compareSimilaritiesLabel:c.target.value}),"aria-label":e?"عنوان أوجه التشابه":"Similarities heading","data-testid":"input-compare-similarities-label"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"عنوان الاختلاف":"Differences heading"}),t.jsx("input",{value:i?.compareDifferencesLabel??(e?"خصائص واختلافات":"Traits and differences"),onChange:c=>a({compareDifferencesLabel:c.target.value}),"aria-label":e?"عنوان الخصائص والاختلافات":"Traits and differences heading","data-testid":"input-compare-differences-label"})]})]}),(s.type==="short_answer"||s.type==="fill_blank")&&t.jsxs("label",{className:"ws-format-type",children:[t.jsx("span",{children:e?"الإجابة النموذجية":"Model answer"}),t.jsx("input",{value:s.answer??"",onChange:c=>n({...s,answer:c.target.value}),"aria-label":e?"الإجابة النموذجية":"Model answer"})]}),t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"مسافة السؤال":"Question spacing"}),t.jsxs("select",{value:i?.spacing??"normal",onChange:c=>a({spacing:c.target.value}),"aria-label":e?"مسافة السؤال":"Question spacing","data-testid":"select-question-spacing",children:[t.jsx("option",{value:"compact",children:e?"مضغوط":"Compact"}),t.jsx("option",{value:"normal",children:e?"عادي":"Normal"}),t.jsx("option",{value:"relaxed",children:e?"واسع":"Wide"})]})]}),s.type==="mcq"&&t.jsxs("label",{className:"ws-format-type ws-format-control",children:[t.jsx("span",{children:e?"ترتيب الخيارات":"Option layout"}),t.jsxs("select",{value:i?.choiceColumns??2,onChange:c=>a({choiceColumns:Number(c.target.value)}),"aria-label":e?"ترتيب خيارات السؤال":"Question option layout","data-testid":"select-choice-columns",children:[t.jsx("option",{value:1,children:e?"عمودي":"Vertical"}),t.jsx("option",{value:2,children:e?"خياران في سطر":"Two per row"})]})]}),t.jsx("button",{type:"button",onClick:k,"aria-label":e?"إعادة إعدادات السؤال":"Reset question settings","data-testid":"button-reset-question-formatting",children:t.jsx(Te,{})})]})]})}function V({text:e,editMode:s,className:r,onCommit:i,placeholder:o,style:l,onSelect:a}){const d=$.useRef(null);$.useEffect(()=>{d.current&&!s&&(d.current.textContent=e)},[e,s]);const n=Ns(l);return s?t.jsx("span",{ref:d,className:`ws-editable${r?` ${r}`:""}`,style:{...n,unicodeBidi:"plaintext"},contentEditable:!0,suppressContentEditableWarning:!0,onFocus:h=>{a?.(),h.currentTarget.textContent||(h.currentTarget.textContent=e)},onBlur:h=>{const k=h.currentTarget.textContent?.trim()??"";i(k||e)},onKeyDown:h=>{h.key==="Enter"&&(h.preventDefault(),h.currentTarget.blur())},spellCheck:!1,dir:Kt(e,"rtl"),children:e||o}):t.jsx(le,{text:e||o,className:r,fallbackDirection:"rtl",style:n})}function nt({index:e,q:s,ar:r,labels:i,editMode:o,onEdit:l,showTypeHeader:a,questionStyle:d,onSelectField:n,selected:h,onSelectQuestion:k,onMatchingWidthChange:v,onQuestionStyleChange:I}){const j=o??!1,p=l??(()=>{}),c=$.useRef(null),b=s.type==="matching"?gt(s.pairs):null,D=d?.matchingLeftWidth,C=D?{left:D/100,right:(100-D)/100}:b,J=g=>{const w=c.current?.getBoundingClientRect();if(!w||w.width<=0)return;const y=r?(w.right-g)/w.width:(g-w.left)/w.width;v?.(Math.round(Math.min(.65,Math.max(.35,y))*100))};return t.jsxs("div",{className:`ws-question-block ws-q-spacing-${d?.spacing??"normal"}${j?" ws-q-editable":""}${h?" ws-q-selected":""}`,onClick:g=>{!j||g.target.closest(".ws-editable")||k?.()},"data-question-selected":h||void 0,children:[a&&t.jsx("div",{className:"ws-section-instr",children:vs(s.type,r,d)}),s.type==="word_bank"&&t.jsxs("div",{className:"ws-word-bank","aria-label":r?"بنك الكلمات":"Word bank",children:[t.jsx("strong",{children:r?"بنك الكلمات":"Word bank"}),t.jsx("div",{children:Array.from(new Set(s.items.filter(Boolean))).map((g,w)=>t.jsx(le,{text:g,fallbackDirection:r?"rtl":"ltr"},w))})]}),t.jsxs("div",{className:"ws-q",children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num","aria-label":`${i.question} ${e}`,children:e}),t.jsxs("div",{className:"ws-q-prompt-wrap",children:[typeof s.points=="number"&&s.points>0&&t.jsx("div",{className:"ws-q-typeline",children:t.jsxs("span",{className:"ws-q-points",children:[s.points," ",r?"د":"pt"]})}),t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(V,{text:s.prompt??(s.type==="matching"?r?"صل بين العمودين بخطوط:":"Match the columns:":""),editMode:j,style:d?.fields?.find(g=>g.key==="prompt"),onSelect:()=>n?.("prompt"),onCommit:g=>p({...s,prompt:g})}),s.type==="true_false"&&(d?.trueFalseLayout??"choices")==="mark"&&t.jsx("span",{className:"ws-tf-mark","aria-hidden":"true",children:"(　　)"})]})]})]}),s.type==="mcq"&&t.jsx("ol",{className:"ws-mcq","data-choice-columns":d?.choiceColumns??2,style:{gridTemplateColumns:`repeat(${d?.choiceColumns??2}, minmax(0, 1fr))`},children:s.options.map((g,w)=>t.jsxs("li",{children:[t.jsxs("span",{className:"ws-mcq-letter",children:["(",ce(w,r),")"]}),t.jsx("span",{className:"ws-mcq-text",children:t.jsx(V,{text:g,editMode:j,style:d?.fields?.find(y=>y.key===`option:${w}`),onSelect:()=>n?.(`option:${w}`),onCommit:y=>{const E=s.options.slice();E[w]=y,p({...s,options:E})}})})]},w))}),s.type==="true_false"&&(d?.trueFalseLayout??"choices")==="choices"&&t.jsxs("div",{className:"ws-tf-choices",children:[t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),i.true]}),t.jsxs("span",{className:"ws-tf-choice",children:[t.jsx("span",{className:"ws-tf-box","aria-hidden":"true"}),i.false]})]}),s.type==="short_answer"&&t.jsx("div",{className:"ws-lines",children:Array.from({length:s.lines??2}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))}),s.type==="fill_blank"&&t.jsx("div",{className:"ws-fill",children:t.jsx("span",{className:"ws-fill-rule"})}),s.type==="matching"&&t.jsxs("div",{className:"ws-match",ref:c,style:{gridTemplateColumns:`minmax(0, ${C.left}fr) 6mm minmax(0, ${C.right}fr)`},"data-matching-left-share":C.left,"data-matching-right-share":C.right,children:[t.jsx("ul",{className:"ws-match-col",children:s.pairs.map((g,w)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-num",children:[w+1,"."]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(V,{text:g.left,editMode:j,style:d?.fields?.find(y=>y.key===`match-left:${w}`),onSelect:()=>n?.(`match-left:${w}`),onCommit:y=>{const E=s.pairs.map((Q,se)=>se===w?{...Q,left:y}:Q);p({...s,pairs:E})}})})]},`l${w}`))}),t.jsx("div",{className:`ws-match-divider${j?" is-editable":""}`,role:j?"separator":void 0,"aria-label":j?r?"اسحب لتغيير عرض عمودي التوصيل":"Drag to resize matching columns":void 0,"aria-orientation":j?"vertical":void 0,"aria-valuemin":j?35:void 0,"aria-valuemax":j?65:void 0,"aria-valuenow":j?Math.round(C.left*100):void 0,tabIndex:j?0:void 0,onPointerDown:g=>{j&&(g.preventDefault(),g.stopPropagation(),g.currentTarget.setPointerCapture(g.pointerId),J(g.clientX))},onPointerMove:g=>{!j||!g.currentTarget.hasPointerCapture(g.pointerId)||J(g.clientX)},onKeyDown:g=>{if(!j||!["ArrowLeft","ArrowRight"].includes(g.key))return;g.preventDefault(),g.stopPropagation();const w=g.key==="ArrowRight"?2:-2,y=r?-w:w,E=Math.round(C.left*100);v?.(Math.min(65,Math.max(35,E+y)))},children:j&&t.jsx("span",{className:"ws-match-divider-handle","aria-hidden":"true",children:"↔"})}),t.jsx("ul",{className:"ws-match-col",children:ht(s.pairs.length).map((g,w)=>t.jsxs("li",{className:"ws-match-pair",children:[t.jsxs("span",{className:"ws-match-bullet ws-match-letter",children:["(",ce(w,r),")"]}),t.jsx("span",{className:"ws-match-text",children:t.jsx(V,{text:s.pairs[g].right,editMode:j,style:d?.fields?.find(y=>y.key===`match-right:${g}`),onSelect:()=>n?.(`match-right:${g}`),onCommit:y=>{const E=s.pairs.map((Q,se)=>se===g?{...Q,right:y}:Q);p({...s,pairs:E})}})})]},`r${w}`))})]}),s.type==="tic_tac_toe"&&t.jsx("div",{className:"ws-tic-board",role:"group","aria-label":r?"لوحة الاختيار — ثلاثة على خط":"Three-in-a-row choice board",children:s.cells.map((g,w)=>t.jsxs("div",{className:"ws-tic-cell",children:[t.jsx("span",{className:"ws-tic-check","aria-hidden":"true"}),g.imageUrl&&t.jsx("img",{className:"ws-tic-image",src:Ut(g.imageUrl)??"",alt:""}),t.jsx("span",{className:"ws-tic-text",children:t.jsx(V,{text:g.text,editMode:j,style:d?.fields?.find(y=>y.key===`tic-cell:${w}`),onSelect:()=>n?.(`tic-cell:${w}`),onCommit:y=>{const E=s.cells.map((Q,se)=>se===w?{...Q,text:y}:Q);p({...s,cells:E})}})}),t.jsxs("span",{className:"ws-tic-writing","aria-hidden":"true",children:[t.jsx("span",{}),t.jsx("span",{}),t.jsx("span",{})]})]},w))}),s.type==="tic_tac_toe"&&(d?.ticTacToeResponseLines??0)>0&&t.jsx("div",{className:"ws-short-lines mt-4","aria-hidden":"true",children:Array.from({length:d?.ticTacToeResponseLines??0}).map((g,w)=>t.jsx("div",{className:"ws-short-line"},w))}),s.type==="worked_problem"&&t.jsxs("div",{className:"ws-worked-problem",children:[t.jsx("div",{className:"ws-response-label",children:r?"خطوات الحل / مساحة العمل":"Steps / Work area"}),t.jsx("div",{className:"ws-work-steps",children:Array.from({length:Math.max(3,s.steps??4)}).map((g,w)=>t.jsxs("div",{className:"ws-work-step",children:[t.jsx("span",{className:"ws-work-step-num",children:w+1}),t.jsx("span",{className:"ws-work-step-line"})]},w))}),t.jsxs("div",{className:"ws-final-answer",children:[t.jsx("strong",{children:r?"الإجابة النهائية":"Final answer"}),t.jsx("span",{})]})]}),s.type==="extended_response"&&t.jsx("div",{className:"ws-extended-response","aria-label":r?"مساحة الإجابة الموسعة":"Extended response writing area",children:Array.from({length:Math.max(3,s.lines??6)}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))}),s.type==="error_correction"&&t.jsxs("div",{className:"ws-error-correction",children:[t.jsxs("div",{className:"ws-incorrect-box",children:[t.jsx("strong",{children:r?"النص غير الصحيح:":"Incorrect text:"}),t.jsx(le,{text:s.incorrectText,fallbackDirection:r?"rtl":"ltr"})]}),t.jsxs("div",{className:"ws-correction-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التصحيح":"Correction"}),Array.from({length:d?.errorCorrectionCorrectionLines??2}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))]}),(d?.errorCorrectionShowExplanation??!0)&&t.jsxs("div",{className:"ws-explanation-area",children:[t.jsx("div",{className:"ws-response-label",children:r?"التفسير":"Explanation"}),Array.from({length:d?.errorCorrectionExplanationLines??2}).map((g,w)=>t.jsx("span",{className:"ws-line"},w))]})]}),s.type==="compare"&&t.jsxs("div",{className:"ws-compare-organizer",children:[t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(V,{text:s.leftLabel,editMode:j,onSelect:()=>n?.("prompt"),onCommit:g=>p({...s,leftLabel:g})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(V,{text:d?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:j,onSelect:()=>n?.("prompt"),onCommit:g=>I?.({compareDifferencesLabel:g})})}),Array.from({length:3}).map((g,w)=>t.jsx("span",{className:"ws-compare-line"},w))]}),t.jsxs("div",{className:"ws-compare-panel ws-compare-similarities",children:[t.jsx("strong",{children:t.jsx(V,{text:d?.compareSimilaritiesLabel??(r?"أوجه التشابه":"Similarities"),editMode:j,onSelect:()=>n?.("prompt"),onCommit:g=>I?.({compareSimilaritiesLabel:g})})}),Array.from({length:3}).map((g,w)=>t.jsx("span",{className:"ws-compare-line"},w))]}),t.jsxs("div",{className:"ws-compare-panel",children:[t.jsx("strong",{children:t.jsx(V,{text:s.rightLabel,editMode:j,onSelect:()=>n?.("prompt"),onCommit:g=>p({...s,rightLabel:g})})}),t.jsx("span",{className:"ws-compare-subtitle",children:t.jsx(V,{text:d?.compareDifferencesLabel??(r?"خصائص واختلافات":"Traits and differences"),editMode:j,onSelect:()=>n?.("prompt"),onCommit:g=>I?.({compareDifferencesLabel:g})})}),Array.from({length:3}).map((g,w)=>t.jsx("span",{className:"ws-compare-line"},w))]})]}),(s.type==="short_answer"||s.type==="tic_tac_toe")&&d?.rubric&&t.jsxs("div",{className:"ws-rubric",children:[t.jsx("strong",{children:r?"معيار النجاح:":"Success criterion:"}),t.jsx(le,{text:d.rubric,fallbackDirection:r?"rtl":"ltr"})]})]})]})}function it({item:e,ar:s,labels:r}){const{question:i,questionLabel:o,text:l,continuation:a}=e;return t.jsxs("div",{className:"ws-q ws-answer","data-answer-continuation":a||void 0,children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num",children:o}),t.jsx("div",{className:"ws-q-prompt-wrap",children:t.jsxs("div",{className:"ws-q-prompt",children:[t.jsx(le,{text:i.type==="matching"?s?"أزواج التوصيل":"Matching pairs":i.prompt,fallbackDirection:s?"rtl":"ltr"}),a&&t.jsxs("span",{className:"ws-answer-cont-label",children:[" (",s?"تابع":"continued",")"]})]})})]}),t.jsxs("div",{className:"ws-answer-line",children:[t.jsx("strong",{children:a?s?"تابع الإجابة:":"Answer continued:":r.correct})," ",t.jsx(le,{text:l,fallbackDirection:s?"rtl":"ltr"})]})]})}const _s=["أ","ب","ج","د","هـ","و","ز","ح","ط","ي"];function ce(e,s){return s?_s[e]??String(e+1):String.fromCharCode(65+e)}function mt(e,s,r=16){return Math.max(0,e-(s-r))}function pt(e,s,r){if(e.type===s)return e;const i={id:e.id,prompt:e.prompt??"",...e.points!==void 0?{points:e.points}:{}},o=e.type==="mcq"?e.options[e.correctIndex]??"":e.type==="true_false"?e.correct?r?"صح":"True":r?"خطأ":"False":e.type==="short_answer"||e.type==="fill_blank"||e.type==="worked_problem"||e.type==="extended_response"?e.answer??"":e.type==="error_correction"?e.correction:"";if(s==="true_false")return{...i,type:s,correct:!0};if(s==="short_answer")return{...i,type:s,lines:2,answer:o};if(s==="fill_blank")return{...i,type:s,answer:o};if(s==="worked_problem")return{...i,type:s,steps:4,answer:o};if(s==="extended_response")return{...i,type:s,lines:6,answer:o};if(s==="error_correction")return{...i,type:s,incorrectText:i.prompt,correction:o,explanation:""};if(s==="word_bank")return{...i,type:s,items:[],answers:[]};if(s==="compare")return{...i,type:s,leftLabel:r?"العنصر الأول":"Item A",rightLabel:r?"العنصر الثاني":"Item B",similarities:"",differences:""};if(s==="mcq"){const d=e.type==="matching"?e.pairs.map(n=>n.right).filter(Boolean).slice(0,4):[];for(;d.length<4;)d.push(r?`الخيار ${d.length+1}`:`Option ${d.length+1}`);return{...i,type:s,options:d,correctIndex:0}}if(s==="tic_tac_toe")return{...i,type:s,prompt:r?"اختر ثلاثة مربعات متصلة أفقيًا أو عموديًا أو قطريًا، ونفّذ المهام.":"Choose three connected squares horizontally, vertically, or diagonally, and complete the tasks.",cells:(r?["تذكّر","فسّر","طبّق","قارن","ارسم","اكتب","حلّل","أنشئ","تحدَّ"]:["Recall","Explain","Apply","Compare","Draw","Write","Analyze","Create","Challenge"]).map(n=>({category:n,text:""}))};const l=e.type==="mcq"?e.options:[],a=Array.from({length:Math.max(3,Math.min(4,l.length))},(d,n)=>({left:r?`العبارة ${n+1}`:`Item ${n+1}`,right:l[n]||(r?`الإجابة ${n+1}`:`Answer ${n+1}`)}));return{...i,type:s,pairs:a}}function ht(e){const s=Array.from({length:e},(o,l)=>l);let r=e*2654435761>>>0;const i=()=>{r|=0,r=r+1831565813|0;let o=Math.imul(r^r>>>15,1|r);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296};for(let o=e-1;o>0;o--){const l=Math.floor(i()*(o+1)),a=s[o];s[o]=s[l],s[l]=a}return e>1&&s.every((o,l)=>o===l)&&([s[0],s[1]]=[s[1],s[0]]),s}function gt(e){const s=a=>{if(a.length===0)return 1;const d=a.map(h=>h.trim().length);return d.reduce((h,k)=>h+k,0)/d.length+Math.max(...d)*.5},r=s(e.map(a=>a.left)),i=s(e.map(a=>a.right)),o=r/(r+i),l=Math.round(Math.min(.65,Math.max(.35,o))*100)/100;return{left:l,right:Math.round((1-l)*100)/100}}function As({fontFamily:e,headingFont:s,fontSizePt:r,lang:i,themeColor:o}){const l=i==="ar",a=l?"right":"left",d=l?"left":"right",n=o;return t.jsx("style",{children:`
      /* High-quality Arabic + Latin fonts, including elegant heading
         faces (Reem Kufi, Amiri) used for the title and section labels. */
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${e}; }
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
        letter-spacing: 0.035em;
        user-select: none;
      }

      /* Decorative gold corner ornaments. */
      .ws-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${_};
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
        width: 64%; height: 2px; background: ${_};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${n} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${n}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${_} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${n}0d 0%, ${_}10 100%);
        border-${a}: 3px solid ${n};
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
        background: linear-gradient(135deg, ${_}1a 0%, ${_}08 100%);
        border-${a}: 4px solid ${_};
        padding: 8px 12px;
        font-size: ${Math.max(9,r-1)}pt;
        margin-top: 4mm;
        border-radius: 4px;
        line-height: 1.6;
      }
      .ws-instructions strong { color: ${n}; margin-${d}: 4px; }
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
        margin-${a}: auto;
        white-space: nowrap;
        color: #566;
        font-weight: 700;
      }
      .ws-rubric {
        display: flex;
        gap: 1.5mm;
        margin-top: 2mm;
        padding: 1.5mm 2mm;
        border-${a}: 0.9mm solid ${n};
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
        border-${a}: 3px solid ${n};
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
        color: ${_};
        background: ${_}18;
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

      .ws-mcq { list-style: none; padding-${a}: 34px; margin: 2mm 0 0; display: grid; grid-template-columns: 1fr; gap: 2mm 16px; }
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
        padding-${a}: 34px;
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

      .ws-lines { padding-${a}: 36px; margin-top: 2mm; }
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

      .ws-fill { padding-${a}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${n};
      }

      .ws-match {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6mm minmax(0, 1fr);
        gap: 6mm;
        padding-${a}: 36px;
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
        outline: 3px solid ${_};
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
          justify-content: flex-start;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding: 3px 2px;
          scrollbar-width: thin;
        }
        .ws-format-toolbar button {
          min-width: 38px;
          height: 38px;
          flex: 0 0 auto;
        }
        .ws-format-text-btn { min-width: max-content !important; }
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
        color: ${_};
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
      .ws-answer .ws-q-num { background: ${_}; box-shadow: 0 0 0 2px ${n}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${a}: 36px;
        color: ${n};
        font-size: ${Math.max(9.5,r-.5)}pt;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .ws-answer-line strong { color: ${_}; margin-${d}: 4px; }
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
        ${l?"right":"left"}: 0;
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
        ${l?"left":"right"}: 20px;
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
    `})}function Ms({worksheetId:e,page:s,total:r,ar:i}){const o=`${window.location.origin}/teacher/worksheets/${e}/grade?p=${s}&of=${r}`;return t.jsxs("div",{style:{position:"absolute",bottom:"6mm",insetInlineStart:"8mm",display:"flex",alignItems:"center",gap:"2mm",zIndex:5},children:[t.jsx("div",{style:{background:"white",padding:"1mm",border:"0.4mm solid #d4d4d4",borderRadius:"1mm",lineHeight:0},children:t.jsx(qt,{value:o,size:52,style:{width:"13mm",height:"13mm"}})}),t.jsxs("div",{style:{fontSize:"7pt",color:"#8a8a8a",lineHeight:1.5,fontWeight:600},children:[t.jsx("div",{children:i?"امسح للتصحيح الذكي":"Scan to grade"}),r>1&&t.jsx("div",{style:{fontWeight:800,color:"#5a5a5a"},children:i?`صفحة ${s} / ${r}`:`Page ${s} / ${r}`})]})]})}function xt(e,s,r){return e.map((i,o)=>({id:`${i.id}:answer`,question:i,questionLabel:String(o+1),text:wt(i,s,r),continuation:!1}))}function Ss(e){if(e.text.length<2)return null;const s=Math.floor(e.text.length/2),r=e.text.lastIndexOf(" ",s),i=e.text.indexOf(" ",s),o=r>s*.6?r:i>0?i:s,l=e.text.slice(0,o).trimEnd(),a=e.text.slice(o).trimStart();return!l||!a?null:[{...e,id:`${e.id}:a`,text:l},{...e,id:`${e.id}:b`,text:a,continuation:!0}]}function wt(e,s,r){if(e.type==="mcq")return`(${ce(e.correctIndex,s)}) ${e.options[e.correctIndex]??""}`;if(e.type==="true_false")return e.correct?r.true:r.false;if(e.type==="short_answer")return e.answer?.trim()||"—";if(e.type==="fill_blank")return e.answer;if(e.type==="worked_problem"||e.type==="extended_response")return e.answer?.trim()||"—";if(e.type==="error_correction"){const o=e.correction.trim()||"—",l=e.explanation?.trim();return l?`${s?"التصحيح:":"Correction:"} ${o} — ${s?"التفسير:":"Explanation:"} ${l}`:`${s?"التصحيح:":"Correction:"} ${o}`}if(e.type==="word_bank")return e.items.map((o,l)=>{const a=e.answers[l];return`${l+1}. ${a?.trim()||"—"}`}).join("    ");if(e.type==="compare"){const o=e.similarities,l=e.differences;return[o?.trim()?`${s?"أوجه التشابه:":"Similarities:"} ${o.trim()}`:"",l?.trim()?`${s?"أوجه الاختلاف:":"Differences:"} ${l.trim()}`:""].filter(Boolean).join(" — ")||"—"}if(e.type==="tic_tac_toe")return s?"تُقيّم المهام الثلاث المتصلة التي اختارها الطالب":"Grade the three connected tasks selected by the student";const i=ht(e.pairs.length);return e.pairs.map((o,l)=>{const a=i.indexOf(l);return`${l+1} ← ${ce(a>=0?a:l,s)}`}).join("    ")}const Js=Object.freeze(Object.defineProperty({__proto__:null,QuestionFormattingToolbar:dt,WorksheetPrintView:ct,answerText:wt,buildAnswerItems:xt,convertQuestionType:pt,default:gs,matchingColumnFractions:gt,mobileToolbarScrollOffset:mt,optionLabel:ce},Symbol.toStringTag,{value:"Module"}));export{at as T,ct as W,Xs as a,Ys as g,Vs as s,Js as w};
