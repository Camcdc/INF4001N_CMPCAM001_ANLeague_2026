import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../config/firebase";

export const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTeams = async () => {
      try {
        // Get all teams - no authentication required
        const teamsSnapshot = await getDocs(collection(db, "teams"));
        const allTeams = teamsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort teams by federationID (fallback to name)
        const sortedTeams = allTeams.sort((a, b) => {
          const idA = a.federationID || a.name || "Unknown";
          const idB = b.federationID || b.name || "Unknown";
          return idA.localeCompare(idB);
        });

        setTeams(sortedTeams);
      } catch (error) {
        console.error("Error loading teams:", error);
      } finally {
        setLoading(false);
      }
    };

    // Check authentication state but don't require login
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser({ uid: authUser.uid });
      } else {
        setUser(null);
      }
    });

    // Load teams regardless of authentication status
    loadTeams();

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loader border-t-4 border-blue-500 rounded-full w-12 h-12 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white p-6 rounded-lg shadow-lg mb-6">
        <h1 className="text-4xl font-bold mb-2">Registered Teams</h1>
        <p className="text-lg">
          View all teams that have registered for the league
        </p>
        <div className="mt-2 text-sm opacity-90">
          Total Teams: {teams.length}
        </div>
      </div>

      {/* Teams List */}
      {teams.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">⚽</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            No Teams Registered
          </h2>
          <p className="text-gray-600">
            No teams have been registered yet. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teamPage/${team.id}`}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-200 block"
            >
              {/* Team Header */}
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-blue-600 mb-2">
                  {team.federationID || "Unknown ID"}
                </h3>
                {/* team.name intentionally hidden in list view; federationID is primary */}
              </div>

              {/* Team Details */}
              <div className="space-y-2 text-sm">
                {team.country && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Country:</span>
                    <span className="font-medium">{team.country}</span>
                  </div>
                )}

                {team.players && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Squad Size:</span>
                    <span className="font-medium">
                      {team.players.length} players
                    </span>
                  </div>
                )}

                {team.homeStadium && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Home Stadium:</span>
                    <span className="font-medium">{team.homeStadium}</span>
                  </div>
                )}
              </div>

              {/* Team Stats or Additional Info */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    ACTIVE
                  </span>
                  <span className="text-xs text-blue-600 font-medium">
                    Click to view →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
