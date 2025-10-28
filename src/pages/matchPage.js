import confetti from "canvas-confetti";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        if (matchDoc.exists()) {
          const matchData = { id: matchDoc.id, ...matchDoc.data() };
          setMatch(matchData);
          setCommentary(matchData.commentary || []);

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
        commentaryText = `GOAL! ${match.team1ID} scores! Current score: ${match.score.team1}-${match.score.team2}`;
      } else if (team2Change > 0) {
        commentaryText = `GOAL! ${match.team2ID} scores! Current score: ${match.score.team1}-${match.score.team2}`;
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
        match.team1ID,
        match.team2ID
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
          if (event.team === match.team1ID) {
            currentScore.team1++;
          } else if (event.team === match.team2ID) {
            currentScore.team2++;
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
        text: `Full-time! ${match.team1ID} ${currentScore.team1} - ${currentScore.team2} ${match.team2ID}`,
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
      await updateDoc(doc(db, "matches", matchId), {
        score: currentScore,
        status: "Full Time",
        simulated: true,
      });
      setMatch((prev) => ({ ...prev, score: currentScore, simulated: true }));
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

        // Update final score with penalty result
        await updateDoc(doc(db, "matches", matchId), {
          score: penaltyResult.finalScore,
          penaltyScore: penaltyResult.penaltyScore,
          simulated: true,
          status: "Full Time",
        });
        setMatch((prev) => ({
          ...prev,
          score: penaltyResult.finalScore,
          penaltyScore: penaltyResult.penaltyScore,
          simulated: true,
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
    const team1Name = matchData.team1ID;
    const team2Name = matchData.team2ID;
    let team1Penalties = 0;
    let team2Penalties = 0;
    const commentary = [];
    let penaltyRound = 1;

    // Standard 5 penalty rounds
    for (let round = 1; round <= 5; round++) {
      // Team 1 penalty
      const team1Success = Math.random() < 0.75; // 75% success rate
      if (team1Success) {
        team1Penalties++;
        commentary.push({
          text: `Penalty ${round} - ${team1Name} SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Penalty ${round} - ${team1Name} MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      }

      // Team 2 penalty
      const team2Success = Math.random() < 0.75; // 75% success rate
      if (team2Success) {
        team2Penalties++;
        commentary.push({
          text: `Penalty ${round} - ${team2Name} SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Penalty ${round} - ${team2Name} MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + round,
          timestamp: new Date().toISOString(),
        });
      }

      penaltyRound = round;
    }

    // Sudden death if tied after 5 rounds
    while (team1Penalties === team2Penalties) {
      penaltyRound++;

      // Team 1 sudden death penalty
      const team1Success = Math.random() < 0.7; // Slightly lower success rate in sudden death
      if (team1Success) {
        team1Penalties++;
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team1Name} SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team1Name} MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      }

      // Team 2 sudden death penalty
      const team2Success = Math.random() < 0.7;
      if (team2Success) {
        team2Penalties++;
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team2Name} SCORES! 🥅 Penalty score: ${team1Penalties}-${team2Penalties}`,
          minute: 91 + penaltyRound,
          timestamp: new Date().toISOString(),
        });
      } else {
        commentary.push({
          text: `Sudden Death ${penaltyRound} - ${team2Name} MISSES! ❌ Penalty score: ${team1Penalties}-${team2Penalties}`,
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

    // Determine winner and update match score
    const finalScore = { ...currentScore };
    const winner = team1Penalties > team2Penalties ? team1Name : team2Name;

    // Winner gets 1 added to their score for the win
    if (team1Penalties > team2Penalties) {
      finalScore.team1++;
    } else {
      finalScore.team2++;
    }

    // Add final penalty result commentary
    commentary.push({
      text: `🏆 ${winner} wins the penalty shootout ${team1Penalties}-${team2Penalties}! Match result: ${matchData.team1ID} ${finalScore.team1}-${finalScore.team2} ${matchData.team2ID}`,
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

      {/* Teams and Score */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-4">
          {match.team1ID} <span className="text-gray-500">VS</span>{" "}
          {match.team2ID}
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
            <div className="flex justify-center items-center gap-8 text-lg font-semibold text-blue-600">
              <span>Penalties: {match.penaltyScore.team1}</span>
              <span>–</span>
              <span>{match.penaltyScore.team2}</span>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <p className="text-center mb-6 text-lg font-medium text-gray-600">
        {matchStatus}
      </p>

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
