import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Shield, CreditCard } from 'lucide-react';
import { useState } from 'react';

export default function UserDetails() {
  const { id } = useParams();
  const [currentPlan, setCurrentPlan] = useState('free'); // Dummy state for now

  const handleUpdatePlan = (e) => {
    e.preventDefault();
    alert(`Plan updated successfully for user #${id} to ${currentPlan.toUpperCase()}`);
    // In real app, make axios call to backend here
  };

  return (
    <div>
      <Link to="/users" className="btn btn-outline" style={{ marginBottom: '24px', display: 'inline-flex', padding: '6px 12px' }}>
        <ArrowLeft size={16} /> Back to Users
      </Link>

      <h1>User Profile</h1>
      <p className="subtitle">Managing details and subscription for User #{id}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* User Data Section */}
        <div>
          <div className="user-detail-card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={20} /> Account Information</h2>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="form-control" value="user@example.com" disabled />
            </div>
            <div className="form-group">
              <label>Registration Date</label>
              <input type="text" className="form-control" value="August 15, 2023" disabled />
            </div>
            <div className="form-group">
              <label>Total Links Created</label>
              <input type="text" className="form-control" value="12" disabled />
            </div>
          </div>
        </div>

        {/* Plan Management Section */}
        <div>
          <div className="plan-manager">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}><Shield size={20} /> Subscription Control</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              You have full authority to override this user's current subscription plan.
            </p>
            
            <form onSubmit={handleUpdatePlan}>
              <div className="form-group">
                <label>Current Plan</label>
                <select 
                  className="form-control" 
                  value={currentPlan}
                  onChange={(e) => setCurrentPlan(e.target.value)}
                >
                  <option value="free">Free Plan (Basic Features)</option>
                  <option value="pro">Pro Plan (Premium Features)</option>
                  <option value="lifetime">Lifetime Deal (All Features)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <CreditCard size={18} /> Update User Plan
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
