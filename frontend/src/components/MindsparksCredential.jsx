/**
 * MindsparksCredential — Feature 8
 *
 * Renders the "Mindsparks Career Ready" badge + downloadable PDF certificate
 * when the user's readiness score is >= 80. Renders NOTHING otherwise
 * (no badge shell, no button), matching the explainability layer's
 * graceful-degradation rule.
 *
 * Logos are imported as Vite assets and converted to base64 on demand for
 * jsPDF's doc.addImage().
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Download, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';

import austIdcLogo from '../assets/credential/aust-idc.png';
import codefrontLogo from '../assets/credential/codefront.png';
import mindsparksLogo from '../assets/credential/mindsparks.png';

const PRIMARY = '#A855F7';
const PRIMARY_LIGHT = '#C084FC';
const BG_DARK = '#0B0E1C';

// Convert an imported image URL into a base64 data URL suitable for
// jsPDF.addImage(). Returns null on failure (caller skips the image).
async function urlToBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function MindsparksCredential({ score, userName, confidence }) {
  const [downloading, setDownloading] = useState(false);

  // Hard gate — render nothing below the threshold.
  if (typeof score !== 'number' || score < 80) return null;

  const safeName = (userName && String(userName).trim()) || 'CareerPath User';

  const downloadCertificate = async () => {
    setDownloading(true);
    try {
      const [austB64, codefrontB64, mindsparksB64] = await Promise.all([
        urlToBase64(austIdcLogo),
        urlToBase64(codefrontLogo),
        urlToBase64(mindsparksLogo),
      ]);

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Background
      doc.setFillColor(BG_DARK);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Neon border
      doc.setDrawColor(PRIMARY);
      doc.setLineWidth(3);
      doc.rect(24, 24, pageW - 48, pageH - 48);
      doc.setLineWidth(0.5);
      doc.setDrawColor(PRIMARY_LIGHT);
      doc.rect(36, 36, pageW - 72, pageH - 72);

      // Logos row across the top
      const logoY = 60;
      const logoH = 60;
      const logoW = 120;
      if (austB64) doc.addImage(austB64, 'PNG', 60, logoY, logoW, logoH, undefined, 'FAST');
      if (codefrontB64) doc.addImage(codefrontB64, 'PNG', (pageW - logoW) / 2, logoY, logoW, logoH, undefined, 'FAST');
      if (mindsparksB64) doc.addImage(mindsparksB64, 'PNG', pageW - 60 - logoW, logoY, logoW, logoH, undefined, 'FAST');

      // Heading
      doc.setTextColor(PRIMARY_LIGHT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(36);
      doc.text('Mindsparks Career Ready', pageW / 2, logoY + logoH + 70, { align: 'center' });

      // Sub-heading
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.text('This certificate is proudly presented to', pageW / 2, logoY + logoH + 100, {
        align: 'center',
      });

      // User name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(30);
      doc.setTextColor(PRIMARY);
      doc.text(safeName, pageW / 2, logoY + logoH + 145, { align: 'center' });

      // Body
      doc.setTextColor(220, 220, 230);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.text(
        'for achieving a verified Career Readiness score on CareerPath\u2019s',
        pageW / 2,
        logoY + logoH + 180,
        { align: 'center' }
      );
      doc.text(
        'AI-powered explainability platform.',
        pageW / 2,
        logoY + logoH + 200,
        { align: 'center' }
      );

      // Score & confidence pill
      doc.setTextColor(PRIMARY_LIGHT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(
        `Readiness Score: ${Math.round(score)}/100   \u00b7   Confidence: ${confidence || 'High'}`,
        pageW / 2,
        logoY + logoH + 240,
        { align: 'center' }
      );

      // Footer — branding + date
      const today = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc.setFontSize(11);
      doc.setTextColor(180, 180, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('CareerPath \u2014 AI-Powered Career Development Platform', 60, pageH - 60);
      doc.text(`Issued: ${today}`, pageW - 60, pageH - 60, { align: 'right' });

      const fileSafe = safeName.replace(/[^a-z0-9_-]+/gi, '_');
      doc.save(`CareerPath_Certificate_${fileSafe}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 neon-card p-5"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src={austIdcLogo}
              alt="AUST IDC"
              className="h-10 w-auto object-contain"
            />
            <img
              src={codefrontLogo}
              alt="CodeFront"
              className="h-10 w-auto object-contain"
            />
            <img
              src={mindsparksLogo}
              alt="Mindsparks"
              className="h-10 w-auto object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Award className="text-primary glow-icon" size={20} />
              <span className="font-bold text-text-main glow-text">
                Mindsparks Career Ready
              </span>
              <span className="text-primary"></span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck size={12} className="text-primary" />
                Score {Math.round(score)}/100
              </span>
              <span className="inline-flex items-center gap-1">
                Confidence: <span className="text-primary-light">{confidence || 'High'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Download */}
        <button
          onClick={downloadCertificate}
          disabled={downloading}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          <Download size={16} />
          {downloading ? 'Generating…' : 'Download Certificate'}
        </button>
      </div>
    </motion.div>
  );
}
