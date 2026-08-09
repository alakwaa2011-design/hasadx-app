---
name: jscanify/OpenCV document scanner
description: How the worksheet camera scanner is built and the jscanify memory-leak pitfall
---
- الماسح الضوئي للكاميرا (اكتشاف حدود الورقة + التقاط تلقائي + warp) في مكوّن doc-scanner-camera بتطبيق homework-app؛ opencv.js (8.6MB) منسوخ من حزمة jscanify إلى public/ ويُحمَّل كسولاً.
- **لا تستدعِ دوال jscanify مباشرة في حلقة تحليل مستمرة**: نسخة 1.4.x تسرّب Mat في `findPaperContour` (كل `contours.get(i)` بلا delete) وفي `extractPaper` (srcTri/dstTri/M) — الذاكرة تتضخم حتى يتوقف المسح. أعدنا كتابة الخوارزمية باستدعاءات cv مباشرة مع تحرير كل الكائنات.
- **Why:** مراجعة architect كشفت التسريب قبل الإطلاق؛ حلقة كل 160ms تجعل أي تسريب قاتلاً.
- **How to apply:** أي استخدام جديد لـ jscanify/opencv.js في المتصفح: راجع تحرير الـMats يدوياً، أو أعد استخدام findPaperQuad/warpPaper من المكوّن الحالي.
- منطق مهم: نزع التسليح عند كل التقاط (يدوي وتلقائي) وإعادة التسليح فقط بعد خروج الورقة من الكادر — يمنع التقاط نفس الصفحة مرتين في الجلسات المتتابعة.
