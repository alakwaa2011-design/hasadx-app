import{q as k,j as e,e as z}from"./index-D8FmUyXe.js";import{e as _,g as $}from"./use-kids-BwuvjRZA.js";import{K as b,r as A}from"./kids-assets-D8HVFiDO.js";import{S as p}from"./star-DQM_fL3a.js";import{C as f}from"./cloud-CaZ0fXk0.js";import{L as K}from"./lock-Ct66SuVq.js";import{P as L}from"./play-NY60Sldu.js";import{C}from"./circle-check-tdVYxG9U.js";import"./award-Cmzq-kn6.js";import"./trophy-CnmR3Vk2.js";import"./target-B9uRwu3w.js";import"./compass-Cg2p6VO4.js";import"./gamepad-2-LhIV22ME.js";import"./rocket-8l4ZT54I.js";const Y=`
  .trail-line {
    position: absolute;
    width: 24px;
    background: #fde68a; /* amber-200 */
    left: 50%;
    transform: translateX(-50%);
    top: 60px;
    bottom: 60px;
    border-radius: 99px;
    z-index: 0;
    border: 6px solid #fef08a; /* amber-300 */
  }
  .node-shadow {
    box-shadow: 0 8px 0 var(--shadow-color);
  }
  .node-active {
    animation: bounce-pulse 2.5s infinite cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes bounce-pulse {
    0%, 100% { transform: scale(1) translateY(0); }
    50% { transform: scale(1.1) translateY(-6px); }
  }
  .kids-btn {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .kids-btn:active {
    transform: scale(0.92);
  }
  .kids-card {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .kids-card:hover {
    transform: translateY(-8px) scale(1.02);
  }
  @keyframes float-cloud {
    0%, 100% { transform: translateY(0px) translateX(0px); }
    50% { transform: translateY(-10px) translateX(5px); }
  }
  .animate-float-cloud {
    animation: float-cloud 6s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .node-active, .animate-float-cloud {
      animation: none !important;
      transform: none !important;
    }
    .kids-card:hover, .kids-btn:active {
      transform: none !important;
    }
  }
`,y=({activity:s,isCompleted:r,isAvailable:l})=>e.jsxs("div",{className:`p-4 sm:p-5 rounded-[2.5rem] w-full max-w-[260px] border-4 flex flex-col items-center text-center kids-card relative z-10 ${r?"bg-emerald-50 border-emerald-300 shadow-[0_8px_0_#6ee7b7]":l?"bg-white border-amber-300 shadow-[0_8px_0_#fcd34d]":"bg-slate-50 border-slate-200 shadow-[0_8px_0_#e2e8f0] opacity-90 grayscale-[30%]"}`,children:[e.jsxs("div",{className:"mb-4 relative group",children:[e.jsx("div",{className:`absolute inset-0 bg-white rounded-3xl transform rotate-3 transition-transform group-hover:rotate-6 ${r?"opacity-100":"opacity-50"}`}),e.jsx("img",{src:A(s.asset_key)??void 0,alt:"",className:`h-20 w-20 sm:h-24 sm:w-24 rounded-3xl relative z-10 border-4 border-white shadow-md object-cover ${r?"bg-emerald-100":l?"bg-sky-50":"bg-slate-200"}`})]}),e.jsx("h3",{className:`font-black text-xl sm:text-2xl mb-3 leading-tight drop-shadow-sm ${r?"text-emerald-700":l?"text-amber-700":"text-slate-500"}`,children:s.title_ar}),e.jsx("div",{className:"flex items-center justify-center gap-1.5 bg-white/80 px-4 py-2 rounded-full shadow-sm border-2 border-white",children:[...Array(3)].map((i,o)=>e.jsx(p,{className:`w-5 h-5 sm:w-6 sm:h-6 ${r?"fill-amber-400 text-amber-400 drop-shadow-sm":"fill-slate-200 text-slate-200"}`},o))})]});function M(){const{data:s,isLoading:r}=_(),l=$();if(k.useEffect(()=>{s&&s.adventure.started_at===void 0&&l.mutate()},[s,l]),r||!s)return e.jsxs("div",{className:"flex h-[60vh] flex-col items-center justify-center gap-6",children:[e.jsx(p,{className:"h-16 w-16 text-amber-400 animate-spin"}),e.jsx("h2",{className:"text-2xl font-bold text-amber-600 animate-pulse font-display",children:"نجهز المغامرة..."})]});const{adventure:i,activities:o}=s,a=o.map(t=>`${t.title_ar} ${t.slug} ${t.activity_type}`).join(" ").toLowerCase();let n="kids/illustrations/world-arabic",m="bg-sky-200",c="مدينة الحروف العربية";return a.includes("english")||a.includes("انجليزي")||/[a-z]/.test(a)?(n="kids/illustrations/world-english",m="bg-indigo-200",c="جزيرة الإنجليزية"):(a.includes("number")||a.includes("رقم")||a.includes("ارقام")||a.includes("عد")||/[0-9]/.test(a))&&(n="kids/illustrations/world-numbers",m="bg-amber-200",c="وادي الأرقام"),e.jsxs(e.Fragment,{children:[e.jsx("style",{children:Y}),e.jsxs("div",{className:`min-h-[85vh] rounded-[3rem] p-4 md:p-8 pb-24 animate-in fade-in zoom-in-95 duration-700 font-display shadow-inner border-4 border-white/60 relative overflow-hidden ${m}`,children:[e.jsxs("div",{className:"absolute inset-0 z-0",children:[e.jsx(b,{assetKey:n,alt:c,eager:!0,className:"w-full h-full object-cover object-center"}),e.jsx("div",{className:"absolute inset-0 bg-white/75 backdrop-blur-[2px]"})]}),e.jsx(f,{className:"absolute top-10 right-10 text-white/80 w-24 h-24 animate-float-cloud z-0",style:{animationDelay:"0s"}}),e.jsx(f,{className:"absolute top-32 left-8 text-white/70 w-32 h-32 animate-float-cloud z-0",style:{animationDelay:"1.5s"}}),e.jsx(f,{className:"absolute bottom-20 right-20 text-white/60 w-40 h-40 animate-float-cloud z-0",style:{animationDelay:"3s"}}),e.jsxs("div",{className:"flex justify-center items-center mb-16 relative z-20",children:[e.jsx(b,{assetKey:"kids/illustrations/mascot-point",alt:"مرشد حصاد يشير إلى طريق المغامرة",eager:!0,className:"h-32 w-32 object-contain drop-shadow-lg -ml-5",fallback:e.jsx(p,{className:"h-20 w-20 fill-amber-300 text-amber-400"})}),e.jsxs("div",{className:"text-center space-y-4 bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 px-12 border-4 border-white shadow-xl",children:[e.jsx("h1",{className:"text-4xl md:text-5xl font-black text-emerald-700 drop-shadow-sm","data-testid":"text-adventure-title",children:"خريطة المغامرة"}),e.jsx("p",{className:"text-xl text-emerald-600 font-bold",children:"انطلق في محطتك القادمة!"})]})]}),e.jsxs("div",{className:"relative max-w-3xl mx-auto py-8",children:[e.jsx("div",{className:"trail-line"}),e.jsx("div",{className:"space-y-16 sm:space-y-24 relative z-10",children:i.activity_ids.map((t,d)=>{const x=o.find(N=>N.id===t);if(!x)return null;const u=i.completed_ids?.includes(t)||!1,w=d>0?i.activity_ids[d-1]:null,j=d===0||w&&i.completed_ids?.includes(w),v=d%2===0,g=!j,h=j&&!u;return e.jsxs("div",{className:"flex items-center justify-center w-full relative",children:[e.jsx("div",{className:"flex-1 flex justify-end px-2 md:px-8 relative z-10 min-w-0",children:!v&&e.jsx(y,{activity:x,isCompleted:u,isAvailable:h})}),e.jsxs("div",{className:"relative shrink-0 z-20 flex flex-col items-center justify-center mx-2 sm:mx-6",children:[e.jsx("div",{className:"absolute inset-0 bg-white/50 rounded-full scale-150 blur-md"}),g?e.jsx("div",{className:"w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-300 flex items-center justify-center relative z-10 border-4 border-slate-400 node-shadow",style:{"--shadow-color":"#94a3b8"},"data-testid":`node-locked-${t}`,children:e.jsx(K,{className:"w-8 h-8 sm:w-10 sm:h-10 text-slate-500"})}):h?e.jsx(z,{href:`/kids/activity/${t}`,"data-testid":`link-play-${t}`,children:e.jsx("button",{className:"kids-btn w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-amber-400 hover:bg-amber-500 flex items-center justify-center relative z-10 border-4 border-white node-shadow node-active",style:{"--shadow-color":"#d97706"},"data-testid":`button-play-${t}`,children:e.jsx(b,{assetKey:"kids/illustrations/play-station",alt:"محطة اللعب التالية",className:"h-20 w-20 object-contain",fallback:e.jsx(L,{className:"w-10 h-10 sm:w-12 sm:h-12 fill-white text-white translate-x-1"})})})}):e.jsx("div",{className:"w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-400 flex items-center justify-center relative z-10 border-4 border-white node-shadow",style:{"--shadow-color":"#059669"},"data-testid":`node-completed-${t}`,children:e.jsx(C,{className:"w-10 h-10 sm:w-12 sm:h-12 text-white"})})]}),e.jsx("div",{className:"flex-1 flex justify-start px-2 md:px-8 relative z-10 min-w-0",children:v&&e.jsx(y,{activity:x,isCompleted:u,isAvailable:h})})]},t)})})]})]})]})}export{M as default};
