"use client";
import React, { useState } from 'react';

export default function PlansPage() {
  const [activePlan, setActivePlan] = useState('Starter');

  return (
    <div className="fade-in">
      <div className="dash-header">
        <h1>Plans & Billing</h1>
        <p>Get more placements and features by choosing the right plan for you.</p>
      </div>

      <div className="plans-grid">
        <div className={`glass-panel plan-card ${activePlan === 'Free' ? 'active' : ''}`}>
          <div className="plan-name">Free</div>
          <div className="plan-price">$0 <span>/ month</span></div>
          <ul className="plan-features">
            <li>5 Placements per month</li>
            <li>Basic search filters</li>
            <li>Standard support</li>
            <li>Community access</li>
          </ul>
          <button className="plan-btn" onClick={() => setActivePlan('Free')}>
            {activePlan === 'Free' ? 'Current Plan' : 'Downgrade'}
          </button>
        </div>

        <div className={`glass-panel plan-card ${activePlan === 'Starter' ? 'active' : ''}`}>
          <div className="plan-name">Starter</div>
          <div className="plan-price">$25 <span>/ month</span></div>
          <ul className="plan-features">
            <li>100 Placements per month</li>
            <li>Advanced AI regenerations</li>
            <li>Export to CSV/Excel</li>
            <li>Priority email support</li>
          </ul>
          <button className="plan-btn" onClick={() => setActivePlan('Starter')}>
            {activePlan === 'Starter' ? 'Current Plan' : 'Upgrade to Starter'}
          </button>
        </div>

        <div className={`glass-panel plan-card ${activePlan === 'Pro' ? 'active' : ''}`}>
          <div className="plan-name">Pro</div>
          <div className="plan-price">$50 <span>/ month</span></div>
          <ul className="plan-features">
            <li>300 Placements per month</li>
            <li>Unlimited regenerations</li>
            <li>API Access</li>
            <li>24/7 Dedicated support</li>
          </ul>
          <button className="plan-btn" onClick={() => setActivePlan('Pro')}>
            {activePlan === 'Pro' ? 'Current Plan' : 'Upgrade to Pro'}
          </button>
        </div>
        
        <div className="glass-panel plan-card">
          <div className="plan-name">Business</div>
          <div className="plan-price">Custom</div>
          <ul className="plan-features">
            <li>Custom placement limits</li>
            <li>White-label reporting</li>
            <li>Dedicated account manager</li>
            <li>Custom integrations</li>
          </ul>
          <button className="plan-btn">
            Contact Us
          </button>
        </div>
      </div>
    </div>
  );
}
