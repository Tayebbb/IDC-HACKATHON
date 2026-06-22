/**
 * ProfilePDFDocument Component
 * Renders profile data as a PDF document in resume-style layout
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// PDF-specific styles using StyleSheet
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#A855F7',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  jobTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
  },
  contactInfo: {
    fontSize: 10,
    color: '#4B5563',
    marginBottom: 3,
  },
  section: {
    marginTop: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#A855F7',
    marginBottom: 8,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  text: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 5,
  },
  subsection: {
    marginBottom: 10,
  },
  subsectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 3,
  },
  subsectionSubtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
  },
  subsectionDate: {
    fontSize: 9,
    color: '#9CA3AF',
    marginBottom: 3,
  },
  bulletPoint: {
    fontSize: 10,
    color: '#4B5563',
    marginLeft: 15,
    marginBottom: 2,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    backgroundColor: '#F3E8FF',
    color: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    marginRight: 5,
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    width: 120,
  },
  infoValue: {
    fontSize: 10,
    color: '#374151',
    flex: 1,
  },
});

const ProfilePDFDocument = ({ profile }) => {
  // Extract profile data with fallbacks
  const {
    fullName = profile?.displayName || 'N/A',
    jobTitle = profile?.preferredTrack || 'N/A',
    email = profile?.email || 'N/A',
    phone = profile?.phone || 'N/A',
    location = profile?.location || 'N/A',
    experienceLevel = profile?.experienceLevel || 'N/A',
    careerTrack = profile?.preferredTrack || 'N/A',
    professionalSummary = profile?.bio || 'N/A',
    technicalSkills = profile?.skills || [],
    softSkills = profile?.softSkills || [],
    tools = profile?.tools || [],
    education = profile?.education || [],
    experience = profile?.experience || [],
  } = profile || {};

  // Format education array if it's a string
  const educationArray = Array.isArray(education) 
    ? education 
    : education ? [{ institution: education }] : [];

  // Format experience array if needed
  const experienceArray = Array.isArray(experience) ? experience : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.jobTitle}>{jobTitle}</Text>
          <Text style={styles.contactInfo}>Email: {email}</Text>
          <Text style={styles.contactInfo}>Phone: {phone}</Text>
          <Text style={styles.contactInfo}>Location: {location}</Text>
        </View>

        {/* Professional Summary */}
        {professionalSummary && professionalSummary !== 'N/A' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.text}>{professionalSummary}</Text>
          </View>
        )}

        {/* Profile Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Experience Level:</Text>
            <Text style={styles.infoValue}>{experienceLevel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Career Track:</Text>
            <Text style={styles.infoValue}>{careerTrack}</Text>
          </View>
        </View>

        {/* Skills Section */}
        {(technicalSkills.length > 0 || softSkills.length > 0 || tools.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            
            {technicalSkills.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Technical Skills</Text>
                <View style={styles.skillsContainer}>
                  {technicalSkills.map((skill, index) => (
                    <Text key={index} style={styles.skillTag}>{skill}</Text>
                  ))}
                </View>
              </View>
            )}

            {softSkills.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Soft Skills</Text>
                <View style={styles.skillsContainer}>
                  {softSkills.map((skill, index) => (
                    <Text key={index} style={styles.skillTag}>{skill}</Text>
                  ))}
                </View>
              </View>
            )}

            {tools.length > 0 && (
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Tools & Technologies</Text>
                <View style={styles.skillsContainer}>
                  {tools.map((tool, index) => (
                    <Text key={index} style={styles.skillTag}>{tool}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Experience Section */}
        {experienceArray.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Experience</Text>
            {experienceArray.map((exp, index) => (
              <View key={index} style={styles.subsection}>
                <Text style={styles.subsectionTitle}>
                  {exp.position || 'Position'} - {exp.company || 'Company'}
                </Text>
                {exp.location && (
                  <Text style={styles.subsectionSubtitle}>{exp.location}</Text>
                )}
                {(exp.startDate || exp.endDate) && (
                  <Text style={styles.subsectionDate}>
                    {exp.startDate || 'Start'} - {exp.endDate || 'Present'}
                  </Text>
                )}
                {exp.responsibilities && exp.responsibilities.length > 0 && (
                  <View>
                    {exp.responsibilities.map((resp, idx) => (
                      <Text key={idx} style={styles.bulletPoint}>• {resp}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education Section */}
        {educationArray.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {educationArray.map((edu, index) => (
              <View key={index} style={styles.subsection}>
                <Text style={styles.subsectionTitle}>
                  {edu.degree || edu.institution || 'Education'}
                </Text>
                {edu.institution && edu.degree && (
                  <Text style={styles.subsectionSubtitle}>{edu.institution}</Text>
                )}
                {edu.fieldOfStudy && (
                  <Text style={styles.text}>Field of Study: {edu.fieldOfStudy}</Text>
                )}
                {(edu.startYear || edu.endYear) && (
                  <Text style={styles.subsectionDate}>
                    {edu.startYear || 'Start'} - {edu.endYear || 'Present'}
                  </Text>
                )}
                {edu.grade && (
                  <Text style={styles.text}>Grade: {edu.grade}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};

export default ProfilePDFDocument;
