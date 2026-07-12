import { Users, Link as LinkIcon, DollarSign, Activity } from 'lucide-react';

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard Overview</h1>
      <p className="subtitle">Welcome back, Admin. Here is what's happening today.</p>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Users</h3>
            <p>1,248</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <LinkIcon size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Links Created</h3>
            <p>8,592</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>Pro Subscriptions</h3>
            <p>342</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning)' }}>
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <h3>Active Today</h3>
            <p>156</p>
          </div>
        </div>
      </div>
      
      <h2>Recent Activity</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>rahul@example.com</td>
              <td>Created a new link</td>
              <td>2 mins ago</td>
            </tr>
            <tr>
              <td>priya@example.com</td>
              <td>Upgraded to Pro Plan</td>
              <td>1 hour ago</td>
            </tr>
            <tr>
              <td>amit@business.com</td>
              <td>Registered account</td>
              <td>3 hours ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
