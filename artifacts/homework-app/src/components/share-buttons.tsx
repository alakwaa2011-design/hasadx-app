import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ShareButtonsProps {
  text: string;
  url?: string;
}

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L0 24l6.336-1.51A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.372l-.36-.214-3.728.888.913-3.638-.235-.374A9.818 9.818 0 1112 21.818z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export function ShareButtons({ text, url }: ShareButtonsProps) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(shareUrl);
  const hasNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = shareUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ text, url: shareUrl });
    } catch {}
  };

  const socialLinks = [
    {
      label: "WhatsApp",
      href: `https://wa.me/send?text=${encodedText}%20${encodedUrl}`,
      icon: WhatsAppIcon,
      bg: "bg-green-500 hover:bg-green-600",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      icon: FacebookIcon,
      bg: "bg-blue-600 hover:bg-blue-700",
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: XIcon,
      bg: "bg-black hover:bg-gray-900",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Share2 className="w-3 h-3" />
        {lang === "ar" ? "شارك نتيجتك" : "Share your result"}
      </p>
      <div className="flex items-center gap-2">
        {socialLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-95 ${link.bg}`}
              aria-label={`${lang === "ar" ? "شارك على" : "Share on"} ${link.label}`}
            >
              <Icon />
            </a>
          );
        })}

        <button
          onClick={handleCopy}
          title={lang === "ar" ? "نسخ الرابط" : "Copy link"}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-95 bg-gray-500 hover:bg-gray-600"
          aria-label={lang === "ar" ? "نسخ الرابط" : "Copy link"}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>

        {hasNativeShare && (
          <button
            onClick={handleNativeShare}
            title={lang === "ar" ? "مشاركة" : "Share"}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-95 bg-indigo-500 hover:bg-indigo-600"
            aria-label={lang === "ar" ? "مشاركة" : "Share"}
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
