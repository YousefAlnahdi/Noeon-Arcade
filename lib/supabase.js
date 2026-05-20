import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Helper to create a mock client when credentials are not set
const createMockSupabaseClient = () => {
  if (typeof window !== 'undefined') {
    console.warn(
      "⚠️ NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing! " +
      "Running with a Mock Supabase Client. User sessions and game history will be saved to localStorage."
    );
  }

  const getSessionUser = () => {
    if (typeof window === 'undefined') return null;
    const sessionStr = localStorage.getItem('mock_supabase_session');
    return sessionStr ? JSON.parse(sessionStr)?.user : null;
  };

  // Simple mock implementation
  const mockClient = {
    auth: {
      getSession: async () => {
        if (typeof window === 'undefined') return { data: { session: null } };
        const sessionStr = localStorage.getItem('mock_supabase_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        return { data: { session } };
      },
      onAuthStateChange: (callback) => {
        if (typeof window !== 'undefined') {
          const sessionStr = localStorage.getItem('mock_supabase_session');
          const session = sessionStr ? JSON.parse(sessionStr) : null;
          // Set a short timeout so that it runs after subscribers are registered
          setTimeout(() => callback('SIGNED_IN', session), 0);
        }
        return {
          data: {
            subscription: {
              unsubscribe: () => {}
            }
          }
        };
      },
      signUp: async ({ email, password, options }) => {
        if (typeof window === 'undefined') return { data: { user: null }, error: { message: 'Not on client' } };
        const username = options?.data?.username || email.split('@')[0];
        const display_name = options?.data?.display_name || username;
        const mockUser = {
          id: 'mock-user-id-' + Math.random().toString(36).substr(2, 9),
          email,
          user_metadata: { username, display_name }
        };
        const mockSession = { user: mockUser, access_token: 'mock-token' };
        localStorage.setItem('mock_supabase_session', JSON.stringify(mockSession));
        
        const profile = {
          id: mockUser.id,
          username,
          display_name,
          avatar_url: null,
          rank: 'Rookie',
          total_tokens: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        localStorage.setItem(`mock_profile_${mockUser.id}`, JSON.stringify(profile));

        return { data: { user: mockUser, session: mockSession }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        if (typeof window === 'undefined') return { data: { user: null }, error: { message: 'Not on client' } };
        const username = email.split('@')[0];
        const mockUser = {
          id: 'mock-user-id-fixed',
          email,
          user_metadata: { username, display_name: username }
        };
        const mockSession = { user: mockUser, access_token: 'mock-token' };
        localStorage.setItem('mock_supabase_session', JSON.stringify(mockSession));
        
        if (!localStorage.getItem(`mock_profile_${mockUser.id}`)) {
          const profile = {
            id: mockUser.id,
            username,
            display_name: username,
            avatar_url: null,
            rank: 'Rookie',
            total_tokens: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          localStorage.setItem(`mock_profile_${mockUser.id}`, JSON.stringify(profile));
        }

        return { data: { user: mockUser, session: mockSession }, error: null };
      },
      signOut: async () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mock_supabase_session');
        }
        return { error: null };
      }
    },
    from: (table) => {
      return {
        select: (fields) => {
          return {
            eq: (field, value) => {
              return {
                single: async () => {
                  if (table === 'profiles') {
                    if (typeof window !== 'undefined') {
                      const profileStr = localStorage.getItem(`mock_profile_${value}`);
                      if (profileStr) {
                        return { data: JSON.parse(profileStr), error: null };
                      }
                    }
                    return {
                      data: {
                        id: value,
                        username: 'PlayerOne',
                        display_name: 'Player One',
                        rank: 'Rookie',
                        total_tokens: 100,
                        created_at: new Date().toISOString()
                      },
                      error: null
                    };
                  }
                  return { data: null, error: { message: 'Not found' } };
                },
                order: (field, { ascending } = {}) => {
                  return {
                    limit: async (limitVal) => {
                      return { data: [], error: null };
                    }
                  };
                }
              };
            },
            order: (field, { ascending } = {}) => {
              return {
                limit: async (limitVal) => {
                  if (table === 'game_sessions') {
                    const user = getSessionUser();
                    if (!user) return { data: [], error: null };
                    if (typeof window !== 'undefined') {
                      const sessionsStr = localStorage.getItem(`mock_sessions_${user.id}`);
                      let sessions = sessionsStr ? JSON.parse(sessionsStr) : [];
                      sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                      return { data: sessions.slice(0, limitVal), error: null };
                    }
                  }
                  return { data: [], error: null };
                }
              };
            }
          };
        },
        insert: async (records) => {
          if (table === 'game_sessions' && typeof window !== 'undefined') {
            const recordsArray = Array.isArray(records) ? records : [records];
            const user = getSessionUser();
            if (user) {
              const sessionsStr = localStorage.getItem(`mock_sessions_${user.id}`) || '[]';
              const sessions = JSON.parse(sessionsStr);
              
              const newRecords = recordsArray.map(r => {
                const rec = {
                  id: 'session-' + Math.random().toString(36).substr(2, 9),
                  ...r,
                  created_at: new Date().toISOString()
                };
                sessions.push(rec);
                return rec;
              });

              localStorage.setItem(`mock_sessions_${user.id}`, JSON.stringify(sessions));

              const profileStr = localStorage.getItem(`mock_profile_${user.id}`);
              if (profileStr) {
                const profile = JSON.parse(profileStr);
                const tokensEarned = recordsArray.reduce((acc, r) => acc + (r.tokens_earned || 0), 0);
                profile.total_tokens = (profile.total_tokens || 0) + tokensEarned;
                
                const wins = sessions.filter(s => s.result === 'win').length;
                let newRank = 'Rookie';
                if (wins >= 100) newRank = 'Neon Legend';
                else if (wins >= 50) newRank = 'Arcade Master';
                else if (wins >= 25) newRank = 'Cyber Knight III';
                else if (wins >= 15) newRank = 'Cyber Knight II';
                else if (wins >= 10) newRank = 'Cyber Knight I';
                else if (wins >= 5) newRank = 'Circuit Runner';
                else if (wins >= 1) newRank = 'Pixel Cadet';
                profile.rank = newRank;

                localStorage.setItem(`mock_profile_${user.id}`, JSON.stringify(profile));
              }

              return { data: newRecords, error: null };
            }
          }
          return { data: records, error: null };
        },
        update: (updates) => {
          return {
            eq: (field, value) => {
              if (table === 'profiles' && typeof window !== 'undefined') {
                const profileStr = localStorage.getItem(`mock_profile_${value}`);
                if (profileStr) {
                  const profile = { ...JSON.parse(profileStr), ...updates, updated_at: new Date().toISOString() };
                  localStorage.setItem(`mock_profile_${value}`, JSON.stringify(profile));
                  return { data: [profile], error: null };
                }
              }
              return { data: null, error: null };
            }
          };
        }
      };
    },
    channel: (chanName) => {
      return {
        on: (event, filter, callback) => {
          return {
            subscribe: () => {
              return {
                unsubscribe: () => {}
              };
            }
          };
        },
        subscribe: () => {
          return {
            unsubscribe: () => {}
          };
        }
      };
    },
    removeChannel: () => {}
  };

  return mockClient;
};

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabaseClient();

