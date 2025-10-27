import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authUser = auth.currentUser;
        if (!authUser) return;

        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (!userDoc.exists()) return;
        const userData = userDoc.data();
        setUser({ uid: authUser.uid, ...userData });

        if (!userData.teamID) navigate("/register-team");

        const tournamentDoc = await getDoc(doc(db, "tournament", id));
        if (!tournamentDoc.exists()) return;
        const tournamentData = {
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        };
        setTournament(tournamentData);

        if (tournamentData.teamsQualified) {
          const teamDataResults = await Promise.all(
            tournamentData.teamsQualified.map(async (teamId) => {
              try {
                const teamDoc = await getDoc(doc(db, "teams", teamId));
                if (teamDoc.exists()) {
                  const teamData = teamDoc.data();
                  console.log(`Team ${teamId} data:`, teamData); // Debug log
                  return { [teamId]: teamData };
                } else {
                  console.warn(`Team document not found for teamId: ${teamId}`);
                  return null; // Don't include teams that don't exist
                }
              } catch (error) {
                console.error(`Error fetching team ${teamId}:`, error);
                return null;
              }
            })
          );

          // Filter out null results and merge the valid team data
          const validTeamData = teamDataResults.filter(
            (result) => result !== null
          );
          const teamsDataObject = validTeamData.reduce(
            (acc, curr) => ({ ...acc, ...curr }),
            {}
          );
          console.log("Final teamsData object:", teamsDataObject); // Debug log
          setTeamsData(teamsDataObject);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const registerTeam = async (teamID) => {
    if (!teamID || !tournament) return;
    if (tournament.teamsQualified?.includes(teamID)) {
      alert("Your team is already registered");
      return;
    }
    try {
      const tournamentRef = doc(db, "tournament", id);
      await updateDoc(tournamentRef, { teamsQualified: arrayUnion(teamID) });

      const updatedTeamsQualified = [
        ...(tournament.teamsQualified || []),
        teamID,
      ];

      setTournament((prev) => ({
        ...prev,
        teamsQualified: updatedTeamsQualified,
      }));

      // Refresh all teams data to ensure consistency
      try {
        const teamDataResults = await Promise.all(
          updatedTeamsQualified.map(async (teamId) => {
            try {
              const teamDoc = await getDoc(doc(db, "teams", teamId));
              if (teamDoc.exists()) {
                const teamData = teamDoc.data();
                console.log(`Refreshed team ${teamId} data:`, teamData);
                return { [teamId]: teamData };
              } else {
                console.warn(`Team document not found for teamId: ${teamId}`);
                return null;
              }
            } catch (error) {
              console.error(`Error fetching team ${teamId}:`, error);
              return null;
            }
          })
        );

        // Filter out null results and merge the valid team data
        const validTeamData = teamDataResults.filter(
          (result) => result !== null
        );
        const refreshedTeamsData = validTeamData.reduce(
          (acc, curr) => ({ ...acc, ...curr }),
          {}
        );
        console.log("Refreshed all teams data:", refreshedTeamsData);
        setTeamsData(refreshedTeamsData);
      } catch (teamError) {
        console.error("Error refreshing teams data:", teamError);
      }

      alert("Team registered successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to register team");
    }
  };

  const startTournament = async () => {
    if (!tournament || (tournament.teamsQualified || []).length !== 8) {
      alert("Tournament must have exactly 8 teams to start");
      return;
    }

    try {
      const teams = tournament.teamsQualified;
      const quarterFinals = [
        { matchId: "match1", teams: [teams[0], teams[7]] },
        { matchId: "match2", teams: [teams[3], teams[4]] },
        { matchId: "match3", teams: [teams[1], teams[6]] },
        { matchId: "match4", teams: [teams[2], teams[5]] },
      ];

      const semiFinals = [
        { matchId: "semi1", teams: ["Winner of match1", "Winner of match2"] },
        { matchId: "semi2", teams: ["Winner of match3", "Winner of match4"] },
      ];

      const final = [
        { matchId: "final", teams: ["Winner of semi1", "Winner of semi2"] },
      ];

      const bracket = { quarterFinals, semiFinals, final, champion: null };

      const tournamentRef = doc(db, "tournament", id);
      await updateDoc(tournamentRef, { stage: "Quarter Finals", bracket });
      setTournament((prev) => ({ ...prev, stage: "Quarter Finals", bracket }));

      alert("Tournament started! Brackets have been seeded.");
    } catch (err) {
      console.error(err);
      alert("Failed to start tournament");
    }
  };

  const resetTournament = async () => {
    if (!tournament) return;
    if (
      !window.confirm(
        "Are you sure you want to reset the tournament? All progress will be lost."
      )
    )
      return;

    try {
      const tournamentRef = doc(db, "tournament", id);
      await updateDoc(tournamentRef, {
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
      alert("Tournament has been reset.");
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

  // Prepare complete bracket rounds for react-brackets - always show full tournament
  const rounds = [
    {
      title: "Quarter Finals",
      seeds: [
        {
          id: 1,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.quarterFinals?.[0]?.teams?.[0]
                ? typeof tournament.bracket.quarterFinals[0].teams[0] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[0].teams[0]]
                  ? teamsData[tournament.bracket.quarterFinals[0].teams[0]]
                      ?.federationID ||
                    teamsData[tournament.bracket.quarterFinals[0].teams[0]]
                      ?.name ||
                    teamsData[tournament.bracket.quarterFinals[0].teams[0]]
                      ?.federation ||
                    tournament.bracket.quarterFinals[0].teams[0]
                  : tournament.bracket.quarterFinals[0].teams[0]
                : "TBD",
            },
            {
              name: tournament.bracket?.quarterFinals?.[0]?.teams?.[1]
                ? typeof tournament.bracket.quarterFinals[0].teams[1] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[0].teams[1]]
                  ? teamsData[tournament.bracket.quarterFinals[0].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[0].teams[1]
                : "TBD",
            },
          ],
        },
        {
          id: 2,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.quarterFinals?.[1]?.teams?.[0]
                ? typeof tournament.bracket.quarterFinals[1].teams[0] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[1].teams[0]]
                  ? teamsData[tournament.bracket.quarterFinals[1].teams[0]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[1].teams[0]
                : "TBD",
            },
            {
              name: tournament.bracket?.quarterFinals?.[1]?.teams?.[1]
                ? typeof tournament.bracket.quarterFinals[1].teams[1] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[1].teams[1]]
                  ? teamsData[tournament.bracket.quarterFinals[1].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[1].teams[1]
                : "TBD",
            },
          ],
        },
        {
          id: 3,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.quarterFinals?.[2]?.teams?.[0]
                ? typeof tournament.bracket.quarterFinals[2].teams[0] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[2].teams[0]]
                  ? teamsData[tournament.bracket.quarterFinals[2].teams[0]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[2].teams[0]
                : "TBD",
            },
            {
              name: tournament.bracket?.quarterFinals?.[2]?.teams?.[1]
                ? typeof tournament.bracket.quarterFinals[2].teams[1] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[2].teams[1]]
                  ? teamsData[tournament.bracket.quarterFinals[2].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[2].teams[1]
                : "TBD",
            },
          ],
        },
        {
          id: 4,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.quarterFinals?.[3]?.teams?.[0]
                ? typeof tournament.bracket.quarterFinals[3].teams[0] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[3].teams[0]]
                  ? teamsData[tournament.bracket.quarterFinals[3].teams[0]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[3].teams[0]
                : "TBD",
            },
            {
              name: tournament.bracket?.quarterFinals?.[3]?.teams?.[1]
                ? typeof tournament.bracket.quarterFinals[3].teams[1] ===
                    "string" &&
                  teamsData[tournament.bracket.quarterFinals[3].teams[1]]
                  ? teamsData[tournament.bracket.quarterFinals[3].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.quarterFinals[3].teams[1]
                : "TBD",
            },
          ],
        },
      ],
    },
    {
      title: "Semi Finals",
      seeds: [
        {
          id: 5,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.semiFinals?.[0]?.teams?.[0]
                ? typeof tournament.bracket.semiFinals[0].teams[0] ===
                    "string" &&
                  teamsData[tournament.bracket.semiFinals[0].teams[0]]
                  ? teamsData[tournament.bracket.semiFinals[0].teams[0]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.semiFinals[0].teams[0]
                : "Winner of Match 1",
            },
            {
              name: tournament.bracket?.semiFinals?.[0]?.teams?.[1]
                ? typeof tournament.bracket.semiFinals[0].teams[1] ===
                    "string" &&
                  teamsData[tournament.bracket.semiFinals[0].teams[1]]
                  ? teamsData[tournament.bracket.semiFinals[0].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.semiFinals[0].teams[1]
                : "Winner of Match 2",
            },
          ],
        },
        {
          id: 6,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.semiFinals?.[1]?.teams?.[0]
                ? typeof tournament.bracket.semiFinals[1].teams[0] ===
                    "string" &&
                  teamsData[tournament.bracket.semiFinals[1].teams[0]]
                  ? teamsData[tournament.bracket.semiFinals[1].teams[0]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.semiFinals[1].teams[0]
                : "Winner of Match 3",
            },
            {
              name: tournament.bracket?.semiFinals?.[1]?.teams?.[1]
                ? typeof tournament.bracket.semiFinals[1].teams[1] ===
                    "string" &&
                  teamsData[tournament.bracket.semiFinals[1].teams[1]]
                  ? teamsData[tournament.bracket.semiFinals[1].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.semiFinals[1].teams[1]
                : "Winner of Match 4",
            },
          ],
        },
      ],
    },
    {
      title: "Final",
      seeds: [
        {
          id: 7,
          date: new Date().toDateString(),
          teams: [
            {
              name: tournament.bracket?.final?.[0]?.teams?.[0]
                ? typeof tournament.bracket.final[0].teams[0] === "string" &&
                  teamsData[tournament.bracket.final[0].teams[0]]
                  ? teamsData[tournament.bracket.final[0].teams[0]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.final[0].teams[0]
                : "Winner of Semi 1",
            },
            {
              name: tournament.bracket?.final?.[0]?.teams?.[1]
                ? typeof tournament.bracket.final[0].teams[1] === "string" &&
                  teamsData[tournament.bracket.final[0].teams[1]]
                  ? teamsData[tournament.bracket.final[0].teams[1]]
                      ?.federationID || "Unknown"
                  : tournament.bracket.final[0].teams[1]
                : "Winner of Semi 2",
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Tournament Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-lg shadow-lg mb-6">
        <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
        <p className="text-lg">
          Stage:{" "}
          <span className="font-semibold">
            {tournament.stage || "Registration"}
          </span>
        </p>
      </div>

      {/* Admin Controls */}
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

      {/* Teams Section */}
      <h2 className="text-2xl font-semibold mb-4">Teams</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
        {teams.map((teamId) => (
          <Link
            to={`/teamPage/${teamId}`}
            key={teamId}
            className="bg-white border rounded-xl p-6 shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1 flex flex-col justify-between"
          >
            <h3 className="text-xl font-bold mb-2">
              {teamsData[teamId]?.federationID ||
                teamsData[teamId]?.name ||
                teamsData[teamId]?.federation ||
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

      {/* Bracket Section - Always Show Complete Tournament */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Tournament Bracket</h2>
        {/* React Brackets Implementation */}
        <div className="bg-gray-50 rounded-xl shadow-inner p-8 overflow-x-auto">
          <div style={{ minWidth: "1400px" }}>
            <Bracket
              rounds={rounds}
              renderSeedComponent={({
                seed,
                breakpoint,
                roundIndex,
                seedIndex,
              }) => (
                <Seed key={seed.id} seed={seed} breakpoint={breakpoint}>
                  <SeedItem
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px",
                      margin: "4px 0",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      minWidth: "240px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "8px",
                        color:
                          seed.teams[0]?.name === "TBD" ||
                          seed.teams[0]?.name?.includes("Winner")
                            ? "#9ca3af"
                            : "#374151",
                      }}
                    >
                      {seed.teams[0]?.name || "TBD"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>vs</div>
                    <div
                      style={{
                        fontWeight: "bold",
                        marginTop: "8px",
                        color:
                          seed.teams[1]?.name === "TBD" ||
                          seed.teams[1]?.name?.includes("Winner")
                            ? "#9ca3af"
                            : "#374151",
                      }}
                    >
                      {seed.teams[1]?.name || "TBD"}
                    </div>
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
