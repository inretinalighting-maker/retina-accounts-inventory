
import React, { useState } from "react";
import { supabase } from "./supabaseClient.js";

const TABLES = [
  { name: "accounts", expected: 174 },
  { name: "transactions", expected: 58 },
  { name: "openingBalances", expected: 4 },
  { name: "bankAccounts", expected: 4 },
  { name: "bankTransactions", expected: 0 },
  { name: "reconciliation", expected: 0 },
  { name: "projects", expected: 3 },
  { name: "parties", expected: 2 },
  { name: "salesInvoices", expected: 0 },
  { name: "purchaseBills", expected: 0 },
];

export default function SupabaseTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState([]);
  const [testing, setTesting] = useState(false);

  async function testConnection() {
    if (testing) return;

    setTesting(true);
    setResults([]);
    setMessage("Connecting to Supabase...");

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

      setMessage("Login verified. Checking all 10 tables...");

      const checks = await Promise.all(
        TABLES.map(async (table) => {
          try {
            const { count, error } = await supabase
              .from(table.name)
              .select("*", {
                count: "exact",
                head: true,
              });

            if (error) {
              return {
                ...table,
                actual: null,
                status: "FAIL",
                detail: error.message,
              };
            }

            return {
              ...table,
              actual: count,
              status:
                count === table.expected ? "PASS" : "FAIL",
              detail:
                count === table.expected
                  ? "Count verified"
                  : "Count mismatch",
            };
          } catch (error) {
            return {
              ...table,
              actual: null,
              status: "FAIL",
              detail: error.message,
            };
          }
        })
      );

      setResults(checks);

      const passed = checks.filter(
        (item) => item.status === "PASS"
      ).length;

      const totalRecords = checks.reduce(
        (sum, item) => sum + (item.actual ?? 0),
        0
      );

      setMessage(
        passed === TABLES.length
          ? `SUCCESS! All 10 tables PASS. ${totalRecords} records accessible.`
          : `CHECK REQUIRED: ${passed}/10 tables PASS. Review failures below.`
      );
    } catch (error) {
      setMessage("Test error: " + error.message);
    } finally {
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error("Sign-out error:", error);
        }
      }
      setTesting(false);
    }
  }

  return (
    <div
      style={{
        padding: 30,
        fontFamily: "Arial, sans-serif",
        maxWidth: 850,
        margin: "auto",
      }}
    >
      <h2>Retina Supabase — 10 Table Verification</h2>

      <p>Read-only database connection test</p>

      <input
        type="email"
        placeholder="Admin email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 10, marginRight: 8 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: 10, marginRight: 8 }}
      />

      <button
        onClick={testConnection}
        disabled={testing}
        style={{ padding: 10, cursor: "pointer" }}
      >
        {testing ? "Checking..." : "Test All 10 Tables"}
      </button>

      <h3>{message}</h3>

      {results.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            border="1"
            cellPadding="10"
            style={{
              borderCollapse: "collapse",
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th>Table</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {results.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.expected}</td>
                  <td>{item.actual ?? "—"}</td>
                  <td
                    style={{
                      color:
                        item.status === "PASS"
                          ? "green"
                          : "red",
                      fontWeight: "bold",
                    }}
                  >
                    {item.status}
                  </td>
                  <td>{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 25, color: "#666" }}>
        This test reads Supabase only.
        Google Sheets remains the live backend.
      </p>
    </div>
  );
}
