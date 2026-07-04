"use client";

import React, { useState } from 'react';

export default function Dashboard() {
  const [activePlan, setActivePlan] = useState('Starter');
  
  // Example dummy data
  const stats = {
    placementsFound: 12450,
    placementsExported: 8400,
    tokensUsedPerPlacement: 2.4,
    regenerationsPerPlacement: 1.2,
    totalMonthlyTokens: 100000,
    usedMonthlyTokens: 68400,
    totalMonthlyPlacements: 100,
    usedMonthlyPlacements: 84
  };

  const tokensPercentage = (stats.usedMonthlyTokens / stats.totalMonthlyTokens) * 100;
  const placementsPercentage = (stats.usedMonthlyPlacements / stats.totalMonthlyPlacements) * 100;

  return (
    <div className="fade-in">
      <div className="dash-header">
        <h1>Dashboard</h1>
        <p>Real-time overview of your Link Place activity and token usage.</p>
      </div>

      {/* Main Metrics */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-title">
            Link Placements Found
          </div>
          <div className="stat-value">
            {stats.placementsFound.toLocaleString()}
            <span>+12.4%</span>
          </div>
          <div className="stat-chart-placeholder"></div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-title">
            Placements Exported
          </div>
          <div className="stat-value">
            {(stats.placementsExported / 1000).toFixed(1)}k
            <span>+5.2%</span>
          </div>
          <div className="stat-chart-placeholder" style={{ borderBottomColor: 'var(--accent-secondary)', background: 'linear-gradient(180deg, rgba(59,130,246,0.1) 0%, transparent 100%)' }}></div>
        </div>
        
        <div className="glass-panel flex-col justify-between">
          <div>
            <div className="stat-title" style={{ marginBottom: '1.5rem' }}>Current Usage (Starter Plan)</div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="flex-row justify-between text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                <span>Placements ({stats.usedMonthlyPlacements}/{stats.totalMonthlyPlacements})</span>
                <span className="text-accent">{Math.round(placementsPercentage)}%</span>
              </div>
              <div className="progress-bg">
                <div className="progress-fill" style={{ width: `${placementsPercentage}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex-row justify-between text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                <span>Tokens ({Intl.NumberFormat('en-US').format(stats.usedMonthlyTokens)}/{Intl.NumberFormat('en-US').format(stats.totalMonthlyTokens)})</span>
                <span style={{ color: 'var(--accent-secondary)' }}>{Math.round(tokensPercentage)}%</span>
              </div>
              <div className="progress-bg">
                <div className="progress-fill" style={{ width: `${tokensPercentage}%`, background: 'var(--accent-secondary)', boxShadow: '0 0 10px rgba(59,130,246,0.2)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="glass-panel">
          <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Avg Tokens / Placement</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.tokensUsedPerPlacement}</div>
        </div>
        <div className="glass-panel">
          <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Avg Regenerations</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{stats.regenerationsPerPlacement}</div>
        </div>
        <div className="glass-panel" style={{ background: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
          <div className="text-accent" style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>Active Mode</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>Paid ({activePlan})</div>
        </div>
      </div>
    </div>
  );
}
