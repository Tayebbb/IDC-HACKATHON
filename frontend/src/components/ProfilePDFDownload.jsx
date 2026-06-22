/**
 * ProfilePDFDownload Component
 * Provides a download button for the profile PDF
 */

import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ProfilePDFDocument from './ProfilePDFDocument';

const ProfilePDFDownload = ({ profile }) => {
  return (
    <PDFDownloadLink
      document={<ProfilePDFDocument profile={profile} />}
      fileName="profile_resume.pdf"
    >
      {({ loading }) => (
        <button className="mt-4 px-6 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition">
          {loading ? 'Preparing download...' : 'Download Profile as PDF'}
        </button>
      )}
    </PDFDownloadLink>
  );
};

export default ProfilePDFDownload;
