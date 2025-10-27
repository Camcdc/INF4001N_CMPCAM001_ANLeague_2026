import { getAuth } from "firebase/auth";
import {
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
import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";

export const Team = () => {
  const navigate = useNavigate();
  const [teamData, setTeamData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const auth = getAuth();
  const [user, userLoading] = useAuthState(auth);

  // Fetch team and players
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchTeamAndPlayers = async () => {
      try {
        setLoading(true);
        setError("");

        // Wait a bit for auth to fully initialize
        await new Promise((resolve) => setTimeout(resolve, 100));

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          throw new Error("User profile not found. Please register first.");
        }

        const userData = userSnap.data();
        const teamID = userData?.teamID;

        if (!teamID) {
          navigate("/register-team");
          return;
        }

        const teamDocRef = doc(db, "teams", teamID);
        const teamSnap = await getDoc(teamDocRef);

        if (!teamSnap.exists()) {
          throw new Error("Team not found. It may have been deleted.");
        }

        setTeamData({ id: teamSnap.id, ...teamSnap.data() });

        const playersQuery = query(
          collection(db, "players"),
          where("teamID", "==", teamID)
        );
        const playerSnap = await getDocs(playersQuery);
        const playerList = playerSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPlayers(playerList);
      } catch (err) {
        console.error("Error fetching team data:", err);
        if (err.code === "permission-denied") {
          setError(
            "Permission denied. Please make sure you're logged in and have access to this team."
          );
        } else if (err.code === "unavailable") {
          setError("Service temporarily unavailable. Please try again later.");
        } else {
          setError(
            err.message || "Error fetching team data. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTeamAndPlayers();
  }, [user, userLoading, navigate]);

  const openModal = (player) => setSelectedPlayer(player);
  const closeModal = () => {
    setSelectedPlayer(null);
    setIsEditing(false);
  };

  // Handle editing player info
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!user) {
        setError("You must be logged in to edit players.");
        return;
      }

      const playerRef = doc(db, "players", selectedPlayer.id);

      // If making captain, unset current captain first
      if (editData.isCaptain) {
        const currentCaptain = players.find((p) => p.isCaptain);
        if (currentCaptain && currentCaptain.id !== selectedPlayer.id) {
          await updateDoc(doc(db, "players", currentCaptain.id), {
            isCaptain: false,
          });
        }
        await updateDoc(doc(db, "teams", teamData.id), {
          captainID: selectedPlayer.id,
        });
      }

      await updateDoc(playerRef, {
        name: editData.name,
        position: editData.position,
        isCaptain: editData.isCaptain,
      });

      setPlayers(
        players.map((p) =>
          p.id === selectedPlayer.id
            ? { ...p, ...editData }
            : editData.isCaptain
            ? { ...p, isCaptain: false }
            : p
        )
      );

      setSelectedPlayer({ ...selectedPlayer, ...editData });
      setIsEditing(false);
      alert("Player updated successfully!");
    } catch (err) {
      console.error("Error updating player:", err);
      if (err.code === "permission-denied") {
        setError(
          "Permission denied. You don't have access to edit this player."
        );
      } else {
        setError("Error updating player. Please try again.");
      }
    }
  };

  // Delete team and all players
  const deleteTeam = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete your team and all its players?"
      )
    )
      return;

    try {
      // Delete all players linked to the team
      const playersQuery = query(
        collection(db, "players"),
        where("teamID", "==", teamData.id)
      );
      const playerSnap = await getDocs(playersQuery);
      const deletePromises = playerSnap.docs.map((docSnap) =>
        deleteDoc(doc(db, "players", docSnap.id))
      );
      await Promise.all(deletePromises);

      // Delete team document
      await deleteDoc(doc(db, "teams", teamData.id));

      // Clear user’s team reference
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        hasTeam: false,
        teamID: "",
      });

      alert("Team and all players deleted successfully!");

      setTeamData(null);
      setPlayers([]);
      navigate("/");
    } catch (err) {
      console.error("Error deleting team:", err);
      if (err.code === "permission-denied") {
        setError(
          "Permission denied. You don't have access to delete this team."
        );
      } else {
        setError("Error deleting team. Please try again.");
      }
      setLoading(false);
    }
  };

  if (userLoading || loading)
    return <p className="text-center mt-10 text-gray-500">Loading...</p>;
  if (error) return <p className="text-center mt-10 text-red-500">{error}</p>;
  if (!teamData)
    return <p className="text-center mt-10 text-gray-600">No team found.</p>;

  return (
    <div className="mt-10 max-w-5xl mx-auto p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">{teamData.name}</h1>

      <div className="flex justify-between mb-6">
        <p className="font-medium">Manager: {teamData.manager}</p>
        <p className="font-medium">
          Goals: {teamData.goalsScored} / {teamData.goalsConceded}
        </p>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={deleteTeam}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          Delete Team
        </button>
      </div>

      <h2 className="text-2xl font-semibold mb-4">Players</h2>

      {/* Player Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {players.map((player) => (
          <div
            key={player.id}
            className={`border rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition text-center ${
              player.isCaptain ? "border-yellow-400" : ""
            }`}
            onClick={() => openModal(player)}
          >
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-lg">{player.name}</span>
                {player.isCaptain && (
                  <span className="px-2 py-0.5 bg-yellow-400 text-white text-xs font-semibold rounded-full">
                    Captain
                  </span>
                )}
              </div>
              <span className="text-gray-500">{player.position}</span>
              <span className="text-gray-400 text-sm">
                Rating: {player.overallRating}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Player Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-11/12 md:w-1/2 relative animate-fadeIn">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold"
              onClick={closeModal}
            >
              ✕
            </button>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {selectedPlayer.name}
                <span className="text-gray-500 text-lg font-medium">
                  ({selectedPlayer.position})
                </span>
                {selectedPlayer.isCaptain && (
                  <span className="ml-2 px-2 py-1 bg-yellow-400 text-white text-sm rounded-full">
                    Captain
                  </span>
                )}
              </h2>
            </div>

            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    className="border rounded w-full p-2 focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-gray-600 mb-1">Position</label>
                  <input
                    type="text"
                    value={editData.position}
                    onChange={(e) =>
                      setEditData({ ...editData, position: e.target.value })
                    }
                    className="border rounded w-full p-2 focus:ring-2 focus:ring-blue-400"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.isCaptain}
                    onChange={(e) =>
                      setEditData({ ...editData, isCaptain: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label className="text-gray-700 font-medium">
                    Set as Captain
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded shadow">
                    <p className="text-gray-600 font-medium">Overall Rating</p>
                    <p className="text-xl font-bold">
                      {selectedPlayer.overallRating}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded shadow">
                    <p className="text-gray-600 font-medium">Goals</p>
                    <p className="text-xl font-bold">{selectedPlayer.goals}</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded shadow mb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">
                    Detailed Ratings
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPlayer.ratings &&
                      Object.entries(selectedPlayer.ratings).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="p-2 bg-white rounded shadow text-center font-medium"
                          >
                            <p className="text-gray-500 text-sm">{key}</p>
                            <p className="text-lg font-bold">{value}</p>
                          </div>
                        )
                      )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditData(selectedPlayer);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
