import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../config/firebase";

export const MatchPage = () => {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const matchDoc = await getDoc(doc(db, "matches", matchId));
        if (matchDoc.exists()) {
          setMatch({ id: matchDoc.id, ...matchDoc.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [matchId]);

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
    <div className="max-w-2xl mx-auto mt-12 p-6 bg-white shadow-lg rounded-lg border border-gray-200">
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
      </div>

      {/* Status */}
      <p className="text-center mb-6 text-lg font-medium text-gray-600">
        {match.status || "Match Pending"}
      </p>

      {/* Commentary */}
      <div className="border-t border-gray-300 pt-4">
        <h3 className="text-xl font-semibold mb-3">Commentary</h3>
        {match.commentary.length > 0 ? (
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {match.commentary.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No commentary available</p>
        )}
      </div>
    </div>
  );
};
