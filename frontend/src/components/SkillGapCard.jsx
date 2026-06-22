import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Target, TrendingUp } from 'lucide-react';

const SkillGapCard = ({ missingSkills, matchScore }) => {
  if (!missingSkills || missingSkills.length === 0) {
    return null;
  }

  const getEncouragementText = (score) => {
    if (score >= 80) {
      return "You're almost there! Just a few more skills to master.";
    } else if (score >= 60) {
      return "Good progress! These skills will boost your match significantly.";
    } else if (score >= 40) {
      return "Building these skills will open up this opportunity for you.";
    } else {
      return "Start your learning journey with these foundational skills.";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm border border-pink-500/30 rounded-2xl p-6 mb-4"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-pink-500/20 rounded-lg">
          <Target className="w-5 h-5 text-pink-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            Skill Gap Analysis
            <span className="text-xs font-normal text-pink-400 bg-pink-500/20 px-2 py-1 rounded-full">
              {missingSkills.length} skill{missingSkills.length !== 1 ? 's' : ''} needed
            </span>
          </h3>
          <p className="text-sm text-gray-300">
            {getEncouragementText(matchScore)}
          </p>
        </div>
      </div>

      {/* Missing Skills */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-semibold text-pink-300">Skills to Learn:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {missingSkills.map((skill, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="px-3 py-1.5 bg-pink-500/10 border border-pink-500/50 rounded-lg text-sm font-medium text-pink-300 hover:bg-pink-500/20 hover:border-pink-400 transition-all duration-300 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-default"
            >
              {skill}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Info Text */}
      <div className="flex items-start gap-2 mt-4 p-3 bg-purple-900/30 rounded-lg border border-purple-500/20">
        <TrendingUp className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-purple-200">
          <span className="font-semibold">Boost your match %:</span> Learning these skills will significantly increase your compatibility with this role.
        </p>
      </div>
    </motion.div>
  );
};

export default SkillGapCard;
