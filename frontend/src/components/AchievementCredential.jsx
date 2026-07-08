/**
 * AchievementCredential - Feature 8
 *
 * Renders the CareerPath achievement badge and downloadable PDF certificate
 * when the user's readiness score is >= 80. Renders nothing otherwise.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Download, ShieldCheck, Sparkles } from 'lucide-react';
import jsPDF from 'jspdf';

const PRIMARY = '#A855F7';
const PRIMARY_LIGHT = '#C084FC';
const ACCENT = '#38BDF8';
const BG_DARK = '#0B0E1C';

export default function AchievementCredential({ score, userName, confidence }) {
  const [downloading, setDownloading] = useState(false);

  if (typeof score !== 'number' || score < 80) return null;

  const safeName = (userName && String(userName).trim()) || 'CareerPath User';

  const drawCertificateMark = (doc, x, y, size) => {
    doc.setFillColor(17, 24, 39);
    doc.circle(x, y, size / 2, 'F');
    doc.setDrawColor(245, 211, 77);
    doc.setLineWidth(4);
    doc.line(x - size * 0.23, y + size * 0.16, x - size * 0.02, y - size * 0.08);
    doc.line(x - size * 0.02, y - size * 0.08, x + size * 0.28, y - size * 0.22);
    doc.setFillColor(56, 189, 248);
    doc.circle(x - size * 0.26, y + size * 0.18, size * 0.07, 'F');
  };

  const downloadCertificate = async () => {
    setDownloading(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFillColor(BG_DARK);
      doc.rect(0, 0, pageW, pageH, 'F');

      doc.setDrawColor(PRIMARY);
      doc.setLineWidth(3);
      doc.rect(24, 24, pageW - 48, pageH - 48);
      doc.setLineWidth(0.5);
      doc.setDrawColor(PRIMARY_LIGHT);
      doc.rect(36, 36, pageW - 72, pageH - 72);

      drawCertificateMark(doc, pageW / 2, 102, 76);

      doc.setTextColor(PRIMARY_LIGHT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(36);
      doc.text('CareerPath Career Ready', pageW / 2, 190, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.text('This certificate is proudly presented to', pageW / 2, 224, {
        align: 'center',
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(30);
      doc.setTextColor(PRIMARY);
      doc.text(safeName, pageW / 2, 272, { align: 'center' });

      doc.setTextColor(220, 220, 230);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(13);
      doc.text(
        "for achieving a verified Career Readiness score on CareerPath's",
        pageW / 2,
        308,
        { align: 'center' }
      );
      doc.text(
        'AI-powered career intelligence platform.',
        pageW / 2,
        328,
        { align: 'center' }
      );

      doc.setTextColor(PRIMARY_LIGHT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text(
        `Readiness Score: ${Math.round(score)}/100   |   Confidence: ${confidence || 'High'}`,
        pageW / 2,
        378,
        { align: 'center' }
      );

      const today = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc.setFontSize(11);
      doc.setTextColor(180, 180, 200);
      doc.setFont('helvetica', 'normal');
      doc.text('CareerPath - AI-Powered Career Development Platform', 60, pageH - 60);
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
        <div className="flex items-center gap-4">
          <span
            className="inline-flex items-center justify-center h-12 w-12 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${PRIMARY}33, ${ACCENT}22)`,
              border: `1px solid ${PRIMARY}55`,
              boxShadow: `0 0 22px ${PRIMARY}44`,
            }}
          >
            <Sparkles className="text-primary-light" size={24} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Award className="text-primary glow-icon" size={20} />
              <span className="font-bold text-text-main glow-text">
                CareerPath Career Ready
              </span>
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

        <button
          onClick={downloadCertificate}
          disabled={downloading}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          <Download size={16} />
          {downloading ? 'Generating...' : 'Download Certificate'}
        </button>
      </div>
    </motion.div>
  );
}
