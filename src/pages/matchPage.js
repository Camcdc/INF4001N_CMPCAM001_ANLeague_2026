import confetti from "canvas-confetti";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../config/firebase";
import { simulateFootballMatch } from "../utils/geminiAI";

export const MatchPage = () => {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentary, setCommentary] = useState([]);
  const [matchAnalysis, setMatchAnalysis] = useState("");
  const [previousScore, setPreviousScore] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [matchStatus, setMatchStatus] = useState("Pending");
  const [team1Data, setTeam1Data] = useState(null);
  const [team2Data, setTeam2Data] = useState(null);
  const [team1Players, setTeam1Players] = useState([]);
  const [team2Players, setTeam2Players] = useState([]);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        if (matchDoc.exists()) {
          const matchData = { id: matchDoc.id, ...matchDoc.data() };
          setMatch(matchData);
          setCommentary(matchData.commentary || []);

          // Fetch team data for federationIDs
          if (matchData.team1ID) {
            const team1Doc = await getDoc(doc(db, "teams", matchData.team1ID));
            if (team1Doc.exists()) {
              setTeam1Data(team1Doc.data());

              // Fetch team1 players
              const team1PlayersQuery = query(
                collection(db, "players"),
                where("teamID", "==", matchData.team1ID)
              );
              const team1PlayersSnap = await getDocs(team1PlayersQuery);
              const team1PlayersList = team1PlayersSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              setTeam1Players(team1PlayersList);
            }
          }

          if (matchData.team2ID) {
            const team2Doc = await getDoc(doc(db, "teams", matchData.team2ID));
            if (team2Doc.exists()) {
              setTeam2Data(team2Doc.data());

              // Fetch team2 players
              const team2PlayersQuery = query(
                collection(db, "players"),
                where("teamID", "==", matchData.team2ID)
              );
              const team2PlayersSnap = await getDocs(team2PlayersQuery);
              const team2PlayersList = team2PlayersSnap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              setTeam2Players(team2PlayersList);
            }
          }

          // Set initial previous score for comparison
          if (matchData.score) {
            setPreviousScore(matchData.score);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();

    // Set up polling for real-time updates
    const interval = setInterval(fetchMatch, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [matchId]);

  // Watch for score changes and generate commentary
  useEffect(() => {
    if (match && previousScore && match.score) {
      const scoreChanged =
        match.score.team1 !== previousScore.team1 ||
        match.score.team2 !== previousScore.team2;

      if (scoreChanged && !isSimulating) {
        generateScoreCommentary();
        setPreviousScore(match.score);
      }
    }
  }, [match?.score]);

  const generateScoreCommentary = async () => {
    if (!match || !previousScore) return;

    try {
      // Simple fallback commentary for manual score updates
      const team1Change = match.score.team1 - previousScore.team1;
      const team2Change = match.score.team2 - previousScore.team2;

      let commentaryText = "";
      if (team1Change > 0) {
        commentaryText = `GOAL! ${
          team1Data?.federationID || match.team1ID
        } scores! Current score: ${match.score.team1}-${match.score.team2}`;
      } else if (team2Change > 0) {
        commentaryText = `GOAL! ${
          team2Data?.federationID || match.team2ID
        } scores! Current score: ${match.score.team1}-${match.score.team2}`;
      }

      if (commentaryText) {
        // Create commentary object with estimated minute
        const commentaryWithMinute = {
          text: commentaryText,
          minute: Math.floor(Math.random() * 90) + 1,
          timestamp: new Date().toISOString(),
        };

        const updatedCommentary = [...commentary, commentaryWithMinute];
        setCommentary(updatedCommentary);

        // Update Firebase with new commentary
        await updateDoc(doc(db, "matches", matchId), {
          commentary: updatedCommentary,
        });
      }
    } catch (error) {
      console.error("Error generating score commentary:", error);
    }
  };

  // Trigger confetti celebration for goals
  const triggerGoalConfetti = () => {
    console.log("🎉 CONFETTI TRIGGERED!");

    // Create multiple confetti bursts for exciting goal celebration
    confetti({
      particleCount: 200,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#f39c12", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"],
    });

    // Second burst slightly delayed
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.7 },
        colors: ["#f1c40f", "#e67e22", "#1abc9c", "#34495e"],
      });
    }, 200);

    // Third burst for extra celebration
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { y: 0.5 },
        colors: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7"],
      });
    }, 400);
  };

  // Function to update player goal count in Firebase
  const updatePlayerGoalCount = async (playerName, teamName) => {
    try {
      console.log(
        `Updating goal count for player: ${playerName} from team: ${teamName}`
      );

      // Determine which team's players to search through
      const playersToSearch =
        teamName === (team1Data?.federationID || match.team1ID)
          ? team1Players
          : team2Players;

      // Find the player by name (case-insensitive)
      const player = playersToSearch.find(
        (p) =>
          p.name &&
          p.name.toLowerCase().trim() === playerName.toLowerCase().trim()
      );

      if (player) {
        console.log(`Found player: ${player.name} (ID: ${player.id})`);

        // Get current goal count (default to 0 if not set)
        const currentGoals = player.goals || 0;
        const newGoals = currentGoals + 1;

        // Update the player's goal count in Firebase
        await updateDoc(doc(db, "players", player.id), {
          goals: newGoals,
        });

        // Update local state
        if (teamName === (team1Data?.federationID || match.team1ID)) {
          setTeam1Players((prev) =>
            prev.map((p) =>
              p.id === player.id ? { ...p, goals: newGoals } : p
            )
          );
        } else {
          setTeam2Players((prev) =>
            prev.map((p) =>
              p.id === player.id ? { ...p, goals: newGoals } : p
            )
          );
        }

        console.log(
          `✅ Updated ${player.name}'s goals from ${currentGoals} to ${newGoals}`
        );
      } else {
        console.log(
          `❌ Player "${playerName}" not found in team "${teamName}"`
        );
      }
    } catch (error) {
      console.error("Error updating player goal count:", error);
    }
  };

  // Main match simulation function using AI
  const simulateMatch = async () => {
    if (!match || isSimulating) return;

    setIsSimulating(true);
    setMatchStatus("Live");

    // Clear existing commentary
    setCommentary([]);
    await updateDoc(doc(db, "matches", matchId), {
      commentary: [],
      status: "Live",
      score: { team1: 0, team2: 0 },
    });

    try {
      // Use the simplified AI function to simulate the entire match
      const matchResult = await simulateFootballMatch(
        team1Data?.federationID || match.team1ID,
        team2Data?.federationID || match.team2ID,
        team1Players,
        team2Players
      );

      console.log("AI Match Result:", matchResult);
      console.log("Number of events:", matchResult.events?.length);
      console.log(
        "Goal events:",
        matchResult.events?.filter((e) => e.type === "goal").length
      );

      // Process each event from the AI simulation (only up to minute 90)
      let currentScore = { team1: 0, team2: 0 };

      // Filter events to only include those up to minute 90 (regular time)
      const regularTimeEvents = matchResult.events.filter(
        (event) => event.minute <= 90
      );

      for (let i = 0; i < regularTimeEvents.length; i++) {
        const event = regularTimeEvents[i];

        // Update score if this is a goal
        if (event.type === "goal") {
          if (event.team === (team1Data?.federationID || match.team1ID)) {
            currentScore.team1++;
          } else if (
            event.team === (team2Data?.federationID || match.team2ID)
          ) {
            currentScore.team2++;
          }

          // Update player goal count if player information is available
          if (event.player && event.player.trim() !== "") {
            await updatePlayerGoalCount(event.player, event.team);
          }

          // Update Firebase and state with current score after each goal
          await updateDoc(doc(db, "matches", matchId), {
            score: { ...currentScore },
          });
          setMatch((prev) => ({ ...prev, score: { ...currentScore } }));
        }

        // Add commentary for this event
        const commentaryWithMinute = {
          text: event.description,
          minute: event.minute,
          timestamp: new Date().toISOString(),
        };

        setCommentary((prev) => {
          const updated = [...prev, commentaryWithMinute];
          updateDoc(doc(db, "matches", matchId), {
            commentary: updated,
          });
          return updated;
        });

        // Wait between events for realistic simulation
        if (i < regularTimeEvents.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Add final "Full-time!" commentary
      const fullTimeCommentary = {
        text: `Full-time! ${team1Data?.federationID || match.team1ID} ${
          currentScore.team1
        } - ${currentScore.team2} ${team2Data?.federationID || match.team2ID}`,
        minute: 90,
        timestamp: new Date().toISOString(),
      };

      setCommentary((prev) => {
        const updated = [...prev, fullTimeCommentary];
        updateDoc(doc(db, "matches", matchId), {
          commentary: updated,
        });
        return updated;
      });

      // Set final score and status (use our calculated score, not AI's finalScore)
      // Determine winner for regular time
      let winnerTeamId = "";
      if (currentScore.team1 > currentScore.team2) {
        winnerTeamId = match.team1ID;
        console.log("🏆 Regular time winner: Team 1 -", winnerTeamId);
      } else if (currentScore.team2 > currentScore.team1) {
        winnerTeamId = match.team2ID;
        console.log("🏆 Regular time winner: Team 2 -", winnerTeamId);
      } else {
        console.log("⚖️ Match is tied, no winner yet (going to penalties)");
      }
      // If tied, winnerID will be set after penalty shootout

      console.log("💾 Updating match with winner ID:", winnerTeamId);
      try {
        await updateDoc(doc(db, "matches", matchId), {
          score: currentScore,
          status: "Full Time",
          simulated: true,
          winnerID: winnerTeamId, // Set winner ID (empty if draw)
        });
        console.log(
          "✅ Successfully updated match with winnerID:",
          winnerTeamId
        );
      } catch (error) {
        console.error("❌ Error updating match with winnerID:", error);
      }

      setMatch((prev) => ({
        ...prev,
        score: currentScore,
        simulated: true,
        winnerID: winnerTeamId,
      }));
      setMatchStatus("Full Time");

      // 🎉 GAME OVER CELEBRATION!
      triggerGoalConfetti();

      console.log("Final currentScore:", currentScore);
      console.log(
        "Team1 score:",
        currentScore.team1,
        "Team2 score:",
        currentScore.team2
      );
      console.log("Is draw?", currentScore.team1 === currentScore.team2);

      // Check if match is a draw and needs penalty shootout
      if (currentScore.team1 === currentScore.team2) {
        // Wait a moment before starting penalties
        await new Promise((resolve) => setTimeout(resolve, 2000));

        setMatchStatus("Penalty Shootout");
        await updateDoc(doc(db, "matches", matchId), {
          status: "Penalty Shootout",
        });

        // Add penalty shootout commentary
        const penaltyStartCommentary = {
          text: "The match is tied! We're going to a penalty shootout to determine the winner!",
          minute: 91,
          timestamp: new Date().toISOString(),
        };

        setCommentary((prev) => {
          const updated = [...prev, penaltyStartCommentary];
          updateDoc(doc(db, "matches", matchId), {
            commentary: updated,
          });
          return updated;
        });

        // Simulate penalty shootout
        const penaltyResult = await simulatePenaltyShootout(
          currentScore,
          match
        );

        // Determine penalty shootout winner
        let penaltyWinnerTeamId = "";
        if (
          penaltyResult.penaltyScore.team1 > penaltyResult.penaltyScore.team2
        ) {
          penaltyWinnerTeamId = match.team1ID;
          console.log(
            "🥅 Penalty shootout winner: Team 1 -",
            penaltyWinnerTeamId
          );
        } else if (
          penaltyResult.penaltyScore.team2 > penaltyResult.penaltyScore.team1
        ) {
          penaltyWinnerTeamId = match.team2ID;
          console.log(
            "🥅 Penalty shootout winner: Team 2 -",
            penaltyWinnerTeamId
          );
        }

        console.log(
          "💾 Updating match with penalty winner ID:",
          penaltyWinnerTeamId
        );

        // Update final score with penalty result
        try {
          await updateDoc(doc(db, "matches", matchId), {
            score: penaltyResult.finalScore,
            penaltyScore: penaltyResult.penaltyScore,
            simulated: true,
            status: "Full Time",
            winnerID: penaltyWinnerTeamId, // Set penalty shootout winner
          });
          console.log(
            "✅ Successfully updated match with penalty winnerID:",
            penaltyWinnerTeamId
          );
        } catch (error) {
          console.error(
            "❌ Error updating match with penalty winnerID:",
            error
          );
        }

        setMatch((prev) => ({
          ...prev,
          score: penaltyResult.finalScore,
          penaltyScore: penaltyResult.penaltyScore,
          simulated: true,
          winnerID: penaltyWinnerTeamId,
        }));

        // Add penalty shootout commentary
        for (const penaltyCommentary of penaltyResult.commentary) {
          setCommentary((prev) => {
            const updated = [...prev, penaltyCommentary];
            updateDoc(doc(db, "matches", matchId), {
              commentary: updated,
            });
            return updated;
          });

          // Wait between penalty commentaries
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // 🎉 PENALTY SHOOTOUT OVER CELEBRATION!
        triggerGoalConfetti();
      }
    } catch (error) {
      console.error("Error during match simulation:", error);
    } finally {
      setIsSimulating(false);
    }
  };

  // Simulate penalty shootout
  const simulatePenaltyShootout = async (currentScore, matchData) => {
    const team1Name = team1Data?.federationID || matchData.team1ID;
    const team2Name = team2Data?.federationID || matchData.team2ID;
    let team1Penalties = 0;
    let team2Penalties = 0;
    const commentary = [];
    let penaltyRound = 1;

    // Standard 5 penalty rounds
    for (let round = 1; round <= 5; round++) {
      // Get random players for penalties
      const team1Player =
        team1Players.length > 0
          ? team1Players[
              Math.floor(Math.random() * Math.min(team1Players.length, 11))
            ].name
          : "Player";
      const team2Player =
        team2Players.length > 0
          ? team2Players[
              Math.floor(Math.random() * Math.min(team2Players.length, 11))
            ].name
          : "Player";

      // Team 1 penalty
      const team1Success = Math.random() < 0.75; // 75% success rate
      if (team1Success) {
        team1Penalties++;
        commentary.push({
          text: `Penalty ${round} - ${team1Player} (${team1Name}) SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Penalty ${round} - ${team1Player} (${team1Name}) MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      }

      // Team 2 penalty
      const team2Success = Math.random() < 0.75; // 75% success rate
      if (team2Success) {
        team2Penalties++;
        commentary.push({
          text: `Penalty ${round} - ${team2Player} (${team2Name}) SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Penalty ${round} - ${team2Player} (${team2Name}) MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      }

      penaltyRound = round;
    }

    // Sudden death if tied after 5 rounds
    while (team1Penalties === team2Penalties) {
      penaltyRound++;

      // Get random players for sudden death penalties
      const team1SuddenPlayer =
        team1Players.length > 0
          ? team1Players[
              Math.floor(Math.random() * Math.min(team1Players.length, 11))
            ].name
          : "Player";
      const team2SuddenPlayer =
        team2Players.length > 0
          ? team2Players[
              Math.floor(Math.random() * Math.min(team2Players.length, 11))
            ].name
          : "Player";

      // Team 1 sudden death penalty
      const team1Success = Math.random() < 0.7; // Slightly lower success rate in sudden death
      if (team1Success) {
        team1Penalties++;
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team1SuddenPlayer} (${team1Name}) SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team1SuddenPlayer} (${team1Name}) MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      }

      // Team 2 sudden death penalty
      const team2Success = Math.random() < 0.7;
      if (team2Success) {
        team2Penalties++;
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team2SuddenPlayer} (${team2Name}) SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team2SuddenPlayer} (${team2Name}) MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      }

      // Prevent infinite loop (max 10 sudden death rounds)
      if (penaltyRound > 15) {
        const winner = Math.random() < 0.5 ? 1 : 2;
        if (winner === 1) {
          team1Penalties++;
          commentary.push({
            text: `${team1Name} wins the marathon penalty shootout! Final penalty score: ${team1Penalties}-${team2Penalties}`,
            minute: 91 + penaltyRound,
            timestamp: new Date().toISOString(),
          });
        } else {
          team2Penalties++;
          commentary.push({
            text: `${team2Name} wins the marathon penalty shootout! Final penalty score: ${team1Penalties}-${team2Penalties}`,
            minute: 91 + penaltyRound,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }
    }

    // Determine winner and keep original match score
    const finalScore = { ...currentScore }; // Keep the original tied score
    const winner = team1Penalties > team2Penalties ? team1Name : team2Name;

    // In football, penalty shootouts don't change the regular time score
    // The match remains a draw (e.g., 1-1) and penalty score determines the winner

    // Add final penalty result commentary
    commentary.push({
      text: `🏆 ${winner} wins the penalty shootout ${team1Penalties}-${team2Penalties}! Match result: ${team1Name} ${finalScore.team1}-${finalScore.team2} ${team2Name}`,
      minute: 95,
      timestamp: new Date().toISOString(),
    });

    return {
      finalScore,
      penaltyScore: { team1: team1Penalties, team2: team2Penalties },
      commentary,
      winner,
    };
  };

  const fetchMatch = async () => {
    try {
      const matchDoc = await getDoc(doc(db, "matches", matchId));
      if (matchDoc.exists()) {
        const matchData = { id: matchDoc.id, ...matchDoc.data() };
        setMatch(matchData);
        setCommentary(matchData.commentary || []);
        setMatchStatus(matchData.status || "Pending");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Test function to manually set winnerID
  const testSetWinnerID = async () => {
    if (!match) return;

    try {
      // Determine winner based on current score
      let testWinnerID = "";
      if (match.score.team1 > match.score.team2) {
        testWinnerID = match.team1ID;
      } else if (match.score.team2 > match.score.team1) {
        testWinnerID = match.team2ID;
      } else {
        // If tied, just pick team1 for testing
        testWinnerID = match.team1ID;
      }

      console.log("🧪 Testing winnerID update with:", testWinnerID);

      await updateDoc(doc(db, "matches", matchId), {
        winnerID: testWinnerID,
        simulated: true,
      });

      console.log("✅ Test winnerID update successful!");
      alert(`Winner ID set to: ${testWinnerID}`);

      // Refresh the match data to verify
      const matchDoc = await getDoc(doc(db, "matches", matchId));
      if (matchDoc.exists()) {
        const updatedMatch = { id: matchDoc.id, ...matchDoc.data() };
        setMatch(updatedMatch);
        console.log("📊 Updated match data:", updatedMatch);
      }
    } catch (error) {
      console.error("❌ Error in test winnerID update:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const resetMatch = async () => {
    try {
      // Reset match to initial state
      const resetScore = { team1: 0, team2: 0 };
      const emptyCommentary = [];

      setCommentary(emptyCommentary);
      setMatchAnalysis("");
      setMatchStatus("Pending");
      setMatch((prev) => ({
        ...prev,
        score: resetScore,
        penaltyScore: null, // Clear penalty scores
      }));

      // Update Firebase with reset values (including clearing penalty scores)
      await updateDoc(doc(db, "matches", matchId), {
        commentary: emptyCommentary,
        score: resetScore,
        status: "Pending",
        penaltyScore: null, // Clear penalty scores in Firebase too
        simulated: false, // Reset simulated flag
        winnerID: "", // Clear winner ID
      });

      console.log("Match reset successfully");
    } catch (error) {
      console.error("Error resetting match:", error);
    }
  };

  if (loading)
    return (
      <p className="text-center text-lg mt-20 animate-pulse text-gray-500">
        Loading match...
      </p>
    );

  if (!match)
    return (
      <p className="text-center text-lg mt-20 text-red-500">Match not found</p>
    );

  return (
    <div className="max-w-4xl mx-auto mt-12 p-6 bg-white shadow-lg rounded-lg border border-gray-200">
      {/* Match Header */}
      <h1 className="text-3xl font-bold text-center mb-8">Match Details</h1>

      {/* Debug Section */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Debug Information:</h3>
        <div className="text-sm space-y-1">
          <p>
            <strong>Match ID:</strong> {matchId}
          </p>
          <p>
            <strong>Simulated:</strong> {match.simulated ? "Yes" : "No"}
          </p>
          <p>
            <strong>Winner ID:</strong> {match.winnerID || "Not set"}
          </p>
          <p>
            <strong>Score:</strong> {match.score?.team1 || 0} -{" "}
            {match.score?.team2 || 0}
          </p>
          {match.penaltyScore && (
            <p>
              <strong>Penalties:</strong> {match.penaltyScore.team1} -{" "}
              {match.penaltyScore.team2}
            </p>
          )}
        </div>
        <button
          onClick={testSetWinnerID}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Test Set Winner ID
        </button>
      </div>

      {/* Teams and Score */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-4">
          {team1Data?.federationID || match.team1ID}{" "}
          <span className="text-gray-500">VS</span>{" "}
          {team2Data?.federationID || match.team2ID}
        </h2>
        <div className="flex justify-center items-center gap-12 text-4xl font-extrabold">
          <span>{match.score.team1}</span>
          <span>–</span>
          <span>{match.score.team2}</span>
        </div>

        {/* Penalty Score Display */}
        {match.penaltyScore && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 mb-2">After Penalty Shootout</p>
            <div className="flex justify-center items-center gap-8 text-lg font-semibold">
              <span
                className={
                  match.penaltyScore.team1 > match.penaltyScore.team2
                    ? "text-green-600"
                    : "text-blue-600"
                }
              >
                Penalties: {match.penaltyScore.team1}
              </span>
              <span className="text-gray-500">–</span>
              <span
                className={
                  match.penaltyScore.team2 > match.penaltyScore.team1
                    ? "text-green-600"
                    : "text-blue-600"
                }
              >
                {match.penaltyScore.team2}
              </span>
            </div>
            {/* Show penalty winner */}
            <div className="mt-2">
              <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
                🏆{" "}
                {match.penaltyScore.team1 > match.penaltyScore.team2
                  ? team1Data?.federationID || match.team1ID
                  : team2Data?.federationID || match.team2ID}{" "}
                wins on penalties
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <p className="text-center mb-6 text-lg font-medium text-gray-600">
        {matchStatus}
      </p>

      {/* Team Players Section */}
      {(team1Players.length > 0 || team2Players.length > 0) && (
        <div className="border-t border-gray-300 pt-4 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-center">
            Team Squads
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Team 1 Players */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3 text-center">
                {team1Data?.federationID || match.team1ID} Squad
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {team1Players.slice(0, 11).map((player, idx) => (
                  <div
                    key={player.id}
                    className="bg-white rounded p-2 text-sm text-center"
                  >
                    <div className="font-medium">{player.name}</div>
                    <div className="text-gray-500 text-xs">
                      {player.position}
                    </div>
                    {player.goals > 0 && (
                      <div className="text-green-600 text-xs font-semibold mt-1">
                        ⚽ {player.goals} goal{player.goals !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {team1Players.length > 11 && (
                <p className="text-xs text-gray-600 mt-2 text-center">
                  +{team1Players.length - 11} substitutes
                </p>
              )}
            </div>

            {/* Team 2 Players */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-3 text-center">
                {team2Data?.federationID || match.team2ID} Squad
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {team2Players.slice(0, 11).map((player, idx) => (
                  <div
                    key={player.id}
                    className="bg-white rounded p-2 text-sm text-center"
                  >
                    <div className="font-medium">{player.name}</div>
                    <div className="text-gray-500 text-xs">
                      {player.position}
                    </div>
                    {player.goals > 0 && (
                      <div className="text-green-600 text-xs font-semibold mt-1">
                        ⚽ {player.goals} goal{player.goals !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {team2Players.length > 11 && (
                <p className="text-xs text-gray-600 mt-2 text-center">
                  +{team2Players.length - 11} substitutes
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match Simulation Controls */}
      <div className="border-t border-gray-300 pt-4 mb-6">
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={simulateMatch}
            disabled={isSimulating}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-colors text-lg"
          >
            {isSimulating ? "⚽ Simulating Match..." : "⚽ Simulate Match"}
          </button>

          <button
            onClick={resetMatch}
            disabled={isSimulating}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            🔄 Reset Match
          </button>

          <button
            onClick={testSetWinnerID}
            disabled={isSimulating}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            🧪 Test Set Winner
          </button>
        </div>

        {isSimulating && (
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              <span className="text-green-600 font-medium">
                Simulating live match with AI commentary...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Match Analysis */}
      {matchAnalysis && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-2 text-green-800">
            AI Match Analysis
          </h3>
          <p className="text-green-700">{matchAnalysis}</p>
        </div>
      )}

      {/* Commentary */}
      <div className="border-t border-gray-300 pt-4">
        <h3 className="text-xl font-semibold mb-3">Live Match Commentary</h3>
        {commentary.length > 0 ? (
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <ul className="space-y-3">
              {commentary
                .slice() // Create a copy to avoid mutating original array
                .sort((a, b) => {
                  // Sort by minute, treating objects with minute property
                  const minuteA =
                    typeof a === "object" && a.minute ? a.minute : 999;
                  const minuteB =
                    typeof b === "object" && b.minute ? b.minute : 999;
                  return minuteA - minuteB;
                })
                .map((commentaryItem, idx) => {
                  // Handle both old format (string) and new format (object)
                  const commentaryText =
                    typeof commentaryItem === "string"
                      ? commentaryItem
                      : commentaryItem.text;
                  const matchMinute =
                    typeof commentaryItem === "object" && commentaryItem.minute
                      ? commentaryItem.minute
                      : null;

                  return (
                    <li
                      key={idx}
                      className="border-l-4 border-green-500 pl-4 py-2 bg-white rounded shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded">
                          Event #{idx + 1}
                        </span>
                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                          {matchMinute ? `${matchMinute}'` : "?'"}
                        </span>
                        <span className="text-xs text-gray-500">
                          Match Event
                        </span>
                      </div>
                      <p className="text-gray-800 font-medium">
                        {commentaryText}
                      </p>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <div className="text-6xl mb-4">⚽</div>
            <p className="text-lg font-medium">No match commentary yet</p>
            <p className="text-sm mt-2">
              Click "Simulate Match" to watch a full match with AI-powered
              commentary!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
