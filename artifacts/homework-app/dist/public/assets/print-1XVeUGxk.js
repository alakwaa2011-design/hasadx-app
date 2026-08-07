import{a as m,j as o}from"./vendor-react-nSsBnU22.js";import{bK as w}from"./vendor-BxYjvUzn.js";import{X as y,Y as k}from"./index-B9R5Bg_T.js";import{b as j}from"./slide-render-i8Nz9HB4.js";import"./vendor-radix-NKxx0A_R.js";import"./vendor-query-Bib9NpEm.js";import"./slide-themes-DzouSB3J.js";function E({id:l,isAr:t}){const[i,u]=m.useState(!1),a=async()=>{if(!(i||!Number.isFinite(l))){u(!0);try{const n=await fetch(`/api/presentations/${l}/export/pdf`,{method:"POST",credentials:"include"});if(!n.ok){const c=await n.json().catch(()=>({}));throw new Error(c?.message||`HTTP ${n.status}`)}const h=await n.blob(),d=n.headers.get("Content-Disposition")||"",f=/filename\*=UTF-8''([^;]+)/i.exec(d),b=f?decodeURIComponent(f[1]):`presentation-${l}.pdf`,g=URL.createObjectURL(h),e=document.createElement("a");e.href=g,e.download=b,document.body.appendChild(e),e.click(),e.remove(),URL.revokeObjectURL(g)}catch(n){alert((t?"تعذّر التصدير: ":"Export failed: ")+n.message)}finally{u(!1)}}},s=i?t?"جارٍ التجهيز…":"Preparing…":t?"تنزيل PDF":"Download PDF";return o.jsx("button",{type:"button",onClick:a,disabled:i,style:{padding:"10px 18px",fontSize:14,fontWeight:600,color:"white",background:i?"#6b7280":"#1d4ed8",border:"none",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,.3)",cursor:i?"wait":"pointer"},children:s})}function F(){const[,l]=w("/teacher/presentations/:id/print"),t=parseInt(l?.id??"",10),i=typeof window<"u"?window.location.search:"",u=new URLSearchParams(i),a=u.get("exportToken"),s=u.get("ssr")==="1",[n,h]=m.useState(null),[d,f]=m.useState(null);m.useEffect(()=>{if(!a||!Number.isFinite(t))return;let p=!1;return fetch(`/api/presentations/${t}/export-data?token=${encodeURIComponent(a)}`).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(r=>{p||h(r)}).catch(r=>{p||f(r.message)}),()=>{p=!0}},[a,t]);const{data:b,isLoading:g}=y(t,{query:{queryKey:k(t),enabled:Number.isFinite(t)&&!a}}),e=a?n??void 0:b;if(m.useEffect(()=>{!e?.slides&&!d||requestAnimationFrame(()=>{requestAnimationFrame(()=>{window.__SLIDES_READY__=!0})})},[e?.slides?.length,d]),d)return o.jsxs("div",{style:{padding:24,fontFamily:"sans-serif",color:"#b91c1c"},children:["Export error: ",d]});if(!a&&g||!e)return null;const c=e.language==="ar",x=e.slides??[];return o.jsxs("div",{dir:c?"rtl":"ltr",lang:c?"ar":"en",className:"bg-white",children:[o.jsx("style",{children:`
        @page { size: 1280px 720px; margin: 0; }
        html, body { background: white; margin: 0; padding: 0; }
        .print-slide {
          width: 1280px; height: 720px; page-break-after: always;
          break-after: page; overflow: hidden; position: relative;
        }
        .print-slide:last-child { page-break-after: auto; break-after: auto; }
        @media screen {
          body { background: ${s?"white":"#1a1a1a"}; padding: ${s?"0":"24px"}; }
          .print-slide {
            margin: ${s?"0":"0 auto 24px"};
            box-shadow: ${s?"none":"0 8px 24px rgba(0,0,0,.4)"};
            transform-origin: top left;
          }
        }
        @media print {
          body { background: white !important; padding: 0 !important; }
          .print-slide { margin: 0 !important; box-shadow: none !important; }
          .print-trigger { display: none !important; }
        }
      `}),!s&&o.jsxs("div",{className:"print-trigger",style:{position:"fixed",top:16,insetInlineEnd:16,zIndex:50,display:"flex",gap:8},children:[o.jsx(E,{id:t,isAr:c}),o.jsx("button",{type:"button",onClick:()=>{try{window.print()}catch{}},style:{padding:"10px 18px",fontSize:14,fontWeight:600,color:"white",background:"#0f766e",border:"none",borderRadius:8,boxShadow:"0 4px 12px rgba(0,0,0,.3)",cursor:"pointer"},children:c?"طباعة":"Print"})]}),x.map((p,r)=>o.jsx("div",{className:"print-slide",children:o.jsx(j,{lang:e.language,slide:p,theme:e.theme??"harvest",pattern:e.pattern??"solid"})},p.id??r))]})}export{F as default};
