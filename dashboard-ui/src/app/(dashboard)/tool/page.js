"use client";
import React, { useState } from 'react';

export default function ToolPage() {
  const [activeTab, setActiveTab] = useState('single');

  return (
    <div className="fade-in tool-container">
      <div className="tool-hero text-center">
        <h1 className="hero-title">
          Find the perfect <br/>
          <span className="text-gradient-purple">link placement</span>
        </h1>
        <p className="hero-subtitle">
          Enter a domain and anchor text — AI finds the best article and suggests<br/>
          the exact insertion spot.
        </p>
      </div>

      <div className="tool-tabs">
        <button 
          className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          Single URL
        </button>
        <button 
          className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          Bulk CSV
        </button>
      </div>

      <div className="glass-panel tool-form-panel">
        {activeTab === 'single' ? (
          <div className="flex-col gap-6">
            <div className="form-group">
              <label>DOMAIN (FROM PAGE)</label>
              <div className="input-wrapper">
                <span className="input-icon">@</span>
                <input type="text" className="tool-input" placeholder="xyz.com" />
              </div>
              <span className="input-hint">Domain only — no need for https://</span>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>ANCHOR TEXT</label>
                <div className="input-wrapper">
                  <span className="input-icon">#</span>
                  <input type="text" className="tool-input" placeholder="web scraping proxy" />
                </div>
              </div>
              <div className="form-group flex-1">
                <label>LINK TO (DESTINATION URL)</label>
                <div className="input-wrapper">
                  <span className="input-icon">→</span>
                  <input type="text" className="tool-input" placeholder="https://dest.com/page" />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>ALTERNATE ANCHOR TEXT (OPTIONAL)</label>
              <div className="input-wrapper">
                <span className="input-icon">#</span>
                <input type="text" className="tool-input" placeholder="Fallback anchor if primary fails" />
              </div>
              <span className="input-hint">Automatically used if no placement is found for the primary anchor.</span>
            </div>

            <button className="btn-primary-purple">
              Find Best Placement ↗
            </button>
          </div>
        ) : (
          <div className="flex-col gap-6 text-center" style={{ padding: '3rem 1rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <div>
              <h3 style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>Upload CSV</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>Upload a CSV with domain, anchor_text, and destination_url columns.</p>
            </div>
            <button className="tool-btn" style={{ maxWidth: '200px', margin: '0 auto' }}>Choose File</button>
          </div>
        )}
      </div>
    </div>
  );
}
