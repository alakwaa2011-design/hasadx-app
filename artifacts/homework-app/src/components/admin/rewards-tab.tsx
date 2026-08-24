import { useEffect, useState } from "react";
import { Card } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import { Trophy, Settings2, Gift, Trash2, Pencil, Plus, Coins, Mail, Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
type Section = "rules" | "badges" | "thresholds" | "fulfillment" | "adjustments" | "seasons" | "email";
type XpRule = { id:number; actionKey:string; labelAr:string; points:number; dailyCap:number|null; weeklyCap:number|null; isActive:boolean };
type Badge = { id:number; nameAr:string; descriptionAr:string; icon:string; tier:"bronze"|"silver"|"gold"|"legendary"; unlockRule:unknown };
type ThresholdReward = { id:number; nameAr:string; metric:"level"|"totalXp"|"badgeCount"|"questsCompleted"|"streak"; threshold:number; prizeKind:"feature_unlock"|"shipped_item"|"title"|"perk"; prizeLabelAr:string; prizeDescriptionAr:string|null; autoApply:boolean; isActive:boolean };
type Fulfillment = { id:number; teacherName:string|null; teacherEmail:string|null; source:string; prizeLabel:string; prizeDescription:string|null; status:"pending"|"in_progress"|"delivered"|"cancelled"; notes:string|null; trackingRef:string|null; createdAt:string };
type XpAdjustment = { id:number; teacherId:number; teacherName:string|null; delta:number; reason:string; createdAt:string };
type Season = { id:number; nameAr:string; startsAt:string; endsAt:string; status:"upcoming"|"active"|"closed" };
type EmailOutbox = { id:number; toEmail:string; subject:string; status:"pending"|"sent"|"failed"; attempts:number; createdAt:string };

const fill = (value:string, values:Record<string,string|number>) =>
  Object.entries(values).reduce((result, [key, replacement]) => result.replace(`{${key}}`, String(replacement)), value);

async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials:"include", headers:{ "Content-Type":"application/json" }, ...init });
  if (!response.ok) throw new Error(response.statusText);
  return response.json();
}

