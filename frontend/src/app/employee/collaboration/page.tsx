'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  Award, Trophy, Search, Users, Send, CheckCircle, ShieldAlert,
  Clock, ThumbsUp, Heart, Star, Sparkles, MessageSquare, Loader2
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Recognition {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name: string;
  points: number;
  reason: string;
  created_at: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  reward_points: number;
  company_name?: string;
}

interface SearchUser {
  id: string;
  name: string;
  email: string;
  type: string;
}

export default function CollaborationPage() {
  const { user } = useAuth();
  
  // Lists
  const [received, setReceived] = useState<Recognition[]>([]);
  const [sent, setSent] = useState<Recognition[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  
  // Form State
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Fetch all necessary data
  const fetchData = useCallback(async () => {
    try {
      const [receivedRes, sentRes, leaderboardRes] = await Promise.all([
        api.get('/peer-recognition/received'),
        api.get('/peer-recognition/sent'),
        api.get('/peer-recognition/leaderboard')
      ]);
      setReceived(receivedRes.data);
      setSent(sentRes.data);
      setLeaderboard(leaderboardRes.data);
    } catch (err) {
      console.error('Error fetching collaboration data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Peer Recognition search autocomplete
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${searchQuery}`);
        // Filter out current user from search results
        const filteredUsers = (res.data.employees || []).filter(
          (u: SearchUser) => u.id !== user?.id
        );
        setSearchResults(filteredUsers);
      } catch (err) {
        console.error('Failed to search employees:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setFormError('Please select a peer to recognize.');
      return;
    }
    if (!reason || reason.trim().length < 5) {
      setFormError('Please provide a reason of at least 5 characters.');
      return;
    }
    if (points <= 0 || points > 10) {
      setFormError('Points must be between 1 and 10.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setFormSuccess('');

    try {
      await api.post('/peer-recognition', {
        receiver_id: selectedUser.id,
        reason: reason.trim(),
        points: points
      });

      setFormSuccess(`Successfully awarded ${points} points to ${selectedUser.name}!`);
      
      // Reset form
      setSelectedUser(null);
      setSearchQuery('');
      setReason('');
      setPoints(1);
      
      // Refresh statistics & lists
      fetchData();
    } catch (err: any) {
      console.error('Failed to submit recognition:', err);
      setFormError(err.response?.data?.detail || 'Failed to send recognition. Please check points cap (max 10 points/month).');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate monthly sent points
  const totalSentThisMonth = sent.reduce((sum, r) => sum + r.points, 0);
  const remainingAllowance = Math.max(0, 10 - totalSentThisMonth);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-indigo-500 animate-pulse" />
          Collaboration & Recognition Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Appreciate your colleagues, award points, and grow together as a cohesive team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form & Statistics */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Allowance Indicator */}
          <div className="glass rounded-3xl p-6 border border-slate-100/50 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/30 relative overflow-hidden shadow-sm">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Monthly Peer Recognition Limit</span>
                <h3 className="text-xl font-bold text-slate-800">Remaining Allowance</h3>
                <p className="text-xs text-slate-500">You can give up to 10 points every month to peers in your company.</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-indigo-600">{remainingAllowance.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-bold ml-1">/ 10.0 pts</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-500" 
                style={{ width: `${(remainingAllowance / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* Recognition Submission Form */}
          <div className="glass rounded-3xl p-8 border border-slate-100 relative shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Heart className="w-5 h-5 text-indigo-600 fill-indigo-100" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Appreciate a Peer</h2>
                <p className="text-xs text-slate-400 font-medium">Send points and a message of gratitude</p>
              </div>
            </div>

            {formError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Autocomplete Peer Search */}
              <div className="relative">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Search colleague</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={selectedUser ? selectedUser.name : searchQuery}
                    onChange={(e) => {
                      if (selectedUser) setSelectedUser(null);
                      setSearchQuery(e.target.value);
                    }}
                    className="input pl-11 pr-4 h-12 rounded-2xl border-slate-200 focus:border-indigo-500 font-semibold"
                    placeholder="Type name or email to search..."
                    disabled={submitting}
                  />
                  {selectedUser && (
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Suggestions List */}
                {searchResults.length > 0 && !selectedUser && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-700">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {user.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Point Allocation */}
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Points to Award</label>
                  <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg">{points.toFixed(1)} Point(s)</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={points}
                  onChange={(e) => setPoints(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  disabled={submitting || remainingAllowance <= 0}
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 mt-1">
                  <span>0.5 Pts</span>
                  <span>5.0 Pts</span>
                  <span>10.0 Pts</span>
                </div>
              </div>

              {/* Appreciation Reason */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Reason / Note of Appreciation</label>
                <div className="relative group">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="textarea border-slate-200 focus:border-indigo-500 rounded-2xl min-h-[100px] p-4 text-sm font-medium leading-relaxed"
                    placeholder="Mention specific tasks, help, or achievements they contributed..."
                    required
                    maxLength={500}
                    disabled={submitting}
                  />
                  <div className="absolute right-3 bottom-3 text-[10px] text-slate-400 font-bold">
                    {reason.length}/500
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={submitting || remainingAllowance <= 0 || !selectedUser}
                className="btn btn-primary w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Award Recognition
                  </>
                )}
              </button>
            </form>
          </div>

          {/* History of Recognitions */}
          <div className="glass rounded-3xl overflow-hidden border border-slate-100 shadow-sm bg-white">
            <div className="border-b border-slate-100 flex items-center justify-between p-4 bg-slate-50/50">
              <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setActiveTab('received')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'received' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Received ({received.length})
                </button>
                <button
                  onClick={() => setActiveTab('sent')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'sent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sent ({sent.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar p-6">
              {activeTab === 'received' ? (
                received.length > 0 ? (
                  received.map((rec) => (
                    <div key={rec.id} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-700">From: {rec.sender_name}</span>
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            +{rec.points} pts
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          {rec.reason}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(rec.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-slate-400 italic">
                    <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    No recognitions received yet. Keep up the good work!
                  </div>
                )
              ) : (
                sent.length > 0 ? (
                  sent.map((rec) => (
                    <div key={rec.id} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <ThumbsUp className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-700">To: {rec.receiver_name}</span>
                          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            -{rec.points} pts
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          {rec.reason}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(rec.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-slate-400 italic">
                    <Send className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    You haven't appreciated anyone yet this month. Spread some positivity!
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="space-y-8">
          <div className="glass rounded-3xl p-6 border border-slate-100 shadow-sm bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-5 h-5 text-amber-500 fill-amber-100" />
              <div>
                <h3 className="font-bold text-slate-800">Points Leaderboard</h3>
                <p className="text-[10px] uppercase text-slate-400 font-black tracking-wider mt-0.5">Top Performers in Company</p>
              </div>
            </div>

            <div className="space-y-4">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => {
                  // Style top 3 places differently
                  const isTopThree = index < 3;
                  const medalColors = ['from-amber-400 to-amber-500 shadow-amber-200', 'from-slate-300 to-slate-400 shadow-slate-200', 'from-amber-600 to-amber-700 shadow-amber-800/20'];
                  
                  return (
                    <div 
                      key={entry.id} 
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        entry.id === user?.id 
                          ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' 
                          : 'bg-slate-50/40 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isTopThree ? (
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${medalColors[index]} flex items-center justify-center text-white text-xs font-black shadow-lg`}>
                            {index + 1}
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold border border-slate-200">
                            {index + 1}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            {entry.name}
                            {entry.id === user?.id && (
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">You</span>
                            )}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            {entry.role.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-indigo-600 bg-white border border-indigo-100 px-2.5 py-1 rounded-xl shadow-sm">
                          {(entry.reward_points ?? 0).toFixed(2)} pts
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  No records to display.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
