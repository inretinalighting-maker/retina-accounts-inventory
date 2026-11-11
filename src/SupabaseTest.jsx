
import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

export default function SupabaseTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);

  async function testConnection() {
    if (testing) return;

    setTesting(true);
    setMessage("Connecting...");

    try {
      if (!supabase) {
        setMessage("Supabase configuration missing.");
        return;
      }

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        setMessage("Login failed: " + loginError.message);
        return;
      }

      // Read-only: count all accessible accounts.
      const { count, error: readError } =
        await supabase
          .from("accounts")
          .select("id", { count: "exact", head: true });

      if (readError) {
        setMessage("Database error: " + readError.message);
      } else {
        setMessage(
          "SUCCESS! Login verified. Supabase accounts: " +
            count +
            (count === 174
              ? " — Expected count verified!"
              : " — Count differs from expected 174.")
        );
      }
    } catch (error) {
      setMessage("Test error: " + error.message);
    } finally {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setTesting(false);
    }
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

      <button onClick={testConnection} disabled={testing}>
        {testing ? "Testing..." : "Test Supabase"}
      </button>

      <p>{message}</p>
    </div>
  );
}