export function RewardsTab() {
  const { t, dir } = useI18n();
  const [section, setSection] = useState<Section>("rules");
  const tabs:Array<[Section,string,typeof Coins]> = [
    ["rules",t.adminRewards.tabs.rules,Coins], ["badges",t.adminRewards.tabs.badges,Trophy],
    ["thresholds",t.adminRewards.tabs.thresholds,Gift], ["fulfillment",t.adminRewards.tabs.fulfillment,Settings2],
    ["adjustments",t.adminRewards.tabs.adjustments,Pencil], ["seasons",t.adminRewards.tabs.seasons,Calendar],
    ["email",t.adminRewards.tabs.email,Mail],
  ];
  return <div className="space-y-4" dir={dir}>
    <div className="flex flex-wrap gap-2">{tabs.map(([key,label,Icon]) =>
      <button key={key} aria-label={label} onClick={()=>setSection(key)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border ${section===key?"bg-indigo-600 text-white border-indigo-600":"bg-white text-gray-700"}`}><Icon size={14}/>{label}</button>
    )}</div>
    {section==="rules"&&<XpRulesEditor/>}{section==="badges"&&<BadgesEditor/>}
    {section==="thresholds"&&<ThresholdRewardsBuilder/>}{section==="fulfillment"&&<FulfillmentQueue/>}
    {section==="adjustments"&&<ManualAdjustments/>}{section==="seasons"&&<SeasonsEditor/>}
    {section==="email"&&<EmailOutboxView/>}
  </div>;
}

function XpRulesEditor() {
  const { t }=useI18n(); const [rules,setRules]=useState<XpRule[]>([]); const [loading,setLoading]=useState(true);
  const refresh=()=>{setLoading(true);request<XpRule[]>("/api/admin/xp-rules").then(setRules).catch(()=>setRules([])).finally(()=>setLoading(false));};
  useEffect(refresh,[]);
  const update=async(id:number,body:Partial<XpRule>)=>{try{await request(`/api/admin/xp-rules/${id}`,{method:"PATCH",body:JSON.stringify(body)});toast.success(t.adminRewards.common.saved);refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  if(loading)return <p className="p-4">{t.adminRewards.common.loading}</p>;
  return <Card className="p-4"><h3 className="font-bold mb-3">{t.adminRewards.rules.title}</h3><div className="overflow-x-auto"><table className="w-full text-sm">
    <thead className="bg-gray-50"><tr><th className="p-2 text-start">{t.adminRewards.rules.action}</th><th>{t.adminRewards.rules.points}</th><th>{t.adminRewards.rules.dailyCap}</th><th>{t.adminRewards.rules.weeklyCap}</th><th>{t.adminRewards.rules.enabled}</th><th/></tr></thead>
    <tbody>{rules.map(rule=><RuleRow key={rule.id} rule={rule} onSave={body=>update(rule.id,body)}/>)}</tbody>
  </table></div></Card>;
}
function RuleRow({rule,onSave}:{rule:XpRule;onSave:(body:Partial<XpRule>)=>void}) {
  const {t}=useI18n(); const [points,setPoints]=useState(rule.points);const [daily,setDaily]=useState<number|"">(rule.dailyCap??"");const [weekly,setWeekly]=useState<number|"">(rule.weeklyCap??"");const [active,setActive]=useState(rule.isActive);
  return <tr className="border-t"><td className="p-2"><p className="font-semibold">{rule.labelAr}</p><p className="text-xs text-gray-500">{rule.actionKey}</p></td>
    {[ [points,setPoints],[daily,setDaily],[weekly,setWeekly] ].map(([value,setter],index)=><td className="p-2" key={index}><input aria-label={[t.adminRewards.rules.points,t.adminRewards.rules.dailyCap,t.adminRewards.rules.weeklyCap][index]} type="number" className="w-20 border rounded p-1" value={value as number|string} onChange={e=>(setter as (v:number|"")=>void)(e.target.value===""?"":parseInt(e.target.value)||0)}/></td>)}
    <td className="p-2 text-center"><input aria-label={t.adminRewards.rules.enabled} type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/></td>
    <td className="p-2"><button className="px-3 py-1 bg-indigo-600 text-white rounded text-xs" onClick={()=>onSave({points,dailyCap:daily===""?null:daily,weeklyCap:weekly===""?null:weekly,isActive:active})}>{t.adminRewards.common.save}</button></td></tr>;
}

function BadgesEditor(){
  const {t}=useI18n();const [list,setList]=useState<Badge[]>([]);const [loading,setLoading]=useState(true);
  const refresh=()=>{setLoading(true);request<Badge[]>("/api/admin/badges").then(setList).catch(()=>setList([])).finally(()=>setLoading(false));};useEffect(refresh,[]);
  const remove=async(id:number)=>{if(!confirm(t.adminRewards.badges.deleteConfirm))return;try{await request(`/api/admin/badges/${id}`,{method:"DELETE"});refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  if(loading)return <p className="p-4">{t.adminRewards.common.loading}</p>;
  return <Card className="p-4"><div className="flex justify-between items-center mb-3 gap-3"><h3 className="font-bold">{t.adminRewards.badges.title}</h3><p className="text-xs text-gray-500">{t.adminRewards.badges.hint}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{list.map(b=><div key={b.id} className="border rounded-lg p-3 flex items-start gap-3"><div className="text-3xl">{b.icon}</div><div className="flex-1"><p className="font-bold">{b.nameAr} <span className="text-xs text-gray-500">({t.adminRewards.badges[b.tier]})</span></p><p className="text-sm text-gray-700">{b.descriptionAr}</p><p className="text-xs text-gray-500 mt-1">{t.adminRewards.badges.unlockRule} <code>{JSON.stringify(b.unlockRule)}</code></p></div><button aria-label={t.adminRewards.common.delete} onClick={()=>remove(b.id)} className="text-red-600"><Trash2 size={16}/></button></div>)}</div>
  </Card>;
}

function ThresholdRewardsBuilder(){
  const {t,lang}=useI18n();const [list,setList]=useState<ThresholdReward[]>([]);const [editing,setEditing]=useState<Partial<ThresholdReward>|null>(null);const [loading,setLoading]=useState(true);
  const metrics={level:t.adminRewards.thresholds.metricLevel,totalXp:t.adminRewards.thresholds.metricXp,badgeCount:t.adminRewards.thresholds.metricBadges,questsCompleted:t.adminRewards.thresholds.metricQuests,streak:t.adminRewards.thresholds.metricStreak};
  const kinds={feature_unlock:t.adminRewards.thresholds.kindFeature,shipped_item:t.adminRewards.thresholds.kindShipped,title:t.adminRewards.thresholds.kindTitle,perk:t.adminRewards.thresholds.kindPerk};
  const refresh=()=>{setLoading(true);request<ThresholdReward[]>("/api/admin/threshold-rewards").then(setList).catch(()=>setList([])).finally(()=>setLoading(false));};useEffect(refresh,[]);
  const save=async()=>{if(!editing)return;try{await request(editing.id?`/api/admin/threshold-rewards/${editing.id}`:"/api/admin/threshold-rewards",{method:editing.id?"PATCH":"POST",body:JSON.stringify({...editing,metric:editing.metric??"totalXp",threshold:Number(editing.threshold),prizeKind:editing.prizeKind??"shipped_item",prizeDescriptionAr:editing.prizeDescriptionAr??null,autoApply:editing.autoApply??false,isActive:editing.isActive??true})});toast.success(t.adminRewards.common.saved);setEditing(null);refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  const remove=async(id:number)=>{if(!confirm(t.adminRewards.thresholds.deleteConfirm))return;try{await request(`/api/admin/threshold-rewards/${id}`,{method:"DELETE"});refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  if(loading)return <p className="p-4">{t.adminRewards.common.loading}</p>;
  return <Card className="p-4"><div className="flex justify-between items-center mb-3 gap-3"><div><h3 className="font-bold">{t.adminRewards.thresholds.title}</h3><p className="text-xs text-gray-600">{t.adminRewards.thresholds.hint}</p></div><button onClick={()=>setEditing({nameAr:"",metric:"totalXp",threshold:100,prizeKind:"shipped_item",prizeLabelAr:"",autoApply:false,isActive:true})} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded text-sm"><Plus size={14}/>{t.adminRewards.common.add}</button></div>
    <div className="space-y-2">{list.map(r=><div key={r.id} className="border rounded-lg p-3 flex items-center gap-3"><div className="flex-1"><p className="font-semibold">{r.nameAr}</p><p className="text-sm text-gray-700">{fill(t.adminRewards.thresholds.reached,{threshold:r.threshold.toLocaleString(lang),metric:metrics[r.metric]})} → 🎁 {r.prizeLabelAr} <span className="text-xs text-gray-500">({kinds[r.prizeKind]})</span></p>{r.prizeDescriptionAr&&<p className="text-xs text-gray-600">{r.prizeDescriptionAr}</p>}<p className="text-xs text-gray-500 mt-1">{r.autoApply?t.adminRewards.thresholds.auto:t.adminRewards.thresholds.manual}</p></div><button aria-label={t.adminRewards.common.edit} onClick={()=>setEditing(r)} className="text-indigo-700"><Pencil size={16}/></button><button aria-label={t.adminRewards.common.delete} onClick={()=>remove(r.id)} className="text-red-600"><Trash2 size={16}/></button></div>)}{!list.length&&<p className="text-center text-gray-500 py-4">{t.adminRewards.thresholds.empty}</p>}</div>
    {editing&&<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={()=>setEditing(null)}><div className="bg-white rounded-xl p-5 w-full max-w-lg" onClick={e=>e.stopPropagation()}><h3 className="text-lg font-bold mb-3">{editing.id?t.adminRewards.thresholds.editTitle:t.adminRewards.thresholds.newTitle}</h3><div className="space-y-3">
      <Field label={t.adminRewards.thresholds.name}><input className="w-full border rounded p-2" value={editing.nameAr??""} onChange={e=>setEditing({...editing,nameAr:e.target.value})}/></Field>
      <div className="grid grid-cols-2 gap-3"><Field label={t.adminRewards.thresholds.metric}><select className="w-full border rounded p-2" value={editing.metric??"totalXp"} onChange={e=>setEditing({...editing,metric:e.target.value as ThresholdReward["metric"]})}>{Object.entries(metrics).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field><Field label={t.adminRewards.thresholds.threshold}><input type="number" className="w-full border rounded p-2" value={editing.threshold??0} onChange={e=>setEditing({...editing,threshold:parseInt(e.target.value)||0})}/></Field></div>
      <Field label={t.adminRewards.thresholds.kind}><select className="w-full border rounded p-2" value={editing.prizeKind??"shipped_item"} onChange={e=>setEditing({...editing,prizeKind:e.target.value as ThresholdReward["prizeKind"]})}>{Object.entries(kinds).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label={t.adminRewards.thresholds.label}><input className="w-full border rounded p-2" value={editing.prizeLabelAr??""} onChange={e=>setEditing({...editing,prizeLabelAr:e.target.value})}/></Field>
      <Field label={t.adminRewards.thresholds.description}><textarea className="w-full border rounded p-2" rows={2} value={editing.prizeDescriptionAr??""} onChange={e=>setEditing({...editing,prizeDescriptionAr:e.target.value})}/></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.autoApply??false} onChange={e=>setEditing({...editing,autoApply:e.target.checked})}/>{t.adminRewards.thresholds.autoDigital}</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isActive??true} onChange={e=>setEditing({...editing,isActive:e.target.checked})}/>{t.adminRewards.common.active}</label>
      <div className="flex gap-2 justify-end pt-2"><button onClick={()=>setEditing(null)} className="px-4 py-2 border rounded">{t.adminRewards.common.cancel}</button><button onClick={save} className="px-4 py-2 bg-indigo-600 text-white rounded">{t.adminRewards.common.save}</button></div>
    </div></div></div>}
  </Card>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><label className="block text-sm font-semibold mb-1">{label}</label>{children}</div>;}

function FulfillmentQueue(){
  const {t,lang}=useI18n();const [list,setList]=useState<Fulfillment[]>([]);const [filter,setFilter]=useState<"all"|Fulfillment["status"]>("pending");const [loading,setLoading]=useState(true);
  const statuses={pending:t.adminRewards.fulfillment.pending,in_progress:t.adminRewards.fulfillment.inProgress,delivered:t.adminRewards.fulfillment.delivered,cancelled:t.adminRewards.fulfillment.cancelled};
  const refresh=()=>{setLoading(true);request<Fulfillment[]>("/api/admin/fulfillment-queue").then(setList).catch(()=>setList([])).finally(()=>setLoading(false));};useEffect(refresh,[]);
  const update=async(id:number,body:Partial<Fulfillment>)=>{try{await request(`/api/admin/fulfillment-queue/${id}`,{method:"PATCH",body:JSON.stringify(body)});refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  if(loading)return <p className="p-4">{t.adminRewards.common.loading}</p>;const filtered=filter==="all"?list:list.filter(f=>f.status===filter);
  return <Card className="p-4"><div className="flex justify-between items-center mb-3 flex-wrap gap-2"><h3 className="font-bold">{t.adminRewards.fulfillment.title}</h3><select aria-label={t.adminRewards.common.status} value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} className="border rounded p-1 text-sm"><option value="all">{t.adminRewards.fulfillment.all}</option>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
    <div className="space-y-2">{filtered.map(f=><div key={f.id} className="border rounded p-3 flex items-start gap-3 flex-wrap"><div className="flex-1 min-w-[200px]"><p className="font-semibold">{f.teacherName} <span className="text-xs text-gray-500">{f.teacherEmail}</span></p><p className="text-sm">🎁 {f.prizeLabel}</p>{f.prizeDescription&&<p className="text-xs text-gray-600">{f.prizeDescription}</p>}<p className="text-xs text-gray-500 mt-1">{new Date(f.createdAt).toLocaleString(lang)} · {f.source}</p></div><div className="flex flex-col gap-2 min-w-[200px]"><select aria-label={t.adminRewards.common.status} value={f.status} onChange={e=>update(f.id,{status:e.target.value as Fulfillment["status"]})} className="border rounded p-1 text-sm">{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input aria-label={t.adminRewards.fulfillment.tracking} placeholder={t.adminRewards.fulfillment.tracking} defaultValue={f.trackingRef??""} onBlur={e=>e.target.value!==(f.trackingRef??"")&&update(f.id,{trackingRef:e.target.value||null})} className="border rounded p-1 text-sm"/><input aria-label={t.adminRewards.fulfillment.notes} placeholder={t.adminRewards.fulfillment.notes} defaultValue={f.notes??""} onBlur={e=>e.target.value!==(f.notes??"")&&update(f.id,{notes:e.target.value||null})} className="border rounded p-1 text-sm"/></div></div>)}{!filtered.length&&<p className="text-center text-gray-500 py-4">{t.adminRewards.fulfillment.empty}</p>}</div>
  </Card>;
}

function ManualAdjustments(){
  const {t,lang}=useI18n();const [list,setList]=useState<XpAdjustment[]>([]);const [teacherId,setTeacherId]=useState<number|"">("");const [delta,setDelta]=useState(50);const [reason,setReason]=useState("");
  const refresh=()=>{void request<XpAdjustment[]>("/api/admin/xp-adjustments").then(setList).catch(()=>setList([]));};useEffect(refresh,[]);
  const submit=async()=>{if(typeof teacherId!=="number"||!delta||!reason.trim()){toast.error(t.adminRewards.adjustments.required);return;}try{await request("/api/admin/xp-adjustments",{method:"POST",body:JSON.stringify({teacherId,delta,reason:reason.trim()})});toast.success(t.adminRewards.adjustments.success);setReason("");refresh();}catch{toast.error(t.adminRewards.adjustments.failed);}};
  return <Card className="p-4"><h3 className="font-bold mb-3">{t.adminRewards.adjustments.title}</h3><div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4"><input type="number" placeholder={t.adminRewards.adjustments.teacherId} aria-label={t.adminRewards.adjustments.teacherId} className="border rounded p-2" value={teacherId} onChange={e=>setTeacherId(e.target.value===""?"":parseInt(e.target.value))}/><input type="number" placeholder={t.adminRewards.adjustments.points} aria-label={t.adminRewards.adjustments.points} className="border rounded p-2" value={delta} onChange={e=>setDelta(parseInt(e.target.value)||0)}/><input placeholder={t.adminRewards.adjustments.reason} aria-label={t.adminRewards.adjustments.reason} className="border rounded p-2" value={reason} onChange={e=>setReason(e.target.value)}/><button onClick={submit} className="bg-indigo-600 text-white rounded p-2">{t.adminRewards.adjustments.apply}</button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-start">{t.adminRewards.common.teacher}</th><th>{t.adminRewards.adjustments.change}</th><th className="text-start">{t.adminRewards.common.reason}</th><th>{t.adminRewards.common.date}</th></tr></thead><tbody>{list.map(a=><tr key={a.id} className="border-t"><td className="p-2">{a.teacherName} <span className="text-xs text-gray-500">#{a.teacherId}</span></td><td className={`p-2 text-center font-semibold ${a.delta>0?"text-green-700":"text-red-700"}`}>{a.delta>0?`+${a.delta}`:a.delta}</td><td className="p-2">{a.reason}</td><td className="p-2 text-center text-xs">{new Date(a.createdAt).toLocaleString(lang)}</td></tr>)}</tbody></table></div>
  </Card>;
}

function SeasonsEditor(){
  const {t,lang}=useI18n();const [list,setList]=useState<Season[]>([]);const [loading,setLoading]=useState(true);const [creating,setCreating]=useState(false);const [form,setForm]=useState({nameAr:"",startsAt:"",endsAt:""});
  const labels={upcoming:t.adminRewards.seasons.upcoming,active:t.adminRewards.seasons.active,closed:t.adminRewards.seasons.closedStatus};
  const refresh=()=>{setLoading(true);request<Season[]>("/api/admin/seasons").then(setList).catch(()=>setList([])).finally(()=>setLoading(false));};useEffect(refresh,[]);
  const create=async()=>{if(!form.nameAr||!form.startsAt||!form.endsAt)return;try{await request("/api/admin/seasons",{method:"POST",body:JSON.stringify({nameAr:form.nameAr,startsAt:new Date(form.startsAt).toISOString(),endsAt:new Date(form.endsAt).toISOString()})});toast.success(t.adminRewards.seasons.created);setCreating(false);setForm({nameAr:"",startsAt:"",endsAt:""});refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  const close=async(id:number)=>{if(!confirm(t.adminRewards.seasons.closeConfirm))return;try{await request(`/api/admin/seasons/${id}/close`,{method:"POST"});toast.success(t.adminRewards.seasons.closed);refresh();}catch{toast.error(t.adminRewards.common.saveFailed);}};
  if(loading)return <p className="p-4">{t.adminRewards.common.loading}</p>;
  return <Card className="p-4"><div className="flex justify-between items-center mb-3"><h3 className="font-bold">{t.adminRewards.seasons.title}</h3><button onClick={()=>setCreating(!creating)} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1"><Plus size={14}/>{t.adminRewards.seasons.new}</button></div>
    {creating&&<div className="border rounded p-3 mb-3 grid grid-cols-1 md:grid-cols-4 gap-2"><input placeholder={t.adminRewards.seasons.name} aria-label={t.adminRewards.seasons.name} className="border rounded p-2" value={form.nameAr} onChange={e=>setForm({...form,nameAr:e.target.value})}/><input aria-label={t.adminRewards.common.date} type="datetime-local" className="border rounded p-2" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/><input aria-label={t.adminRewards.common.date} type="datetime-local" className="border rounded p-2" value={form.endsAt} onChange={e=>setForm({...form,endsAt:e.target.value})}/><button onClick={create} className="bg-green-600 text-white rounded p-2">{t.adminRewards.seasons.create}</button></div>}
    <div className="space-y-2">{list.map(s=><div key={s.id} className="border rounded p-3 flex items-center gap-3 flex-wrap"><div className="flex-1"><p className="font-semibold">{s.nameAr} <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">{labels[s.status]}</span></p><p className="text-xs text-gray-600">{new Date(s.startsAt).toLocaleDateString(lang)} → {new Date(s.endsAt).toLocaleDateString(lang)}</p></div>{s.status==="active"&&<button onClick={()=>close(s.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm">{t.adminRewards.seasons.closeAndAward}</button>}</div>)}</div>
  </Card>;
}

function EmailOutboxView(){
  const {t,lang}=useI18n();const [list,setList]=useState<EmailOutbox[]>([]);const [loading,setLoading]=useState(true);useEffect(()=>{request<EmailOutbox[]>("/api/admin/email-outbox").then(setList).catch(()=>setList([])).finally(()=>setLoading(false));},[]);
  const statuses={pending:t.adminRewards.email.pending,sent:t.adminRewards.email.sent,failed:t.adminRewards.email.failed};
  if(loading)return <p className="p-4">{t.adminRewards.common.loading}</p>;
  return <Card className="p-4"><h3 className="font-bold mb-3">{t.adminRewards.email.title}</h3>{!list.length?<p className="text-gray-500 text-center py-4">{t.adminRewards.email.empty}</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-start">{t.adminRewards.email.to}</th><th className="p-2 text-start">{t.adminRewards.email.subject}</th><th>{t.adminRewards.common.status}</th><th>{t.adminRewards.common.date}</th></tr></thead><tbody>{list.map(e=><tr key={e.id} className="border-t"><td className="p-2">{e.toEmail}</td><td className="p-2">{e.subject}</td><td className="p-2 text-center">{statuses[e.status]}{e.attempts?` (${e.attempts})`:""}</td><td className="p-2 text-center text-xs">{new Date(e.createdAt).toLocaleString(lang)}</td></tr>)}</tbody></table></div>}</Card>;
}