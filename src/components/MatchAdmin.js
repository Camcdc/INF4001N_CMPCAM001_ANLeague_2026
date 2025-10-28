import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { db } from "../config/firebase";

export const MatchAdmin = ({ match, onScoreUpdate }) => {
  const [team1Score, setTeam1Score] = useState(match.score.team1);
  const [team2Score, setTeam2Score] = useState(match.score.team2);
  const [status, setStatus] = useState(match.status);
  const [updating, setUpdating] = useState(false);

  const updateScore = async () => {
    setUpdating(true);
    try {
      const newScore = {
        team1: parseInt(team1Score),
        team2: parseInt(team2Score),
      };

      await updateDoc(doc(db, "matches", match.id), {
        score: newScore,
        status: status,
      });

      // Call the callback to trigger re-fetch
      if (onScoreUpdate) {
        onScoreUpdate();
      }
    } catch (error) {
      console.error("Error updating match:", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold mb-3 text-yellow-800">
        🔧 Match Admin (For Testing AI Commentary)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {match.team1ID} Score
          </label>
          <input
            type="number"
            value={team1Score}
            onChange={(e) => setTeam1Score(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {match.team2ID} Score
          </label>
          <input
            type="number"
            value={team2Score}
            onChange={(e) => setTeam2Score(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Match Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Live">Live</option>
            <option value="Half Time">Half Time</option>
            <option value="Full Time">Full Time</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={updateScore}
            disabled={updating}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            {updating ? "Updating..." : "Update Match"}
          </button>
        </div>
      </div>

      <p className="text-sm text-yellow-700 mt-2">
        💡 Change the scores above to test automatic AI commentary generation!
      </p>
    </div>
  );
};
