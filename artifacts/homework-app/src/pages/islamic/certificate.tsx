import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { api, IslamicShell, GoldButton, BackLink, ISLAMIC_GOLD, ISLAMIC_GREEN } from "./_shared";

interface Cert { id: number; serial: string; userName: string; categoryName: string; totalQuestions: number; totalStars: number; issuedAt: string; }

export default function IslamicCertificate() {
  const [, params] = useRoute("/islamic/certificate/:serial");
  const serial = params?.serial || "";
  const [cert, setCert] = useState<Cert | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/islamic/certificates/verify/${encodeURIComponent(serial)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setCert({ id: 0, ...d } as Cert);
      })
      .catch(() => {});
  }, [serial]);

  function downloadPdf() {
    window.print();
  }

  if (!cert) return <IslamicShell title="الشهادة"><BackLink /><div style={{ textAlign: "center" }}>لم تُعثر الشهادة</div></IslamicShell>;

  const verifyUrl = `${window.location.origin}/islamic/certificate/${cert.serial}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`;

  return (
    <IslamicShell>
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .cert-card { box-shadow: none !important; border: 4px solid ${ISLAMIC_GOLD} !important; }
        }
      `}</style>
      <div className="no-print"><BackLink /></div>
      <div className="cert-card" style={{
        background: "white",
        color: ISLAMIC_GREEN,
        borderRadius: 24,
        padding: 48,
        textAlign: "center",
        border: `4px solid ${ISLAMIC_GOLD}`,
        boxShadow: `0 0 60px rgba(217,119,6,0.4)`,
        fontFamily: "'Cairo', sans-serif",
      }}>
        <div style={{ fontSize: 28, color: ISLAMIC_GOLD, fontWeight: 900 }}>منصة حصاد</div>
        <div style={{ height: 2, background: ISLAMIC_GOLD, margin: "16px auto", width: "60%" }} />
        <div style={{ fontSize: 22, marginTop: 24, color: ISLAMIC_GREEN }}>شهادة تقدير</div>
        <div style={{ fontSize: 18, marginTop: 16, opacity: 0.85 }}>تُمنح هذه الشهادة لـ</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: ISLAMIC_GREEN, margin: "16px 0" }}>{cert.userName}</div>
        <div style={{ fontSize: 18 }}>لإتقان فئة</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: ISLAMIC_GOLD, marginTop: 8 }}>{cert.categoryName}</div>
        <div style={{ fontSize: 18, marginTop: 16 }}>بعدد {cert.totalStars} ⭐ على {cert.totalQuestions} سؤال</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
          <div style={{ fontSize: 13, opacity: 0.85, textAlign: "right" }}>
            <div>التاريخ: {new Date(cert.issuedAt).toLocaleDateString("ar-EG")}</div>
            <div>الرقم التسلسلي: {cert.serial}</div>
          </div>
          <img src={qrSrc} alt="QR" style={{ width: 100, height: 100 }} />
        </div>
      </div>
      <div className="no-print" style={{ textAlign: "center", marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
        <GoldButton onClick={downloadPdf}>طباعة / حفظ PDF</GoldButton>
        <GoldButton onClick={() => navigator.clipboard?.writeText(verifyUrl)}>نسخ رابط التحقق</GoldButton>
      </div>
    </IslamicShell>
  );
}
