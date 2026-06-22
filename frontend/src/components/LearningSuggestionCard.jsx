import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, BookOpen, Youtube, Gift, DollarSign, GraduationCap } from 'lucide-react';

const LearningSuggestionCard = ({ suggestions }) => {
  const [expandedSkills, setExpandedSkills] = useState(new Set());

  if (!suggestions || suggestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 text-gray-400">
          <BookOpen className="w-5 h-5" />
          <p className="text-sm">No learning resources found for these skills yet.</p>
        </div>
      </motion.div>
    );
  }

  const toggleSkill = (skillName) => {
    const newExpanded = new Set(expandedSkills);
    if (newExpanded.has(skillName)) {
      newExpanded.delete(skillName);
    } else {
      newExpanded.add(skillName);
    }
    setExpandedSkills(newExpanded);
  };

  const getPlatformIcon = (platform) => {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes('youtube')) {
      return <Youtube className="w-4 h-4 text-red-400" />;
    } else if (platformLower.includes('udemy') || platformLower.includes('coursera')) {
      return <GraduationCap className="w-4 h-4 text-blue-400" />;
    } else {
      return <BookOpen className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <GraduationCap className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">
            Recommended Learning Resources
          </h3>
          <p className="text-sm text-gray-300">
            Curated courses and tutorials to help you master these skills
          </p>
        </div>
      </div>

      {/* Skills and Resources */}
      <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <motion.div
            key={suggestion.skill}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border border-purple-500/20 rounded-xl overflow-hidden bg-black/20"
          >
            {/* Skill Header - Clickable */}
            <button
              onClick={() => toggleSkill(suggestion.skill)}
              className="w-full flex items-center justify-between p-4 hover:bg-purple-500/10 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-pink-500/20 border border-pink-500/40 rounded-lg">
                  <span className="text-sm font-semibold text-pink-300">
                    {suggestion.skill}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {suggestion.resources.length} resource{suggestion.resources.length !== 1 ? 's' : ''}
                </span>
              </div>
              {expandedSkills.has(suggestion.skill) ? (
                <ChevronUp className="w-5 h-5 text-purple-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-purple-400" />
              )}
            </button>

            {/* Resources List - Expandable */}
            <AnimatePresence>
              {expandedSkills.has(suggestion.skill) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-purple-500/20"
                >
                  <div className="p-4 space-y-3">
                    {suggestion.resources.map((resource, resourceIndex) => (
                      <motion.div
                        key={resource.id || resourceIndex}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: resourceIndex * 0.05 }}
                        className="flex items-start justify-between gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-500/10 hover:border-purple-500/30 hover:bg-purple-900/30 transition-all duration-200 group"
                      >
                        {/* Resource Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getPlatformIcon(resource.platform)}
                            <h4 className="text-sm font-medium text-white truncate">
                              {resource.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-400">
                              {resource.platform}
                            </span>
                            <span className="text-gray-600">•</span>
                            <div className="flex items-center gap-1">
                              {resource.cost === 'Free' ? (
                                <>
                                  <Gift className="w-3 h-3 text-green-400" />
                                  <span className="text-xs font-medium text-green-400">Free</span>
                                </>
                              ) : (
                                <>
                                  <DollarSign className="w-3 h-3 text-yellow-400" />
                                  <span className="text-xs font-medium text-yellow-400">Paid</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* View Button */}
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] whitespace-nowrap"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-4 p-3 bg-purple-900/20 rounded-lg border border-purple-500/10">
        <p className="text-xs text-gray-400 text-center">
          💡 Click on each skill to view recommended learning resources
        </p>
      </div>
    </motion.div>
  );
};

export default LearningSuggestionCard;
