function g({element:t,title:o,lang:i="ar"}){const a=t.outerHTML,m=Array.from(document.querySelectorAll("style")).map(p=>p.innerHTML).join(`
`),s="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap');",c=`
    @page WordSection1 {
      size: 210mm 297mm;
      mso-page-orientation: portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    div.WordSection1 { page: WordSection1; }
    body { font-family: 'Cairo','Inter',Arial,sans-serif; background: white !important; margin: 0; padding: 0; }
    /* Neutralize fixed page width / on-screen chrome inside Word so the
       printable content sits inside Word's actual margin box. */
    .WordSection1 .ws-page,
    .WordSection1 .lp-page {
      width: auto !important;
      max-width: 100% !important;
      min-height: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    /* The wrapper hosts (the elements we serialize) include screen-only
       gray padding — drop it so Word treats them as transparent. */
    .WordSection1 #ws-printable-root,
    .WordSection1 #lp-printable-root {
      background: white !important;
      padding: 0 !important;
      min-height: 0 !important;
      display: block !important;
    }
  `,r=i==="ar"?"rtl":"ltr",l=`<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="${i}" dir="${r}">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>${h(o)}</title>
    <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
    <![endif]-->
    <style>
      ${s}
      ${c}
      ${m}
    </style>
  </head>
  <body dir="${r}">
    <div class="WordSection1">
      ${a}
    </div>
  </body>
</html>`,d=new Blob(["\uFEFF",l],{type:"application/msword"}),n=URL.createObjectURL(d),e=document.createElement("a");e.href=n,e.download=`${w(o)}.doc`,document.body.appendChild(e),e.click(),document.body.removeChild(e),setTimeout(()=>URL.revokeObjectURL(n),1500)}function f(){window.print()}function h(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function w(t){const o=t.replace(/[\\/:*?"<>|\x00-\x1f]+/g,"-").replace(/\s+/g," ").trim();return o.length>0?o.slice(0,80):"document"}export{g as d,f as p};
