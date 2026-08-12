import{j as t,$ as Le,u as qe,a as De,r as b,t as U,L as We}from"./index-C7-CgEPe.js";import{p as He,d as Re}from"./print-export-DjFgfEmw.js";import{Q as Ce}from"./index-sKR8itNa.js";import{A as Ue}from"./arrow-left-DAWYba32.js";import{C as Qe}from"./camera-6Xdm4fnx.js";import{P as ue}from"./pen-line-CaaL0xdj.js";import{F as Ke}from"./file-type-BKl8FXy2.js";import{P as Pe}from"./printer-7hkQ-_kv.js";import{C as Oe}from"./check-check-CAYEbTgO.js";const we={geometric:{id:"geometric",nameAr:"هندسي",nameEn:"Geometric",description:"هيكل منظم، شبكة، وأرقام مربعة — للرياضيات والفيزياء",headerLayout:"tabular",defaultColor:"#1B2D6B",swatchColors:["#1B2D6B","#E07B20"],css({TC:e,GOLD:s,fontSizePt:r,isAr:n,startSide:i}){return`
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
        .ws-theme-geometric .ws-watermark-word { opacity: 0.03; color: ${e}; }
        /* Square number badges — geometric feel */
        .ws-theme-geometric .ws-q-num {
          border-radius: 3px;
          box-shadow: none;
          background: ${e};
          width: 24px; height: 24px;
        }
        /* Questions: clean bottom-rule style, no left bar */
        .ws-theme-geometric .ws-q {
          border-${i}: 0;
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
          text-align: ${n?"left":"right"};
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
      `}},arabic_ink:{id:"arabic_ink",nameAr:"خط عربي",nameEn:"Arabic Ink",description:"أناقة كلاسيكية، خلفية كريمية، زخارف عربية",headerLayout:"arabesque",defaultColor:"#1B4D3E",swatchColors:["#1B4D3E","#C9972A"],headingFontOverride:"'Amiri', 'Scheherazade New', 'Cairo', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:n,isAr:i,startSide:d}){return`
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
          border-${d}: 3.5px solid ${s};
          background: none;
          border-radius: 0;
          padding: 3mm ${i?"12px":"4mm"} 4mm ${i?"4mm":"12px"};
          margin-bottom: 6mm;
        }
        /* Circle badge in teal */
        .ws-theme-arabic_ink .ws-q-num { background: ${e}; box-shadow: 0 0 0 2px ${s}55; }
        /* Larger question text for Arabic readability */
        .ws-theme-arabic_ink .ws-q-prompt {
          font-size: ${n+.5}pt;
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
          background: linear-gradient(to ${i?"left":"right"}, transparent, ${s}, transparent);
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
          font-size: ${n+13}pt;
          font-weight: 700;
          color: ${e};
          line-height: 1.3;
          letter-spacing: 0.03em;
          margin: 2mm 0;
        }
        .ws-arb-kicker {
          font-size: ${Math.max(9,n-1)}pt;
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
          font-size: ${Math.max(8.5,n-2)}pt;
          font-weight: 600;
          color: ${e};
        }
        .ws-arb-cell-label { color: ${e}88; font-weight: 500; }
        .ws-cont-header { border-bottom-color: ${s}55; }
      `}},modern_band:{id:"modern_band",nameAr:"شريط عصري",nameEn:"Modern Band",description:"شريط لوني علوي، بطاقات بيضاء، تصميم ناشر حديث",headerLayout:"band",defaultColor:"#1D4ED8",swatchColors:["#1D4ED8","#ffffff"],css({TC:e,GOLD:s,fontSizePt:r,isAr:n,startSide:i}){return`
        .ws-theme-modern_band.ws-page {
          background: white;
          border-radius: 4px;
        }
        .ws-theme-modern_band .ws-content { padding: 0 0 13mm; }
        /* No corner ornaments */
        .ws-theme-modern_band .ws-corner { display: none; }
        /* Questions: floating card style */
        .ws-theme-modern_band .ws-q {
          border-${i}: 0;
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
          transform: skewX(${n?"":"-"}15deg) translateX(${n?"-":""}10mm);
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
          border-${i}: 4px solid ${e};
          padding: 6px 10px;
          font-size: ${Math.max(9,r-1)}pt;
          border-radius: 4px;
        }
        .ws-band-instr strong { color: ${e}; margin-${i==="right"?"left":"right"}: 4px; }
        .ws-questions-band { padding: 0 18mm; }
        .ws-theme-modern_band .ws-questions { column-gap: 6mm; }
        .ws-theme-modern_band .ws-footer { padding: 5mm 18mm 0; border-top: 1px solid ${e}22; }
        .ws-theme-modern_band .ws-cont-header { margin: 0 18mm 4mm; }
      `}},exam_paper:{id:"exam_paper",nameAr:"ورقة امتحان",nameEn:"Exam Paper",description:"رسمي، جدول منظم، أسلوب امتحانات وزارية",headerLayout:"tabular",defaultColor:"#1A1A1A",swatchColors:["#1A1A1A","#888888"],css({TC:e,GOLD:s,fontSizePt:r,isAr:n,startSide:i}){return`
        .ws-theme-exam_paper.ws-page {
          background: white;
          border-radius: 0;
          border: none;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10);
        }
        .ws-theme-exam_paper .ws-content { padding: 15mm 18mm 14mm; }
        .ws-theme-exam_paper .ws-corner { display: none; }
        .ws-theme-exam_paper .ws-watermark-word { opacity: 0.025; color: ${e}; }
        /* Questions: plain numbered list — no boxes */
        .ws-theme-exam_paper .ws-q {
          border-${i}: 0;
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
          text-align: ${n?"left":"right"};
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
      `}},kids_play:{id:"kids_play",nameAr:"مرح الأطفال",nameEn:"Kids Play",description:"ألوان زاهية، حروف كبيرة، مرح وودود للمراحل الأولى",headerLayout:"playful",defaultColor:"#E84393",swatchColors:["#E84393","#FFC107"],css({TC:e,GOLD:s,fontSizePt:r,isAr:n,startSide:i}){const d="#2196F3",a="#4CAF50";return`
        .ws-theme-kids_play.ws-page {
          --ws-frame: 6px; /* حد 3px أعلى + أسفل */
          background: #FFFBF0;
          border: 3px dashed ${e};
          border-radius: 16px;
          box-shadow: 0 4px 20px ${e}22;
        }
        .ws-theme-kids_play .ws-content { padding: 14mm 16mm 14mm; }
        .ws-theme-kids_play .ws-corner { display: none; }
        .ws-theme-kids_play .ws-watermark-word { opacity: 0.04; color: ${s}; }
        /* Large rounded question cards */
        .ws-theme-kids_play .ws-q {
          border-${i}: 0;
          border-radius: 12px;
          border: 2.5px solid ${e}33;
          background: white;
          padding: 4mm 5mm;
          margin-bottom: 5mm;
          box-shadow: 0 2px 6px ${e}14;
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+1) { border-color: ${e}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) { border-color: ${d}44; }
        .ws-theme-kids_play .ws-q:nth-child(3n+3) { border-color: ${a}44; }
        /* Very large circle number badges */
        .ws-theme-kids_play .ws-q-num {
          width: 32px; height: 32px;
          border-radius: 50%;
          box-shadow: none;
          font-size: ${Math.max(12,r+1)}pt;
          background: ${e};
        }
        .ws-theme-kids_play .ws-q:nth-child(3n+2) .ws-q-num { background: ${d}; }
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
      `}},science_lab:{id:"science_lab",nameAr:"مختبر علوم",nameEn:"Science Lab",description:"ورق مربعات خفيف، شارة المادة، أسلوب مفكرة العالم",headerLayout:"clipboard",defaultColor:"#0A6B6B",swatchColors:["#0A6B6B","#4FC3F7"],css({TC:e,GOLD:s,fontSizePt:r,isAr:n,startSide:i}){return`
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
          border-${i}: 4mm solid ${e};
          box-shadow: 0 3px 14px ${e}18;
        }
        .ws-theme-science_lab .ws-content { padding: 14mm 16mm 13mm; }
        .ws-theme-science_lab .ws-corner { display: none; }
        .ws-theme-science_lab .ws-watermark-word { opacity: 0.03; }
        /* Lab-notebook question boxes */
        .ws-theme-science_lab .ws-q {
          border-${i}: 0;
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
      `}},editorial:{id:"editorial",nameAr:"أسلوب تحريري",nameEn:"Editorial",description:"رأسية صحفية، خط سيريف، لإسلاميات والأدب والتاريخ",headerLayout:"masthead",defaultColor:"#4A1042",swatchColors:["#4A1042","#C8952A"],headingFontOverride:"'Amiri', 'Georgia', 'Times New Roman', serif",css({TC:e,GOLD:s,BG:r,fontSizePt:n,isAr:i,startSide:d}){return`
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
          border-${d}: 0;
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
          font-size: ${n+5}pt;
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
          font-size: ${n+.5}pt;
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
          font-size: ${n+13}pt;
          font-weight: 700;
          color: ${e};
          margin: 0 0 2mm;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
        .ws-mast-meta {
          font-size: ${Math.max(9,n-1)}pt;
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
          font-size: ${Math.max(8.5,n-2)}pt;
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
      `}}},be="ws_last_theme";function Ft(){try{return localStorage.getItem(be)??null}catch{return null}}function St(e){try{localStorage.setItem(be,e)}catch{}}function Et(e,s,r,n,i){const d=(e??"").trim().toLowerCase(),a=(s??"").trim().toLowerCase();if(/روض|kg|kind|التمهيد|kinder|grade 1\b|1st grade|first grade|الأول الابتدائي|الصف الأول/.test(a))return"kids_play";const m=[[/رياض|math|حساب|جبر|هندس|algebra|geometry|trigon|calculus|statistics/,"geometric"],[/فيزياء|physics/,"science_lab"],[/علوم|science|biology|chemistry|أحياء|كيمياء|بيولوجيا|biolog|chem|lab/,"science_lab"],[/اللغة العربية|عرب|arabic lang|لغة عرب|نحو|إملاء|صرف|بلاغ/,"arabic_ink"],[/إسلام|دين|قرآن|تلاوة|فقه|حديث|سيرة|Islamic|religion|quran|fiqh|hadith|seerah/,"editorial"],[/english|اللغة الإنجليزية|لغة إنجليزية|grammar|vocabulary|reading/,"modern_band"],[/تاريخ|جغرافيا|اجتماع|وطني|history|geography|social stud|civics/,"editorial"],[/أدب|literature|poetry|قصة|رواية|شعر|نثر/,"editorial"],[/تقنية|حاسوب|حاسب|technology|computer|ict/,"modern_band"]];for(const[c,g]of m)if(c.test(d))return g===i?{geometric:"science_lab",science_lab:"geometric",arabic_ink:"editorial",editorial:"arabic_ink",modern_band:"exam_paper",exam_paper:"modern_band",kids_play:"modern_band"}[g]:g;if(/ثانو|secondary|high school|grade 1[0-2]|10th|11th|12th|عاشر|الحادي عشر|الثاني عشر/.test(a)){const g=["exam_paper","editorial","modern_band"].filter(u=>u!==i);return g[n%g.length]}const l=["geometric","modern_band","editorial","exam_paper","science_lab"].filter(c=>c!==i);return l[n%l.length]}const Ye={geometric:"white",arabic_ink:"#FDFAF4",modern_band:"white",exam_paper:"white",kids_play:"#FFFBF0",science_lab:"white",editorial:"#FDF8F5"};function Ve({data:e,labels:s,TC:r,ar:n,hasIdentity:i,customFields:d}){const a=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),m=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...d.map(o=>`${o.label}: ${o.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-tab-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"3mm",justifyContent:n?"flex-end":"flex-start"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",className:"ws-logo-img"})}),t.jsxs("div",{className:"ws-tab-toprow",children:[t.jsx("div",{className:"",style:{textAlign:n?"right":"left"},children:m.map((o,l)=>t.jsx("div",{className:"ws-tab-school",children:o},l))}),t.jsx("h1",{className:"ws-tab-title",lang:e.language,children:e.title}),t.jsx("div",{className:"ws-tab-meta",children:a&&t.jsx("div",{children:a})})]}),t.jsx("div",{className:"ws-tab-inner-rule"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsx(Xe,{data:e,labels:s,TC:r}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#555",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`4px solid ${r}`,fontSize:"90%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function Xe({data:e,labels:s,TC:r}){const n=[e.settings.includeName&&{label:s.name,flex:2},e.settings.includeClass&&{label:s.clazz,flex:1},e.settings.includeDate&&{label:s.date,flex:1}].filter(Boolean);return t.jsx("div",{style:{display:"grid",gridTemplateColumns:n.map(i=>`${i.flex}fr`).join(" "),gap:"5mm",marginTop:"3mm"},children:n.map((i,d)=>t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${r}55`,paddingBottom:"3mm",fontWeight:700,color:r,fontSize:"90%"},children:[i.label,t.jsx("span",{style:{flex:1}})]},d))})}function Je({data:e,labels:s,TC:r,GOLD:n,ar:i,hasIdentity:d,customFields:a}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),o=[e.settings.schoolName&&{label:s.school,value:e.settings.schoolName},e.settings.teacherName&&{label:s.teacher,value:e.settings.teacherName},e.settings.section&&{label:s.section,value:e.settings.section},...a.map(l=>({label:l.label.trim(),value:l.value}))].filter(Boolean);return t.jsxs("div",{className:"ws-arb-header",children:[e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{marginBottom:"4mm"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",className:"ws-logo-img"})}),t.jsx(de,{GOLD:n}),m&&t.jsx("div",{className:"ws-arb-kicker",children:m}),t.jsx("h1",{className:"ws-arb-title",lang:e.language,children:e.title}),t.jsx(de,{GOLD:n}),o.length>0&&t.jsx("div",{className:"ws-arb-identity",children:o.map((l,c)=>t.jsxs("div",{className:"ws-arb-cell",children:[t.jsxs("span",{className:"ws-arb-cell-label",children:[l.label,":"]}),t.jsx("span",{children:l.value})]},c))}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"5mm",marginTop:"4mm"},children:[e.settings.includeName&&t.jsx(J,{label:s.name,TC:r,GOLD:n}),e.settings.includeClass&&t.jsx(J,{label:s.clazz,TC:r,GOLD:n}),e.settings.includeDate&&t.jsx(J,{label:s.date,TC:r,GOLD:n})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"90%",color:"#6a5c3a",margin:"3mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${n}12`,borderInlineStart:`4px solid ${n}`,fontSize:"90%",lineHeight:1.7,borderRadius:"4px"},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function de({GOLD:e}){return t.jsxs("div",{className:"ws-arb-ornament",children:[t.jsx("div",{className:"ws-arb-ornament-line"}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-diamond",style:{background:e}}),t.jsx("div",{className:"ws-arb-diamond-sm",style:{background:e,borderColor:e}}),t.jsx("div",{className:"ws-arb-ornament-line"})]})}function J({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px dashed ${r}88`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function Ze({data:e,labels:s,TC:r,GOLD:n,ar:i,hasIdentity:d,customFields:a}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),o=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(l=>`${l.label}: ${l.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-band-header",children:[t.jsxs("div",{className:"ws-band-top",children:[e.settings.logoUrl&&t.jsx("div",{style:{position:"absolute",top:"4mm",[i?"left":"right"]:"16mm"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",style:{height:"12mm",width:"auto",objectFit:"contain",filter:"brightness(10)"}})}),o.length>0&&t.jsx("div",{className:"ws-band-chips",children:o.map((l,c)=>t.jsx("span",{className:"ws-band-chip",children:l},c))}),t.jsx("h1",{className:"ws-band-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-band-sub",children:m})]}),t.jsxs("div",{className:"ws-band-body",children:[(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-band-fields",children:[e.settings.includeName&&t.jsx(Z,{label:s.name,TC:r,flex:2}),e.settings.includeClass&&t.jsx(Z,{label:s.clazz,TC:r,flex:1}),e.settings.includeDate&&t.jsx(Z,{label:s.date,TC:r,flex:1})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"90%",color:"#555",margin:"0 0 3mm",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{className:"ws-band-instr",children:[t.jsxs("strong",{children:[s.instructions,":"]})," ",e.settings.instructions]})]})]})}function Z({label:e,TC:s,flex:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"90%",flex:r},children:[e,t.jsx("span",{style:{flex:1}})]})}function Ge({data:e,labels:s,TC:r,GOLD:n,ar:i,hasIdentity:d,customFields:a}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),o=[e.settings.schoolName,e.settings.teacherName,e.settings.section,...a.map(l=>l.value)].filter(Boolean);return t.jsxs("div",{className:"ws-play-header",children:[t.jsxs("div",{className:"ws-play-banner",children:[t.jsx("div",{className:"ws-play-stars",children:"★ ☆ ★"}),t.jsx("h1",{className:"ws-play-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-play-sub",children:m}),o.length>0&&t.jsx("div",{className:"ws-play-chips",children:o.map((l,c)=>t.jsx("span",{className:"ws-play-chip",children:l},c))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-play-fields",children:[e.settings.includeName&&t.jsx(G,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(G,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(G,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontWeight:700,color:r,margin:"2mm 0",fontSize:"105%"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{background:`${r}12`,borderRadius:"10px",padding:"6px 12px",fontSize:"95%",fontWeight:700,color:r,marginBottom:"4mm"},children:["⭐ ",e.settings.instructions]})]})}function G({label:e,TC:s}){return t.jsxs("div",{className:"ws-play-field",children:[e,t.jsx("span",{className:"ws-play-field-rule"})]})}function Te({data:e,labels:s,TC:r,GOLD:n,ar:i,hasIdentity:d,customFields:a}){[e.subject,e.gradeLevel].filter(Boolean).join(" · ");const m=[e.settings.schoolName&&`${s.school}: ${e.settings.schoolName}`,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(o=>`${o.label}: ${o.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-clip-header",children:[t.jsxs("div",{className:"ws-clip-badges",children:[e.settings.logoUrl&&t.jsx("img",{src:e.settings.logoUrl,alt:"",style:{height:"10mm",width:"auto",objectFit:"contain"}}),e.subject&&t.jsx("span",{className:"ws-clip-badge",children:e.subject}),e.gradeLevel&&t.jsx("span",{className:"ws-clip-badge-sec",children:e.gradeLevel})]}),t.jsxs("div",{className:"ws-clip-title-row",children:[t.jsx("h1",{className:"ws-clip-title",lang:e.language,children:e.title}),m.length>0&&t.jsx("div",{className:"ws-clip-identity",children:m.map((o,l)=>t.jsx("div",{className:"ws-clip-id-row",children:o},l))})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-clip-fields",children:[e.settings.includeName&&t.jsx(T,{label:s.name,TC:r}),e.settings.includeClass&&t.jsx(T,{label:s.clazz,TC:r}),e.settings.includeDate&&t.jsx(T,{label:s.date,TC:r})]}),e.settings.headerNote&&t.jsx("p",{style:{fontSize:"88%",color:"#4a7a7a",margin:"2mm 0 0"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"4px 9px",background:`${r}08`,border:`1.5px solid ${r}33`,borderRadius:"3px",fontSize:"88%",lineHeight:1.6},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function T({label:e,TC:s}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1.5px solid ${s}55`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function et({data:e,labels:s,TC:r,GOLD:n,ar:i,hasIdentity:d,customFields:a}){const m=[e.subject,e.gradeLevel].filter(Boolean).join(" · "),o=[e.settings.schoolName,e.settings.teacherName&&`${s.teacher}: ${e.settings.teacherName}`,e.settings.section&&`${s.section}: ${e.settings.section}`,...a.map(l=>`${l.label}: ${l.value}`)].filter(Boolean);return t.jsxs("div",{className:"ws-mast-header",children:[t.jsx("div",{className:"ws-mast-rule-thick"}),t.jsx("div",{className:"ws-mast-rule-mid"}),e.settings.logoUrl&&t.jsx("div",{className:"ws-logo-wrap",style:{margin:"2mm auto"},children:t.jsx("img",{src:e.settings.logoUrl,alt:"",className:"ws-logo-img"})}),t.jsx("h1",{className:"ws-mast-title",lang:e.language,children:e.title}),m&&t.jsx("div",{className:"ws-mast-meta",children:m}),o.length>0&&t.jsx("div",{className:"ws-mast-identity",children:o.map((l,c)=>t.jsx("span",{children:l},c))}),t.jsx("div",{className:"ws-mast-rule-thin"}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-mast-fields",children:[e.settings.includeName&&t.jsx(ee,{label:s.name,TC:r,GOLD:n}),e.settings.includeClass&&t.jsx(ee,{label:s.clazz,TC:r,GOLD:n}),e.settings.includeDate&&t.jsx(ee,{label:s.date,TC:r,GOLD:n})]}),e.settings.headerNote&&t.jsx("p",{style:{textAlign:"center",fontSize:"88%",color:"#6a4a5a",margin:"2mm 0 0",fontStyle:"italic"},children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{style:{marginTop:"3mm",padding:"5px 10px",background:`${r}08`,borderInlineStart:`3px solid ${n}`,fontSize:"88%",lineHeight:1.7},children:[t.jsxs("strong",{style:{color:r,marginInlineEnd:"4px"},children:[s.instructions,":"]}),e.settings.instructions]})]})}function ee({label:e,TC:s,GOLD:r}){return t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"5px",borderBottom:`1px solid ${s}44`,paddingBottom:"3mm",fontWeight:700,color:s,fontSize:"88%"},children:[e,t.jsx("span",{style:{flex:1}})]})}function tt(e,s){return e?we[e]?.headingFontOverride??s:s}const te="#225739";function st({layout:e}){return e?.elements?.length?t.jsx(t.Fragment,{children:e.elements.map(s=>{const r={position:"absolute",left:`${s.x}%`,top:`${s.y}%`,width:`${s.width}%`,height:s.kind==="line"?`${s.strokeWidth??2}px`:`${s.height}%`,pointerEvents:"none",boxSizing:"border-box",zIndex:2};return s.kind==="text"?t.jsx("div",{style:{...r,fontSize:`${s.fontSize??14}pt`,fontWeight:s.bold?800:400,fontStyle:s.italic?"italic":"normal",color:s.fontColor??"#1a2421",textAlign:s.align??"right",padding:"2px 4px",whiteSpace:"pre-wrap",wordBreak:"break-word",overflow:"hidden"},children:s.text??""},s.id):s.kind==="rect"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px solid ${s.strokeColor??te}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:"2px",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="circle"?t.jsx("div",{style:{...r,border:`${s.strokeWidth??2}px solid ${s.strokeColor??te}`,background:s.fillColor==="transparent"?"transparent":s.fillColor??"transparent",borderRadius:"50%",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):s.kind==="line"?t.jsx("div",{style:{...r,background:s.strokeColor??te,WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}},s.id):null})}):null}const ce="",A="#225739",w="#D9A521";function rt(e,s){const r="'Cairo', 'Noto Naskh Arabic', 'Tajawal', 'Arial', sans-serif",n="'Inter', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif";switch(e){case"cairo":return`'Cairo', ${r}`;case"tajawal":return`'Tajawal', ${r}`;case"amiri":return`'Amiri', 'Scheherazade New', ${r}`;case"noto-naskh":return`'Noto Naskh Arabic', ${r}`;case"inter":return`'Inter', ${n}`;case"georgia":return"Georgia, 'Times New Roman', serif";default:return s==="ar"?r:n}}function it(e){return e==="ar"?"'Cairo', 'Noto Naskh Arabic', 'Tajawal', sans-serif":"'Inter', 'Source Sans Pro', sans-serif"}function me(e,s,r,n,i,d){if(e.length===0)return[[]];const a=s*.352778*1.85,m=r===2?22:44,o=5,l=p=>{const j=10+Math.max(1,Math.ceil((p.prompt?.length??0)/m))*a;switch(p.type){case"mcq":return j+p.options.filter(Boolean).length*a*1.3;case"true_false":return j+a*1.1;case"short_answer":return j+(p.lines??2)*9;case"fill_blank":return j+3;case"matching":return j+p.pairs.length*a*1.3}},c=[];let g=[],u=0,y=n;if(r===2)for(let p=0;p<e.length;p+=2){const z=d?.has(e[p].id)||p+1<e.length&&d?.has(e[p+1].id),j=Math.max(l(e[p]),p+1<e.length?l(e[p+1]):0)+o;g.length>0&&(z||u+j>y)&&(c.push(g),g=[],u=0,y=i),g.push(e[p]),p+1<e.length&&g.push(e[p+1]),u+=j}else for(const p of e){const z=d?.has(p.id),j=l(p)+o;g.length>0&&(z||u+j>y)&&(c.push(g),g=[],u=0,y=i),g.push(p),u+=j}return g.length>0&&c.push(g),c.length>0?c:[e]}function nt({theme:e,TC:s,GOLD:r,BG:n,fontFamily:i,headingFont:d,fontSizePt:a,lang:m}){const o=m==="ar",l=o?"right":"left",c=o?"left":"right";return t.jsx("style",{children:e.css({TC:s,GOLD:r,BG:n,fontFamily:i,headingFont:d,fontSizePt:a,isAr:o,startSide:l,endSide:c})})}function ot({theme:e,data:s,labels:r,TC:n,GOLD:i,ar:d,hasIdentity:a,customFields:m,classicFallback:o}){if(!e)return o;const l={data:s,labels:r,TC:n,GOLD:i,ar:d,hasIdentity:a,customFields:m,IdentityCell:()=>null,FieldLine:()=>null,DoubleDivider:()=>null,IconUser:()=>null,IconClass:()=>null,IconDate:()=>null,IconLightbulb:()=>null,IconSchool:()=>null,IconSection:()=>null,IconTeacher:()=>null,IconField:()=>null};switch(e.headerLayout){case"tabular":return t.jsx(Ve,{...l});case"arabesque":return t.jsx(Je,{...l});case"band":return t.jsx(Ze,{...l});case"playful":return t.jsx(Ge,{...l});case"clipboard":return t.jsx(Te,{...l});case"masthead":return t.jsx(et,{...l});default:return o}}function fe({data:e,onLayoutChange:s}){const r=e.language==="ar",n=r?"rtl":"ltr",i=rt(e.settings.fontFamily,e.language),d=it(e.language),a=e.settings.template,m=a?we[a]:void 0,o=a?Ye[a]??"white":"white",l=tt(a,d),c=Math.min(18,Math.max(9,e.settings.fontSizePt??12)),g=e.settings.showWatermark!==!1,u=e.settings.themeColor??m?.defaultColor??A,y=e.settings.logoUrl,[p,z]=b.useState(e.questions),[j,O]=b.useState(()=>new Set(e.settings.pageBreaks??[])),je=b.useMemo(()=>{const h=new Set;let x=null;for(const f of p)f.type!==x&&(h.add(f.id),x=f.type);return h},[p]),[yt,jt]=b.useState(!1),[$e,E]=b.useState(!1),[F,ke]=b.useState(!1),[D,ve]=b.useState(null),[$t,Ne]=b.useState(null),re=b.useRef(e);b.useEffect(()=>{re.current!==e&&(re.current=e,z(e.questions),O(new Set(e.settings.pageBreaks??[])),E(!1))},[e]),b.useCallback(h=>{O(x=>{const f=new Set(x);return f.add(h),f}),E(!0)},[]),b.useCallback(h=>{O(x=>{const f=new Set(x);return f.delete(h),f}),E(!0)},[]);const _e=b.useCallback(()=>{s?.(p,[...j]),E(!1)},[p,j,s]),Ae=b.useCallback(h=>{z(x=>x.map(f=>f.id===h.id?h:f)),E(!0)},[]);b.useCallback(h=>{D&&(Ne(null),ve(null),z(x=>{const M=me(x,c,e.settings.columns,190,250,j)[h];if(!M||M.length===0)return x;const k=M[0].id;if(k===D)return x;const N=x.find(S=>S.id===D);if(!N)return x;const I=x.filter(S=>S.id!==D),B=I.findIndex(S=>S.id===k);return B===-1?[...I,N]:[...I.slice(0,B),N,...I.slice(B)]}),E(!0))},[D,c,e.settings.columns,j]);const v=r?{name:"الاسم",date:"التاريخ",clazz:"الصف",section:"القسم",school:"المدرسة",teacher:"المعلم",instructions:"تعليمات",answerKey:"صفحة الإجابات",question:"س",true:"صح",false:"خطأ",correct:"الإجابة:",goodLuck:"نتمنى لك التوفيق ✦"}:{name:"Name",date:"Date",clazz:"Class",section:"Section",school:"School",teacher:"Teacher",instructions:"Instructions",answerKey:"Answer Key",question:"Q",true:"True",false:"False",correct:"Answer:",goodLuck:"✦ Good luck!"},Y=(e.settings.customFields??[]).filter(h=>(h?.label?.trim()??"")||(h?.value?.trim()??"")),Me=!!e.settings.schoolName||!!e.settings.section||!!e.settings.teacherName||!!y||Y.length>0,W=e.settings.columns,[V,ze]=b.useState(()=>me(e.questions,c,W,190,250)),ie=b.useRef(null),ne=b.useRef("");b.useLayoutEffect(()=>{const h=[e.questions.map($=>$.id).join(","),W,c,e.settings.schoolName??"",e.settings.section??"",e.settings.teacherName??"",y?"logo":"",e.settings.includeName?"n":"",e.settings.includeDate?"d":"",e.settings.includeClass?"c":"",e.settings.instructions??"",a??""].join("|");if(h===ne.current)return;const x=ie.current;if(!x)return;const f=Array.from(x.querySelectorAll("[data-q-measure]"));if(f.length!==e.questions.length)return;const M=x.querySelector("[data-header-measure]");ne.current=h;const k=3.7795,N=263*k,I=M?M.offsetHeight:60*k,B=12*k,L=12*k,S=8*k,Se=Math.max(N-I-B-L,80*k),le=Math.max(N-B-12*k-S,150*k),Ee=4*k,X=f.map($=>$.offsetHeight+Ee),H=[];let _=[],q=0,C=Se;if(W===2)for(let $=0;$<e.questions.length;$+=2){const R=Math.max(X[$]??0,X[$+1]??0);_.length>0&&q+R>C&&(H.push(_),_=[],q=0,C=le),_.push(e.questions[$]),$+1<e.questions.length&&_.push(e.questions[$+1]),q+=R}else for(let $=0;$<e.questions.length;$++){const R=X[$];_.length>0&&q+R>C&&(H.push(_),_=[],q=0,C=le),_.push(e.questions[$]),q+=R}_.length>0&&H.push(_),H.length>0&&ze(H)});const Ie=t.jsxs("header",{className:"ws-header",children:[t.jsxs("div",{className:"ws-headrow",dir:r?"rtl":"ltr",children:[t.jsxs("div",{className:"ws-headstart",children:[e.settings.schoolName&&t.jsx(Q,{label:v.school,value:e.settings.schoolName,icon:t.jsx(lt,{})}),e.settings.section&&t.jsx(Q,{label:v.section,value:e.settings.section,icon:t.jsx(dt,{})}),e.settings.teacherName&&t.jsx(Q,{label:v.teacher,value:e.settings.teacherName,icon:t.jsx(ct,{})}),Y.map((h,x)=>t.jsx(Q,{label:h.label.trim()||(r?"حقل":"Field"),value:h.value,icon:t.jsx(mt,{})},`cf-${x}`))]}),t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",children:e.title}),(e.subject||e.gradeLevel)&&t.jsx("div",{className:"ws-kicker-center",children:[e.subject,e.gradeLevel].filter(Boolean).join(" · ")}),t.jsx(ge,{})]}),t.jsx("div",{className:"ws-headend",children:y&&t.jsx("img",{src:y,alt:r?"شعار المدرسة":"School logo",className:"ws-logo-img"})})]}),(e.settings.includeName||e.settings.includeDate||e.settings.includeClass)&&t.jsxs("div",{className:"ws-fields",children:[e.settings.includeName&&t.jsx(se,{label:v.name,icon:t.jsx(pt,{})}),e.settings.includeClass&&t.jsx(se,{label:v.clazz,icon:t.jsx(ht,{}),short:!0}),e.settings.includeDate&&t.jsx(se,{label:v.date,icon:t.jsx(gt,{}),short:!0})]}),e.settings.headerNote&&t.jsx("p",{className:"ws-subtitle",children:e.settings.headerNote}),e.settings.instructions&&t.jsxs("div",{className:"ws-instructions",children:[t.jsx(xt,{}),t.jsxs("div",{children:[t.jsx("strong",{children:v.instructions}),t.jsxs("span",{children:[" ",e.settings.instructions]})]})]})]}),oe=t.jsx(ot,{theme:m,data:e,labels:v,TC:u,GOLD:w,ar:r,hasIdentity:Me,customFields:Y,classicFallback:Ie}),Be=W===2?"calc((174mm - 8mm) / 2)":"174mm",ae=`ws-page${a?` ws-theme-${a}`:""}`,Fe="bg-neutral-200";return t.jsxs(t.Fragment,{children:[t.jsx(bt,{fontFamily:i,headingFont:l,fontSizePt:c,lang:e.language,themeColor:u}),m&&t.jsx(nt,{theme:m,TC:u,GOLD:w,BG:o,fontFamily:i,headingFont:l,fontSizePt:c,lang:e.language}),t.jsxs("div",{ref:ie,"aria-hidden":"true",className:`print-host${a?` ws-theme-${a}`:""}`,style:{position:"absolute",left:"-9999px",top:0,visibility:"hidden",pointerEvents:"none"},dir:n,children:[t.jsx("div",{"data-header-measure":!0,style:{width:"174mm"},children:oe}),e.questions.map((h,x)=>t.jsx("div",{"data-q-measure":!0,style:{width:Be},children:t.jsx(xe,{index:x+1,q:h,ar:r,labels:v})},h.id))]}),s&&t.jsxs("div",{className:"no-print",style:{position:"fixed",bottom:16,[r?"left":"right"]:16,zIndex:40,display:"flex",gap:8,alignItems:"center",background:F?w:"white",border:`2px solid ${F?w:A}`,borderRadius:999,padding:"7px 14px",boxShadow:"0 4px 16px rgba(0,0,0,0.18)",fontFamily:"inherit",fontWeight:700,fontSize:13,color:F?"white":A,cursor:"pointer",transition:"all 0.18s"},role:"group","aria-label":r?"أدوات التعديل":"Edit tools",children:[F&&$e&&t.jsxs("button",{onClick:_e,style:{background:"white",color:A,border:"none",borderRadius:999,padding:"3px 12px",fontWeight:800,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5},children:[t.jsx(Oe,{style:{width:14,height:14}}),r?"حفظ":"Save"]}),t.jsxs("button",{onClick:()=>ke(h=>!h),style:{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:"inherit",fontWeight:700,fontSize:13,padding:0},children:[t.jsx(ue,{style:{width:15,height:15}}),F?r?"إنهاء التعديل":"Done editing":r?"تعديل النص":"Edit text"]})]}),t.jsxs("div",{id:"ws-printable-root",className:`print-host ${Fe} min-h-screen py-6 px-2 flex flex-col items-center`,dir:n,style:F?{outline:"none"}:void 0,children:[V.map((h,x)=>{const f=x+1,M=x===0,k=x===V.length-1;return t.jsxs("article",{className:ae,lang:e.language,style:{background:o},children:[g&&t.jsx(he,{ar:r}),!a&&t.jsx(K,{}),a==="arabic_ink"&&t.jsx(K,{}),M&&t.jsx(st,{layout:e.settings.layout}),t.jsxs("div",{className:"ws-content",children:[M?oe:t.jsxs("div",{className:"ws-cont-header",children:[t.jsx("span",{className:"ws-cont-title",children:e.title}),t.jsx("span",{className:"ws-cont-page",children:r?`صفحة ${f}`:`Page ${f}`})]}),t.jsx("section",{className:"ws-questions",style:{columnCount:W===2?2:1},children:h.map(N=>{const I=p.find(L=>L.id===N.id)??N,B=p.findIndex(L=>L.id===N.id);return t.jsx(xe,{index:B+1,q:I,ar:r,labels:v,editMode:F,onEdit:Ae,showTypeHeader:je.has(N.id)},N.id)})}),t.jsx(pe,{note:k?e.settings.footerNote:void 0,goodLuck:k?e.settings.goodLuck?.trim()||v.goodLuck:""})]}),e.linkedAssignmentId!=null&&t.jsx(ft,{worksheetId:e.id,page:f,total:V.length,ar:r})]},f)}),e.settings.includeAnswerKey&&t.jsxs("article",{className:ae,lang:e.language,style:{background:o},children:[g&&t.jsx(he,{ar:r}),!a&&t.jsx(K,{}),a==="arabic_ink"&&t.jsx(K,{}),t.jsxs("div",{className:"ws-content",children:[t.jsx("header",{className:"ws-header",children:t.jsx("div",{className:"ws-headgrid ws-headgrid-titleonly",children:t.jsxs("div",{className:"ws-headcenter",children:[t.jsx("h1",{className:"ws-title",style:{color:w},children:v.answerKey}),t.jsx("div",{className:"ws-kicker-center",style:{color:w,background:`${w}1f`},children:e.title}),t.jsx(ge,{gold:!0})]})})}),t.jsx("section",{className:"ws-questions",style:{columnCount:1},children:e.questions.map((h,x)=>t.jsx(wt,{index:x+1,q:h,ar:r,labels:v},h.id))}),t.jsx(pe,{goodLuck:""})]})]})]})]})}function at(){const s=Le()?.id,{lang:r}=qe(),[,n]=De(),[i,d]=b.useState(null),[a,m]=b.useState(!0);if(b.useEffect(()=>{s&&fetch(`${ce}/api/worksheets/${s}`,{credentials:"include"}).then(c=>{if(!c.ok)throw new Error("load failed");return c.json()}).then(d).catch(()=>U.error(r==="ar"?"تعذّر تحميل ورقة العمل":"Failed to load worksheet")).finally(()=>m(!1))},[s,r]),a)return t.jsx("div",{className:"min-h-screen flex items-center justify-center",children:t.jsx(We,{className:"w-8 h-8 animate-spin",style:{color:A}})});if(!i)return t.jsx("div",{className:"min-h-screen flex items-center justify-center text-muted-foreground",children:r==="ar"?"لم يتم العثور على ورقة العمل.":"Worksheet not found."});const o=i.language==="ar"?"rtl":"ltr",l=()=>{const c=document.getElementById("ws-printable-root");if(!c){U.error(r==="ar"?"تعذّر إعداد الملف":"Could not prepare file");return}Re({element:c,title:i.title,lang:i.language})};return t.jsxs(t.Fragment,{children:[t.jsxs("div",{dir:o,className:"no-print sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b shadow-sm bg-white",children:[t.jsxs("button",{onClick:()=>n("/teacher"),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${A}55`,color:A},children:[t.jsx(Ue,{className:"w-3.5 h-3.5"}),r==="ar"?"اللوحة":"Dashboard"]}),t.jsx("div",{className:"text-xs font-bold truncate flex-1 text-center",style:{color:A},children:i.title}),t.jsxs("div",{className:"flex gap-1.5 flex-wrap justify-end",children:[i.isOwner!==!1&&i.linkedAssignmentId!=null&&t.jsxs("button",{onClick:()=>n(`/teacher/worksheets/${i.id}/grade`),className:"px-3 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:"#2f684d"},title:r==="ar"?"تصحيح الأوراق بالكاميرا":"Grade papers with camera","data-testid":"btn-open-grading",children:[t.jsx(Qe,{className:"w-3.5 h-3.5"}),r==="ar"?"تصحيح":"Grade"]}),i.isOwner!==!1&&t.jsxs("button",{onClick:()=>n(`/teacher/worksheets/create?edit=${i.id}`),className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${A}55`,color:A},title:r==="ar"?"تحرير هذه الورقة":"Edit this worksheet",children:[t.jsx(ue,{className:"w-3.5 h-3.5"}),r==="ar"?"تحرير":"Edit"]}),t.jsxs("button",{onClick:l,className:"px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5",style:{borderColor:`${w}88`,color:w,background:`${w}10`},title:r==="ar"?"تنزيل كملف وورد":"Download as Word",children:[t.jsx(Ke,{className:"w-3.5 h-3.5"}),r==="ar"?"وورد":"Word"]}),t.jsxs("button",{onClick:()=>He(),className:"px-4 py-1.5 rounded-lg font-bold text-white flex items-center gap-1.5 text-sm",style:{background:A},children:[t.jsx(Pe,{className:"w-3.5 h-3.5"}),r==="ar"?"PDF / طباعة":"PDF / Print"]})]})]}),t.jsx(fe,{data:i,onLayoutChange:i.isOwner!==!1?async(c,g)=>{const u={...i,questions:c,settings:{...i.settings,pageBreaks:g}};try{if(!(await fetch(`${ce}/api/worksheets/${i.id}`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:u.title,language:u.language,gradeLevel:u.gradeLevel,subject:u.subject,questions:u.questions,settings:u.settings})})).ok)throw new Error("save failed");d(u),U.success(r==="ar"?"تم حفظ توزيع الصفحات":"Layout saved")}catch{U.error(r==="ar"?"تعذّر الحفظ":"Save failed")}}:void 0})]})}function se({label:e,short:s,icon:r}){return t.jsxs("div",{className:`ws-field-line ${s?"short":""}`,children:[r&&t.jsx("span",{className:"ws-field-icon",children:r}),t.jsxs("span",{className:"ws-field-label",children:[e,":"]}),t.jsx("span",{className:"ws-field-rule"})]})}function Q({label:e,value:s,icon:r}){return t.jsxs("div",{className:"ws-school-cell",children:[t.jsx("span",{className:"ws-school-icon",children:r}),t.jsxs("div",{className:"ws-school-text",children:[t.jsx("span",{className:"ws-school-label",children:e}),t.jsx("span",{className:"ws-school-value",children:s})]})]})}function pe({note:e,goodLuck:s}){return!e&&!s?null:t.jsxs("footer",{className:"ws-footer",children:[s&&t.jsx("div",{className:"ws-footer-cheer",children:s}),e&&t.jsx("div",{className:"ws-footer-note",children:e})]})}function he({ar:e}){const s=e?"حصاد":"Hasaad";return t.jsx("div",{className:"ws-watermark","aria-hidden":"true",children:t.jsx("span",{className:"ws-watermark-word",children:s})})}function K(){return t.jsxs(t.Fragment,{children:[t.jsx("span",{className:"ws-corner ws-corner-tl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-tr","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-bl","aria-hidden":"true"}),t.jsx("span",{className:"ws-corner ws-corner-br","aria-hidden":"true"})]})}function ge({gold:e}){return t.jsxs("div",{className:`ws-divider ${e?"gold":""}`,"aria-hidden":"true",children:[t.jsx("span",{className:"ws-divider-thick"}),t.jsx("span",{className:"ws-divider-thin"})]})}function lt(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("path",{d:"M3 10l9-5 9 5-9 5-9-5z"}),t.jsx("path",{d:"M7 12v4c0 1 2 2 5 2s5-1 5-2v-4"})]})}function dt(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"4",y:"4",width:"16",height:"16",rx:"2"}),t.jsx("path",{d:"M9 4v16M4 9h16"})]})}function ct(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"3"}),t.jsx("path",{d:"M5 21c0-4 3-7 7-7s7 3 7 7"})]})}function mt(){return t.jsx("svg",{viewBox:"0 0 24 24",width:"14",height:"14",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:t.jsx("path",{d:"M4 7h16M4 12h16M4 17h10"})})}function pt(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("circle",{cx:"12",cy:"8",r:"4"}),t.jsx("path",{d:"M4 21c0-4 4-6 8-6s8 2 8 6"})]})}function ht(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"6",width:"18",height:"13",rx:"2"}),t.jsx("path",{d:"M8 3v6M16 3v6"})]})}function gt(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"13",height:"13",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[t.jsx("rect",{x:"3",y:"5",width:"18",height:"16",rx:"2"}),t.jsx("path",{d:"M3 10h18M8 3v4M16 3v4"})]})}function xt(){return t.jsxs("svg",{viewBox:"0 0 24 24",width:"16",height:"16",fill:"none",stroke:w,strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",style:{flex:"0 0 auto"},children:[t.jsx("path",{d:"M9 18h6M10 21h4"}),t.jsx("path",{d:"M12 3a6 6 0 0 0-4 10c1 1 1.5 2 1.5 3h5c0-1 .5-2 1.5-3A6 6 0 0 0 12 3z"})]})}function ut(e,s){return s?{mcq:"اختر الإجابة الصحيحة من الاختيارات التالية:",true_false:"ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام العبارة الخاطئة:",short_answer:"أجب عن الأسئلة التالية إجابةً قصيرة:",fill_blank:"أكمل الفراغات التالية بالكلمة المناسبة:",matching:"صل بين العمودين بخطوط:"}[e]:{mcq:"Choose the correct answer from the following:",true_false:"Write (✓) for True and (✗) for False:",short_answer:"Answer the following questions briefly:",fill_blank:"Fill in the blanks with the appropriate word:",matching:"Match the following columns:"}[e]}function P({text:e,editMode:s,className:r,onCommit:n,placeholder:i}){const d=b.useRef(null);return b.useEffect(()=>{d.current&&!s&&(d.current.textContent=e)},[e,s]),s?t.jsx("span",{ref:d,className:`ws-editable${r?` ${r}`:""}`,contentEditable:!0,suppressContentEditableWarning:!0,onFocus:a=>{a.currentTarget.textContent||(a.currentTarget.textContent=e)},onBlur:a=>{const m=a.currentTarget.textContent?.trim()??"";n(m||e)},onKeyDown:a=>{a.key==="Enter"&&(a.preventDefault(),a.currentTarget.blur())},spellCheck:!1,dir:"auto",children:e||i}):t.jsx("span",{className:r,children:e||i})}function xe({index:e,q:s,ar:r,labels:n,editMode:i,onEdit:d,showTypeHeader:a}){const m=i??!1,o=d??(()=>{});return t.jsxs(t.Fragment,{children:[a&&t.jsx("div",{className:"ws-section-instr",children:ut(s.type,r)}),t.jsxs("div",{className:"ws-q",children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num","aria-label":`${n.question} ${e}`,children:e}),t.jsxs("div",{className:"ws-q-prompt-wrap",children:[typeof s.points=="number"&&s.points>0&&t.jsx("div",{className:"ws-q-typeline",children:t.jsxs("span",{className:"ws-q-points",children:[s.points," ",r?"د":"pt"]})}),t.jsx("div",{className:"ws-q-prompt",children:t.jsx(P,{text:s.prompt??(s.type==="matching"?r?"صل بين العمودين بخطوط:":"Match the columns:":""),editMode:m,onCommit:l=>o({...s,prompt:l})})})]})]}),s.type==="mcq"&&t.jsx("ol",{className:"ws-mcq",children:s.options.map((l,c)=>t.jsxs("li",{children:[t.jsxs("span",{className:"ws-mcq-letter",children:[r?`${"أبجده"[c]||c+1}`:String.fromCharCode(65+c),")"]}),t.jsx("span",{className:"ws-bubble"}),t.jsx("span",{className:"ws-mcq-text",children:t.jsx(P,{text:l,editMode:m,onCommit:g=>{const u=s.options.slice();u[c]=g,o({...s,options:u})}})})]},c))}),s.type==="true_false"&&t.jsxs("div",{className:"ws-tf",children:[t.jsxs("span",{className:"ws-tf-opt",children:[t.jsx("span",{className:"ws-bubble"})," ",n.true]}),t.jsxs("span",{className:"ws-tf-opt",children:[t.jsx("span",{className:"ws-bubble"})," ",n.false]})]}),s.type==="short_answer"&&t.jsx("div",{className:"ws-lines",children:Array.from({length:s.lines??2}).map((l,c)=>t.jsx("span",{className:"ws-line"},c))}),s.type==="fill_blank"&&t.jsx("div",{className:"ws-fill",children:t.jsx("span",{className:"ws-fill-rule"})}),s.type==="matching"&&t.jsxs("div",{className:"ws-match",children:[t.jsx("ul",{className:"ws-match-col",children:s.pairs.map((l,c)=>t.jsxs("li",{children:[t.jsx("span",{className:"ws-match-bullet ws-match-num",children:c+1}),t.jsx("span",{className:"ws-match-text",children:t.jsx(P,{text:l.left,editMode:m,onCommit:g=>{const u=s.pairs.map((y,p)=>p===c?{...y,left:g}:y);o({...s,pairs:u})}})}),t.jsx("span",{className:"ws-match-tab"})]},`l${c}`))}),t.jsx("div",{className:"ws-match-divider","aria-hidden":"true"}),t.jsx("ul",{className:"ws-match-col",children:ye(s.pairs.length).map((l,c)=>t.jsxs("li",{children:[t.jsx("span",{className:"ws-match-tab"}),t.jsx("span",{className:"ws-match-bullet ws-match-letter",children:String.fromCharCode(65+c)}),t.jsx("span",{className:"ws-match-text",children:t.jsx(P,{text:s.pairs[l].right,editMode:m,onCommit:g=>{const u=s.pairs.map((y,p)=>p===l?{...y,right:g}:y);o({...s,pairs:u})}})})]},`r${c}`))})]})]})]})}function wt({index:e,q:s,ar:r,labels:n}){let i="";if(s.type==="mcq")i=`${r?`${"أبجده"[s.correctIndex]||s.correctIndex+1}`:String.fromCharCode(65+s.correctIndex)}) ${s.options[s.correctIndex]??""}`;else if(s.type==="true_false")i=s.correct?n.true:n.false;else if(s.type==="short_answer")i=s.answer?.trim()||"—";else if(s.type==="fill_blank")i=s.answer;else if(s.type==="matching"){const d=ye(s.pairs.length);i=s.pairs.map((a,m)=>{const o=d.indexOf(m);return`${m+1} → ${String.fromCharCode(65+(o>=0?o:m))}`}).join("    ")}return t.jsxs("div",{className:"ws-q ws-answer",children:[t.jsxs("div",{className:"ws-q-head",children:[t.jsx("span",{className:"ws-q-num",children:e}),t.jsx("div",{className:"ws-q-prompt-wrap",children:t.jsx("div",{className:"ws-q-prompt",children:s.type==="matching"?r?"أزواج التوصيل":"Matching pairs":s.prompt})})]}),t.jsxs("div",{className:"ws-answer-line",children:[t.jsx("strong",{children:n.correct})," ",i]})]})}function ye(e){const s=Array.from({length:e},(i,d)=>d);let r=e*2654435761>>>0;const n=()=>{r|=0,r=r+1831565813|0;let i=Math.imul(r^r>>>15,1|r);return i=i+Math.imul(i^i>>>7,61|i)^i,((i^i>>>14)>>>0)/4294967296};for(let i=e-1;i>0;i--){const d=Math.floor(n()*(i+1)),a=s[i];s[i]=s[d],s[d]=a}return e>1&&s.every((i,d)=>i===d)&&([s[0],s[1]]=[s[1],s[0]]),s}function bt({fontFamily:e,headingFont:s,fontSizePt:r,lang:n,themeColor:i}){const d=n==="ar",a=d?"right":"left",m=d?"left":"right",o=i;return t.jsx("style",{children:`
      /* High-quality Arabic + Latin fonts, including elegant heading
         faces (Reem Kufi, Amiri) used for the title and section labels. */
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

      .print-host { font-family: ${e}; }
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
        overflow: visible;
        border-radius: 4px;
      }
      .ws-page:last-of-type { page-break-after: auto; margin-bottom: 0; }
      .ws-content {
        position: relative;
        z-index: 1;
        padding: 18mm 18mm 16mm 18mm;
        display: flex;
        flex-direction: column;
        /* --ws-frame = مجموع سماكة إطار الصفحة (أعلى+أسفل) في القوالب ذات الحدود.
           بدون خصمه يتجاوز ارتفاع الصفحة 297mm بضع بكسلات فتنقسم كل صفحة
           مطبوعة إلى صفحتين (شريحة مكررة) عند الطباعة/تصدير PDF. */
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
        font-size: 200pt;
        color: ${o};
        opacity: 0.05;
        transform: rotate(-22deg);
        white-space: nowrap;
        letter-spacing: 0.05em;
        user-select: none;
      }

      /* Decorative gold corner ornaments. */
      .ws-corner {
        position: absolute; width: 18mm; height: 18mm;
        border: 1.4px solid ${w};
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
        color: ${o};
        background: ${o}10;
        padding: 3px 12px;
        border-radius: 999px;
        letter-spacing: 0.02em;
        margin-top: 2mm;
      }

      .ws-title {
        font-family: ${s};
        font-size: ${r+12}pt;
        font-weight: 800;
        color: ${o};
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
        width: 64%; height: 2px; background: ${w};
        border-radius: 2px;
      }
      .ws-divider-thin {
        width: 40%; height: 1px;
        background: repeating-linear-gradient(to right, ${o} 0 6px, transparent 6px 12px);
      }
      .ws-divider.gold .ws-divider-thick { background: ${o}; }
      .ws-divider.gold .ws-divider-thin { background: repeating-linear-gradient(to right, ${w} 0 6px, transparent 6px 12px); }

      .ws-school-cell {
        display: flex; align-items: center; gap: 8px;
        background: linear-gradient(135deg, ${o}0d 0%, ${w}10 100%);
        border-${a}: 3px solid ${o};
        padding: 5px 10px;
        border-radius: 4px;
      }
      .ws-school-icon {
        display: inline-flex; align-items: center; justify-content: center;
        color: ${o};
        flex: 0 0 auto;
      }
      .ws-school-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
      .ws-school-label {
        font-weight: 700;
        color: ${o};
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
        border-bottom: 1px dashed ${o}55;
        padding: 4px 4px 6px;
      }
      .ws-field-icon { color: ${o}; flex: 0 0 auto; display: inline-flex; }
      .ws-field-label { font-weight: 700; color: ${o}; white-space: nowrap; flex: 0 0 auto; }
      .ws-field-rule { flex: 1; height: 14px; }

      .ws-instructions {
        display: flex; gap: 8px; align-items: flex-start;
        background: linear-gradient(135deg, ${w}1a 0%, ${w}08 100%);
        border-${a}: 4px solid ${w};
        padding: 8px 12px;
        font-size: ${Math.max(9,r-1)}pt;
        margin-top: 4mm;
        border-radius: 4px;
        line-height: 1.6;
      }
      .ws-instructions strong { color: ${o}; margin-${m}: 4px; }

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
        border-${a}: 3px solid ${w};
        background: linear-gradient(180deg, #ffffff 0%, ${o}04 100%);
        border-radius: 0 6px 6px 0;
        ${d?"border-radius: 6px 0 0 6px;":""}
      }
      .ws-q-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 3mm; }
      .ws-q-num {
        flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px;
        background: ${o};
        color: white;
        border-radius: 50%;
        font-weight: 800;
        font-size: ${Math.max(9.5,r-1)}pt;
        font-family: ${s};
        box-shadow: 0 0 0 2px ${w}55;
      }
      .ws-q-prompt-wrap { flex: 1; min-width: 0; }
      /* Section instruction — shown once before the first question of each type group */
      .ws-section-instr {
        font-size: ${Math.max(9,r-1.5)}pt;
        font-weight: 700;
        color: ${o};
        border-${a}: 3px solid ${o};
        padding: 2mm 4mm;
        margin: 3mm 0 2mm;
        background: ${o}08;
        border-radius: 0 4px 4px 0;
        break-inside: avoid;
      }
      /* Points badge — still shown per-question when points are assigned */
      .ws-q-typeline { display: flex; align-items: center; gap: 8px; margin-bottom: 1mm; }
      .ws-q-points {
        font-size: ${Math.max(7.5,r-3.5)}pt;
        font-weight: 800;
        color: ${w};
        background: ${w}18;
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

      .ws-mcq { list-style: none; padding-${a}: 36px; margin: 2mm 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 16px; }
      .ws-mcq li {
        display: flex; gap: 7px; align-items: center;
        line-height: 1.6;
      }
      .ws-mcq-letter {
        display: inline-block;
        min-width: 18px;
        font-weight: 800;
        color: ${w};
        font-family: ${s};
      }
      .ws-bubble {
        display: inline-block;
        width: 14px; height: 14px;
        border: 1.6px solid ${o}88;
        border-radius: 50%;
        flex: 0 0 auto;
        background: white;
      }
      .ws-mcq-text { flex: 1; }

      .ws-tf {
        display: flex; gap: 24px;
        padding-${a}: 36px;
        margin-top: 2mm;
        align-items: center;
      }
      .ws-tf-opt {
        display: inline-flex; align-items: center; gap: 8px;
        font-weight: 700;
      }
      /* Square checkbox for true/false (override the default circle bubble) */
      .ws-tf .ws-bubble {
        border-radius: 2px;
        width: 15px; height: 15px;
      }
      .ws-tf-sym {
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px;
        border: 1.8px solid currentColor;
        border-radius: 4px;
        font-size: ${Math.max(11,r)}pt;
        font-weight: 900;
        line-height: 1;
        flex: 0 0 auto;
      }
      .ws-tf-sym-check { color: #1a7a3f; }
      .ws-tf-sym-cross  { color: #c0392b; }

      .ws-lines { padding-${a}: 36px; margin-top: 2mm; }
      .ws-line {
        display: block;
        border-bottom: 1px dotted ${o}66;
        height: 8mm;
      }

      .ws-fill { padding-${a}: 36px; margin-top: 1mm; }
      .ws-fill-rule {
        display: block;
        height: 8mm;
        border-bottom: 1.5px dashed ${o};
      }

      .ws-match {
        display: grid;
        grid-template-columns: 1fr 6mm 1fr;
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
        display: flex; align-items: center; gap: 7px;
        background: white;
        border: 1px solid ${o}22;
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
      .ws-match-num { background: ${o}; color: white; }
      .ws-match-letter { background: ${w}; color: white; }
      .ws-match-text { flex: 1; }
      .ws-match-tab { flex: 0 0 0; }
      .ws-match-divider {
        background: repeating-linear-gradient(to bottom, ${w} 0 4px, transparent 4px 9px);
        width: 2px;
        margin: 0 auto;
      }

      /* Footer strip — brand line removed per teacher request; only the
         "good luck" cheer and optional teacher footer note remain. */
      .ws-footer {
        margin-top: auto;
        padding-top: 6mm;
        border-top: 1px dashed ${o}44;
        text-align: center;
        font-size: ${Math.max(8,r-2.5)}pt;
        color: #6a7370;
      }
      .ws-footer-cheer {
        font-family: ${s};
        font-weight: 700;
        color: ${w};
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
        border-bottom: 2px solid ${o}22;
      }
      .ws-cont-title {
        font-family: ${s};
        font-weight: 800;
        font-size: ${Math.max(10,r)}pt;
        color: ${o};
      }
      .ws-cont-page {
        font-size: ${Math.max(8,r-2)}pt;
        font-weight: 700;
        color: ${o}88;
        background: ${o}0d;
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
      .ws-answer .ws-q-num { background: ${w}; box-shadow: 0 0 0 2px ${o}55; }
      .ws-answer-line {
        margin-top: 2mm;
        padding-${a}: 36px;
        color: ${o};
        font-size: ${Math.max(9.5,r-.5)}pt;
      }
      .ws-answer-line strong { color: ${w}; margin-${m}: 4px; }

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
        ${d?"right":"left"}: 0;
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
        ${d?"left":"right"}: 20px;
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
        /* عند الطباعة نترك بضع بكسلات احتياطاً — أي صفحة يتجاوز ارتفاعها
           297mm ولو بكسراً واحداً تنقسم في PDF إلى صفحة + شريحة مكررة. */
        .ws-content {
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
    `})}function ft({worksheetId:e,page:s,total:r,ar:n}){const i=`${window.location.origin}/teacher/worksheets/${e}/grade?p=${s}&of=${r}`;return t.jsxs("div",{style:{position:"absolute",bottom:"6mm",insetInlineStart:"8mm",display:"flex",alignItems:"center",gap:"2mm",zIndex:5},children:[t.jsx("div",{style:{background:"white",padding:"1mm",border:"0.4mm solid #d4d4d4",borderRadius:"1mm",lineHeight:0},children:t.jsx(Ce,{value:i,size:52,style:{width:"13mm",height:"13mm"}})}),t.jsxs("div",{style:{fontSize:"7pt",color:"#8a8a8a",lineHeight:1.5,fontWeight:600},children:[t.jsx("div",{children:n?"امسح للتصحيح الذكي":"Scan to grade"}),r>1&&t.jsx("div",{style:{fontWeight:800,color:"#5a5a5a"},children:n?`صفحة ${s} / ${r}`:`Page ${s} / ${r}`})]})]})}const Lt=Object.freeze(Object.defineProperty({__proto__:null,WorksheetPrintView:fe,default:at},Symbol.toStringTag,{value:"Module"}));export{we as T,fe as W,St as a,Ft as g,Et as s,Lt as w};
