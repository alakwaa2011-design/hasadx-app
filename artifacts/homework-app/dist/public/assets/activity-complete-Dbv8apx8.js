import{am as o,j as e,S as t,e as s,y as m}from"./index-CgEj3yCo.js";import{d,c}from"./use-kids-BqRftfCi.js";import{K as r}from"./kids-assets-fQE3xJ-g.js";import{n as x}from"./kids-avatar-catalog-IxJTUZbh.js";import{C as p}from"./circle-check-OVwo2vUq.js";import{T as f}from"./trophy-DXy-c-4O.js";import{S as l}from"./star-CQ90Dgnk.js";import{A as b}from"./award-DkYT2Av5.js";import{R as u}from"./rocket-BYqc1T5M.js";import"./target-CAZ0qHsG.js";import"./compass-D5BdicTe.js";import"./gamepad-2-hp2fnirL.js";const h=`
  @keyframes spin-slow {
    100% { transform: rotate(360deg); }
  }
  @keyframes pop-in {
    0% { transform: scale(0.5); opacity: 0; }
    60% { transform: scale(1.15); opacity: 1; }
    80% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes float-star {
    0%, 100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-20px) rotate(15deg); }
  }
  @keyframes bounce-jelly {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05) translateY(-5px); }
  }
  .animate-spin-slow { animation: spin-slow 15s linear infinite; }
  .animate-pop-in { animation: pop-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .animate-float-star { animation: float-star 3s ease-in-out infinite; }
  .animate-bounce-jelly { animation: bounce-jelly 2.5s infinite cubic-bezier(0.34, 1.56, 0.64, 1); }

  .sunburst {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 250vw;
    height: 250vw;
    transform: translate(-50%, -50%);
    background: repeating-conic-gradient(
      from 0deg,
      hsl(var(--primary)) 0deg 15deg,
      hsl(var(--primary) / 0.8) 15deg 30deg
    );
    z-index: 0;
    opacity: 0.2;
  }

  .kids-btn { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .kids-btn:active { transform: scale(0.92); }

  @media (prefers-reduced-motion: reduce) {
    .animate-spin-slow, .animate-pop-in, .animate-float-star, .animate-bounce-jelly, .sunburst {
      animation: none !important;
      transform: none !important;
    }
    .kids-btn:active {
      transform: none !important;
    }
  }
`;function B(){const{id:g}=o(),{data:i}=d(),{data:n}=c(),a=(x(n?.age_band)||"young")!=="young";return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:h}),e.jsxs("div",{className:"fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-hidden font-display",dir:"rtl",children:[!a&&e.jsx("div",{className:"sunburst animate-spin-slow"}),a&&e.jsx("div",{className:"absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 to-emerald-50 dark:from-emerald-900/20 dark:to-background z-0"}),!a&&e.jsxs(e.Fragment,{children:[e.jsx(t,{className:"absolute top-[10%] left-[15%] w-16 h-16 text-amber-300 animate-float-star opacity-90",style:{animationDelay:"0s"}}),e.jsx(t,{className:"absolute bottom-[20%] right-[15%] w-24 h-24 text-amber-300 animate-float-star opacity-90",style:{animationDelay:"1s"}}),e.jsx(t,{className:"absolute top-[30%] right-[25%] w-12 h-12 text-emerald-400 animate-float-star opacity-70",style:{animationDelay:"0.5s"}})]}),e.jsxs("div",{className:"relative z-10 max-w-lg w-full flex flex-col items-center",children:[e.jsxs("div",{className:`relative ${a?"-mb-8":"-mb-10"} group z-20`,children:[!a&&e.jsx("div",{className:"absolute inset-0 bg-amber-200 rounded-full blur-[40px] opacity-70 animate-pulse"}),a?e.jsx("div",{className:"w-32 h-32 bg-emerald-100 dark:bg-emerald-900/50 rounded-full border-4 border-white shadow-xl flex items-center justify-center animate-pop-in",children:e.jsx(p,{className:"w-16 h-16 text-emerald-600 dark:text-emerald-400"})}):e.jsxs("div",{className:"w-56 h-44 sm:w-64 sm:h-52 flex items-end justify-center transform transition-transform group-hover:scale-105",children:[e.jsx(r,{assetKey:"kids/illustrations/mascot-cheer",alt:"مرشد حصاد يحتفل بإنجازك",eager:!0,className:"relative z-10 h-full w-40 object-contain drop-shadow-xl",fallback:e.jsx(f,{className:"h-24 w-24 text-amber-300"})}),e.jsx(r,{assetKey:"kids/illustrations/reward-chest",alt:"صندوق المكافأة",eager:!0,className:"relative z-20 -mr-8 h-24 w-24 object-contain drop-shadow-xl",fallback:e.jsx(l,{className:"h-16 w-16 fill-amber-300 text-amber-400"})})]})]}),e.jsx("div",{className:"animate-pop-in text-center flex flex-col items-center w-full",children:e.jsxs("div",{className:"bg-card/95 backdrop-blur-xl p-8 sm:p-10 pt-16 rounded-[3.5rem] shadow-2xl border-[6px] border-card w-full space-y-8 relative",children:[e.jsx("div",{className:"flex flex-col items-center gap-4",children:e.jsx("h2",{className:"text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm text-center","data-testid":"text-success-title",children:a?"أداء ممتاز!":"عمل رائع يا بطل!"})}),e.jsxs("div",{className:`flex flex-col items-center justify-center gap-4 py-6 sm:py-8 rounded-[2.5rem] ${a?"bg-muted/50 border-2 border-border":"bg-gradient-to-b from-amber-50 to-amber-100 border-4 border-amber-200"} shadow-inner`,children:[e.jsx("span",{className:`text-xl sm:text-2xl font-bold ${a?"text-foreground":"text-amber-800"}`,children:a?"رصيد النقاط المكتسبة":"إجمالي نجومك المدهشة"}),e.jsxs("div",{className:"flex items-center gap-4","data-testid":"display-stars-total",children:[a?e.jsx(b,{className:"w-10 h-10 text-amber-500"}):e.jsx(l,{className:"w-12 h-12 sm:w-16 sm:h-16 fill-amber-500 text-amber-500 drop-shadow-md animate-float-star"}),e.jsx("span",{className:`text-5xl sm:text-6xl font-black ${a?"text-foreground":"text-amber-500 drop-shadow-md"}`,children:i?.stars||0})]})]}),e.jsxs("div",{className:"pt-2 flex flex-col gap-5",children:[e.jsx(s,{href:"/kids/adventure","data-testid":"link-next-stop",children:e.jsxs("button",{className:"kids-btn w-full relative group","data-testid":"button-next-stop",children:[e.jsx("div",{className:"absolute inset-0 bg-emerald-700 rounded-[2.5rem] translate-y-2.5 group-active:translate-y-0 transition-transform"}),e.jsxs("div",{className:`relative bg-emerald-500 text-white text-2xl sm:text-3xl font-black py-5 sm:py-6 px-8 rounded-[2.5rem] ${a?"":"border-[5px] border-emerald-300"} flex items-center justify-center gap-4 shadow-xl`,children:[e.jsx(u,{className:"w-8 h-8 sm:w-10 sm:h-10 drop-shadow-sm"}),e.jsx("span",{className:"drop-shadow-sm",children:a?"الاستمرار":"المحطة التالية"})]})]})}),e.jsx(s,{href:"/kids","data-testid":"link-home",children:e.jsxs("button",{className:"kids-btn w-full relative group","data-testid":"button-home",children:[e.jsx("div",{className:"absolute inset-0 bg-slate-300 dark:bg-slate-700 rounded-[2.5rem] translate-y-2 group-active:translate-y-0 transition-transform"}),e.jsxs("div",{className:`relative bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xl sm:text-2xl font-bold py-4 sm:py-5 px-8 rounded-[2.5rem] ${a?"":"border-4 border-white"} flex items-center justify-center gap-3`,children:[e.jsx(m,{className:"w-6 h-6 sm:w-8 sm:h-8"}),e.jsx("span",{children:"العودة للرئيسية"})]})]})})]})]})})]})]})]})}export{B as default};
