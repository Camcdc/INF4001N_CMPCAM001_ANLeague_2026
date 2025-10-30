import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../config/firebase";

export const Fixtures = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [teamsData, setTeamsData] = useState({});
  const [tournamentsData, setTournamentsData] = useState({});
  const [activeTab, setActiveTab] = useState("fixtures"); // "fixtures" or "results"
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        navigate("/login");
        return;
      }

      try {
        // Get user data
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (userDoc.exists()) {
          setUser({ uid: authUser.uid, ...userDoc.data() });
        }

        // Get all matches
        const matchesSnapshot = await getDocs(collection(db, "matches"));
        const allMatches = matchesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter matches based on active tab
        const filteredMatches = allMatches.filter((match) => {
          if (activeTab === "fixtures") {
            return !match.simulated; // Upcoming matches
          } else {
            return match.simulated; // Completed matches
          }
        });

        // Get unique team IDs from filtered matches
        const teamIds = [
          ...new Set([
            ...filteredMatches.map((m) => m.team1ID),
            ...filteredMatches.map((m) => m.team2ID),
          ]),
        ].filter(Boolean);

        // Fetch team data
        const teamPromises = teamIds.map(async (teamId) => {
          try {
            const teamDoc = await getDoc(doc(db, "teams", teamId));
            return teamDoc.exists() ? { [teamId]: teamDoc.data() } : null;
          } catch (error) {
            console.error(`Error fetching team ${teamId}:`, error);
            return null;
          }
        });

        const teamResults = await Promise.all(teamPromises);
        const validTeams = teamResults.filter(Boolean);
        setTeamsData(
          validTeams.reduce((acc, team) => ({ ...acc, ...team }), {})
        );

        // Fetch tournaments referenced by matches so we can group by name
        const tournamentIds = [
          ...new Set(
            filteredMatches.map((m) => m.tournamentID).filter(Boolean)
          ),
        ];

        const tournamentPromises = tournamentIds.map(async (tId) => {
          try {
            const tDoc = await getDoc(doc(db, "tournament", tId));
            return tDoc.exists()
              ? { [tId]: tDoc.data().name || "Unnamed" }
              : null;
          } catch (error) {
            console.error(`Error fetching tournament ${tId}:`, error);
            return null;
          }
        });

        const tournamentResults = await Promise.all(tournamentPromises);
        const validTournaments = tournamentResults.filter(Boolean);
        const tournamentsMap = validTournaments.reduce(
          (acc, t) => ({ ...acc, ...t }),
          {}
        );

        // Sort matches by tournament name then by date (if available)
        const sortedMatches = filteredMatches.sort((a, b) => {
          const nameA = tournamentsMap[a.tournamentID] || "ZZZ";
          const nameB = tournamentsMap[b.tournamentID] || "ZZZ";
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          // For results tab, sort completed matches by date (newest first)
          // For fixtures tab, sort upcoming matches by date (soonest first)
          const dateA = a.date
            ? new Date(a.date.seconds ? a.date.seconds * 1000 : a.date)
            : 0;
          const dateB = b.date
            ? new Date(b.date.seconds ? b.date.seconds * 1000 : b.date)
            : 0;
          return activeTab === "results" ? dateB - dateA : dateA - dateB;
        });

        setMatches(sortedMatches.map((m) => ({ ...m })));
        setTournamentsData(tournamentsMap);
      } catch (error) {
        console.error("Error loading fixtures:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, activeTab]);

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
        <h1 className="text-4xl font-bold mb-2">
          {activeTab === "fixtures" ? "Upcoming Fixtures" : "Match Results"}
        </h1>
        <p className="text-lg">
          {activeTab === "fixtures"
            ? "View all scheduled matches across tournaments"
            : "View completed match results across tournaments"}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("fixtures")}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
            activeTab === "fixtures"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          📅 Fixtures
        </button>
        <button
          onClick={() => setActiveTab("results")}
          className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
            activeTab === "results"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          🏆 Results
        </button>
      </div>

      {/* Matches List */}
      {matches.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">⚽</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            {activeTab === "fixtures"
              ? "No Upcoming Matches"
              : "No Completed Matches"}
          </h2>
          <p className="text-gray-600">
            {activeTab === "fixtures"
              ? "All current matches have been completed."
              : "No matches have been completed yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group matches by tournament name */}
          {(() => {
            const groups = {};
            matches.forEach((m) => {
              const tName =
                tournamentsData[m.tournamentID] || "Other Tournaments";
              if (!groups[tName]) groups[tName] = [];
              groups[tName].push(m);
            });

            return Object.entries(groups).map(([tName, tMatches]) => (
              <div key={tName} className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800 border-b-2 border-gray-200 pb-2">
                  {tName}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tMatches.map((match) => (
                    <Link
                      key={match.id}
                      to={`/match/${match.id}`}
                      className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-200"
                    >
                      {/* Teams (no avatar circles) */}
                      <div className="space-y-3 text-gray-800">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm text-gray-600">Team 1</div>
                            <div className="font-medium text-lg">
                              {teamsData[match.team1ID]?.federationID ||
                                match.team1ID ||
                                "TBD"}
                            </div>
                          </div>
                          {/* Show score for completed matches */}
                          {activeTab === "results" && match.score && (
                            <div className="text-2xl font-bold text-blue-600">
                              {match.score.team1}
                            </div>
                          )}
                        </div>

                        <div className="text-center text-gray-500 font-medium">
                          VS
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm text-gray-600">Team 2</div>
                            <div className="font-medium text-lg">
                              {teamsData[match.team2ID]?.federationID ||
                                match.team2ID ||
                                "TBD"}
                            </div>
                          </div>
                          {/* Show score for completed matches */}
                          {activeTab === "results" && match.score && (
                            <div className="text-2xl font-bold text-blue-600">
                              {match.score.team2}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Match Status */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Status:</span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              activeTab === "results"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {activeTab === "results" ? "COMPLETED" : "UPCOMING"}
                          </span>
                        </div>

                        {/* Show stage for completed matches */}
                        {activeTab === "results" && match.stage && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-gray-600">
                              Stage:
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              {match.stage}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Call to Action */}
                      <div className="mt-4 text-center">
                        <span className="text-sm text-blue-600 font-medium">
                          Click to view details →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Navigation Links */}
      <div className="mt-8 text-center space-x-4">
        <Link
          to="/main"
          className="inline-block px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
        >
          Back to Home
        </Link>
        <Link
          to="/all-tournaments"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          View All Tournaments
        </Link>
      </div>
    </div>
  );
};
