"use client";

import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, UserX, Search } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import axios from 'axios';

interface User {
  _id: string;
  email: string;
  role: string;
  tokens: number;
  isActive: boolean;
  searchLogs: any[];
  createdAt: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAppStore();

  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const fetchUsers = async () => {
    if (!currentUser?.token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${currentUser.token}` }
      });
      setUsers(res.data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    if (!currentUser?.token) return;
    const action = currentStatus ? "block" : "unblock";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      await axios.patch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}/status`, 
        { isActive: !currentStatus },
        { headers: { Authorization: `Bearer ${currentUser.token}` } }
      );
      await fetchUsers();
    } catch (error) {
      console.error("Failed to update user status:", error);
      alert("Failed to update user status.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-zinc-400">View all users, their usage, and manage access.</p>
      </div>

      <div className="bg-[#0d0d0f] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/[0.01]">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search by email..." 
              className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-white/[0.02] text-xs uppercase font-semibold text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Tokens Left</th>
                <th className="px-6 py-4">Searches Made</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-zinc-500">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{u.email}</div>
                      <div className="text-xs text-zinc-500">Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">
                      {u.tokens.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      {u.searchLogs ? u.searchLogs.length : 0}
                    </td>
                    <td className="px-6 py-4">
                      {u.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                          <ShieldCheck className="w-4 h-4" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                          <ShieldAlert className="w-4 h-4" /> Blocked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u._id !== currentUser?.uid && ( // Don't let admin block themselves
                        <button 
                          onClick={() => handleToggleBlock(u._id, u.isActive)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2 ml-auto ${
                            u.isActive 
                              ? 'text-red-400 hover:bg-red-500/10 border-red-500/20' 
                              : 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20'
                          }`}
                        >
                          {u.isActive ? (
                            <><UserX className="w-3 h-3" /> Block User</>
                          ) : (
                            <><ShieldCheck className="w-3 h-3" /> Unblock</>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
