import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import "@/i18n";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdmin from "./pages/SuperAdmin";
import Onboarding from "./pages/Onboarding";
import PublicBooking from "./pages/PublicBooking";
import InstagramBooking from "./pages/InstagramBooking";
import PendingApproval from "./pages/PendingApproval";
import HotelProfile from "./pages/HotelProfile";
import Contacts from "./pages/Contacts";
import Pricing from "./pages/Pricing";
import Help from "./pages/Help";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";
import AcceptInvite from "./pages/AcceptInvite";
import Presentation from "./pages/Presentation";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/book/:hotelSlug" element={<PublicBooking />} />
              <Route path="/hotels/:hotelSlug" element={<HotelProfile />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/help" element={<Help />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              <Route path="/presentation" element={<Presentation />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
