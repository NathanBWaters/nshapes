"use client";

import React, { useState } from 'react';
import { ROUND_REQUIREMENTS } from '../utils/gameDefinitions';

interface RoundScoreboardProps {
  currentRound: number;
  currentScore: number;
}

const RoundScoreboard: React.FC<RoundScoreboardProps> = ({
  currentRound,
  currentScore
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get current round requirement
  const currentRequirement = ROUND_REQUIREMENTS.find(r => r.round === currentRound) || 
    { round: currentRound, targetScore: 3, time: 30 };
  
  // Calculate progress percentage
  const progressPercentage = Math.min((currentScore / currentRequirement.targetScore) * 100, 100);
  
  return (
    <div className="round-scoreboard bg-gray-100 rounded-lg p-4 shadow-md mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold">Round Progress</h3>
        <button 
          className="text-blue-600 hover:text-blue-800 text-sm underline flex items-center"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <span>Hide Details</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              <span>Show Details</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      </div>
      
      <div className="flex items-center mb-3">
        <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <span className="text-sm font-medium whitespace-nowrap">
          {currentScore}/{currentRequirement.targetScore}
        </span>
      </div>
      
      {isExpanded && (
        <div className="overflow-x-auto border-t pt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-1 px-2 text-left">Round</th>
                <th className="py-1 px-2 text-left">Target</th>
                <th className="py-1 px-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {ROUND_REQUIREMENTS.map(req => (
                <tr 
                  key={req.round} 
                  className={`
                    ${req.round === currentRound ? 'bg-blue-100 font-bold' : ''}
                    ${req.round < currentRound ? 'text-gray-500' : ''}
                  `}
                >
                  <td className="py-1 px-2">{req.round}</td>
                  <td className="py-1 px-2">{req.targetScore} points</td>
                  <td className="py-1 px-2">{req.time}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RoundScoreboard; 