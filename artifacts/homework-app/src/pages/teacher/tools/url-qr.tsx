import { useState, useMemo } from "react";
import QRCode from "react-qr-code";
import { Link } from "wouter";
import { 
  ArrowRight, ArrowLeft, QrCode, Download, Link as LinkIcon, 
  Settings2, RotateCcw, AlertTriangle, Image as ImageIcon,
  Copy, Check
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, character => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function getTextDirection(value: string): "rtl" | "ltr" {
  const firstStrongCharacter = value.match(/[A-Za-z\u0590-\u08FF]/)?.[0];
  return firstStrongCharacter && /[\u0590-\u08FF]/.test(firstStrongCharacter) ? "rtl" : "ltr";
}

type LabelFont = "tajawal" | "cairo" | "kufi";
type LabelSize = "small" | "medium" | "large";

const LABEL_FONTS: Record<LabelFont, string> = {
  tajawal: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
  cairo: "'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif",
  kufi: "'Noto Kufi Arabic', 'Tajawal', system-ui, sans-serif",
};

const LABEL_SIZES: Record<LabelSize, { preview: number; png: number; svg: number }> = {
  small: { preview: 16, png: 32, svg: 16 },
  medium: { preview: 20, png: 40, svg: 20 },
  large: { preview: 24, png: 48, svg: 24 },
};

export default function UrlQrTool() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  const BackArrow = isAr ? ArrowRight : ArrowLeft;
  
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [level, setLevel] = useState<"L"|"M"|"Q"|"H">("M");
  const [labelFont, setLabelFont] = useState<LabelFont>("tajawal");
  const [labelSize, setLabelSize] = useState<LabelSize>("medium");
  const [copied, setCopied] = useState(false);
  const labelFontFamily = LABEL_FONTS[labelFont];
  const labelSizes = LABEL_SIZES[labelSize];
  
  const normalizedUrl = useMemo(() => {
    let u = url.trim();
    if (!u) return "";
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      u = "https://" + u;
    }
    return u;
  }, [url]);

  const isValidUrl = useMemo(() => {
    if (!normalizedUrl) return false;
    try {
      new URL(normalizedUrl);
      return true;
    } catch {
      return false;
    }
  }, [normalizedUrl]);

  const hasLowContrast = useMemo(() => {
    const getLuminance = (hex: string) => {
      hex = hex.replace("#", "");
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      const [r, g, b] = [
        parseInt(hex.slice(0,2), 16)/255,
        parseInt(hex.slice(2,4), 16)/255,
        parseInt(hex.slice(4,6), 16)/255
      ].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    
    try {
      const l1 = getLuminance(fgColor);
      const l2 = getLuminance(bgColor);
      const brightest = Math.max(l1, l2);
      const darkest = Math.min(l1, l2);
      const ratio = (brightest + 0.05) / (darkest + 0.05);
      return ratio < 2.5;
    } catch {
      return false;
    }
  }, [fgColor, bgColor]);

  const reset = () => {
    setFgColor("#000000");
    setBgColor("#ffffff");
    setLevel("M");
    setLabelFont("tajawal");
    setLabelSize("medium");
  };

  const clearAll = () => {
    setUrl("");
    setLabel("");
    reset();
  };

  const copyLink = () => {
    if (!normalizedUrl) return;
    navigator.clipboard.writeText(normalizedUrl);
    setCopied(true);
    toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPNG = async () => {
    if (!isValidUrl || hasLowContrast) return;
    const svg = document.getElementById("url-qr-svg");
    if (!svg) return;
    
    const size = 600; // Generate high-res image
    const padding = 48;
    const labelSpace = label ? 80 : 0;
    
    const canvas = document.createElement("canvas");
    canvas.width = size + (padding * 2);
    canvas.height = size + (padding * 2) + labelSpace;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const img = new Image();
    await document.fonts.load(`700 ${labelSizes.png}px ${labelFontFamily}`).catch(() => []);
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      
      if (label) {
        ctx.fillStyle = fgColor;
        ctx.font = `700 ${labelSizes.png}px ${labelFontFamily}`;
        ctx.direction = getTextDirection(label);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, canvas.width / 2, size + padding + 40);
      }
      
      const a = document.createElement("a");
      a.download = `qrcode-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      toast.success(isAr ? "تم تنزيل الصورة بنجاح" : "Image downloaded successfully");
    };
    img.onerror = () => {
      toast.error(isAr ? "تعذّر تجهيز الصورة. حاول مرة أخرى." : "Could not prepare the image. Please try again.");
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
  };

  const downloadSVG = () => {
    if (!isValidUrl || hasLowContrast) return;
    const svg = document.getElementById("url-qr-svg");
    if (!svg) return;
    
    const size = 300;
    const padding = 24;
    const labelSpace = label ? 40 : 0;
    const totalWidth = size + (padding * 2);
    const totalHeight = size + (padding * 2) + labelSpace;
    const labelDirection = getTextDirection(label);
    
    const innerSVG = svg.innerHTML;
    
    const combinedSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" dir="${dir}">
        <rect width="${totalWidth}" height="${totalHeight}" fill="${bgColor}" />
        <svg x="${padding}" y="${padding}" width="${size}" height="${size}" viewBox="0 0 256 256">
          ${innerSVG}
        </svg>
        ${label ? `<text x="50%" y="${size + padding + 25}" text-anchor="middle" direction="${labelDirection}" unicode-bidi="plaintext" font-family="${escapeXml(labelFontFamily)}" font-weight="700" font-size="${labelSizes.svg}" fill="${fgColor}">${escapeXml(label)}</text>` : ''}
      </svg>
    `;
    
    const blob = new Blob([combinedSVG], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `qrcode-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(objectUrl);
    toast.success(isAr ? "تم تنزيل ملف المتجه بنجاح" : "SVG downloaded successfully");
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/teacher?tab=tools">
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border shadow-sm hover:bg-muted transition-colors text-muted-foreground">
              <BackArrow className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <QrCode className="w-6 h-6 text-primary" />
              {isAr ? "تحويل الرابط إلى باركود QR" : "Link to QR Code"}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {isAr 
                ? "حوّل أي رابط إلى رمز QR جاهز للطباعة والاستخدام الصفي."
                : "Turn any link into a classroom-ready printable QR code."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="url-input" className="text-base">
                    {isAr ? "الرابط (URL)" : "Link (URL)"}
                  </Label>
                  <div className="relative mt-2">
                    <div className="absolute top-0 bottom-0 start-0 flex items-center justify-center w-12 text-muted-foreground">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <Input
                      id="url-input"
                      type="url"
                      placeholder="example.com"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      maxLength={2048}
                      className="ps-12 py-3.5 text-lg shadow-sm"
                      dir="ltr"
                    />
                  </div>
                  <AnimatePresence>
                    {url && !isValidUrl && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-destructive text-sm font-bold mt-2 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        {isAr ? "صيغة الرابط غير صحيحة" : "Invalid link format"}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <Label htmlFor="label-input" className="text-base">
                    {isAr ? "عنوان الرمز (اختياري)" : "Code Title (Optional)"}
                  </Label>
                  <Input
                    id="label-input"
                    type="text"
                    placeholder={isAr ? "مثال: مراجعة الوحدة الأولى" : "e.g. Unit 1 Review"}
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    maxLength={80}
                    className="mt-2 shadow-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {isAr ? "سيظهر هذا النص أسفل رمز QR عند تصديره." : "This text will appear below the QR code when exported."}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-muted-foreground" />
                  {isAr ? "التخصيص" : "Customization"}
                </h3>
                {(fgColor !== "#000000" || bgColor !== "#ffffff" || level !== "M" || labelFont !== "tajawal" || labelSize !== "medium") && (
                  <button 
                    onClick={reset}
                    className="text-sm font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {isAr ? "إعادة ضبط" : "Reset"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {isAr ? "لون الرمز" : "Foreground"}
                  </Label>
                  <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/50">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm border border-border">
                      <input 
                        type="color" 
                        value={fgColor} 
                        onChange={e => setFgColor(e.target.value)}
                        className="absolute -inset-4 w-[200%] h-[200%] cursor-pointer"
                      />
                    </div>
                    <span className="font-mono text-sm uppercase font-medium text-foreground truncate" dir="ltr">{fgColor}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {isAr ? "لون الخلفية" : "Background"}
                  </Label>
                  <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/50">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm border border-border">
                      <input 
                        type="color" 
                        value={bgColor} 
                        onChange={e => setBgColor(e.target.value)}
                        className="absolute -inset-4 w-[200%] h-[200%] cursor-pointer"
                      />
                    </div>
                    <span className="font-mono text-sm uppercase font-medium text-foreground truncate" dir="ltr">{bgColor}</span>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {isAr ? "ثبات المسح والطباعة" : "Scan resilience"}
                  </Label>
                  <select 
                    value={level}
                    onChange={e => setLevel(e.target.value as any)}
                    className="w-full h-[50px] bg-muted/30 border border-border/50 rounded-xl px-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="L">{isAr ? "أساسي" : "Basic"}</option>
                    <option value="M">{isAr ? "متوازن (موصى به)" : "Balanced (recommended)"}</option>
                    <option value="Q">{isAr ? "قوي" : "Strong"}</option>
                    <option value="H">{isAr ? "أقصى حماية" : "Maximum"}</option>
                  </select>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {label && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/60 pt-5">
                      <div className="space-y-2">
                        <Label htmlFor="label-font" className="text-sm text-muted-foreground">
                          {isAr ? "خط العنوان" : "Title font"}
                        </Label>
                        <select
                          id="label-font"
                          value={labelFont}
                          onChange={event => setLabelFont(event.target.value as LabelFont)}
                          className="w-full h-[50px] bg-muted/30 border border-border/50 rounded-xl px-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors"
                        >
                          <option value="tajawal">{isAr ? "حصاد الافتراضي — تجوال" : "Hasaad default — Tajawal"}</option>
                          <option value="cairo">{isAr ? "رسمي — كايرو" : "Formal — Cairo"}</option>
                          <option value="kufi">{isAr ? "هندسي — كوفي" : "Geometric — Kufi"}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="label-size" className="text-sm text-muted-foreground">
                          {isAr ? "حجم العنوان" : "Title size"}
                        </Label>
                        <select
                          id="label-size"
                          value={labelSize}
                          onChange={event => setLabelSize(event.target.value as LabelSize)}
                          className="w-full h-[50px] bg-muted/30 border border-border/50 rounded-xl px-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors"
                        >
                          <option value="small">{isAr ? "صغير" : "Small"}</option>
                          <option value="medium">{isAr ? "متوسط" : "Medium"}</option>
                          <option value="large">{isAr ? "كبير" : "Large"}</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {hasLowContrast && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-500 px-4 py-3 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                      <div className="text-sm font-bold">
                        <p>{isAr ? "تباين الألوان منخفض جداً" : "Very low color contrast"}</p>
                        <p className="text-xs font-medium opacity-80 mt-1 leading-relaxed">
                          {isAr 
                            ? "قد تجد الكاميرات صعوبة في مسح الرمز. يُنصح باستخدام ألوان متباينة جداً (مثل الأسود على الأبيض)." 
                            : "Cameras might struggle to scan this code. High contrast colors recommended."}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="p-6 lg:sticky lg:top-24 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  {isAr ? "معاينة الرمز" : "Preview"}
                </h3>
                {url && (
                  <button 
                    onClick={clearAll}
                    className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isAr ? "مسح الكل" : "Clear all"}
                  </button>
                )}
              </div>

              <div 
                className="w-full max-w-[320px] aspect-square rounded-[2rem] flex items-center justify-center shadow-inner relative transition-colors duration-300 border border-border/50 overflow-hidden"
                style={{ backgroundColor: bgColor }}
              >
                {!url || !isValidUrl ? (
                  <div className="text-center p-6 text-muted-foreground/40">
                    <QrCode className="w-20 h-20 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-bold opacity-80 px-4">
                      {isAr ? "أدخل رابطاً صالحاً لتوليد الرمز" : "Enter a valid link to generate"}
                    </p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-8 w-full h-full flex items-center justify-center"
                  >
                    <div className="w-full h-full" style={{ color: fgColor }}>
                      <QRCode
                        id="url-qr-svg"
                        value={normalizedUrl}
                        size={256}
                        level={level}
                        bgColor={bgColor}
                        fgColor={fgColor}
                        style={{ width: "100%", height: "100%" }}
                        viewBox={`0 0 256 256`}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="mt-5 min-h-[36px] text-center w-full px-4 break-words">
                {label && url && isValidUrl && (
                  <p 
                    className="font-bold text-xl leading-tight truncate px-2" 
                    style={{
                      color: fgColor === '#ffffff' && bgColor === '#ffffff' ? '#000' : 'inherit',
                      fontFamily: labelFontFamily,
                      fontSize: labelSizes.preview,
                      direction: getTextDirection(label),
                    }}
                  >
                    {label}
                  </p>
                )}
              </div>

              <div className="w-full mt-8 space-y-3">
                <Button 
                  className="w-full py-4 text-base" 
                  disabled={!url || !isValidUrl || hasLowContrast}
                  onClick={downloadPNG}
                >
                  <Download className="w-5 h-5 me-2" />
                  {isAr ? "تنزيل صورة (PNG)" : "Download PNG"}
                </Button>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="py-3.5"
                    disabled={!url || !isValidUrl || hasLowContrast}
                    onClick={downloadSVG}
                  >
                    <Download className="w-4 h-4 me-2" />
                    {isAr ? "متجه (SVG)" : "Vector (SVG)"}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="py-3.5"
                    disabled={!url || !isValidUrl}
                    onClick={copyLink}
                  >
                    {copied ? <Check className="w-4 h-4 me-2 text-green-500" /> : <Copy className="w-4 h-4 me-2" />}
                    {copied ? (isAr ? "تم النسخ" : "Copied") : (isAr ? "نسخ الرابط" : "Copy Link")}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
