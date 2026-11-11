
import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

export default function SupabaseTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function testConnection() {
    setMessage("Connecting...");

    if (!supabase) {
      setMessage("Supabase configuration missing.");
      return;
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setMessage("Login failed: " + error.message);
      return;
    }

    const { data: accounts, error: readError } =
      await supabase
        .from("accounts")
        .select("id")
        .limit(1);

    if (readError) {
      setMessage("Database error: " + readError.message);
    } else {
      setMessage(
        "SUCCESS! Login verified. Accounts accessible: " +
          accounts.length
      );
    }

    await supabase.auth.signOut();
  }

  return (
    <div style={{ padding: 30 }}>
      <h2>Retina Supabase Connection Test</h2>

      <input
        type="email"
        placeholder="Admin email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={testConnection}>
        Test Supabase
      </button>

      <p>{message}</p>
    </div>
  );
}
