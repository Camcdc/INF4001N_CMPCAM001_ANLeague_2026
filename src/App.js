import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import { Navbar } from "./components/navbar";
import { CreateTournaments } from "./pages/allTournaments";
import { Login } from "./pages/login";
import { Main } from "./pages/main";
import { MatchPage } from "./pages/matchPage";
import { Team } from "./pages/myTeam";
import { Register } from "./pages/register";
import { RegisterTeam } from "./pages/register-team";
import { TeamPage } from "./pages/teamPage";
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
          <Route path="/myTeam" element={<Team />} />
          <Route path="/allTournaments" element={<CreateTournaments />} />
          <Route path="/tournament-page/:id" element={<TournamentPage />} />
          <Route path="/teamPage/:id" element={<TeamPage />} />
          <Route path="/match/:matchId" element={<MatchPage />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
