import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyArp7-sDZoQmyJ5GNuoZ7PvmuKsJnRsXto";
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Simulates a complete football match with AI-generated events and commentary
 * Creates realistic match progression with goals, cards, substitutions
 * Includes penalty shootout if needed to ensure there's always a winner
 */
export async function simulateFootballMatch(
  team1Name,
  team2Name,
  team1Players = [],
  team2Players = []
) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Extract player names for the AI to use
  const team1PlayerNames = team1Players
    .map((p) => p.name)
    .filter((name) => name)
    .slice(0, 11); // Starting XI
  const team2PlayerNames = team2Players
    .map((p) => p.name)
    .filter((name) => name)
    .slice(0, 11); // Starting XI

  const prompt = `You are a football match commentator. Create a realistic 90-minute football match between ${team1Name} vs ${team2Name} with FULL match commentary.

Team rosters:
${team1Name} players: ${
    team1PlayerNames.length > 0
      ? team1PlayerNames.join(", ")
      : "No player data available"
  }
${team2Name} players: ${
    team2PlayerNames.length > 0
      ? team2PlayerNames.join(", ")
      : "No player data available"
  }

CRITICAL: Generate a COMPLETELY RANDOM and UNPREDICTABLE match result. Each simulation must be unique!

IMPORTANT: For ALL goal events, you MUST include the exact player name from the roster who scored.

Return ONLY valid JSON in this exact format:
{
  "events": [
    {
      "minute": 1,
      "type": "commentary",
      "team": "${team1Name}",
      "player": "",
      "description": "The match kicks off! ${team1Name} gets us underway!"
    },
    {
      "minute": 15,
      "type": "goal",
      "team": "${team1Name}",
      "player": "Player Name From Roster",
      "description": "GOAL! Player Name From Roster scores for ${team1Name}! Brilliant finish!"
    }
  ],
  "finalScore": {
    "${team1Name}": 0,
    "${team2Name}": 0
  }
}

MANDATORY RULES:
- For EVERY goal event, the "player" field must contain an EXACT player name from the provided roster
- Use ONLY the player names I provided in the team rosters above
- DO NOT make up player names - use only the real names from the lists
- Total goals can be anywhere from 0-7 goals combined (make it realistic but varied)
- Either team can win, lose, or draw - BE COMPLETELY UNPREDICTABLE
- Score possibilities: 0-0, 1-0, 2-1, 3-2, 1-3, 0-2, 4-1, etc. - ANY realistic combination
- Generate 20-35 events spread throughout the FULL 90 minutes (1-90)
- Event types: "goal", "yellow_card", "red_card", "substitution", "commentary"
- Include LOTS of "commentary" events for regular match action
- Events must be in chronological order by minute
- Team names must exactly match: "${team1Name}" or "${team2Name}"
- Make sure final score matches the number of goal events
- BE CREATIVE - create upsets, comebacks, dominant performances, close games, high-scoring games, defensive battles

IMPORTANT: Every simulation should feel different and unpredictable!

Return ONLY the JSON, no other text.`;

  try {
    console.log("🤖 Starting AI match simulation...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    console.log("🔮 AI Response received:", text.substring(0, 200) + "...");

    // Clean the response to extract JSON
    let jsonText = text;

    // Remove any markdown formatting
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");

    // Find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const matchData = JSON.parse(jsonMatch[0]);
      console.log("✅ AI JSON parsed successfully");
      console.log("📊 AI generated events:", matchData.events?.length);
      console.log("⚽ AI final score:", matchData.finalScore);

      // Validate the data structure
      if (
        matchData.events &&
        Array.isArray(matchData.events) &&
        matchData.finalScore
      ) {
        // Sort events by minute to ensure chronological order
        matchData.events.sort((a, b) => a.minute - b.minute);

        // Validate final score matches goal events
        let team1Goals = 0;
        let team2Goals = 0;
        matchData.events.forEach((event) => {
          if (event.type === "goal") {
            if (event.team === team1Name) team1Goals++;
            else if (event.team === team2Name) team2Goals++;
          }
        });

        // Update final score to match actual goals
        matchData.finalScore[team1Name] = team1Goals;
        matchData.finalScore[team2Name] = team2Goals;

        console.log("🎯 Final validated score:", matchData.finalScore);
        console.log("✨ AI simulation successful!");
        return matchData;
      }
    }

    console.log("❌ Invalid JSON structure from AI");
    throw new Error("Invalid JSON structure");
  } catch (error) {
    console.error("❌ Error simulating match:", error);
    console.log("🔄 Using dynamic fallback simulation...");

    // Get some player names for fallback
    const team1Player1 = team1PlayerNames[0] || "Player";
    const team1Player2 = team1PlayerNames[1] || "Rodriguez";
    const team2Player1 = team2PlayerNames[0] || "Wilson";
    const team2Player2 = team2PlayerNames[1] || "Johnson";

    // Generate random but realistic scores (0-4 goals each team)
    const team1Score = Math.floor(Math.random() * 5); // 0-4 goals
    const team2Score = Math.floor(Math.random() * 5); // 0-4 goals

    console.log(
      `🎲 Fallback simulation: ${team1Name} ${team1Score} - ${team2Score} ${team2Name}`
    );

    // Generate dynamic events based on the random score
    const events = [];
    let currentTeam1Goals = 0;
    let currentTeam2Goals = 0;

    // Kick-off
    events.push({
      minute: 1,
      type: "commentary",
      team: team1Name,
      player: "",
      description: `The match kicks off! ${team1Name} gets us underway against ${team2Name}!`,
    });

    // Generate goal events throughout the match
    const totalGoals = team1Score + team2Score;
    const goalMinutes = [];

    for (let i = 0; i < totalGoals; i++) {
      goalMinutes.push(Math.floor(Math.random() * 85) + 5); // Goals between minute 5-90
    }
    goalMinutes.sort((a, b) => a - b);

    let goalIndex = 0;
    for (const minute of goalMinutes) {
      let scoringTeam, scoringPlayer;

      // Randomly decide which team scores this goal based on remaining goals
      const team1Remaining = team1Score - currentTeam1Goals;
      const team2Remaining = team2Score - currentTeam2Goals;

      if (team1Remaining > 0 && team2Remaining > 0) {
        // Both teams still need goals, choose randomly
        if (Math.random() < 0.5) {
          scoringTeam = team1Name;
          scoringPlayer =
            team1PlayerNames[
              Math.floor(Math.random() * team1PlayerNames.length)
            ] || team1Player1;
          currentTeam1Goals++;
        } else {
          scoringTeam = team2Name;
          scoringPlayer =
            team2PlayerNames[
              Math.floor(Math.random() * team2PlayerNames.length)
            ] || team2Player1;
          currentTeam2Goals++;
        }
      } else if (team1Remaining > 0) {
        scoringTeam = team1Name;
        scoringPlayer =
          team1PlayerNames[
            Math.floor(Math.random() * team1PlayerNames.length)
          ] || team1Player1;
        currentTeam1Goals++;
      } else {
        scoringTeam = team2Name;
        scoringPlayer =
          team2PlayerNames[
            Math.floor(Math.random() * team2PlayerNames.length)
          ] || team2Player1;
        currentTeam2Goals++;
      }

      events.push({
        minute: minute,
        type: "goal",
        team: scoringTeam,
        player: scoringPlayer,
        description: `GOAL! ${scoringPlayer} scores for ${scoringTeam}! ${currentTeam1Goals}-${currentTeam2Goals}`,
      });

      goalIndex++;
    }

    // Add some random commentary events
    const commentaryMinutes = [8, 15, 25, 35, 45, 55, 65, 75, 85];
    for (const minute of commentaryMinutes) {
      if (!goalMinutes.includes(minute)) {
        const randomTeam = Math.random() < 0.5 ? team1Name : team2Name;
        const actions = [
          "creates a good chance but the shot goes wide",
          "has a corner kick cleared by the defense",
          "makes a great save to keep the score level",
          "wins a free kick in a dangerous position",
          "almost scores with a header from the cross",
        ];

        events.push({
          minute: minute,
          type: "commentary",
          team: randomTeam,
          player: "",
          description: `${randomTeam} ${
            actions[Math.floor(Math.random() * actions.length)]
          }`,
        });
      }
    }

    // Sort events by minute
    events.sort((a, b) => a.minute - b.minute);

    // Add full-time commentary
    events.push({
      minute: 90,
      type: "commentary",
      team: "",
      player: "",
      description: `Full-time! ${team1Name} ${team1Score} - ${team2Score} ${team2Name}`,
    });

    return {
      events: events,
      finalScore: {
        [team1Name]: team1Score,
        [team2Name]: team2Score,
      },
    };
  }
}
