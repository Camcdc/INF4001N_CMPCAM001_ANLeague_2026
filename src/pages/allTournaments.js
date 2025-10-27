import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";

export const CreateTournaments = () => {
  const [existingTournaments, setExistingTournaments] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const auth = getAuth();
  const navigate = useNavigate();

  // Fetch tournaments from Firestore (with federationIDs for teams)
  const fetchTournaments = async () => {
    try {
      const snapshot = await getDocs(collection(db, "tournament"));
      const tournaments = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          // Fetch federationIDs for all teamsQualified
          if (data.teamsQualified && data.teamsQualified.length > 0) {
            const teams = await Promise.all(
              data.teamsQualified.map(async (teamId) => {
                const teamDoc = await getDoc(doc(db, "teams", teamId));
                if (teamDoc.exists()) {
                  return {
                    id: teamId,
                    federationID: teamDoc.data().federationID || "Unknown",
                  };
                } else {
                  return { id: teamId, federationID: "Unknown" };
                }
              })
            );
            data.teamsQualified = teams; // Replace team IDs with objects containing federationIDs
          } else {
            data.teamsQualified = [];
          }

          return { id: docSnap.id, ...data };
        })
      );

      setExistingTournaments(
        tournaments.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
      );
    } catch (err) {
      console.error("Error fetching tournaments:", err);
    }
  };

  // Check the role of user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setAdmin(userDoc.exists() && userDoc.data().role === "admin");
      } else {
        setAdmin(false);
      }
      await fetchTournaments();
      setCheckingAdmin(false);
    });

    return () => unsubscribe();
  }, []);

  // Create a new tournament
  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) return alert("Enter a tournament name");
    if (!admin) return alert("Only admins can create tournaments");

    setLoading(true);
    try {
      const bracketDoc = {
        name: tournamentName,
        stage: "Waiting for Teams",
        createdAt: Timestamp.now(),
        lastReset: Timestamp.now(),
        teamsQualified: [],
        quarterFinals: [],
        semiFinals: [],
        final: [],
        champion: null,
        completedMatches: [],
        bracket: {},
      };

      await addDoc(collection(db, "tournament"), bracketDoc);
      alert("Tournament created!");
      setTournamentName("");
      setModalOpen(false);
      fetchTournaments();
    } catch (err) {
      console.error("Error creating tournament:", err);
      alert("Error creating tournament! " + err.message);
    }
    setLoading(false);
  };

  if (checkingAdmin) return <p>Loading...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        {admin && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Create Tournament
          </button>
        )}
      </div>

      {/* Tournaments */}
      {existingTournaments.length === 0 ? (
        <p className="text-gray-500">No tournaments found.</p>
      ) : (
        <div className="space-y-6">
          {existingTournaments.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-xl transition cursor-pointer w-full"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold">{t.name}</h3>
                <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {t.stage}
                </span>
              </div>

              <p className="text-gray-600 mb-3">
                Teams Registered: {t.teamsQualified?.length || 0}
              </p>

              {/* Show federationIDs instead of team IDs */}
              <div className="flex gap-2 flex-wrap mb-4">
                {t.teamsQualified?.map((team) => (
                  <span
                    key={team.id}
                    className="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded-full"
                  >
                    {team.federationID}
                  </span>
                ))}
              </div>

              <button
                onClick={() => navigate(`/tournament/${t.id}`)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              >
                View Tournament
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Create Tournament */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create Tournament</h2>
            <input
              type="text"
              placeholder="Tournament Name"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="border p-2 w-full rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded border hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTournament}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
