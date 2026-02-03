
        const LoginScreen = ({ onLogin }) => {
            const [username, setUsername] = useState('');
            const [password, setPassword] = useState('');
            const [error, setError] = useState('');
            const [loading, setLoading] = useState(false);

            const handleSubmit = async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                
                try {
                    const res = await fetch('/api/login', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ username, password })
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        onLogin(data.user);
                    } else {
                        setError(data.message || 'Login failed');
                    }
                } catch (err) {
                    setError('Network error occurred');
                } finally {
                    setLoading(false);
                }
            };

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100">
                    <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
                        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Rugby Team Manager</h1>
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                            >
                                {loading ? 'Logging in...' : 'Sign In'}
                            </button>
                        </form>
                    </div>
                </div>
            );
        };
