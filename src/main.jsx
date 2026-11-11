
import React from "react";
import { createRoot } from "react-dom/client";
import RetinaAccountsInventoryOS from "./RetinaAccountsInventoryOS.jsx";
import SupabaseTest from "./SupabaseTest.jsx";

const isSupabaseTest =
  window.location.pathname === "/supabase-test";

createRoot(document.getElementById("root")).render(
  isSupabaseTest
    ? <SupabaseTest />
    : <RetinaAccountsInventoryOS />
);
