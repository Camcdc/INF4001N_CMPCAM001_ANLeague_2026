import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { Link, useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../config/firebase";

export const TournamentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Check if user has a team
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          alert("User not found");
          return;
        }

        const userData = userDoc.data();
        if (!userData.teamID) {
          // No team → redirect to register-team
          navigate("/register-team");
          return;
        }

        // Fetch tournament
        const tournamentDoc = await getDoc(doc(db, "tournament", id));
        if (tournamentDoc.exists()) {
          setTournament({ id: tournamentDoc.id, ...tournamentDoc.data() });
        } else {
          alert("Tournament not found");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, id, navigate]);

  const registerTeam = async (teamID) => {
    if (!teamID || !tournament) return;

    if (tournament.teamsQualified?.includes(teamID)) {
      alert("Your team is already registered for this tournament");
      return;
    }

    setRegistering(true);
    try {
      const tournamentRef = doc(db, "tournament", id);
      await updateDoc(tournamentRef, {
        teamsQualified: arrayUnion(teamID),
      });

      setTournament((prev) => ({
        ...prev,
        teamsQualified: [...(prev.teamsQualified || []), teamID],
      }));

      alert("Team registered successfully!");
    } catch (err) {
      console.error("Error registering team:", err);
      alert("Failed to register team");
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!tournament) return <p>Tournament not found</p>;

  const teams = tournament.teamsQualified || [];
  const canRegister = teams.length < 8; // Only show registration card if less than 8 teams

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{tournament.name}</h1>
      <p className="mb-4">
        <span className="font-semibold">Stage:</span> {tournament.stage}
      </p>

      <h2 className="text-xl font-semibold mb-2">Teams</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map((teamId) => (
          <Link
            to={`/team/${teamId}`}
            key={teamId}
            className="border rounded-lg p-4 shadow hover:shadow-lg transition duration-200 bg-white"
          >
            <h3 className="text-lg font-bold">{teamId}</h3>
          </Link>
        ))}

        {canRegister && (
          <div
            onClick={async () => {
              if (!user) return;
              try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.data();
                if (userData.teamID) {
                  registerTeam(userData.teamID);
                } else {
                  navigate("/register-team");
                }
              } catch (err) {
                console.error("Error fetching user team:", err);
              }
            }}
            className="border rounded-lg p-4 shadow hover:shadow-lg transition duration-200 bg-gray-100 flex items-center justify-center cursor-pointer text-blue-600 font-bold"
          >
            + Register My Team
          </div>
        )}
      </div>
    </div>
  );
};
