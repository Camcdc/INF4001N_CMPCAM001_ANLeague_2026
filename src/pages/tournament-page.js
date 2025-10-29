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
  const [isUpdatingTournament, setIsUpdatingTournament] = useState(false);

  // Fetch data once auth is ready
  useEffect(() => {
    // Skip if we're in the middle of updating tournament
    if (isUpdatingTournament) {
      console.log("Skipping useEffect - tournament update in progress");
      return;
    }

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

        // Fetch tournament
        const tournamentDoc = await getDoc(doc(db, "tournament", id));
        if (!tournamentDoc.exists()) return;
        let tournamentData = {
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        };

        // Fetch teams and clean up invalid ones
        let validTeamIds = [];
        let teamsData = {};

        if (tournamentData.teamsQualified?.length > 0) {
          const teamDocs = await Promise.all(
            tournamentData.teamsQualified.map(async (teamId) => {
              try {
                const docSnap = await getDoc(doc(db, "teams", teamId));
                if (docSnap.exists()) {
                  return { [teamId]: docSnap.data() };
                } else {
                  console.warn(
                    `Team ${teamId} not found in tournament ${tournamentData.id}`
                  );
                  return null;
                }
              } catch (error) {
                console.error(`Error fetching team ${teamId}:`, error);
                return null;
              }
            })
          );
          const validTeams = teamDocs.filter((t) => t !== null);
          teamsData = validTeams.reduce(
            (acc, curr) => ({ ...acc, ...curr }),
            {}
          );
          validTeamIds = validTeams.map((team) => Object.keys(team)[0]);

          // If we found invalid teams, clean up the database and update tournamentData
          if (validTeamIds.length !== tournamentData.teamsQualified.length) {
            console.log("Cleaning up tournament teams list...");
            // Update tournament to remove invalid team IDs
            await updateDoc(doc(db, "tournament", id), {
              teamsQualified: validTeamIds,
            });
            // Update our local tournamentData before setting state
            tournamentData.teamsQualified = validTeamIds;
          }
        }

        // Set state with cleaned data
        setTournament(tournamentData);
        setTeamsData(teamsData);

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
  }, [id, navigate, isUpdatingTournament]);

  // Monitor matches and update bracket based on wins
  useEffect(() => {
    console.log("🎯 Bracket update useEffect triggered");
    console.log("Tournament:", !!tournament);
    console.log("Matches length:", matches.length);
    console.log("IsUpdating:", isUpdatingTournament);

    if (!tournament) {
      console.log("❌ No tournament data");
      return;
    }

    if (!matches.length) {
      console.log("❌ No matches data");
      return;
    }

    if (isUpdatingTournament) {
      console.log("❌ Tournament update in progress");
      return;
    }

    console.log("🔍 Checking bracket updates...");
    console.log("Tournament stage:", tournament.stage);
    console.log("Tournament bracket:", tournament.bracket);

    const updateBracketWithWinners = async () => {
      try {
        let bracketUpdated = false;
        const updatedBracket = { ...tournament.bracket };

        // Check Quarter Finals for completed matches
        if (
          tournament.stage === "Quarter Finals" &&
          updatedBracket?.quarterFinals
        ) {
          console.log("📊 Checking Quarter Finals...");
          const qfWinners = [];
          let allQFComplete = true;

          for (let i = 0; i < updatedBracket.quarterFinals.length; i++) {
            const qfMatch = updatedBracket.quarterFinals[i];
            console.log(`QF Match ${i + 1}:`, qfMatch);

            // More detailed search for matches
            console.log(
              "All matches in database:",
              matches.map((m) => ({
                id: m.id,
                team1ID: m.team1ID,
                team2ID: m.team2ID,
                stage: m.stage,
                simulated: m.simulated,
                winnerID: m.winnerID,
                tournamentID: m.tournamentID,
              }))
            );

            const matchResult = matches.find(
              (m) =>
                m.team1ID === qfMatch.teams[0] &&
                m.team2ID === qfMatch.teams[1] &&
                m.stage === "Quarter Finals" &&
                m.winnerID &&
                m.winnerID.trim() !== ""
            );

            // Also try reverse team order in case teams were swapped
            const reverseMatchResult = matches.find(
              (m) =>
                m.team1ID === qfMatch.teams[1] &&
                m.team2ID === qfMatch.teams[0] &&
                m.stage === "Quarter Finals" &&
                m.winnerID &&
                m.winnerID.trim() !== ""
            );

            const finalMatchResult = matchResult || reverseMatchResult;
            console.log(`QF Match ${i + 1} result:`, finalMatchResult);

            if (finalMatchResult) {
              // Use the winnerID directly from the match document
              const winnerTeamId = finalMatchResult.winnerID;
              console.log(`QF Match ${i + 1} winner:`, winnerTeamId);
              qfWinners.push(winnerTeamId);
            } else {
              allQFComplete = false;
              qfWinners.push("TBD");
              console.log(`QF Match ${i + 1} not completed yet`);
            }
          }

          console.log("QF Winners:", qfWinners);
          console.log("All QF Complete:", allQFComplete);

          // Update Semi Finals if all Quarter Finals are complete
          if (allQFComplete && qfWinners.every((w) => w !== "TBD")) {
            console.log(
              "✅ All Quarter Finals complete! Updating Semi Finals..."
            );
            updatedBracket.semiFinals = [
              { teams: [qfWinners[0], qfWinners[1]], stage: "Semi Finals" },
              { teams: [qfWinners[2], qfWinners[3]], stage: "Semi Finals" },
            ];
            bracketUpdated = true;

            // Create Semi Final matches
            for (const sf of updatedBracket.semiFinals) {
              const existingMatch = matches.find(
                (m) =>
                  m.team1ID === sf.teams[0] &&
                  m.team2ID === sf.teams[1] &&
                  m.stage === "Semi Finals"
              );
              if (!existingMatch) {
                console.log("Creating Semi Final match:", sf);
                await createMatch(sf.teams[0], sf.teams[1], "Semi Finals");
              }
            }

            // Update tournament stage
            console.log("Updating tournament stage to Semi Finals");
            await updateDoc(doc(db, "tournament", id), {
              stage: "Semi Finals",
              bracket: updatedBracket,
            });
          }
        }

        // Check Semi Finals for completed matches
        if (tournament.stage === "Semi Finals" && updatedBracket?.semiFinals) {
          const sfWinners = [];
          let allSFComplete = true;

          for (let i = 0; i < updatedBracket.semiFinals.length; i++) {
            const sfMatch = updatedBracket.semiFinals[i];
            const matchResult = matches.find(
              (m) =>
                m.team1ID === sfMatch.teams[0] &&
                m.team2ID === sfMatch.teams[1] &&
                m.stage === "Semi Finals" &&
                m.winnerID &&
                m.winnerID.trim() !== ""
            );

            // Also try reverse team order for semi finals
            const reverseMatchResult = matches.find(
              (m) =>
                m.team1ID === sfMatch.teams[1] &&
                m.team2ID === sfMatch.teams[0] &&
                m.stage === "Semi Finals" &&
                m.winnerID &&
                m.winnerID.trim() !== ""
            );

            const finalMatchResult = matchResult || reverseMatchResult;

            if (finalMatchResult) {
              // Use winnerID directly
              const winnerTeamId = finalMatchResult.winnerID;
              console.log(`SF Match ${i + 1} winner:`, winnerTeamId);
              sfWinners.push(winnerTeamId);
            } else {
              allSFComplete = false;
              sfWinners.push("TBD");
              console.log(`SF Match ${i + 1} not completed yet`);
            }
          }

          // Update Final if all Semi Finals are complete
          if (allSFComplete && sfWinners.every((w) => w !== "TBD")) {
            console.log("All Semi Finals complete! Updating Final...");
            updatedBracket.final = [
              { teams: [sfWinners[0], sfWinners[1]], stage: "Final" },
            ];
            bracketUpdated = true;

            // Create Final match
            const existingFinalMatch = matches.find(
              (m) =>
                m.team1ID === sfWinners[0] &&
                m.team2ID === sfWinners[1] &&
                m.stage === "Final"
            );
            if (!existingFinalMatch) {
              await createMatch(sfWinners[0], sfWinners[1], "Final");
            }

            // Update tournament stage
            await updateDoc(doc(db, "tournament", id), {
              stage: "Final",
              bracket: updatedBracket,
            });
          }
        }

        // Check Final for completion
        if (tournament.stage === "Final" && updatedBracket?.final) {
          const finalMatch = updatedBracket.final[0];
          const matchResult = matches.find(
            (m) =>
              m.team1ID === finalMatch.teams[0] &&
              m.team2ID === finalMatch.teams[1] &&
              m.stage === "Final" &&
              m.winnerID &&
              m.winnerID.trim() !== ""
          );

          // Also try reverse team order for final
          const reverseMatchResult = matches.find(
            (m) =>
              m.team1ID === finalMatch.teams[1] &&
              m.team2ID === finalMatch.teams[0] &&
              m.stage === "Final" &&
              m.winnerID &&
              m.winnerID.trim() !== ""
          );

          const finalMatchResult = matchResult || reverseMatchResult;

          if (finalMatchResult) {
            // Use winnerID directly
            const championTeamId = finalMatchResult.winnerID;

            console.log("Tournament complete! Champion:", championTeamId);
            updatedBracket.champion =
              teamsData[championTeamId]?.federationID || championTeamId;

            // Update tournament as completed
            await updateDoc(doc(db, "tournament", id), {
              stage: "Completed",
              bracket: updatedBracket,
            });
            bracketUpdated = true;
          }
        }

        // Update local tournament state if bracket was updated
        if (bracketUpdated) {
          console.log("🔄 Bracket updated, refreshing tournament data...");

          // Refresh tournament data from database to ensure we have the latest state
          const tournamentDoc = await getDoc(doc(db, "tournament", id));
          if (tournamentDoc.exists()) {
            const updatedTournamentData = {
              id: tournamentDoc.id,
              ...tournamentDoc.data(),
            };
            setTournament(updatedTournamentData);
            console.log("✅ Tournament data refreshed:", updatedTournamentData);
          }
        }
      } catch (error) {
        console.error("Error updating bracket:", error);
      }
    };

    updateBracketWithWinners();
  }, [matches, tournament, teamsData, isUpdatingTournament, id]);

  // Polling for match updates
  useEffect(() => {
    if (!tournament) return;

    const pollMatches = async () => {
      try {
        const matchesQuery = query(
          collection(db, "matches"),
          where("tournamentID", "==", tournament.id)
        );
        const matchSnapshot = await getDocs(matchesQuery);
        const latestMatches = matchSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Only update if matches have changed
        const hasChanges = latestMatches.some((latestMatch) => {
          const existingMatch = matches.find((m) => m.id === latestMatch.id);
          const changed =
            !existingMatch ||
            existingMatch.simulated !== latestMatch.simulated ||
            existingMatch.winnerID !== latestMatch.winnerID ||
            JSON.stringify(existingMatch.score) !==
              JSON.stringify(latestMatch.score) ||
            JSON.stringify(existingMatch.penaltyScore) !==
              JSON.stringify(latestMatch.penaltyScore);

          if (changed) {
            console.log("🔄 Match change detected:", {
              matchId: latestMatch.id,
              existingSimulated: existingMatch?.simulated,
              latestSimulated: latestMatch.simulated,
              existingWinnerID: existingMatch?.winnerID,
              latestWinnerID: latestMatch.winnerID,
              existingScore: existingMatch?.score,
              latestScore: latestMatch.score,
            });
          }

          return changed;
        });

        if (hasChanges) {
          console.log("📊 Match updates detected, refreshing data...");
          console.log(
            "Latest matches:",
            latestMatches.map((m) => ({
              id: m.id,
              teams: `${m.team1ID} vs ${m.team2ID}`,
              simulated: m.simulated,
              score: m.score,
            }))
          );
          setMatches(latestMatches);
        }
      } catch (error) {
        console.error("Error polling matches:", error);
      }
    };

    // Poll every 3 seconds for match updates
    const pollInterval = setInterval(pollMatches, 3000);

    return () => clearInterval(pollInterval);
  }, [tournament, matches]);

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

  // Manual refresh function for testing
  const manualRefresh = async () => {
    console.log("🔄 Manual refresh triggered...");
    try {
      // Refresh tournament data
      const tournamentDoc = await getDoc(doc(db, "tournament", id));
      if (tournamentDoc.exists()) {
        const tournamentData = {
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        };
        setTournament(tournamentData);
        console.log("Tournament refreshed:", tournamentData);
      }

      // Refresh matches data
      const matchesQuery = query(
        collection(db, "matches"),
        where("tournamentID", "==", id)
      );
      const matchSnapshot = await getDocs(matchesQuery);
      const matchesData = matchSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMatches(matchesData);
      console.log("Matches refreshed:", matchesData);

      // Check if any matches are missing winnerID but have scores
      console.log("🔍 Checking matches for missing winnerID...");
      for (const match of matchesData) {
        if (
          match.simulated &&
          (!match.winnerID || match.winnerID.trim() === "")
        ) {
          console.log("⚠️ Match missing winnerID but is simulated:", match);

          // Calculate and set winnerID based on score
          let winnerTeamId;
          if (match.penaltyScore) {
            winnerTeamId =
              match.penaltyScore.team1 > match.penaltyScore.team2
                ? match.team1ID
                : match.team2ID;
          } else {
            winnerTeamId =
              match.score.team1 > match.score.team2
                ? match.team1ID
                : match.team2ID;
          }

          console.log(
            `Setting winnerID to ${winnerTeamId} for match ${match.id}`
          );
          await updateDoc(doc(db, "matches", match.id), {
            winnerID: winnerTeamId,
          });
        }
      }

      alert("Data refreshed successfully!");
    } catch (error) {
      console.error("Error during manual refresh:", error);
      alert("Failed to refresh data");
    }
  };

  // Test bracket update function
  const testBracketUpdate = async () => {
    console.log("🧪 Testing bracket update...");

    if (!tournament || !matches.length) {
      alert("No tournament or matches data available");
      return;
    }

    console.log("Current tournament stage:", tournament.stage);
    console.log("Current matches:", matches);
    console.log(
      "Matches with winnerID:",
      matches.filter((m) => m.winnerID && m.winnerID.trim() !== "")
    );

    // Force trigger the bracket update logic
    try {
      // Check current stage and see what should happen
      if (tournament.stage === "Quarter Finals") {
        const qfMatches = matches.filter((m) => m.stage === "Quarter Finals");
        const completedQF = qfMatches.filter(
          (m) => m.winnerID && m.winnerID.trim() !== ""
        );

        console.log(
          `Quarter Finals: ${completedQF.length}/${qfMatches.length} completed`
        );
        console.log("Completed QF matches:", completedQF);

        if (completedQF.length === 4) {
          alert(
            "All Quarter Finals are complete! Bracket should update to Semi Finals."
          );
        } else {
          alert(
            `${completedQF.length}/4 Quarter Finals completed. Need ${
              4 - completedQF.length
            } more.`
          );
        }
      } else if (tournament.stage === "Semi Finals") {
        const sfMatches = matches.filter((m) => m.stage === "Semi Finals");
        const completedSF = sfMatches.filter(
          (m) => m.winnerID && m.winnerID.trim() !== ""
        );

        console.log(
          `Semi Finals: ${completedSF.length}/${sfMatches.length} completed`
        );

        if (completedSF.length === 2) {
          alert(
            "All Semi Finals are complete! Bracket should update to Final."
          );
        } else {
          alert(
            `${completedSF.length}/2 Semi Finals completed. Need ${
              2 - completedSF.length
            } more.`
          );
        }
      } else if (tournament.stage === "Final") {
        const finalMatches = matches.filter((m) => m.stage === "Final");
        const completedFinal = finalMatches.filter(
          (m) => m.winnerID && m.winnerID.trim() !== ""
        );

        if (completedFinal.length === 1) {
          alert("Final is complete! Tournament should be marked as completed.");
        } else {
          alert("Final not yet completed.");
        }
      }
    } catch (error) {
      console.error("Error testing bracket update:", error);
      alert("Error testing bracket update");
    }
  };

  // Force bracket update function
  const forceBracketUpdate = async () => {
    console.log("🚀 Force bracket update triggered...");

    if (!tournament || !matches.length) {
      alert("No tournament or matches data available");
      return;
    }

    try {
      setIsUpdatingTournament(true);

      let bracketUpdated = false;
      const updatedBracket = { ...tournament.bracket };

      // Force update Quarter Finals to Semi Finals
      if (
        tournament.stage === "Quarter Finals" &&
        updatedBracket?.quarterFinals
      ) {
        console.log("🔄 Force updating Quarter Finals...");

        const qfWinners = [];
        let allQFComplete = true;

        // Check each Quarter Final match
        for (let i = 0; i < updatedBracket.quarterFinals.length; i++) {
          const qfMatch = updatedBracket.quarterFinals[i];
          console.log(`Processing QF Match ${i + 1}:`, qfMatch);

          // Find the match in database
          const matchResult = matches.find(
            (m) =>
              ((m.team1ID === qfMatch.teams[0] &&
                m.team2ID === qfMatch.teams[1]) ||
                (m.team1ID === qfMatch.teams[1] &&
                  m.team2ID === qfMatch.teams[0])) &&
              m.stage === "Quarter Finals" &&
              m.winnerID &&
              m.winnerID.trim() !== ""
          );

          if (matchResult) {
            console.log(`QF Match ${i + 1} winner: ${matchResult.winnerID}`);
            qfWinners.push(matchResult.winnerID);
          } else {
            console.log(`QF Match ${i + 1} not completed`);
            allQFComplete = false;
            qfWinners.push("TBD");
          }
        }

        console.log("QF Winners found:", qfWinners);

        // Force update if all QF are complete
        if (allQFComplete && qfWinners.every((w) => w !== "TBD")) {
          console.log(
            "✅ All Quarter Finals complete! Force updating Semi Finals..."
          );

          updatedBracket.semiFinals = [
            { teams: [qfWinners[0], qfWinners[1]], stage: "Semi Finals" },
            { teams: [qfWinners[2], qfWinners[3]], stage: "Semi Finals" },
          ];
          bracketUpdated = true;

          // Create Semi Final matches if they don't exist
          for (const sf of updatedBracket.semiFinals) {
            const existingMatch = matches.find(
              (m) =>
                ((m.team1ID === sf.teams[0] && m.team2ID === sf.teams[1]) ||
                  (m.team1ID === sf.teams[1] && m.team2ID === sf.teams[0])) &&
                m.stage === "Semi Finals"
            );
            if (!existingMatch) {
              console.log("Creating Semi Final match:", sf);
              await createMatch(sf.teams[0], sf.teams[1], "Semi Finals");
            }
          }

          // Update tournament stage
          await updateDoc(doc(db, "tournament", id), {
            stage: "Semi Finals",
            bracket: updatedBracket,
          });

          alert("Quarter Finals completed! Updated to Semi Finals.");
        } else {
          alert(
            `Only ${
              qfWinners.filter((w) => w !== "TBD").length
            }/4 Quarter Finals completed.`
          );
        }
      }

      // Similar logic for Semi Finals to Final
      else if (
        tournament.stage === "Semi Finals" &&
        updatedBracket?.semiFinals
      ) {
        console.log("🔄 Force updating Semi Finals...");

        const sfWinners = [];
        let allSFComplete = true;

        for (let i = 0; i < updatedBracket.semiFinals.length; i++) {
          const sfMatch = updatedBracket.semiFinals[i];

          const matchResult = matches.find(
            (m) =>
              ((m.team1ID === sfMatch.teams[0] &&
                m.team2ID === sfMatch.teams[1]) ||
                (m.team1ID === sfMatch.teams[1] &&
                  m.team2ID === sfMatch.teams[0])) &&
              m.stage === "Semi Finals" &&
              m.winnerID &&
              m.winnerID.trim() !== ""
          );

          if (matchResult) {
            sfWinners.push(matchResult.winnerID);
          } else {
            allSFComplete = false;
            sfWinners.push("TBD");
          }
        }

        if (allSFComplete && sfWinners.every((w) => w !== "TBD")) {
          updatedBracket.final = [
            { teams: [sfWinners[0], sfWinners[1]], stage: "Final" },
          ];
          bracketUpdated = true;

          // Create Final match
          const existingFinalMatch = matches.find(
            (m) =>
              ((m.team1ID === sfWinners[0] && m.team2ID === sfWinners[1]) ||
                (m.team1ID === sfWinners[1] && m.team2ID === sfWinners[0])) &&
              m.stage === "Final"
          );
          if (!existingFinalMatch) {
            await createMatch(sfWinners[0], sfWinners[1], "Final");
          }

          await updateDoc(doc(db, "tournament", id), {
            stage: "Final",
            bracket: updatedBracket,
          });

          alert("Semi Finals completed! Updated to Final.");
        }
      }

      // Update local state if bracket was updated
      if (bracketUpdated) {
        console.log("🔄 Refreshing tournament data...");
        const tournamentDoc = await getDoc(doc(db, "tournament", id));
        if (tournamentDoc.exists()) {
          const updatedTournamentData = {
            id: tournamentDoc.id,
            ...tournamentDoc.data(),
          };
          setTournament(updatedTournamentData);
          console.log("✅ Tournament data refreshed:", updatedTournamentData);
        }
      }
    } catch (error) {
      console.error("Error in force bracket update:", error);
      alert("Error forcing bracket update");
    } finally {
      setIsUpdatingTournament(false);
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

    // Set flag to prevent useEffect from interfering
    setIsUpdatingTournament(true);

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

    // Always re-fetch team data to ensure it's current when tournament starts
    console.log("Refreshing team data for tournament start...");
    const teamDocs = await Promise.all(
      teams.map(async (teamId) => {
        const docSnap = await getDoc(doc(db, "teams", teamId));
        return docSnap.exists() ? { [teamId]: docSnap.data() } : null;
      })
    );
    const validTeams = teamDocs.filter((t) => t !== null);
    const freshTeamsData = validTeams.reduce(
      (acc, curr) => ({ ...acc, ...curr }),
      {}
    );

    // Update teamsData state FIRST and wait for it
    console.log("Setting fresh teams data:", freshTeamsData);
    setTeamsData(freshTeamsData);

    // Small delay to ensure state update is processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update local matches state
    console.log("Setting matches:", createdMatches);
    setMatches(createdMatches);

    // Update tournament state AFTER everything else is ready
    console.log("Updating tournament state...");
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

    // Another small delay to ensure all state updates are processed before alert
    await new Promise((resolve) => setTimeout(resolve, 50));

    console.log("Tournament start complete - showing alert");
    alert(
      "Tournament started! Quarter Final matches created with bracket skeleton."
    );

    // Clear the flag to allow useEffect to run normally again
    setIsUpdatingTournament(false);
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
            <>
              <button
                onClick={resetTournament}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                Reset Tournament
              </button>
              <button
                onClick={manualRefresh}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                🔄 Refresh Data
              </button>
              <button
                onClick={testBracketUpdate}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                🧪 Test Bracket Update
              </button>
              <button
                onClick={forceBracketUpdate}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold"
              >
                🚀 Force Bracket Update
              </button>
            </>
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
