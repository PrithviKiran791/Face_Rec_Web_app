"use client";

import { useState, useEffect } from "react";
import axios from "axios";

interface Contacts {
  email?: string;
  phone?: string;
  parent_email?: string;
  parent_phone?: string;
  manager_email?: string;
  manager_phone?: string;
}

interface Preferences {
  receive_own: boolean;
  receive_absences: boolean;
  notify_parents: boolean;
  notify_managers: boolean;
  channel: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  deliveries: number;
  failures: number;
}

export default function NotificationSettings() {
  const [activeTab, setActiveTab] = useState<"contacts" | "preferences" | "webhooks">("contacts");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Contacts state
  const [contacts, setContacts] = useState<Contacts>({});
  const [contactChanges, setContactChanges] = useState<Contacts>({});

  // Preferences state
  const [preferences, setPreferences] = useState<Preferences>({
    receive_own: true,
    receive_absences: true,
    notify_parents: false,
    notify_managers: false,
    channel: "email",
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhook, setNewWebhook] = useState({
    url: "",
    secret: "",
    events: ["absence"],
    active: true,
  });

  // Load data on mount
  useEffect(() => {
    loadContacts();
    loadPreferences();
    loadWebhooks();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await axios.get("/api/notifications/contacts", {
        withCredentials: true,
      });
      setContacts(response.data.contacts);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load contacts");
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await axios.get("/api/notifications/preferences", {
        withCredentials: true,
      });
      setPreferences(response.data.preferences);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load preferences");
    }
  };

  const loadWebhooks = async () => {
    try {
      const response = await axios.get("/api/notifications/webhooks", {
        withCredentials: true,
      });
      setWebhooks(response.data.webhooks);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load webhooks");
    }
  };

  // Update contacts
  const handleContactChange = (field: keyof Contacts, value: string) => {
    setContactChanges({ ...contactChanges, [field]: value });
  };

  const saveContacts = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/notifications/contacts", contactChanges, {
        withCredentials: true,
      });
      setSuccess("Contacts updated successfully");
      setContactChanges({});
      loadContacts();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update contacts");
    } finally {
      setLoading(false);
    }
  };

  // Update preferences
  const handlePreferenceChange = (field: keyof Preferences, value: any) => {
    setPreferences({ ...preferences, [field]: value });
  };

  const savePreferences = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/notifications/preferences", preferences, {
        withCredentials: true,
      });
      setSuccess("Preferences updated successfully");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update preferences");
    } finally {
      setLoading(false);
    }
  };

  // Create webhook
  const createWebhook = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await axios.post("/api/notifications/webhooks", newWebhook, {
        withCredentials: true,
      });
      setSuccess("Webhook created successfully");
      setNewWebhook({
        url: "",
        secret: "",
        events: ["absence"],
        active: true,
      });
      loadWebhooks();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create webhook");
    } finally {
      setLoading(false);
    }
  };

  // Delete webhook
  const deleteWebhook = async (webhookId: string) => {
    if (!confirm("Delete this webhook?")) return;

    try {
      await axios.delete(`/api/notifications/webhooks/${webhookId}`, {
        withCredentials: true,
      });
      setSuccess("Webhook deleted");
      loadWebhooks();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete webhook");
    }
  };

  // Test webhook
  const testWebhook = async (webhookId: string) => {
    try {
      await axios.post(`/api/notifications/webhooks/${webhookId}/test`, {}, {
        withCredentials: true,
      });
      setSuccess("Test event sent to webhook");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to test webhook");
    }
  };

  return (
    <main className="space-y-6">
      <section className="panel">
        <div className="panel-header">
          <h1 className="panel-title">Notification Settings</h1>
          <p className="panel-subtitle">
            Configure alerts, contacts, and webhooks for attendance notifications.
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              color: "#22c55e",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--surface)" }}>
          {(["contacts", "preferences", "webhooks"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 16px",
                background: activeTab === tab ? "rgba(14, 165, 233, 0.1)" : "transparent",
                color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                textTransform: "capitalize",
                borderBottom: activeTab === tab ? "2px solid var(--accent)" : "none",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="panel-body">
          {/* Contacts Tab */}
          {activeTab === "contacts" && (
            <div className="space-y-4">
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                Your Contact Information
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Your Email</label>
                  <input
                    type="email"
                    className="field"
                    value={contactChanges.email ?? contacts.email ?? ""}
                    onChange={(e) => handleContactChange("email", e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="field-label">Your Phone</label>
                  <input
                    type="tel"
                    className="field"
                    value={contactChanges.phone ?? contacts.phone ?? ""}
                    onChange={(e) => handleContactChange("phone", e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <hr style={{ margin: "20px 0", opacity: 0.2 }} />

              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                Parent/Guardian Information
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Parent Email</label>
                  <input
                    type="email"
                    className="field"
                    value={contactChanges.parent_email ?? contacts.parent_email ?? ""}
                    onChange={(e) => handleContactChange("parent_email", e.target.value)}
                    placeholder="parent@email.com"
                  />
                </div>
                <div>
                  <label className="field-label">Parent Phone</label>
                  <input
                    type="tel"
                    className="field"
                    value={contactChanges.parent_phone ?? contacts.parent_phone ?? ""}
                    onChange={(e) => handleContactChange("parent_phone", e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <hr style={{ margin: "20px 0", opacity: 0.2 }} />

              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                Manager Information
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="field-label">Manager Email</label>
                  <input
                    type="email"
                    className="field"
                    value={contactChanges.manager_email ?? contacts.manager_email ?? ""}
                    onChange={(e) => handleContactChange("manager_email", e.target.value)}
                    placeholder="manager@email.com"
                  />
                </div>
                <div>
                  <label className="field-label">Manager Phone</label>
                  <input
                    type="tel"
                    className="field"
                    value={contactChanges.manager_phone ?? contacts.manager_phone ?? ""}
                    onChange={(e) => handleContactChange("manager_phone", e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <button
                onClick={saveContacts}
                disabled={loading}
                className="btn btn-primary"
                style={{ marginTop: "20px" }}
              >
                {loading ? "Saving..." : "Save Contacts"}
              </button>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-4">
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                Notification Preferences
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={preferences.receive_own}
                    onChange={(e) => handlePreferenceChange("receive_own", e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Notify me when I'm absent</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={preferences.receive_absences}
                    onChange={(e) => handlePreferenceChange("receive_absences", e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Receive absence alerts</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={preferences.notify_parents}
                    onChange={(e) => handlePreferenceChange("notify_parents", e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Notify parents/guardians</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={preferences.notify_managers}
                    onChange={(e) => handlePreferenceChange("notify_managers", e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Notify managers</span>
                </label>
              </div>

              <hr style={{ margin: "20px 0", opacity: 0.2 }} />

              <div>
                <label className="field-label">Notification Channel</label>
                <select
                  className="select"
                  value={preferences.channel}
                  onChange={(e) => handlePreferenceChange("channel", e.target.value)}
                >
                  <option value="email">Email only</option>
                  <option value="sms">SMS only</option>
                  <option value="both">Email & SMS</option>
                </select>
              </div>

              <button
                onClick={savePreferences}
                disabled={loading}
                className="btn btn-primary"
                style={{ marginTop: "20px" }}
              >
                {loading ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          )}

          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="space-y-4">
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                Create New Webhook
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label className="field-label">Webhook URL</label>
                  <input
                    type="url"
                    className="field"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                    placeholder="https://your-system.com/webhooks/attendance"
                  />
                </div>

                <div>
                  <label className="field-label">Webhook Secret</label>
                  <input
                    type="password"
                    className="field"
                    value={newWebhook.secret}
                    onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                    placeholder="Your secret key for signature verification"
                  />
                </div>

                <div>
                  <label className="field-label">Events to Subscribe</label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    {["absence", "attendance"].map((event) => (
                      <label key={event} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="checkbox"
                          checked={newWebhook.events.includes(event)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewWebhook({
                                ...newWebhook,
                                events: [...newWebhook.events, event],
                              });
                            } else {
                              setNewWebhook({
                                ...newWebhook,
                                events: newWebhook.events.filter((ev) => ev !== event),
                              });
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        />
                        <span style={{ textTransform: "capitalize" }}>{event}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={createWebhook}
                  disabled={loading || !newWebhook.url || !newWebhook.secret}
                  className="btn btn-primary"
                >
                  {loading ? "Creating..." : "Create Webhook"}
                </button>
              </div>

              <hr style={{ margin: "20px 0", opacity: 0.2 }} />

              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px" }}>
                Your Webhooks
              </h3>

              {webhooks.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>No webhooks created yet.</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {webhooks.map((webhook) => (
                    <div
                      key={webhook.id}
                      style={{
                        border: "1px solid var(--surface)",
                        borderRadius: "4px",
                        padding: "12px",
                      }}
                    >
                      <div style={{ marginBottom: "8px" }}>
                        <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>
                          {webhook.url}
                        </p>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          Events: {webhook.events.join(", ")} | Status: {webhook.active ? "Active" : "Inactive"}
                        </p>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          Deliveries: {webhook.deliveries} | Failures: {webhook.failures}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => testWebhook(webhook.id)}
                          className="btn"
                          style={{
                            fontSize: "12px",
                            padding: "6px 12px",
                            backgroundColor: "rgba(59, 130, 246, 0.2)",
                            color: "#3b82f6",
                            border: "1px solid rgba(59, 130, 246, 0.4)",
                          }}
                        >
                          Test
                        </button>
                        <button
                          onClick={() => deleteWebhook(webhook.id)}
                          className="btn"
                          style={{
                            fontSize: "12px",
                            padding: "6px 12px",
                            backgroundColor: "rgba(239, 68, 68, 0.2)",
                            color: "#ef4444",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
