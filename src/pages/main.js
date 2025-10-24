import { getAuth } from "firebase/auth";
import { doc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { Link } from "react-router-dom";
import { db } from "../config/firebase";

export const Main = () => {
  const auth = getAuth();
  const [user] = useAuthState(auth);
  const userDocRef = user ? doc(db, "users", user.uid) : null;
  const [userData] = useDocumentData(userDocRef);

  return (
    <div className="p-6 text-center">
      {user ? (
        //LOGGED IN VIEW OF SYSTEM
        <div className="shadow border-solid border-2 p-6 inline-block rounded-md">
          <h2 className="text-xl font-semibold">
            Welcome, {userData?.name || user.displayName || "User"}!
          </h2>
          <div>
            {userData?.hasTeam ? (
              <Link to="/team">View Team</Link>
            ) : (
              <Link to="/register-team">Register Team</Link>
            )}
          </div>
          <div>
            <Link to="/create-tournaments">Manage Tournaments</Link>
          </div>
        </div>
      ) : (
        //LOGGED OUT VIEW OF SYSTEM
        <h2 className="text-xl font-semibold">Home Page</h2>
      )}
    </div>
  );
};
