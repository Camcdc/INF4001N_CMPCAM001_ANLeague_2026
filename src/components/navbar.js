import { signOut } from "firebase/auth";
import { doc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../config/firebase";

export const Navbar = () => {
  const [user] = useAuthState(auth);
  const userDocRef = user ? doc(db, "users", user.uid) : null;
  const [userData] = useDocumentData(userDocRef);
  const navigate = useNavigate();

  const signOutUser = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <nav className="flex justify-between items-center h-20 px-6 shadow-md bg-white">
      {/* LEFT: Logo */}
      <div className="flex items-center">
        <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
      </div>

      {/* CENTER: Home link only */}
      <div className="flex-1 flex justify-center">
        <Link to="/" className="font-semibold hover:text-blue-500">
          Home
        </Link>
        &nbsp;|&nbsp;
        <Link
          to="/allTournaments"
          className="font-semibold hover:text-blue-500"
        >
          Tournaments
        </Link>
        &nbsp;|&nbsp;
        <Link className="font-semibold hover:text-blue-500" to="/fixtures">
          Fixtures
        </Link>
        &nbsp;|&nbsp;
        <Link className="font-semibold hover:text-blue-500">Players</Link>
        &nbsp;|&nbsp;
        <Link className="font-semibold hover:text-blue-500">News</Link>
      </div>

      {/* RIGHT: Login/Register or User Info */}
      <div className="flex items-center space-x-4">
        {!user ? (
          <>
            <Link to="/login" className="hover:text-blue-500">
              Login
            </Link>
            <Link to="/register" className="hover:text-blue-500">
              Register
            </Link>
          </>
        ) : (
          <>
            <button
              onClick={signOutUser}
              className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-md"
            >
              Log Out
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
