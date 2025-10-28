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

  // Fetch data once auth is ready
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!authUser) {
        navigate("/login");
        return;
      }

      try {
        // Fetch user
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (!userDoc.exists()) return;
        const userData = userDoc.data();
        setUser({ uid: authUser.uid, ...userData });

        if (!userData.teamID) navigate("/register-team");

        // Fetch tournament
        const tournamentDoc = await getDoc(doc(db, "tournament", id));
        if (!tournamentDoc.exists()) return;
        const tournamentData = {
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        };
        setTournament(tournamentData);

        // Fetch teams
        if (tournamentData.teamsQualified?.length > 0) {
          const teamDocs = await Promise.all(
            tournamentData.teamsQualified.map(async (teamId) => {
              const docSnap = await getDoc(doc(db, "teams", teamId));
              return docSnap.exists() ? { [teamId]: docSnap.data() } : null;
            })
          );
          const validTeams = teamDocs.filter((t) => t !== null);
          setTeamsData(
            validTeams.reduce((acc, curr) => ({ ...acc, ...curr }), {})
          );
        }

        // Fetch matches for this tournament
        const matchesQuery = query(
          collection(db, "matches"),
          where("tournamentID", "==", tournamentData.id)
        );
        const matchSnapshot = await getDocs(matchesQuery);
        setMatches(
          matchSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, navigate]);

  // Register user team
  const registerTeam = async (teamID) => {
    if (!teamID || !tournament) return;
    if (tournament.teamsQualified?.includes(teamID)) {
      alert("Your team is already registered");
      return;
    }
    try {
      // Update tournament in Firestore
      const tournamentRef = doc(db, "tournament", id);
      await updateDoc(tournamentRef, { teamsQualified: arrayUnion(teamID) });

      // Fetch newly registered team data
      const teamDoc = await getDoc(doc(db, "teams", teamID));
      const teamData = teamDoc.exists() ? { [teamID]: teamDoc.data() } : {};

      // Update local state immediately
      setTournament((prev) => ({
        ...prev,
        teamsQualified: [...(prev.teamsQualified || []), teamID],
      }));
      setTeamsData((prev) => ({ ...prev, ...teamData }));

      alert("Team registered successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to register team");
    }
  };
  // Create a match
  const createMatch = async (team1ID, team2ID, stage) => {
    try {
      const matchRef = await addDoc(collection(db, "matches"), {
        commentary: [""],
        date: new Date(),
        score: { team1: 0, team2: 0 },
        simulated: false,
        stage,
        status: "upcoming",
        team1ID,
        team2ID,
        winnerID: "",
        tournamentID: tournament.id,
      });
      setMatches((prev) => [
        ...prev,
        { id: matchRef.id, team1ID, team2ID, stage },
      ]);
      return matchRef.id;
    } catch (err) {
      console.error("Error creating match:", err);
    }
  };

  // Start tournament
  const startTournament = async () => {
    if (!tournament || (tournament.teamsQualified || []).length !== 8) {
      alert("Tournament must have exactly 8 teams to start");
      return;
    }

    const teams = tournament.teamsQualified;

    // Quarter Finals
    const quarterFinals = [
      { teams: [teams[0], teams[7]], stage: "Quarter Finals" },
      { teams: [teams[3], teams[4]], stage: "Quarter Finals" },
      { teams: [teams[1], teams[6]], stage: "Quarter Finals" },
      { teams: [teams[2], teams[5]], stage: "Quarter Finals" },
    ];

    const semiFinals = [
      { teams: ["TBD", "TBD"], stage: "Semi Finals" },
      { teams: ["TBD", "TBD"], stage: "Semi Finals" },
    ];

    const final = [{ teams: ["TBD", "TBD"], stage: "Final" }];

    const winner = "TBD";

    const createdMatches = [];

    // Create Quarter Final matches in Firestore
    for (const qf of quarterFinals) {
      const matchId = await createMatch(qf.teams[0], qf.teams[1], qf.stage);
      createdMatches.push({ id: matchId, ...qf });
    }

    // Update tournament document with bracket skeleton
    await updateDoc(doc(db, "tournament", id), {
      stage: "Quarter Finals",
      bracket: {
        quarterFinals,
        semiFinals,
        final,
        champion: winner,
      },
    });

    // Ensure team data is fully loaded before updating tournament state
    if (Object.keys(teamsData).length !== teams.length) {
      // Re-fetch team data to ensure all teams are loaded
      const teamDocs = await Promise.all(
        teams.map(async (teamId) => {
          const docSnap = await getDoc(doc(db, "teams", teamId));
          return docSnap.exists() ? { [teamId]: docSnap.data() } : null;
        })
      );
      const validTeams = teamDocs.filter((t) => t !== null);
      const updatedTeamsData = validTeams.reduce(
        (acc, curr) => ({ ...acc, ...curr }),
        {}
      );
      setTeamsData(updatedTeamsData);
    }

    setTournament((prev) => ({
      ...prev,
      stage: "Quarter Finals",
      bracket: {
        quarterFinals,
        semiFinals,
        final,
        champion: null,
      },
    }));

    // Update local matches state
    setMatches(createdMatches);

    alert(
      "Tournament started! Quarter Final matches created with bracket skeleton."
    );
  };

  // Reset tournament (delete matches only)
  const resetTournament = async () => {
    if (!window.confirm("Reset tournament? All progress will be lost.")) return;

    try {
      // Delete all matches for this tournament
      const matchesQuery = query(
        collection(db, "matches"),
        where("tournamentID", "==", tournament.id)
      );
      const matchSnapshot = await getDocs(matchesQuery);
      const deletePromises = matchSnapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, "matches", docSnap.id))
      );
      await Promise.all(deletePromises);

      // Reset tournament stage and bracket
      await updateDoc(doc(db, "tournament", id), {
        stage: "Registration",
        bracket: {
          quarterFinals: [],
          semiFinals: [],
          final: [],
          champion: null,
        },
      });

      setTournament((prev) => ({
        ...prev,
        stage: "Registration",
        bracket: {
          quarterFinals: [],
          semiFinals: [],
          final: [],
          champion: null,
        },
      }));

      setMatches([]);
      alert("Tournament reset! Matches deleted, teams remain.");
    } catch (err) {
      console.error(err);
      alert("Failed to reset tournament.");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="loader border-t-4 border-blue-500 rounded-full w-12 h-12 animate-spin"></div>
      </div>
    );

  if (!tournament)
    return <p className="text-center mt-20 text-lg">Tournament not found</p>;

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
              {teamsData[teamId]?.federationID ||
                teamsData[teamId]?.name ||
                teamId}
            </h3>
            <p className="text-gray-600">
              {teamsData[teamId]?.name || `Team ${teamId}`}
            </p>
          </Link>
        ))}
        {canRegister && (
          <div
            onClick={() => registerTeam(user.teamID)}
            className="border-2 border-dashed border-blue-400 rounded-xl p-6 flex items-center justify-center cursor-pointer text-blue-600 font-bold text-lg hover:bg-blue-50 transition"
          >
            + Register My Team
          </div>
        )}
      </div>
      {/* Matches */}
      <h2 className="text-2xl font-semibold mb-4">Matches</h2>
      <div className="space-y-4 mb-8">
        {matches.map((match) => (
          <Link
            key={match.id}
            to={`/match/${match.id}`} // navigate to match page
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
              <span className="text-sm text-gray-500">{match.stage}</span>
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
      </div>{" "}
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
                          teams: [{ name: s.teams[0] }, { name: s.teams[1] }],
                        })),
                      },
                      {
                        title: "Final",
                        seeds: tournament.bracket.final.map((f, i) => ({
                          id: i + 7,
                          teams: [{ name: f.teams[0] }, { name: f.teams[1] }],
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
