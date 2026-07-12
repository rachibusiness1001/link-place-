import { Link } from 'react-router-dom';
import { Search, Edit } from 'lucide-react';

const DUMMY_USERS = [
  { id: 1, email: 'rahul@example.com', joined: '2023-05-12', plan: 'pro', links: 12 },
  { id: 2, email: 'priya@example.com', joined: '2023-06-20', plan: 'free', links: 3 },
  { id: 3, email: 'amit@business.com', joined: '2023-08-01', plan: 'pro', links: 45 },
  { id: 4, email: 'neha@test.in', joined: '2023-08-15', plan: 'free', links: 1 },
];

export default function UsersList() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Manage Users</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
            <input type="text" className="form-control" placeholder="Search user email..." style={{ paddingLeft: '36px', width: '250px' }} />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Date Joined</th>
              <th>Links Created</th>
              <th>Plan</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_USERS.map(user => (
              <tr key={user.id}>
                <td>#{user.id}</td>
                <td>{user.email}</td>
                <td>{user.joined}</td>
                <td>{user.links}</td>
                <td>
                  <span className={`badge ${user.plan}`}>
                    {user.plan.toUpperCase()}
                  </span>
                </td>
                <td>
                  <Link to={`/users/${user.id}`} className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '12px' }}>
                    <Edit size={14} />
                    Edit Plan
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
