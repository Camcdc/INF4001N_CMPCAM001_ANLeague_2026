import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../config/firebase";

export const TeamPage = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const teamRef = doc(db, "teams", id);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) setTeam(teamSnap.data());
      } catch (err) {
        console.error("Error fetching team:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [id]);

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen bg-[#0B1C4A] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-[#00A3FF]"></div>
      </div>
    );

  if (!team)
    return (
      <div className="text-center mt-20 text-gray-300 bg-[#0B1C4A] min-h-screen pt-20 text-lg">
        Team not found 😢
      </div>
    );

  const tabs = ["overview", "matches", "stats", "squad"];

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-gray-900">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#001D4A] via-[#002E6D] to-[#003C8F] text-white pb-4">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <h1 className="text-4xl font-extrabold mb-1 tracking-tight">
            {team.federationID}
          </h1>
          <p className="text-[#A9C6FF] text-lg font-medium">
            Managed by {team.manager}
          </p>
        </div>

        {/* NAVIGATION BAR */}
        <div className="border-t border-[#ffffff25]">
          <div className="max-w-5xl mx-auto flex justify-around text-sm sm:text-base">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 w-full border-b-4 transition-all duration-300 ${
                  activeTab === tab
                    ? "border-[#00A3FF] text-white font-semibold"
                    : "border-transparent text-gray-300 hover:text-white"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <h2 className="text-lg font-bold mb-3 text-[#001D4A]">
                Upcoming Matches
              </h2>
              <p className="text-gray-600 text-sm">No scheduled matches yet.</p>
            </div>

            <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <h2 className="text-lg font-bold mb-3 text-[#001D4A]">
                Team Stats
              </h2>
              <div className="grid grid-cols-2 gap-4 text-gray-700 text-sm">
                <p>
                  <span className="font-semibold">Average Rating:</span>{" "}
                  {team.averageRating}
                </p>
                <p>
                  <span className="font-semibold">Goals Scored:</span>{" "}
                  {team.goalsScored}
                </p>
                <p>
                  <span className="font-semibold">Goals Conceded:</span>{" "}
                  {team.goalsConceded}
                </p>
                <p>
                  <span className="font-semibold">Eliminated:</span>{" "}
                  {team.eliminated ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MATCHES */}
        {activeTab === "matches" && (
          <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
            <h2 className="text-lg font-bold mb-3 text-[#001D4A]">Matches</h2>
            <p className="text-gray-600 text-sm">
              No matches played yet. When the tournament begins, your team’s
              results and fixtures will appear here.
            </p>
          </div>
        )}

        {/* STATS */}
        {activeTab === "stats" && (
          <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
            <h2 className="text-lg font-bold mb-3 text-[#001D4A]">Key Stats</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-gray-700 text-sm">
              <p>
                <span className="font-semibold">Average Rating:</span>{" "}
                {team.averageRating}
              </p>
              <p>
                <span className="font-semibold">Goals Scored:</span>{" "}
                {team.goalsScored}
              </p>
              <p>
                <span className="font-semibold">Goals Conceded:</span>{" "}
                {team.goalsConceded}
              </p>
              <p>
                <span className="font-semibold">Captain ID:</span>{" "}
                {team.captainID}
              </p>
              <p>
                <span className="font-semibold">Eliminated:</span>{" "}
                {team.eliminated ? "Yes" : "No"}
              </p>
            </div>
          </div>
        )}

        {/* SQUAD */}
        {activeTab === "squad" && (
          <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
            <h2 className="text-lg font-bold mb-4 text-[#001D4A]">
              Squad Members
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {team.players?.map((player, index) => (
                <div
                  key={index}
                  className="bg-[#F3F6FF] rounded-lg p-4 text-center hover:bg-[#EAF1FF] transition duration-200 text-sm"
                >
                  <h3 className="font-semibold text-gray-800">{player}</h3>
                  {team.captainID === player && (
                    <p className="text-[#FFD43B] mt-1 font-medium">
                      ⭐ Captain
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BACK BUTTON */}
        <div className="flex justify-center">
          <Link
            to={-1}
            className="bg-[#00A3FF] hover:bg-[#0077CC] text-white px-6 py-2 rounded-full font-semibold shadow-md transition"
          >
            ← Back
          </Link>
        </div>
      </div>

      <footer className="text-center text-gray-500 text-sm py-8 border-t border-gray-200">
        African Nations League • Team Overview
      </footer>
    </div>
  );
};
