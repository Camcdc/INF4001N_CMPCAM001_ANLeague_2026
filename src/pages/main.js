import { getAuth } from "firebase/auth";
import { doc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { Link } from "react-router-dom";
import { db } from "../config/firebase";

export const Main = () => {
  const auth = getAuth();
  const [user] = useAuthState(auth);
  const userDocRef = user ? doc(db, "users", user.uid) : null;
  const [userData] = useDocumentData(userDocRef);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚽</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            African Nations League 2026
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Tournament Management System
          </p>
          <div className="space-x-4">
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        </div>

        {/* Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* View Tournament Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start space-x-4">
              <div className="text-3xl text-green-600">🏆</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  View Tournament
                </h2>
                <p className="text-gray-600 mb-4">
                  View the tournament bracket and match results
                </p>
                <Link
                  to="/all-tournaments"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Go to tournaments →
                </Link>
              </div>
            </div>
          </div>

          {/* Register Team Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start space-x-4">
              <div className="text-3xl text-green-600">👥</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {userData?.hasTeam ? "My Team" : "Register Team"}
                </h2>
                <p className="text-gray-600 mb-4">
                  {userData?.hasTeam
                    ? "View and manage your registered team"
                    : "Register your country for the tournament"}
                </p>
                {userData?.hasTeam ? (
                  <Link
                    to="/myTeam"
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    View my team →
                  </Link>
                ) : (
                  <Link
                    to="/register-team"
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    Register team →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Browse Teams Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start space-x-4">
              <div className="text-3xl text-purple-600">⚽</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Browse Teams
                </h2>
                <p className="text-gray-600 mb-4">
                  Explore all registered teams and their profiles
                </p>
                <Link
                  to="/teams"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  View all teams →
                </Link>
              </div>
            </div>
          </div>

          {/* Match Analytics Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start space-x-4">
              <div className="text-3xl text-blue-600">📊</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Match Analytics
                </h2>
                <p className="text-gray-600 mb-4">
                  View fixtures, results and team statistics
                </p>
                <Link
                  to="/fixtures"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  View analytics →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
