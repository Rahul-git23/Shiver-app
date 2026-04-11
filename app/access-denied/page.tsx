 'use client';
 export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
        
        <div className="text-6xl mb-4">🚫</div>
        
        <h1 className="text-2xl font-bold text-gray-700 mb-2">
          Access Denied
        </h1>
        
        <p className="text-gray-500 mb-6">
          Your number is not registered in the system. 
          Please contact your coordinator for access.
        </p>

        <div className="bg-orange-50 rounded-xl p-4 mb-6">
          <p className="text-orange-600 text-sm">
            🕉️ Jai Gurudev
          </p>
        </div>

        <button
          onClick={() => window.location.href = '/login'}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Back to Login
        </button>

      </div>
    </div>
  );
}
