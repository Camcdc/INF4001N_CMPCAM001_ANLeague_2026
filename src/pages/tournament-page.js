import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Bracket, Seed, SeedItem } from "react-brackets";
import { Link, useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../config/firebase";

export const TournamentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamsData, setTeamsData] = useState({});
  const [matches, setMatches] = useState([]);
  const [updating, setUpdating] = useState(false);

  // Load tournament data
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

        // Get tournament data
        const tournamentDoc = await getDoc(doc(db, "tournament", id));
        if (tournamentDoc.exists()) {
          setTournament({ id: tournamentDoc.id, ...tournamentDoc.data() });
        }

        // Get teams data - simplified without loading states
        const tournamentData = tournamentDoc.data();
        if (tournamentData?.teamsQualified?.length > 0) {
          try {
            // Fetch all teams data in parallel
            const teamPromises = tournamentData.teamsQualified.map(
              async (teamId) => {
                try {
                  const teamDoc = await getDoc(doc(db, "teams", teamId));
                  return teamDoc.exists() ? { [teamId]: teamDoc.data() } : null;
                } catch (error) {
                  console.error(`Error fetching team ${teamId}:`, error);
                  return null;
                }
              }
            );

            const teamResults = await Promise.all(teamPromises);
            const validTeams = teamResults.filter(Boolean);
            setTeamsData(
              validTeams.reduce((acc, team) => ({ ...acc, ...team }), {})
            );
          } catch (error) {
            console.error("Error loading teams data:", error);
          }
        }

        // Get matches data
        const matchesQuery = query(
          collection(db, "matches"),
          where("tournamentID", "==", id)
        );
        const matchSnapshot = await getDocs(matchesQuery);
        setMatches(
          matchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, navigate]);

  // Auto-update bracket when matches are completed
  useEffect(() => {
    if (!tournament || !matches.length || updating) return;

    // Add a small delay to prevent race conditions
    const timeoutId = setTimeout(async () => {
      const updateBracket = async () => {
        if (tournament.stage === "Quarter Finals") {
          // Check if all QF matches are complete
          const qfMatches = matches.filter(
            (m) => m.stage === "Quarter Finals" && m.winnerID
          );
          if (qfMatches.length === 4) {
            setUpdating(true);
            try {
              // Create semi-final bracket
              const winners = qfMatches.map((m) => m.winnerID);
              const semiFinals = [
                { teams: [winners[0], winners[1]], stage: "Semi Finals" },
                { teams: [winners[2], winners[3]], stage: "Semi Finals" },
              ];

              // Check database directly for existing semi-final matches
              const existingSFQuery = query(
                collection(db, "matches"),
                where("tournamentID", "==", id),
                where("stage", "==", "Semi Finals")
              );
              const existingSFSnapshot = await getDocs(existingSFQuery);
              const existingSFMatches = existingSFSnapshot.docs.map((doc) =>
                doc.data()
              );

              // Create semi-final matches only if none exist
              if (existingSFMatches.length === 0) {
                for (const sf of semiFinals) {
                  await addDoc(collection(db, "matches"), {
                    team1ID: sf.teams[0],
                    team2ID: sf.teams[1],
                    stage: "Semi Finals",
                    tournamentID: id,
                    score: { team1: 0, team2: 0 },
                    simulated: false,
                    winnerID: "",
                    status: "upcoming",
                    date: new Date(),
                    commentary: [""],
                  });
                }
              }

              // Update tournament
              await updateDoc(doc(db, "tournament", id), {
                stage: "Semi Finals",
                bracket: { ...tournament.bracket, semiFinals },
              });
            } finally {
              setUpdating(false);
            }
          }
        }

        if (tournament.stage === "Semi Finals") {
          // Check if all SF matches are complete
          const sfMatches = matches.filter(
            (m) => m.stage === "Semi Finals" && m.winnerID
          );
          if (sfMatches.length === 2) {
            setUpdating(true);
            try {
              const winners = sfMatches.map((m) => m.winnerID);
              const final = [{ teams: winners, stage: "Final" }];

              // Check database directly for existing final match
              const existingFinalQuery = query(
                collection(db, "matches"),
                where("tournamentID", "==", id),
                where("stage", "==", "Final")
              );
              const existingFinalSnapshot = await getDocs(existingFinalQuery);
              const existingFinalMatches = existingFinalSnapshot.docs.map(
                (doc) => doc.data()
              );

              // Create final match only if none exists
              if (existingFinalMatches.length === 0) {
                await addDoc(collection(db, "matches"), {
                  team1ID: winners[0],
                  team2ID: winners[1],
                  stage: "Final",
                  tournamentID: id,
                  score: { team1: 0, team2: 0 },
                  simulated: false,
                  winnerID: "",
                  status: "upcoming",
                  date: new Date(),
                  commentary: [""],
                });
              }

              await updateDoc(doc(db, "tournament", id), {
                stage: "Final",
                bracket: { ...tournament.bracket, final },
              });
            } finally {
              setUpdating(false);
            }
          }
        }

        if (tournament.stage === "Final") {
          // Check if final is complete
          const finalMatch = matches.find(
            (m) => m.stage === "Final" && m.winnerID
          );
          if (finalMatch) {
            await updateDoc(doc(db, "tournament", id), {
              stage: "Completed",
              bracket: {
                ...tournament.bracket,
                champion:
                  teamsData[finalMatch.winnerID]?.federationID ||
                  finalMatch.winnerID,
              },
            });
          }
        }
      };

      await updateBracket();
    }, 1000); // 1 second delay to prevent race conditions

    return () => clearTimeout(timeoutId);
  }, [matches, tournament, teamsData, updating, id]);

  // Poll for match updates
  useEffect(() => {
    if (!tournament) return;

    const interval = setInterval(async () => {
      try {
        const matchesQuery = query(
          collection(db, "matches"),
          where("tournamentID", "==", tournament.id)
        );
        const snapshot = await getDocs(matchesQuery);
        const latestMatches = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (JSON.stringify(latestMatches) !== JSON.stringify(matches)) {
          setMatches(latestMatches);
        }
      } catch (error) {
        console.error("Error polling matches:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [tournament, matches]);

  // Register team
  const registerTeam = async (teamID) => {
    if (!teamID || tournament.teamsQualified?.includes(teamID)) {
      alert("Team already registered or invalid");
      return;
    }

    try {
      // First, fetch the team data immediately
      const teamDoc = await getDoc(doc(db, "teams", teamID));
      const teamData = teamDoc.exists() ? teamDoc.data() : null;

      // Update tournament document
      await updateDoc(doc(db, "tournament", id), {
        teamsQualified: arrayUnion(teamID),
      });

      // Update local tournament state
      setTournament((prev) => ({
        ...prev,
        teamsQualified: [...(prev.teamsQualified || []), teamID],
      }));

      // Immediately add team data to teamsData so federationID shows right away
      if (teamData) {
        setTeamsData((prev) => ({
          ...prev,
          [teamID]: teamData,
        }));
      }

      alert("Team registered successfully!");
    } catch (error) {
      console.error("Registration error:", error);
      alert("Failed to register team");
    }
  };

  // Start tournament
  const startTournament = async () => {
    if ((tournament.teamsQualified || []).length !== 8) {
      alert("Tournament must have exactly 8 teams to start");
      return;
    }

    setUpdating(true);
    try {
      const teams = tournament.teamsQualified;

      // Create quarter final matchups
      const quarterFinals = [
        { teams: [teams[0], teams[7]], stage: "Quarter Finals" },
        { teams: [teams[3], teams[4]], stage: "Quarter Finals" },
        { teams: [teams[1], teams[6]], stage: "Quarter Finals" },
        { teams: [teams[2], teams[5]], stage: "Quarter Finals" },
      ];

      // Create matches in database
      for (const qf of quarterFinals) {
        await addDoc(collection(db, "matches"), {
          team1ID: qf.teams[0],
          team2ID: qf.teams[1],
          stage: "Quarter Finals",
          tournamentID: id,
          score: { team1: 0, team2: 0 },
          simulated: false,
          winnerID: "",
          status: "upcoming",
          date: new Date(),
          commentary: [""],
        });
      }

      // Update tournament
      await updateDoc(doc(db, "tournament", id), {
        stage: "Quarter Finals",
        bracket: {
          quarterFinals,
          semiFinals: [
            { teams: ["TBD", "TBD"], stage: "Semi Finals" },
            { teams: ["TBD", "TBD"], stage: "Semi Finals" },
          ],
          final: [{ teams: ["TBD", "TBD"], stage: "Final" }],
          champion: null,
        },
      });

      alert("Tournament started!");
    } catch (error) {
      console.error("Error starting tournament:", error);
      alert("Failed to start tournament");
    } finally {
      setUpdating(false);
    }
  };

  // Reset tournament
  const resetTournament = async () => {
    if (!window.confirm("Reset tournament? All progress will be lost.")) return;

    try {
      // Delete all matches
      const matchesQuery = query(
        collection(db, "matches"),
        where("tournamentID", "==", id)
      );
      const snapshot = await getDocs(matchesQuery);
      await Promise.all(snapshot.docs.map((doc) => deleteDoc(doc.ref)));

      // Reset tournament
      await updateDoc(doc(db, "tournament", id), {
        stage: "Registration",
        bracket: {
          quarterFinals: [],
          semiFinals: [],
          final: [],
          champion: null,
        },
      });

      setMatches([]);
      alert("Tournament reset successfully!");
    } catch (error) {
      console.error("Reset error:", error);
      alert("Failed to reset tournament");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loader border-t-4 border-blue-500 rounded-full w-12 h-12 animate-spin"></div>
      </div>
    );
  }

  if (!tournament) {
    return <p className="text-center mt-20 text-lg">Tournament not found</p>;
  }

  const teams = tournament.teamsQualified || [];
  const canRegister = teams.length < 8;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-lg shadow-lg mb-6">
        <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
        <p className="text-lg">
          Stage:{" "}
          <span className="font-semibold">
            {tournament.stage || "Registration"}
          </span>
        </p>
      </div>

      {user?.role === "admin" && (
        <div className="flex flex-wrap gap-4 mb-6">
          {teams.length === 8 && !tournament.bracket?.quarterFinals?.length && (
            <button
              onClick={startTournament}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              Start Tournament
            </button>
          )}
          {tournament.bracket?.quarterFinals?.length > 0 && (
            <button
              onClick={resetTournament}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Reset Tournament
            </button>
          )}
        </div>
      )}

      {/* Teams */}
      <h2 className="text-2xl font-semibold mb-4">Teams</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
        {teams.map((teamId) => (
          <Link
            key={teamId}
            to={`/teamPage/${teamId}`}
            className="bg-white border rounded-xl p-6 shadow-lg hover:shadow-2xl transition flex flex-col justify-between"
          >
            <h3 className="text-xl font-bold mb-2">
              {teamsData[teamId]?.federationID || "Loading..."}
            </h3>
            <p className="text-gray-600">Team</p>
          </Link>
        ))}
        {canRegister && (
          <div
            onClick={() => {
              if (user?.teamID) {
                registerTeam(user.teamID);
              } else {
                alert("You need to create a team first!");
                navigate("/register-team");
              }
            }}
            className="border-2 border-dashed border-blue-400 rounded-xl p-6 flex items-center justify-center cursor-pointer text-blue-600 font-bold text-lg hover:bg-blue-50 transition"
          >
            + {user?.teamID ? "Register My Team" : "Create Team to Register"}
          </div>
        )}
      </div>

      {/* Matches */}
      <h2 className="text-2xl font-semibold mb-6">Tournament Matches</h2>

      {/* Quarter Finals Section */}
      {matches.filter((match) => match.stage === "Quarter Finals").length >
        0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-indigo-700 border-b border-indigo-200 pb-2">
            🏆 Quarter Finals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches
              .filter((match) => match.stage === "Quarter Finals")
              .map((match) => (
                <Link
                  key={match.id}
                  to={`/match/${match.id}`}
                  className={`p-4 rounded-lg shadow flex justify-between items-center transition ${
                    match.simulated
                      ? "bg-green-50 border-l-4 border-green-500 hover:bg-green-100"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">
                      {teamsData[match.team1ID]?.federationID || match.team1ID}
                    </span>
                    {match.simulated && match.score ? (
                      <span className="text-lg font-bold text-green-700">
                        {match.score.team1}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-600">vs</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    {match.simulated && match.score ? (
                      <span className="text-lg font-bold text-green-700">
                        {match.score.team2}
                      </span>
                    ) : null}
                    <span className="font-medium">
                      {teamsData[match.team2ID]?.federationID || match.team2ID}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!match.simulated && (
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                        UPCOMING
                      </span>
                    )}
                    {match.simulated && (
                      <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                        COMPLETED
                      </span>
                    )}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Semi Finals Section */}
      {matches.filter((match) => match.stage === "Semi Finals").length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-purple-700 border-b border-purple-200 pb-2">
            🥈 Semi Finals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches
              .filter((match) => match.stage === "Semi Finals")
              .map((match) => (
                <Link
                  key={match.id}
                  to={`/match/${match.id}`}
                  className={`p-4 rounded-lg shadow flex justify-between items-center transition ${
                    match.simulated
                      ? "bg-green-50 border-l-4 border-green-500 hover:bg-green-100"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="font-medium">
                      {teamsData[match.team1ID]?.federationID || match.team1ID}
                    </span>
                    {match.simulated && match.score ? (
                      <span className="text-lg font-bold text-green-700">
                        {match.score.team1}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-600">vs</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    {match.simulated && match.score ? (
                      <span className="text-lg font-bold text-green-700">
                        {match.score.team2}
                      </span>
                    ) : null}
                    <span className="font-medium">
                      {teamsData[match.team2ID]?.federationID || match.team2ID}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!match.simulated && (
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                        UPCOMING
                      </span>
                    )}
                    {match.simulated && (
                      <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">
                        COMPLETED
                      </span>
                    )}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Final Section */}
      {matches.filter((match) => match.stage === "Final").length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-golden-700 border-b border-yellow-300 pb-2">
            🥇 Final
          </h3>
          <div className="flex justify-center">
            {matches
              .filter((match) => match.stage === "Final")
              .map((match) => (
                <Link
                  key={match.id}
                  to={`/match/${match.id}`}
                  className={`p-6 rounded-lg shadow-lg flex justify-between items-center transition max-w-2xl w-full ${
                    match.simulated
                      ? "bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 hover:from-yellow-100 hover:to-yellow-200"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200"
                  }`}
                >
                  <div className="flex items-center space-x-6">
                    <span className="font-bold text-lg">
                      {teamsData[match.team1ID]?.federationID || match.team1ID}
                    </span>
                    {match.simulated && match.score ? (
                      <span className="text-2xl font-bold text-green-700">
                        {match.score.team1}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="font-bold text-gray-600 text-lg">vs</span>
                  </div>

                  <div className="flex items-center space-x-6">
                    {match.simulated && match.score ? (
                      <span className="text-2xl font-bold text-green-700">
                        {match.score.team2}
                      </span>
                    ) : null}
                    <span className="font-bold text-lg">
                      {teamsData[match.team2ID]?.federationID || match.team2ID}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!match.simulated && (
                      <span className="text-sm bg-yellow-200 text-yellow-800 px-3 py-2 rounded-full font-semibold">
                        CHAMPIONSHIP MATCH
                      </span>
                    )}
                    {match.simulated && (
                      <span className="text-sm bg-green-200 text-green-800 px-3 py-2 rounded-full font-semibold">
                        CHAMPION DECIDED!
                      </span>
                    )}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* No matches message */}
      {matches.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">
            Tournament has not yet started.
          </p>
        </div>
      )}

      {/* Bracket */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Tournament Bracket</h2>
        <div className="bg-gray-50 rounded-xl shadow-inner p-8 overflow-x-auto">
          <div style={{ minWidth: "1400px" }}>
            <Bracket
              rounds={
                tournament.bracket?.quarterFinals
                  ? [
                      {
                        title: "Quarter Finals",
                        seeds: tournament.bracket.quarterFinals.map((q, i) => ({
                          id: i + 1,
                          teams: [
                            {
                              name:
                                teamsData[q.teams[0]]?.federationID ||
                                q.teams[0] ||
                                "TBD",
                            },
                            {
                              name:
                                teamsData[q.teams[1]]?.federationID ||
                                q.teams[1] ||
                                "TBD",
                            },
                          ],
                        })),
                      },
                      {
                        title: "Semi Finals",
                        seeds: tournament.bracket.semiFinals.map((s, i) => ({
                          id: i + 5,
                          teams: [
                            {
                              name:
                                teamsData[s.teams[0]]?.federationID ||
                                s.teams[0] ||
                                "TBD",
                            },
                            {
                              name:
                                teamsData[s.teams[1]]?.federationID ||
                                s.teams[1] ||
                                "TBD",
                            },
                          ],
                        })),
                      },
                      {
                        title: "Final",
                        seeds: tournament.bracket.final.map((f, i) => ({
                          id: i + 7,
                          teams: [
                            {
                              name:
                                teamsData[f.teams[0]]?.federationID ||
                                f.teams[0] ||
                                "TBD",
                            },
                            {
                              name:
                                teamsData[f.teams[1]]?.federationID ||
                                f.teams[1] ||
                                "TBD",
                            },
                          ],
                        })),
                      },
                      {
                        title: "Winner",
                        seeds: [
                          {
                            id: 8,
                            teams: [
                              {
                                name: tournament.bracket?.champion || "TBD",
                              },
                            ],
                          },
                        ],
                      },
                    ]
                  : []
              }
              renderSeedComponent={({ seed, breakpoint }) => (
                <Seed key={seed.id} seed={seed} breakpoint={breakpoint}>
                  <SeedItem
                    style={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px",
                      margin: "4px 0",
                      minWidth: "240px",
                      textAlign: "center",
                    }}
                  >
                    {seed.teams.length === 2 ? (
                      <>
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#374151",
                            marginBottom: "8px",
                          }}
                        >
                          {seed.teams[0].name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          vs
                        </div>
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#374151",
                            marginTop: "8px",
                          }}
                        >
                          {seed.teams[1].name}
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          fontWeight: "bold",
                          color: "#10B981", // green for winner
                        }}
                      >
                        {seed.teams[0].name}
                      </div>
                    )}
                  </SeedItem>
                </Seed>
              )}
              swipeableProps={{ enableMouseEvents: true, animateHeight: true }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
