import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ROUTES } from "./routes";
import HomePage from "./pages/HomePage";
import TicketPage from "./pages/TicketPage";
import { ThemeProvider } from "./ThemeProvider";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.tickets} element={<TicketPage />} />
          <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}
