import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import { Navbar } from "./components/navbar";
import { CreateTournaments } from "./pages/create-tournaments";
import { Login } from "./pages/login";
import { Main } from "./pages/main";
import { Register } from "./pages/register";
import { RegisterTeam } from "./pages/register-team";
import { Team } from "./pages/team";
import { TournamentPage } from "./pages/tournament-page";

function App() {
  return (
    <div className="App">
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-team" element={<RegisterTeam />} />
          <Route path="/team" element={<Team />} />
          <Route path="/create-tournaments" element={<CreateTournaments />} />
          <Route path="/tournament/:id" element={<TournamentPage />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
