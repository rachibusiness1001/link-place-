export default function SettingsPage() {
  return (
    <div className="fade-in">
      <div className="dash-header">
        <h1>Settings</h1>
        <p>Manage your account preferences and API keys.</p>
      </div>
      
      <div className="glass-panel" style={{ maxWidth: '600px' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--foreground)' }}>Account Information</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Email Address</label>
            <input type="email" value="alex@example.com" disabled className="tool-input" style={{ width: '100%', opacity: 0.7 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Full Name</label>
            <input type="text" defaultValue="Alex Morgan" className="tool-input" style={{ width: '100%' }} />
          </div>
          <button className="tool-btn" style={{ marginTop: '1rem' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
