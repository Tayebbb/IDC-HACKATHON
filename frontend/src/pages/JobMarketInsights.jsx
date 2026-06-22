import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BarChart3, Briefcase, Target } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const JobMarketInsights = () => {
  const [activeTab, setActiveTab] = useState('employment');

  const data = {
    "youthEmploymentRates": [
      { "year": 2010, "employmentRate": 52.3, "unemploymentRate": 17.2 },
      { "year": 2011, "employmentRate": 53.8, "unemploymentRate": 16.5 },
      { "year": 2012, "employmentRate": 55.1, "unemploymentRate": 15.8 },
      { "year": 2013, "employmentRate": 56.4, "unemploymentRate": 15.2 },
      { "year": 2014, "employmentRate": 57.9, "unemploymentRate": 14.5 },
      { "year": 2015, "employmentRate": 59.2, "unemploymentRate": 13.8 },
      { "year": 2016, "employmentRate": 60.5, "unemploymentRate": 13.2 },
      { "year": 2017, "employmentRate": 61.8, "unemploymentRate": 12.5 },
      { "year": 2018, "employmentRate": 63.2, "unemploymentRate": 11.8 },
      { "year": 2019, "employmentRate": 64.5, "unemploymentRate": 11.2 },
      { "year": 2020, "employmentRate": 58.3, "unemploymentRate": 15.6 },
      { "year": 2021, "employmentRate": 61.7, "unemploymentRate": 13.4 },
      { "year": 2022, "employmentRate": 66.8, "unemploymentRate": 10.5 },
      { "year": 2023, "employmentRate": 69.4, "unemploymentRate": 9.2 },
      { "year": 2024, "employmentRate": 71.6, "unemploymentRate": 8.1 },
      { "year": 2025, "employmentRate": 73.2, "unemploymentRate": 7.5 }
    ],
    "industryGrowth": [
      { "sector": "ICT", "growthRate": 22.5, "averageSalaryBDT": 45000 },
      { "sector": "Garments", "growthRate": 6.8, "averageSalaryBDT": 18000 },
      { "sector": "Agriculture", "growthRate": 4.2, "averageSalaryBDT": 15000 },
      { "sector": "Freelancing", "growthRate": 25.0, "averageSalaryBDT": 38000 },
      { "sector": "Fintech", "growthRate": 19.3, "averageSalaryBDT": 52000 },
      { "sector": "Logistics", "growthRate": 14.7, "averageSalaryBDT": 28000 },
      { "sector": "Healthcare", "growthRate": 11.5, "averageSalaryBDT": 42000 },
      { "sector": "E-commerce", "growthRate": 18.9, "averageSalaryBDT": 32000 },
      { "sector": "Digital Marketing", "growthRate": 21.2, "averageSalaryBDT": 35000 },
      { "sector": "Education Technology", "growthRate": 16.4, "averageSalaryBDT": 38000 },
      { "sector": "Manufacturing", "growthRate": 7.3, "averageSalaryBDT": 22000 },
      { "sector": "Banking", "growthRate": 8.6, "averageSalaryBDT": 48000 },
      { "sector": "Telecommunications", "growthRate": 12.1, "averageSalaryBDT": 46000 },
      { "sector": "Construction", "growthRate": 9.4, "averageSalaryBDT": 25000 },
      { "sector": "Pharmaceuticals", "growthRate": 13.8, "averageSalaryBDT": 40000 }
    ],
    "topJobs2025": [
      { "id": "job001", "jobTitle": "Software Developer", "industry": "ICT", "difficultyLevel": "medium", "avgSalaryBDT": 50000, "requiredSkills": ["JavaScript", "React", "Node.js", "MongoDB", "Git"], "hiringTrend": "rising" },
      { "id": "job002", "jobTitle": "Digital Marketing Specialist", "industry": "Digital Marketing", "difficultyLevel": "easy", "avgSalaryBDT": 32000, "requiredSkills": ["SEO", "Social Media Marketing", "Google Analytics", "Content Writing"], "hiringTrend": "rising" },
      { "id": "job003", "jobTitle": "Data Analyst", "industry": "ICT", "difficultyLevel": "medium", "avgSalaryBDT": 48000, "requiredSkills": ["Python", "SQL", "Excel", "Data Visualization", "Statistics"], "hiringTrend": "rising" },
      { "id": "job004", "jobTitle": "Freelance Web Designer", "industry": "Freelancing", "difficultyLevel": "easy", "avgSalaryBDT": 35000, "requiredSkills": ["Figma", "Adobe XD", "HTML", "CSS", "UI/UX Design"], "hiringTrend": "rising" },
      { "id": "job005", "jobTitle": "Mobile App Developer", "industry": "ICT", "difficultyLevel": "hard", "avgSalaryBDT": 58000, "requiredSkills": ["Flutter", "React Native", "Firebase", "REST API", "Mobile UI Design"], "hiringTrend": "rising" },
      { "id": "job006", "jobTitle": "Garment Quality Inspector", "industry": "Garments", "difficultyLevel": "easy", "avgSalaryBDT": 18000, "requiredSkills": ["Quality Control", "Fabric Knowledge", "Attention to Detail"], "hiringTrend": "stable" },
      { "id": "job007", "jobTitle": "Fintech Product Manager", "industry": "Fintech", "difficultyLevel": "hard", "avgSalaryBDT": 75000, "requiredSkills": ["Product Management", "Agile", "Financial Systems", "User Research", "Data Analysis"], "hiringTrend": "rising" },
      { "id": "job008", "jobTitle": "E-commerce Operations Manager", "industry": "E-commerce", "difficultyLevel": "medium", "avgSalaryBDT": 42000, "requiredSkills": ["Supply Chain", "Inventory Management", "Customer Service", "Excel"], "hiringTrend": "rising" },
      { "id": "job009", "jobTitle": "Cybersecurity Analyst", "industry": "ICT", "difficultyLevel": "hard", "avgSalaryBDT": 62000, "requiredSkills": ["Network Security", "Penetration Testing", "Linux", "Firewalls", "Incident Response"], "hiringTrend": "rising" },
      { "id": "job010", "jobTitle": "Content Creator", "industry": "Digital Marketing", "difficultyLevel": "easy", "avgSalaryBDT": 28000, "requiredSkills": ["Video Editing", "Copywriting", "Social Media", "Photography"], "hiringTrend": "rising" }
    ],
    "sectorOpportunityScore": [
      { "sector": "ICT", "opportunityScore": 92 },
      { "sector": "Garments", "opportunityScore": 58 },
      { "sector": "Agriculture", "opportunityScore": 45 },
      { "sector": "Freelancing", "opportunityScore": 88 },
      { "sector": "Fintech", "opportunityScore": 85 },
      { "sector": "Logistics", "opportunityScore": 72 },
      { "sector": "Healthcare", "opportunityScore": 68 },
      { "sector": "E-commerce", "opportunityScore": 78 },
      { "sector": "Digital Marketing", "opportunityScore": 82 },
      { "sector": "Education Technology", "opportunityScore": 75 },
      { "sector": "Manufacturing", "opportunityScore": 52 },
      { "sector": "Banking", "opportunityScore": 64 },
      { "sector": "Telecommunications", "opportunityScore": 70 },
      { "sector": "Construction", "opportunityScore": 55 },
      { "sector": "Pharmaceuticals", "opportunityScore": 66 }
    ]
  };

  const getTrendColor = (trend) => {
    if (trend === 'rising') return 'text-green-400';
    if (trend === 'falling') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getDifficultyColor = (level) => {
    if (level === 'easy') return 'bg-green-500/20 text-green-400 border-green-500/40';
    if (level === 'medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    return 'bg-red-500/20 text-red-400 border-red-500/40';
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0B14] via-[#13141F] to-[#0A0B14] py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-3">
                Bangladesh Job Market Insights 2025
              </h1>
              <p className="text-gray-400 text-base max-w-3xl mx-auto">
                Comprehensive analysis of employment trends, industry growth, and top opportunities
              </p>
            </div>
          </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <button
            onClick={() => setActiveTab('employment')}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'employment'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:bg-[rgba(255,255,255,0.1)] hover:text-white border border-[rgba(255,255,255,0.1)]'
            }`}
          >
            Employment Rates
          </button>
          <button
            onClick={() => setActiveTab('industry')}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'industry'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:bg-[rgba(255,255,255,0.1)] hover:text-white border border-[rgba(255,255,255,0.1)]'
            }`}
          >
            Industry Growth
          </button>
          <button
            onClick={() => setActiveTab('topjobs')}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'topjobs'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:bg-[rgba(255,255,255,0.1)] hover:text-white border border-[rgba(255,255,255,0.1)]'
            }`}
          >
            Top Jobs 2025
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'opportunities'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:bg-[rgba(255,255,255,0.1)] hover:text-white border border-[rgba(255,255,255,0.1)]'
            }`}
          >
            Sector Opportunities
          </button>
        </div>

        {/* Employment Rates Tab */}
        {activeTab === 'employment' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.youthEmploymentRates.slice(-6).map((item, index) => (
                <motion.div
                  key={item.year}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative bg-gradient-to-br from-[#1A1B2E] to-[#13141F] rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{item.year}</h3>
                    <TrendingUp className="text-purple-400" size={28} />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                      <p className="text-xs text-gray-400 mb-2">Employment Rate</p>
                      <p className="text-4xl font-bold text-green-400">{item.employmentRate}%</p>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                      <p className="text-xs text-gray-400 mb-2">Unemployment Rate</p>
                      <p className="text-4xl font-bold text-red-400">{item.unemploymentRate}%</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Industry Growth Tab */}
        {activeTab === 'industry' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {data.industryGrowth
              .sort((a, b) => b.growthRate - a.growthRate)
              .map((item, index) => (
                <motion.div
                  key={item.sector}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative bg-gradient-to-br from-[#1A1B2E] to-[#13141F] rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 group"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-purple-500/20 p-3 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                      <BarChart3 className="text-purple-400" size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white">{item.sector}</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                      <p className="text-xs text-gray-400 mb-2">Growth Rate</p>
                      <p className="text-3xl font-bold text-green-400">+{item.growthRate}%</p>
                    </div>
                    <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
                      <p className="text-xs text-gray-400 mb-2">Avg Salary</p>
                      <p className="text-2xl font-bold text-purple-400">৳{item.averageSalaryBDT.toLocaleString()}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
          </motion.div>
        )}

        {/* Top Jobs Tab */}
        {activeTab === 'topjobs' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {data.topJobs2025.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative bg-gradient-to-br from-[#1A1B2E] to-[#13141F] rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-3">{job.jobTitle}</h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-4 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium border border-purple-500/30">
                        {job.industry}
                      </span>
                      <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${getDifficultyColor(job.difficultyLevel)}`}>
                        {job.difficultyLevel}
                      </span>
                      <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${getTrendColor(job.hiringTrend)}`}>
                        ↗ {job.hiringTrend}
                      </span>
                    </div>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20 min-w-[180px]">
                    <p className="text-xs text-gray-400 mb-1">Average Salary</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">৳{job.avgSalaryBDT.toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-[rgba(0,0,0,0.2)] rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-3 font-medium">Required Skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg text-sm text-white font-medium hover:border-purple-500/40 transition-colors"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Sector Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {data.sectorOpportunityScore
              .sort((a, b) => b.opportunityScore - a.opportunityScore)
              .map((item, index) => (
                <motion.div
                  key={item.sector}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative bg-gradient-to-br from-[#1A1B2E] to-[#13141F] rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 group"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-purple-500/20 p-3 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                      <Target className="text-purple-400" size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white">{item.sector}</h3>
                  </div>
                  <div className="bg-[rgba(0,0,0,0.2)] rounded-xl p-5">
                    <p className="text-xs text-gray-400 mb-3">Opportunity Score</p>
                    <div className="flex items-end gap-2 mb-4">
                      <p className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{item.opportunityScore}</p>
                      <p className="text-gray-400 text-xl mb-2">/100</p>
                    </div>
                    <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.opportunityScore}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full shadow-lg shadow-purple-500/50"
                      ></motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </motion.div>
        )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default JobMarketInsights;
