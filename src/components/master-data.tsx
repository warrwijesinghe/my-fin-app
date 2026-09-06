"use client";

import { useState } from "react";

type RecordItem = { id: string; name: string; isActive: number | boolean; scope?: "PERSONAL" | "BUSINESS" | null; projectId?: string | null };
type Section = "PROJECT" | "CATEGORY" | "TASK";
const sections = [
  { id: "PROJECT" as const, title: "Projects", singular: "project", description: "Organize business activity by project.", icon: "folder" },
  { id: "CATEGORY" as const, title: "Categories", singular: "category", description: "Group transactions for clearer reporting.", icon: "grid" },
  { id: "TASK" as const, title: "Tasks", singular: "task", description: "Track activities and link them to projects.", icon: "check" },
];
function Icon({ kind }: { kind: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "folder" ? <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /> : kind === "grid" ? <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></> : kind === "search" ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></> : <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m7 12 3 3 7-7" /></>}</svg>;
}
function RecordForm({ section, record, projects, onCancel }: { section: Section; record?: RecordItem; projects: RecordItem[]; onCancel: () => void }) {
  const [pending, setPending] = useState(false);
  const singular = sections.find(item => item.id === section)!.singular;
  return <form action="/api/master-data" method="post" className="md-form" onSubmit={() => setPending(true)}>
    <input type="hidden" name="entity" value={section} /><input type="hidden" name="intent" value={record ? "update" : "create"} />{record && <input type="hidden" name="id" value={record.id} />}
    <div className="md-form-heading"><h3>{record ? `Edit ${singular}` : `New ${singular}`}</h3><p className="muted">{record ? "Update the details or change availability." : "Add a record to use when entering transactions."}</p></div>
    <label>Name<input autoFocus name="name" placeholder={`e.g. ${section === "PROJECT" ? "Office renovation" : section === "CATEGORY" ? "Office supplies" : "Monthly maintenance"}`} defaultValue={record?.name} minLength={2} maxLength={section === "CATEGORY" ? 100 : section === "PROJECT" ? 120 : 140} required /></label>
    {section !== "PROJECT" && <label>Scope<select name="scope" defaultValue={record?.scope ?? (section === "CATEGORY" ? "" : "PERSONAL")}>{section === "CATEGORY" && <option value="">Personal & business</option>}<option value="PERSONAL">Personal</option><option value="BUSINESS">Business</option></select></label>}
    {section === "TASK" && <label>Project <span className="md-optional">(optional)</span><select name="projectId" defaultValue={record?.projectId ?? ""}><option value="">No project</option>{projects.filter(p => p.isActive || p.id === record?.projectId).map(p => <option key={p.id} value={p.id}>{p.name}{!p.isActive ? " (inactive)" : ""}</option>)}</select></label>}
    <label className="md-active"><input type="checkbox" name="isActive" defaultChecked={record ? Boolean(record.isActive) : true} /><span>Active<small>Available when entering transactions</small></span></label>
    <div className="md-form-footer"><button type="button" className="button" onClick={onCancel}>Cancel</button><button type="submit" className="button primary" disabled={pending}>{pending ? "Saving…" : record ? "Save changes" : `Add ${singular}`}</button></div>
  </form>;
}
export function MasterData({ projects, categories, tasks, initialSection = "PROJECT", result = "" }: { projects: RecordItem[]; categories: RecordItem[]; tasks: RecordItem[]; initialSection?: Section; result?: string }) {
  const [section, setSection] = useState<Section>(initialSection);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<string | null>(null);
  const [notice, setNotice] = useState(result);
  const data = { PROJECT: projects, CATEGORY: categories, TASK: tasks };
  const current = sections.find(item => item.id === section)!;
  const records = data[section];
  const visible = records.filter(record => record.name.toLowerCase().includes(query.trim().toLowerCase()) && (status === "all" || Boolean(record.isActive) === (status === "active")));
  const activeCount = records.filter(record => record.isActive).length;
  return <div className="md-workspace">
    <nav className="md-nav" aria-label="Master record types"><p className="eyebrow">Your master files</p>{sections.map(item => <button type="button" key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => { setSection(item.id); setQuery(""); setStatus("all"); setEditor(null); setNotice(""); window.history.replaceState(null, "", `/master-data?section=${item.id}`); }}><Icon kind={item.icon} /><span>{item.title}</span><b>{data[item.id].length}</b></button>)}<div className="md-nav-tip"><strong>Keep your records tidy</strong><p>Deactivate records you no longer use to keep transaction choices focused.</p></div></nav>
    <section className="panel md-content" aria-label={current.title}>
      <div className="md-heading"><div className="md-title"><span className="md-icon"><Icon kind={current.icon} /></span><div><h2>{current.title}</h2><p className="muted">{current.description}</p></div></div><button className="button primary" type="button" onClick={() => setEditor("new")}><span aria-hidden="true">＋</span> Add {current.singular}</button></div>
      {notice && <div className={`md-notice ${notice === "error" ? "md-error" : ""}`} role={notice === "error" ? "alert" : "status"}><span>{notice === "error" ? "Unable to save. Check the record details and try again." : `Record ${notice} successfully.`}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
      <div className="md-stats"><span><b>{records.length}</b> total records</span><span><i /> <b>{activeCount}</b> active</span><span><b>{records.length - activeCount}</b> inactive</span></div>
      {editor === "new" && <RecordForm key={`${section}-new`} section={section} projects={projects} onCancel={() => setEditor(null)} />}
      <div className="md-toolbar"><label className="md-search"><Icon kind="search" /><input aria-label={`Search ${current.title.toLowerCase()}`} placeholder={`Search ${current.title.toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></div>
      <div className="md-list">{visible.map(record => <article className="md-record" key={record.id}><div className="md-record-line"><span className="md-record-icon"><Icon kind={current.icon} /></span><div className="md-record-name"><strong>{record.name}</strong><small>{section === "PROJECT" ? "Business project" : record.scope === "PERSONAL" ? "Personal" : record.scope === "BUSINESS" ? "Business" : "Personal & business"}{section === "TASK" && ` · ${record.projectId ? projects.find(p => p.id === record.projectId)?.name || "Archived project" : "No project"}`}</small></div><span className={`md-badge ${record.isActive ? "is-active" : ""}`}>{record.isActive ? "Active" : "Inactive"}</span><button type="button" className="button md-edit-button" aria-expanded={editor === record.id} aria-label={`Edit ${record.name}`} onClick={() => setEditor(editor === record.id ? null : record.id)}>Edit</button></div>{editor === record.id && <div className="md-editor"><RecordForm section={section} record={record} projects={projects} onCancel={() => setEditor(null)} /><form action="/api/master-data" method="post" className="md-delete" onSubmit={event => { if (!window.confirm(`Delete "${record.name}"? This cannot be undone. Consider deactivating it if you may need it later.`)) event.preventDefault(); }}><input type="hidden" name="entity" value={section} /><input type="hidden" name="id" value={record.id} /><input type="hidden" name="intent" value="delete" /><button className="button danger" type="submit">Delete {current.singular}</button></form></div>}</article>)}</div>
      {!visible.length && <div className="md-empty"><span className="md-icon"><Icon kind={current.icon} /></span><h3>{records.length ? "No matching records" : `Your ${current.title.toLowerCase()} start here`}</h3><p>{records.length ? "Try another name or clear your filters." : `Add your first ${current.singular} to organize your transactions.`}</p><button type="button" className="button" onClick={() => { if (records.length) { setQuery(""); setStatus("all"); } else setEditor("new"); }}>{records.length ? "Clear filters" : `Add ${current.singular}`}</button></div>}
      <div className="md-list-footer" role="status">Showing {visible.length} of {records.length} {current.title.toLowerCase()}</div>
    </section>
  </div>;
}
