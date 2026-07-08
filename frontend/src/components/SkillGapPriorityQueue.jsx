import React from 'react';
import { motion } from 'framer-motion';
import { Target, Clock, TrendingUp, HelpCircle } from 'lucide-react';

const SkillGapPriorityQueue = ({ priorities }) => {
  if (!priorities || priorities.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 mb-8">
      <div className="flex items-center gap-3 mb-2">
        <Target className="text-primary glow-icon" size={28} />
        <h2 className="text-2xl font-bold glow-text">Skill Priority Queue</h2>
      </div>
      <p className="text-muted mb-6">
        Ranked by estimated impact across available jobs and learning effort.
      </p>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {priorities.map((item, index) => (
          <motion.div
            key={item.skill}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="neon-card p-5 hover-lift group"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                {item.skill}
              </h3>
              <div className="bg-primary/20 text-primary-light px-3 py-1 rounded-full text-sm font-semibold border border-primary/30">
                ROI: {item.roiScore}/10
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-300">
                <TrendingUp className="text-emerald-400 mr-2" size={16} />
                <span>Impacts <strong className="text-white">{item.jobsImpacted}</strong> job matches</span>
              </div>
              
              <div className="flex items-center text-sm text-gray-300">
                <Clock className="text-blue-400 mr-2" size={16} />
                <span>Estimated learning time: <strong className="text-white">{item.learningTimeText}</strong></span>
              </div>

              <div className="pt-3 mt-3 border-t border-white/10 text-sm text-gray-400">
                <div className="flex items-start">
                  <HelpCircle className="text-purple-400 mr-2 mt-0.5 shrink-0" size={16} />
                  <span>
                    <strong className="text-gray-300">Why: </strong> 
                    Common requirement across {item.tracksDescription}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SkillGapPriorityQueue;
