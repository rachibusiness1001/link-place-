"use client";
import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="landing-container fade-in">
      <div className="landing-background">
        <div className="bg-grid"></div>
        <div className="bg-glow"></div>
      </div>
      
      <div className="landing-content">
        <div className="hero-section">
          <h1 className="hero-heading">
            Ship your apps to the <br/>
            world easier with <span className="text-gradient-saasfly">Saasfly</span>
          </h1>
          <p className="hero-subheading">
            Your complete All-in-One solution for building SaaS services.
          </p>
          
          <div className="hero-actions">
            <Link href="/dashboard" className="btn-get-started">
              Get Started 
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </Link>
            
            <div className="code-copy">
              <span className="code-text">npm create saasfly@latest</span>
              <button className="copy-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
          </div>
          
          <div className="contributors-section">
            <div className="avatars-group">
              <div className="avatar"><img src="https://avatars.githubusercontent.com/u/10096899" alt="User"/></div>
              <div className="avatar"><img src="https://avatars.githubusercontent.com/u/10334353" alt="User"/></div>
              <div className="avatar"><img src="https://avatars.githubusercontent.com/u/3849293" alt="User"/></div>
              <div className="avatar"><img src="https://avatars.githubusercontent.com/u/22560152" alt="User"/></div>
            </div>
            <div className="contributors-text">
              <div className="text-line"><span className="text-white font-bold">9</span> contributors</div>
              <div className="text-line">Trusted by <span className="text-gradient-saasfly font-bold">2000</span> developers</div>
            </div>
          </div>
        </div>
        
        <div className="hero-graphic">
          <div className="glass-window">
            <div className="window-header">
              <div className="dot red"></div>
              <div className="dot yellow"></div>
              <div className="dot green"></div>
            </div>
            <div className="window-body">
              <div className="code-line w-80"></div>
              <div className="code-line w-60"></div>
              <div className="code-line w-90"></div>
              <br/>
              <div className="code-line w-40 highlight"></div>
              <div className="code-line w-70"></div>
              <div className="code-line w-50"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
