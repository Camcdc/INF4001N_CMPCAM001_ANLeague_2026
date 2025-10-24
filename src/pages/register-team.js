import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";

export const RegisterTeam = () => {
  const navigate = useNavigate();
  const [managerName, setManagerName] = useState("");
  const [players, setPlayers] = useState([]);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Update a player field
  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...players];
    newPlayers[index][field] = value;
    setPlayers(newPlayers);
  };

  // Fetch user federationID
  const fetchUserFederation = async () => {
    if (!currentUser) return "";
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    return userDoc.exists() ? userDoc.data().federationID || "" : "";
  };

  // Generate random ratings
  const generateRatings = (position) => {
    const positions = ["GK", "DF", "MD", "AT"];
    const ratings = {};
    positions.forEach((pos) => {
      ratings[pos] =
        pos === position
          ? Math.floor(Math.random() * 51) + 50
          : Math.floor(Math.random() * 51);
    });
    return ratings;
  };

  const calculateOverallRating = (ratings) => {
    const sum = Object.values(ratings).reduce((a, b) => a + b, 0);
    return Math.round(sum / 4);
  };

  const handleRegisterTeam = async () => {
    const federationID = await fetchUserFederation();
    if (!managerName || players.length !== 23) {
      alert("Please fill manager name and exactly 23 players");
      return;
    }

    try {
      // 1️⃣ Create team document
      const teamDocRef = await addDoc(collection(db, "teams"), {
        manager: managerName,
        averageRating: 0,
        captainID: "",
        currentStage: "",
        eliminated: false,
        federationID,
        goalsConceded: 0,
        goalsScored: 0,
        name: managerName + "'s Team",
        players: [],
        tournamentID: "",
        createdAt: serverTimestamp(),
      });

      let totalRating = 0;
      let captainID = "";

      // 2️⃣ Create player documents
      const playerNames = [];
      for (const p of players) {
        const ratings = generateRatings(p.position);
        const overallRating = calculateOverallRating(ratings);
        totalRating += overallRating;

        const playerDocRef = await addDoc(collection(db, "players"), {
          name: p.name,
          position: p.position,
          isCaptain: p.isCaptain,
          ratings,
          overallRating,
          goals: 0,
          teamID: teamDocRef.id,
        });

        playerNames.push(p.name);

        if (p.isCaptain) captainID = playerDocRef.id;
      }

      // 3️⃣ Update team document with players and captain
      await updateDoc(teamDocRef, {
        players: playerNames,
        averageRating: Math.round(totalRating / players.length),
        captainID,
      });

      // 4️⃣ Update user document with teamID
      if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid), {
          hasTeam: true,
          teamID: teamDocRef.id,
        });
      }

      alert("Team and players registered successfully!");
      navigate("/"); // "/" is your home page route
    } catch (error) {
      console.error("Error registering team:", error);
      alert("Failed to register team.");
    }
  };

  const autoFillPlayers = () => {
    const positions = ["GK", "DF", "MD", "AT"];
    const newPlayers = Array.from({ length: 23 }, (_, i) => ({
      name: `Player ${i + 1}`,
      position: positions[i % 4],
      isCaptain: i === 0, // first player is captain by default
    }));
    setPlayers(newPlayers);
  };

  return (
    <div className="mx-52 mt-8 p-10 border-2 rounded-md">
      <h1 className="text-xl font-bold mb-2">Register Your Team</h1>
      <p className="mb-4">Build your squad</p>

      <button
        type="button"
        onClick={autoFillPlayers}
        className="bg-yellow-500 text-white px-3 py-1 rounded-md mb-4"
      >
        Auto-Fill Players
      </button>

      <form className="space-y-4">
        <div className="flex flex-col">
          <label className="mb-1">Manager Name</label>
          <input
            type="text"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            className="border-2 rounded-md p-2"
          />
        </div>

        <div>
          <h2 className="font-semibold mb-2">Squad</h2>
          <div className="flex flex-col space-y-2">
            {players.map((player, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) =>
                    handlePlayerChange(index, "name", e.target.value)
                  }
                  placeholder={`Player ${index + 1} Name`}
                  className="border-2 rounded-md p-2 flex-1"
                />
                <select
                  required
                  value={player.position}
                  onChange={(e) =>
                    handlePlayerChange(index, "position", e.target.value)
                  }
                  className="border-2 rounded-md p-2"
                >
                  <option value=""></option>
                  <option value="GK">GK</option>
                  <option value="DF">DF</option>
                  <option value="MD">MD</option>
                  <option value="AT">AT</option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setPlayers((prev) =>
                      prev.map((p, i) =>
                        i === index
                          ? { ...p, isCaptain: !p.isCaptain }
                          : { ...p, isCaptain: false }
                      )
                    )
                  }
                  className={`border-2 rounded-md p-2 ${
                    player.isCaptain ? "bg-blue-400 text-white" : ""
                  }`}
                >
                  C
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                if (players.length < 23) {
                  setPlayers([
                    ...players,
                    { name: "", position: "", isCaptain: false },
                  ]);
                } else {
                  alert("You can only add up to 23 players");
                }
              }}
              className="bg-blue-600 text-white px-3 py-1 rounded-md mt-2"
            >
              Add Player
            </button>
          </div>
        </div>
      </form>

      <button
        type="button"
        onClick={handleRegisterTeam}
        className="bg-green-600 text-white px-4 py-2 rounded-md mt-4"
      >
        Register Team
      </button>
    </div>
  );
};
