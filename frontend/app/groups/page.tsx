"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMembers,
  removeGroupMembers,
  getIdentities,
} from "@/lib/api";

/* ── Types ────────────────────────────────────────────────────────────────── */
type Group = {
  id: string;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
};

/* ── Icons ────────────────────────────────────────────────────────────────── */
const Icons = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  ),
};

export default function GroupsPage() {
  const { isLoaded, userId } = useAuth();
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [showMemberModal, setShowMemberModal] = useState<string | null>(null);
  const [selectedIdentities, setSelectedIdentities] = useState<Set<string>>(new Set());

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["groups"],
    enabled: !!isLoaded && !!userId,
    queryFn: async () => (await getGroups()).data.groups as Group[],
  });

  const { data: identitiesData } = useQuery({
    queryKey: ["all-identities"],
    enabled: !!isLoaded && !!userId,
    queryFn: async () => (await getIdentities()).data.identities as string[],
  });

  const { data: membersData } = useQuery({
    queryKey: ["group-members", expandedGroup],
    enabled: !!expandedGroup,
    queryFn: async () => (await getGroupMembers(expandedGroup!)).data.members as string[],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (d: { name: string; description: string }) => createGroup(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description: string }) => updateGroup(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["groups"] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });

  const addMembersMut = useMutation({
    mutationFn: ({ id, identities }: { id: string; identities: string[] }) => addGroupMembers(id, identities),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", showMemberModal] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setShowMemberModal(null);
      setSelectedIdentities(new Set());
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ id, identity }: { id: string; identity: string }) => removeGroupMembers(id, [identity]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", expandedGroup] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openCreate = () => { setEditingGroup(null); setFormName(""); setFormDesc(""); setShowModal(true); };
  const openEdit = (g: Group) => { setEditingGroup(g); setFormName(g.name); setFormDesc(g.description); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingGroup(null); setFormName(""); setFormDesc(""); };

  const handleSubmit = () => {
    if (!formName.trim()) return;
    if (editingGroup) {
      updateMut.mutate({ id: editingGroup.id, name: formName.trim(), description: formDesc.trim() });
    } else {
      createMut.mutate({ name: formName.trim(), description: formDesc.trim() });
    }
  };

  const handleDelete = (g: Group) => {
    if (confirm(`Delete group "${g.name}"? Members will NOT be removed from the registry.`)) {
      deleteMut.mutate(g.id);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedGroup(expandedGroup === id ? null : id);
  };

  const groups = groupsData ?? [];
  const allIdentities = identitiesData ?? [];
  const currentMembers = membersData ?? [];

  // For the add-members modal: filter out already-assigned members
  const availableIdentities = allIdentities.filter((id) => {
    if (showMemberModal && currentMembers.includes(id)) return false;
    if (memberSearch && !id.toLowerCase().includes(memberSearch.toLowerCase())) return false;
    return true;
  });

  // Need to load members for the add-member modal's context
  const { data: addModalMembers } = useQuery({
    queryKey: ["group-members", showMemberModal],
    enabled: !!showMemberModal,
    queryFn: async () => (await getGroupMembers(showMemberModal!)).data.members as string[],
  });

  const addModalExisting = addModalMembers ?? [];
  const filteredAvailable = allIdentities.filter((id) => {
    if (addModalExisting.includes(id)) return false;
    if (memberSearch && !id.toLowerCase().includes(memberSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Class & Group Management</div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
            Organize registered identities into classes, departments, or teams.
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          {Icons.plus} New Group
        </button>
      </div>

      {/* Groups Grid */}
      {isLoading ? (
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
            Loading groups...
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📁</div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>No groups created yet</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
              Create your first group to organize students or employees into classes and departments.
            </p>
            <button className="btn btn-primary" onClick={openCreate}>
              {Icons.plus} Create First Group
            </button>
          </div>
        </div>
      ) : (
        <div className="dash-grid-2">
          {groups.map((g) => (
            <div key={g.id} className="panel" style={{ transition: "all 0.2s" }}>
              <div className="panel-header" style={{ cursor: "pointer" }} onClick={() => toggleExpand(g.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "14px",
                    background: "var(--accent-glow)", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {Icons.users}
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)" }}>{g.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {g.member_count} member{g.member_count !== 1 ? "s" : ""}
                      {g.description && ` · ${g.description}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(g); }} title="Edit">
                    {Icons.edit}
                  </button>
                  <button className="icon-btn icon-btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(g); }} title="Delete">
                    {Icons.trash}
                  </button>
                  <span style={{
                    transform: expandedGroup === g.id ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s", display: "flex", color: "var(--text-muted)"
                  }}>
                    {Icons.chevron}
                  </span>
                </div>
              </div>

              {/* Expanded member list */}
              {expandedGroup === g.id && (
                <div className="panel-body" style={{ borderTop: "1px solid var(--border)", padding: "16px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>MEMBERS</span>
                    <button className="btn" style={{ padding: "8px 16px", fontSize: "12px", border: "1px solid var(--accent)", color: "var(--accent)", background: "transparent" }} onClick={() => { setShowMemberModal(g.id); setMemberSearch(""); setSelectedIdentities(new Set()); }}>
                      {Icons.plus} Add Members
                    </button>
                  </div>
                  {currentMembers.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>No members assigned yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {currentMembers.map((m) => (
                        <div key={m} className="member-chip">
                          <span>{m.split("@")[0]}</span>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{m.split("@")[1] || ""}</span>
                          <button className="chip-remove" onClick={() => removeMemberMut.mutate({ id: g.id, identity: m })} title="Remove">
                            {Icons.x}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal ────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>{editingGroup ? "Edit Group" : "Create New Group"}</h3>
              <button className="icon-btn" onClick={closeModal}>{Icons.x}</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label className="field-label">Group Name *</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Class 10A, Engineering Dept"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label">Description</label>
                  <input
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "transparent" }} onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!formName.trim()}>
                {editingGroup ? "Save Changes" : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Members Modal ────────────────────────────────────────────────── */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "80vh" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Add Members</h3>
              <button className="icon-btn" onClick={() => setShowMemberModal(null)}>{Icons.x}</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search registered identities..."
                className="field"
              />
              <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {filteredAvailable.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "20px", textAlign: "center" }}>
                    {allIdentities.length === 0 ? "No registered identities found." : "All identities are already in this group."}
                  </p>
                ) : (
                  filteredAvailable.map((id) => (
                    <label key={id} className="member-select-row">
                      <input
                        type="checkbox"
                        checked={selectedIdentities.has(id)}
                        onChange={() => {
                          const next = new Set(selectedIdentities);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          setSelectedIdentities(next);
                        }}
                      />
                      <span style={{ fontWeight: 500 }}>{id.split("@")[0]}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{id.split("@")[1] || ""}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{selectedIdentities.size} selected</span>
              <button
                className="btn btn-primary"
                disabled={selectedIdentities.size === 0}
                onClick={() => addMembersMut.mutate({ id: showMemberModal, identities: Array.from(selectedIdentities) })}
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
