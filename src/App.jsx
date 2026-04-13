import { useState, useRef, useEffect, useCallback } from "react";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["MON","TUE","WED","THU","FRI","SAT"];

const PALETTE = {
  Brad:    { bg:"rgba(59,130,246,0.10)", border:"#3b82f6", text:"#93c5fd", dot:"#3b82f6", glow:"rgba(59,130,246,0.3)", accent:"#2563eb" },
  Lindsay: { bg:"rgba(168,85,247,0.10)", border:"#a855f7", text:"#d8b4fe", dot:"#a855f7", glow:"rgba(168,85,247,0.3)", accent:"#7c3aed" },
  Duncan:  { bg:"rgba(34,197,94,0.10)",  border:"#22c55e", text:"#86efac", dot:"#22c55e", glow:"rgba(34,197,94,0.3)",  accent:"#16a34a" },
  EmTech:  { bg:"rgba(245,158,11,0.10)", border:"#f59e0b", text:"#fcd34d", dot:"#f59e0b", glow:"rgba(245,158,11,0.3)", accent:"#d97706" },
  Chris:   { bg:"rgba(6,182,212,0.10)",  border:"#06b6d4", text:"#67e8f9", dot:"#06b6d4", glow:"rgba(6,182,212,0.3)",  accent:"#0891b2" },
  Cinday:  { bg:"rgba(244,63,94,0.10)",  border:"#f43f5e", text:"#fda4af", dot:"#f43f5e", glow:"rgba(244,63,94,0.3)",  accent:"#e11d48" },
};
const XTRA = [
  { bg:"rgba(132,204,22,0.10)", border:"#84cc16", text:"#bef264", dot:"#84cc16", glow:"rgba(132,204,22,0.3)", accent:"#65a30d" },
  { bg:"rgba(20,184,166,0.10)", border:"#14b8a6", text:"#5eead4", dot:"#14b8a6", glow:"rgba(20,184,166,0.3)", accent:"#0d9488" },
];

const Y = { bg:"#050505", card:"rgba(245,158,11,0.03)", cardBorder:"rgba(245,158,11,0.08)", accent:"#f59e0b", accentDim:"#b45309", accentGlow:"rgba(245,158,11,0.25)", accentBright:"#fbbf24", gold:"#eab308", text:"#fef3c7", textDim:"#92400e", textMuted:"#78350f", surface:"rgba(245,158,11,0.04)", surfaceBorder:"rgba(245,158,11,0.10)", todayBg:"rgba(245,158,11,0.06)", todayBorder:"rgba(245,158,11,0.18)" };

// Statuses that count as "assignable" (ready for editor)
const ASSIGNABLE = ["to edit","to film","scripting","edit - in progress","to post"];

const getMonday = (d) => { const dt=new Date(d);const dy=dt.getDay();dt.setDate(dt.getDate()-dy+(dy===0?-6:1));dt.setHours(0,0,0,0);return dt; };
const fmt = (d) => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull = (d) => d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
const fmtW = (m) => { const s=new Date(m);s.setDate(s.getDate()+5);return fmt(m)+" — "+fmt(s)+", "+s.getFullYear(); };
const uid = () => Math.random().toString(36).slice(2,9);

const SK = "noocap_ops_v2_";
const load = (k, fb) => { try { const v=localStorage.getItem(SK+k); return v?JSON.parse(v):fb; } catch{return fb;} };
const save = (k, v) => { try { localStorage.setItem(SK+k, JSON.stringify(v)); } catch{} };

export default function App() {
  const [clients, setClients] = useState(() => load("clients", ["Brad","Lindsay","Chris","Duncan","EmTech","Cinday"]));
  const [editors, setEditors] = useState(() => load("editors", ["Parvez","Ananya","Sumith"]));
  const [pipeline, setPipeline] = useState(() => load("pipeline", {}));
  const [pipelineBreakdown, setPipelineBreakdown] = useState(() => load("breakdown", {}));
  const [notionVideos, setNotionVideos] = useState(() => load("nvideos", {}));
  const [editorProps, setEditorProps] = useState(() => load("eprops", {}));
  const [ws, setWs] = useState(() => getMonday(new Date()));
  const [assigns, setAssigns] = useState(() => load("assigns", []));
  const mounted = useRef(false);

  // UI state
  const [openCell, setOpenCell] = useState(null);
  const [pickingClient, setPickingClient] = useState(null); // {day,ed} — step 1
  const [pickingVideo, setPickingVideo] = useState(null);   // {day,ed,cl} — step 2
  const [dragA, setDragA] = useState(null);
  const [addC, setAddC] = useState(false);
  const [addE, setAddE] = useState(false);
  const [nc, setNc] = useState("");
  const [ne, setNe] = useState("");
  const [renI, setRenI] = useState(null);
  const [renV, setRenV] = useState("");
  const [editPL, setEditPL] = useState(null);
  const [plV, setPlV] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => load("lastSync", null));

  const cR=useRef(),eR=useRef(),rR=useRef(),plR=useRef();

  useEffect(()=>{
    if(!mounted.current){mounted.current=true;return;}
    save("clients",clients);save("editors",editors);save("pipeline",pipeline);
    save("breakdown",pipelineBreakdown);save("nvideos",notionVideos);
    save("assigns",assigns);save("eprops",editorProps);
    if(lastSync)save("lastSync",lastSync);
  },[clients,editors,pipeline,pipelineBreakdown,notionVideos,assigns,lastSync,editorProps]);

  useEffect(()=>{if(addC&&cR.current)cR.current.focus();},[addC]);
  useEffect(()=>{if(addE&&eR.current)eR.current.focus();},[addE]);
  useEffect(()=>{if(renI!==null&&rR.current)rR.current.focus();},[renI]);
  useEffect(()=>{if(editPL&&plR.current){plR.current.focus();plR.current.select();}},[editPL]);

  const showToast = useCallback((msg,isErr)=>{setToast({msg,isErr});setTimeout(()=>setToast(null),3000);},[]);

  const wk = ws.toISOString().slice(0,10);
  const now = new Date();now.setHours(0,0,0,0);
  const cm = getMonday(now);
  const isCW = ws.getTime()===cm.getTime();
  const tI = now.getDay()===0?-1:now.getDay()-1;
  const todayName = DAYS[tI]||null;

  const col = (n) => PALETTE[n]||XTRA[Math.abs(clients.filter(c=>!PALETTE[c]).indexOf(n))%XTRA.length];
  const cellAs = (d,e) => assigns.filter(a=>a.wk===wk&&a.day===d&&a.ed===e);
  const totA = (c) => assigns.filter(a=>a.cl===c).length;
  const wkA2 = (c) => assigns.filter(a=>a.cl===c&&a.wk===wk).length;
  const rem = (c) => Math.max(0,(pipeline[c]||0)-totA(c));
  const editorLoad = (e) => assigns.filter(a=>a.wk===wk&&a.ed===e).length;

  // Get assignable videos for a client (To Edit, To Film, etc.)
  const getAssignable = (cl) => {
    const vids = notionVideos[cl] || [];
    const assignedIds = assigns.map(a=>a.notionId).filter(Boolean);
    return vids.filter(v => {
      const s = (v.status||"").toLowerCase().trim();
      return ASSIGNABLE.includes(s) && !assignedIds.includes(v.id);
    });
  };

  // Assign a Notion video to a cell + update editor in Notion
  const assignVideo = async (day, ed, cl, video) => {
    setAssigns(p => [...p, { id:uid(), wk, day, ed, cl, vn:video.title, notionId:video.id }]);
    setPickingVideo(null);
    setOpenCell(null);
    showToast(`Assigned: ${video.title}`);

    // Write editor back to Notion
    const eProp = editorProps[cl];
    if (eProp && video.id) {
      try {
        await fetch("/api/update-editor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: video.id, editor: ed, editorProp: eProp }),
        });
        showToast(`Editor updated in Notion`);
      } catch (err) {
        console.error("Failed to update Notion:", err);
        showToast("Assigned locally, Notion update failed", true);
      }
    }
  };

  // Manual assign (type custom name)
  const [manualMode, setManualMode] = useState(null);
  const [manualName, setManualName] = useState("");
  const manualRef = useRef(null);
  useEffect(()=>{if(manualMode&&manualRef.current)manualRef.current.focus();},[manualMode]);

  const assignManual = () => {
    if(!manualMode||!manualName.trim()) return;
    const {day,ed,cl} = manualMode;
    setAssigns(p => [...p, { id:uid(), wk, day, ed, cl, vn:manualName.trim() }]);
    setManualMode(null); setManualName(""); setOpenCell(null);
    showToast("Video assigned manually");
  };

  const handleDropCell = (day, ed) => {
    if(dragA){setAssigns(p=>p.map(a=>a.id===dragA.id?{...a,day,ed,wk}:a));setDragA(null);showToast("Rescheduled");}
  };

  const setPL = (c,v) => setPipeline(p=>({...p,[c]:Math.max(0,v)}));
  const savePLE = () => { if(editPL){const v=parseInt(plV,10);if(!isNaN(v))setPL(editPL,v);setEditPL(null);} };

  // ═══ NOTION SYNC ═══
  const syncFromNotion = async () => {
    setSyncing(true);
    try {
      const resp = await fetch("/api/sync");
      const json = await resp.json();
      if (!json.success) throw new Error(json.error);
      const newPL={};const newBD={};const newVids={};const allEd=new Set(editors);const newEP={};
      for (const [cl, data] of Object.entries(json.data)) {
        newPL[cl]=data.pipelineCount;
        newBD[cl]=data.statusCounts;
        newVids[cl]=data.videos;
        if(data.editorProp) newEP[cl]=data.editorProp;
        data.editors.forEach(e=>allEd.add(e));
        if(!clients.includes(cl))setClients(p=>[...p,cl]);
      }
      setPipeline(newPL);setPipelineBreakdown(newBD);setNotionVideos(newVids);
      setEditors([...allEd]);setEditorProps(newEP);
      setLastSync(new Date().toLocaleTimeString());showToast("Synced from Notion");
    } catch(err){ showToast("Sync failed: "+err.message,true); }
    finally{ setSyncing(false); }
  };

  const wkAs = assigns.filter(a=>a.wk===wk);
  const filled = wkAs.length;
  const tPL = Object.values(pipeline).reduce((s,v)=>s+v,0);
  const tRem = clients.reduce((s,c)=>s+rem(c),0);
  const todayAssigns = todayName ? wkAs.filter(a=>a.day===todayName) : [];

  const copySlack = () => {
    let text = `📋 *NOOCAP Video Schedule — ${fmtW(ws)}*\n\n`;
    editors.forEach(ed => { const edAs=wkAs.filter(a=>a.ed===ed); if(!edAs.length)return; text+=`*${ed}*\n`; DAYS.forEach(day=>{edAs.filter(x=>x.day===day).forEach(a=>{text+=`  ${SHORT[DAYS.indexOf(day)]}: ${a.cl} — ${a.vn||"untitled"}\n`;});}); text+="\n"; });
    if(!filled) text+="_No videos scheduled_\n";
    navigator.clipboard.writeText(text).then(()=>{setCopied(true);showToast("Copied!");setTimeout(()=>setCopied(false),2000);});
  };

  // Close popups when clicking outside
  const closeAll = () => { setOpenCell(null);setPickingClient(null);setPickingVideo(null);setManualMode(null); };

  return (
    <div style={{background:Y.bg,color:"#d4d4d8",minHeight:"100vh",fontFamily:"'Outfit',system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${Y.accentDim}40;border-radius:9px}
        input:focus{outline:none;border-color:${Y.accent}50 !important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px ${Y.accentGlow}}50%{box-shadow:0 0 20px ${Y.accentGlow}}}
        .fu{animation:fadeUp .22s ease-out}
        .cell{transition:all .15s}.cell:hover{background:${Y.card} !important;border-color:${Y.cardBorder} !important}
        .chip{transition:all .18s;cursor:grab}.chip:hover{transform:scale(1.01)}
        .hov-show:hover .hov-target{opacity:1 !important}
        .drag-over{box-shadow:inset 0 0 0 2px ${Y.accent}60 !important}
        .add-more{opacity:0;transition:opacity .15s}.cell:hover .add-more{opacity:1}
        .sync-spin{animation:spin 1s linear infinite}
        .vid-pick{cursor:pointer;transition:all .15s;border:1px solid transparent}.vid-pick:hover{border-color:rgba(255,255,255,0.15);background:rgba(255,255,255,0.04)}
        .ntag{font-size:8px;padding:1px 5px;border-radius:4px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}
      `}</style>

      {/* Ambient */}
      <div style={{position:"absolute",top:-300,left:"20%",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(245,158,11,0.04) 0%,transparent 60%)",pointerEvents:"none"}}/>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",zIndex:999,
          background:toast.isErr?"rgba(239,68,68,0.12)":"rgba(245,158,11,0.12)",
          border:"1px solid "+(toast.isErr?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"),backdropFilter:"blur(12px)",
          borderRadius:10,padding:"10px 24px",color:toast.isErr?"#fca5a5":"#fcd34d",fontSize:13,fontWeight:600,
          animation:"toastIn .25s ease-out",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",display:"flex",alignItems:"center",gap:8}}>
          <span>{toast.isErr?"✗":"✓"}</span>{toast.msg}
        </div>
      )}

      <div style={{position:"relative",zIndex:1,padding:"24px 28px",maxWidth:1480,margin:"0 auto"}}>

        {/* HEADER */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16,marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#f59e0b,#eab308,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#000",boxShadow:"0 0 28px rgba(245,158,11,0.4)",animation:"glow 3s ease-in-out infinite"}}>N</div>
            <div>
              <h1 style={{margin:0,fontSize:26,fontWeight:900,color:"#fafafa",letterSpacing:"-0.5px"}}>
                NOOCAP <span style={{background:"linear-gradient(90deg,#f59e0b,#eab308,#fbbf24)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Media Ops</span>
              </h1>
              <p style={{margin:"3px 0 0",fontSize:10,color:Y.textDim,letterSpacing:3,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>PRODUCTION DASHBOARD</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <button onClick={syncFromNotion} disabled={syncing}
              style={{background:syncing?Y.card:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,179,8,0.08))",
                border:"1px solid "+Y.surfaceBorder,color:syncing?Y.textDim:Y.accentBright,padding:"8px 18px",borderRadius:10,fontSize:11,
                cursor:syncing?"wait":"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:700,display:"flex",alignItems:"center",gap:7}}>
              <span className={syncing?"sync-spin":""}>⟳</span>{syncing?"Syncing...":"Sync Notion"}
            </button>
            {lastSync && <span style={{fontSize:9,color:Y.textDim,fontFamily:"'JetBrains Mono',monospace"}}>{lastSync}</span>}
            <div style={{display:"flex",gap:3}}>
              <YBtn onClick={()=>{const d=new Date(ws);d.setDate(d.getDate()-7);setWs(d);}}>◀</YBtn>
              <YBtn onClick={()=>setWs(getMonday(new Date()))} active={isCW}>TODAY</YBtn>
              <YBtn onClick={()=>{const d=new Date(ws);d.setDate(d.getDate()+7);setWs(d);}}>▶</YBtn>
            </div>
            <div style={{padding:"8px 16px",background:Y.surface,border:"1px solid "+Y.surfaceBorder,borderRadius:10}}>
              <span style={{fontSize:13,fontWeight:600,color:Y.text,fontFamily:"'JetBrains Mono',monospace"}}>{fmtW(ws)}</span>
            </div>
            <YBtn onClick={copySlack}>{copied?"✓":"📋"} Slack</YBtn>
          </div>
        </div>

        {/* TODAY'S FOCUS */}
        {isCW && todayName && (
          <div style={{background:"linear-gradient(135deg,"+Y.todayBg+",rgba(234,179,8,0.03))",border:"1px solid "+Y.todayBorder,borderRadius:14,padding:"16px 20px",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:todayAssigns.length?12:0}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:Y.accent,boxShadow:"0 0 12px "+Y.accentGlow,animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:13,fontWeight:700,color:Y.accentBright}}>TODAY'S FOCUS</span>
              <span style={{fontSize:12,color:Y.textDim}}>{fmtFull(now)}</span>
              {!todayAssigns.length && <span style={{fontSize:12,color:Y.textMuted,fontStyle:"italic",marginLeft:8}}>No videos scheduled</span>}
            </div>
            {todayAssigns.length>0 && (
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {todayAssigns.map(a=>{const co=col(a.cl);return(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,background:co.bg,border:"1px solid "+co.border+"40",borderRadius:10,padding:"10px 16px"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:co.dot}}/>
                    <div><div style={{fontSize:13,fontWeight:700,color:co.text}}>{a.cl}</div>
                    {a.vn&&<div style={{fontSize:10,color:co.text+"99",marginTop:1}}>{a.vn}</div>}</div>
                    <div style={{fontSize:10,color:"#52525b",borderLeft:"1px solid rgba(245,158,11,0.1)",paddingLeft:10}}>{a.ed}</div>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}

        {/* PIPELINE */}
        <div style={{background:Y.surface,border:"1px solid "+Y.surfaceBorder,borderRadius:14,padding:20,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:11,fontWeight:700,color:Y.accent,letterSpacing:2,fontFamily:"'JetBrains Mono',monospace"}}>⬡ PIPELINE</span>
              {lastSync && <span className="ntag" style={{background:Y.card,color:Y.accent,border:"1px solid "+Y.surfaceBorder}}>synced</span>}
            </div>
            <div style={{display:"flex",gap:16,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
              <span style={{color:Y.textDim}}>Total <span style={{color:Y.text,fontWeight:700}}>{tPL}</span></span>
              <span style={{color:Y.textDim}}>Assigned <span style={{color:Y.accent,fontWeight:700}}>{tPL-tRem}</span></span>
              <span style={{color:Y.textDim}}>Left <span style={{color:tRem>0?"#fbbf24":"#4ade80",fontWeight:700}}>{tRem}</span></span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
            {clients.map(c=>{
              const co=col(c);const pl=pipeline[c]||0;const asgn=totA(c);const r=rem(c);const p=pl>0?Math.round(asgn/pl*100):0;
              const bd=pipelineBreakdown[c]||{};const assignable=getAssignable(c).length;
              return(
                <div key={c} style={{background:"rgba(0,0,0,0.4)",border:"1px solid "+co.border+"18",borderRadius:12,padding:"12px 14px",position:"relative",overflow:"hidden"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=co.border+"45"} onMouseLeave={e=>e.currentTarget.style.borderColor=co.border+"18"}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:co.dot,boxShadow:"0 0 8px "+co.glow}}/>
                    <span style={{fontSize:13,fontWeight:700,color:co.text}}>{c}</span>
                    {assignable>0&&<span style={{marginLeft:"auto",fontSize:9,background:co.border+"25",color:co.text,padding:"1px 6px",borderRadius:8,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{assignable} ready</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                    <button onClick={()=>setPL(c,pl-1)} style={cntB(co)}>−</button>
                    {editPL===c?(
                      <input ref={plR} value={plV} onChange={e=>setPlV(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")savePLE();if(e.key==="Escape")setEditPL(null);}} onBlur={savePLE}
                        style={{background:"rgba(0,0,0,0.4)",border:"1px solid "+co.border+"40",borderRadius:6,width:40,height:26,color:co.text,fontSize:16,fontWeight:800,textAlign:"center",fontFamily:"'JetBrains Mono',monospace",outline:"none",padding:0}}/>
                    ):(
                      <span onClick={()=>{setEditPL(c);setPlV(String(pl));}}
                        style={{fontSize:20,fontWeight:800,color:co.text,cursor:"pointer",minWidth:32,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{pl}</span>
                    )}
                    <button onClick={()=>setPL(c,pl+1)} style={cntB(co)}>+</button>
                  </div>
                  {Object.keys(bd).length>0 && (
                    <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:6}}>
                      {Object.entries(bd).filter(([_,v])=>v>0).map(([s,v])=>(
                        <span key={s} style={{fontSize:7,padding:"1px 4px",borderRadius:3,background:co.border+"15",color:co.text+"90",fontFamily:"'JetBrains Mono',monospace"}}>{s} {v}</span>
                      ))}
                    </div>
                  )}
                  <div style={{background:"rgba(0,0,0,0.3)",borderRadius:5,height:4,marginBottom:5,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:5,background:`linear-gradient(90deg,${co.accent},${co.dot})`,width:Math.min(p,100)+"%",transition:"width .4s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
                    <span style={{color:co.text+"70"}}>Done {asgn}</span>
                    <span style={{color:r>0?"#fbbf24":"#4ade80",fontWeight:700}}>Left {r}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STATS */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          <YStat label="TOTAL" value={filled}/><YStat label="EDITORS" value={editors.length}/>
          {clients.map(c=><YStat key={c} label={c.toUpperCase()} value={wkA2(c)} color={col(c).dot}/>)}
        </div>

        {/* GRID */}
        <div style={{overflowX:"auto",paddingBottom:4}}>
          <div style={{minWidth:920}}>
            {/* Header */}
            <div style={{display:"grid",gridTemplateColumns:"160px repeat(6,1fr)",gap:3,marginBottom:3}}>
              <div style={{padding:10,fontSize:10,color:Y.textMuted,letterSpacing:2.5,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"flex-end",fontWeight:700}}>EDITORS</div>
              {DAYS.map((day,i)=>{const d=new Date(ws);d.setDate(d.getDate()+i);const isT=isCW&&i===tI;return(
                <div key={day} style={{padding:"10px 8px",textAlign:"center",borderRadius:"12px 12px 0 0",
                  background:isT?Y.todayBg:"rgba(255,255,255,0.01)",
                  border:isT?"1px solid "+Y.todayBorder:"1px solid rgba(255,255,255,0.03)",borderBottom:"none",position:"relative"}}>
                  <div style={{fontSize:10,letterSpacing:2.5,fontWeight:700,color:isT?Y.accentBright:Y.textMuted,fontFamily:"'JetBrains Mono',monospace"}}>{SHORT[i]}</div>
                  <div style={{fontSize:14,fontWeight:700,color:isT?Y.text:"#52525b",marginTop:2}}>{fmt(d)}</div>
                  {isT&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:24,height:3,borderRadius:"3px 3px 0 0",background:"linear-gradient(90deg,#f59e0b,#eab308)"}}/>}
                </div>
              );})}
            </div>

            {/* Rows */}
            {editors.map((ed,eI)=>{const ld=editorLoad(ed);return(
              <div key={ed} style={{display:"grid",gridTemplateColumns:"160px repeat(6,1fr)",gap:3,marginBottom:3}}>
                {/* Editor label */}
                <div className="hov-show" style={{padding:"10px 12px",background:"rgba(255,255,255,0.01)",border:"1px solid rgba(255,255,255,0.03)",
                  borderRadius:eI===0?"12px 0 0 0":eI===editors.length-1?"0 0 0 12px":"0",display:"flex",flexDirection:"column",justifyContent:"center",gap:6,minHeight:72}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    {renI===eI?(
                      <input ref={rR} value={renV} onChange={e=>setRenV(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter"&&renV.trim()){const old=editors[eI];setEditors(p=>p.map((x,i)=>i===eI?renV.trim():x));setAssigns(p=>p.map(a=>a.ed===old?{...a,ed:renV.trim()}:a));setRenI(null);}if(e.key==="Escape")setRenI(null);}}
                        onBlur={()=>{if(renV.trim()){const old=editors[eI];setEditors(p=>p.map((x,i)=>i===eI?renV.trim():x));setAssigns(p=>p.map(a=>a.ed===old?{...a,ed:renV.trim()}:a));}setRenI(null);}}
                        style={{...inp,width:"100%",fontSize:12,padding:"4px 8px"}}/>
                    ):(
                      <>
                        <span onClick={()=>{setRenI(eI);setRenV(ed);}} style={{fontSize:13,fontWeight:600,color:"#a1a1aa",cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title="Rename">{ed}</span>
                        <span className="hov-target" onClick={()=>{setEditors(p=>p.filter(x=>x!==ed));setAssigns(p=>p.filter(a=>a.ed!==ed));}}
                          style={{cursor:"pointer",color:Y.textMuted,fontSize:13,opacity:0}}>×</span>
                      </>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,background:"rgba(0,0,0,0.3)",borderRadius:4,height:4,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:4,width:Math.min(ld/6*100,100)+"%",
                        background:ld>5?"linear-gradient(90deg,#ef4444,#f97316)":ld>3?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#eab308,#fbbf24)"}}/>
                    </div>
                    <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:ld>5?"#fca5a5":Y.textDim,fontWeight:600}}>{ld} vid{ld!==1?"s":""}</span>
                  </div>
                </div>

                {/* Cells */}
                {DAYS.map((day,dI)=>{
                  const ci=cellAs(day,ed);const isT=isCW&&dI===tI;const cid=day+"::"+ed;
                  const isPickC=pickingClient&&pickingClient.day===day&&pickingClient.ed===ed;
                  const isPickV=pickingVideo&&pickingVideo.day===day&&pickingVideo.ed===ed;
                  const isManual=manualMode&&manualMode.day===day&&manualMode.ed===ed;
                  const isOpen=openCell===cid||isPickC||isPickV||isManual;

                  return(
                    <div key={day} className="cell"
                      onClick={()=>{if(!isOpen){closeAll();setOpenCell(cid);setPickingClient({day,ed});}}}
                      onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                      onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
                      onDrop={e=>{e.currentTarget.classList.remove("drag-over");handleDropCell(day,ed);}}
                      style={{padding:6,background:isT?"rgba(245,158,11,0.02)":"rgba(255,255,255,0.006)",
                        border:isT?"1px solid rgba(245,158,11,0.08)":"1px solid rgba(255,255,255,0.03)",
                        cursor:"pointer",minHeight:72,
                        borderRadius:eI===0&&dI===5?"0 12px 0 0":eI===editors.length-1&&dI===5?"0 0 12px 0":"0"}}>

                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {/* Existing assigned chips */}
                        {ci.map(a=>{const co=col(a.cl);return(
                          <div key={a.id} className="chip" draggable onDragStart={e=>{e.stopPropagation();setDragA(a);}} onDragEnd={()=>setDragA(null)} onClick={e=>e.stopPropagation()}
                            style={{background:co.bg,border:"1px solid "+co.border+"28",borderRadius:8,padding:"5px 8px"}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <span style={{width:5,height:5,borderRadius:"50%",background:co.dot}}/><span style={{fontSize:11,fontWeight:700,color:co.text}}>{a.cl}</span>
                              </div>
                              <span onClick={e=>{e.stopPropagation();setAssigns(p=>p.filter(x=>x.id!==a.id));showToast("Removed");}}
                                style={{cursor:"pointer",color:co.text,opacity:0.2,fontSize:12,lineHeight:1}}>×</span>
                            </div>
                            <div style={{fontSize:9,color:co.text+"90",paddingLeft:9,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.vn||"—"}</div>
                          </div>
                        );})}

                        {/* STEP 1: Pick client */}
                        {isPickC&&!isPickV&&!isManual&&(
                          <div className="fu" onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",gap:3}}>
                            {clients.map(c=>{const co=col(c);const ready=getAssignable(c).length;return(
                              <button key={c} onClick={()=>{setPickingClient(null);setPickingVideo({day,ed,cl:c});}}
                                style={{background:co.bg,border:"1px solid "+co.border+"25",borderRadius:6,padding:"5px 9px",color:co.text,fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .15s"}}
                                onMouseEnter={e=>e.currentTarget.style.borderColor=co.border+"60"} onMouseLeave={e=>e.currentTarget.style.borderColor=co.border+"25"}>
                                <span>{c}</span>
                                {ready>0&&<span style={{fontSize:8,background:co.border+"25",color:co.text,borderRadius:8,padding:"0 5px",fontWeight:800}}>{ready}</span>}
                              </button>
                            );})}
                          </div>
                        )}

                        {/* STEP 2: Pick video from Notion */}
                        {isPickV&&(()=>{
                          const co=col(pickingVideo.cl);
                          const vids=getAssignable(pickingVideo.cl);
                          return(
                            <div className="fu" onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",gap:3}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                                <div style={{display:"flex",alignItems:"center",gap:4}}>
                                  <span style={{width:5,height:5,borderRadius:"50%",background:co.dot}}/>
                                  <span style={{fontSize:11,fontWeight:700,color:co.text}}>{pickingVideo.cl}</span>
                                </div>
                                <button onClick={()=>{setPickingVideo(null);setPickingClient({day,ed});}}
                                  style={{background:"none",border:"none",color:Y.textDim,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>← back</button>
                              </div>
                              {vids.length>0 ? vids.slice(0,8).map(v=>(
                                <div key={v.id} className="vid-pick" onClick={()=>assignVideo(day,ed,pickingVideo.cl,v)}
                                  style={{padding:"4px 8px",borderRadius:5,background:"rgba(0,0,0,0.2)"}}>
                                  <div style={{fontSize:10,fontWeight:600,color:Y.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.title}</div>
                                  <div style={{fontSize:8,color:Y.textDim,fontFamily:"'JetBrains Mono',monospace",marginTop:1}}>{v.status}{v.editor?" • "+v.editor:""}</div>
                                </div>
                              )) : (
                                <div style={{fontSize:10,color:Y.textMuted,fontStyle:"italic",padding:4}}>No assignable videos. Sync Notion?</div>
                              )}
                              <button onClick={()=>{setPickingVideo(null);setManualMode({day,ed,cl:pickingVideo.cl});setManualName("");}}
                                style={{background:"none",border:"1px dashed "+Y.surfaceBorder,borderRadius:5,padding:"4px 8px",color:Y.textDim,fontSize:9,cursor:"pointer",fontFamily:"inherit",textAlign:"center",marginTop:2}}>
                                ✎ Type manually
                              </button>
                            </div>
                          );
                        })()}

                        {/* Manual name entry */}
                        {isManual&&(()=>{
                          const co=col(manualMode.cl);
                          return(
                            <div className="fu" onClick={e=>e.stopPropagation()} style={{background:co.bg,border:"1px solid "+co.border+"40",borderRadius:8,padding:"6px 8px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                                <span style={{width:5,height:5,borderRadius:"50%",background:co.dot}}/><span style={{fontSize:11,fontWeight:700,color:co.text}}>{manualMode.cl}</span>
                              </div>
                              <input ref={manualRef} value={manualName} onChange={e=>setManualName(e.target.value)}
                                onKeyDown={e=>{if(e.key==="Enter")assignManual();if(e.key==="Escape")closeAll();}}
                                placeholder="Video name ↵" style={{...inp,width:"100%",fontSize:9,padding:"3px 6px",background:"rgba(0,0,0,0.3)",borderColor:co.border+"30",color:co.text,marginBottom:4}}/>
                              <div style={{display:"flex",gap:3}}>
                                <button onClick={assignManual} style={{flex:1,background:co.border+"18",border:"1px solid "+co.border+"30",borderRadius:5,padding:"3px 0",color:co.text,fontSize:9,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Save</button>
                                <button onClick={closeAll} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"3px 6px",color:"#52525b",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>×</button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Empty state / add more */}
                        {!ci.length&&!isOpen&&(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:52,color:Y.textMuted+"40",fontSize:22,fontWeight:300}}>+</div>)}
                        {ci.length>0&&!isOpen&&(<div className="add-more" onClick={e=>{e.stopPropagation();closeAll();setOpenCell(cid);setPickingClient({day,ed});}}
                          style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3px 0",borderRadius:5,border:"1px dashed "+Y.surfaceBorder,color:Y.textMuted,fontSize:11,cursor:"pointer",marginTop:1}}>+ add</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );})}
          </div>
        </div>

        {/* Add editor / client */}
        <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
          {addE?(
            <div className="fu" style={{display:"flex",gap:6,alignItems:"center"}}>
              <input ref={eR} value={ne} onChange={e=>setNe(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&ne.trim()&&!editors.includes(ne.trim())){setEditors(p=>[...p,ne.trim()]);setNe("");setAddE(false);}}}
                placeholder="Editor name" style={inp}/>
              <YBtn onClick={()=>{if(ne.trim()&&!editors.includes(ne.trim())){setEditors(p=>[...p,ne.trim()]);setNe("");setAddE(false);}}} active>Add</YBtn>
              <YBtn onClick={()=>{setAddE(false);setNe("");}}>×</YBtn>
            </div>
          ):(
            <button onClick={()=>setAddE(true)} style={{background:"none",border:"1px dashed "+Y.surfaceBorder,borderRadius:10,padding:"10px 22px",color:Y.textMuted,cursor:"pointer",fontSize:11,letterSpacing:2,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=Y.accent+"40";e.currentTarget.style.color=Y.accent;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=Y.surfaceBorder;e.currentTarget.style.color=Y.textMuted;}}>+ ADD EDITOR</button>
          )}
          {addC?(
            <div className="fu" style={{display:"flex",gap:6,alignItems:"center"}}>
              <input ref={cR} value={nc} onChange={e=>setNc(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&nc.trim()&&!clients.includes(nc.trim())){setClients(p=>[...p,nc.trim()]);setPipeline(p=>({...p,[nc.trim()]:0}));setNc("");setAddC(false);}}}
                placeholder="Client name" style={inp}/>
              <YBtn onClick={()=>{if(nc.trim()&&!clients.includes(nc.trim())){setClients(p=>[...p,nc.trim()]);setPipeline(p=>({...p,[nc.trim()]:0}));setNc("");setAddC(false);}}} active>Add</YBtn>
              <YBtn onClick={()=>{setAddC(false);setNc("");}}>×</YBtn>
            </div>
          ):(
            <button onClick={()=>setAddC(true)} style={{background:"none",border:"1px dashed "+Y.surfaceBorder,borderRadius:10,padding:"10px 22px",color:Y.textMuted,cursor:"pointer",fontSize:11,letterSpacing:2,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=Y.accent+"40";e.currentTarget.style.color=Y.accent;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=Y.surfaceBorder;e.currentTarget.style.color=Y.textMuted;}}>+ ADD CLIENT</button>
          )}
        </div>

        <div style={{marginTop:24,padding:"14px 0",borderTop:"1px solid "+Y.surfaceBorder,display:"flex",gap:24,flexWrap:"wrap",fontSize:10,color:Y.textMuted,fontFamily:"'JetBrains Mono',monospace"}}>
          <span>⬡ Click cell → pick client → pick Notion video</span>
          <span>⬡ Editor auto-updates in Notion</span>
          <span>⬡ Drag chips to reschedule</span>
          <span>⬡ "Type manually" for custom entries</span>
        </div>
      </div>
    </div>
  );
}

function YBtn({children,onClick,active,style:s}){
  return <button onClick={onClick} style={{background:active?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(245,158,11,0.04)",border:"1px solid "+(active?"#f59e0b":"rgba(245,158,11,0.12)"),color:active?"#000":"#92400e",padding:"7px 14px",borderRadius:9,fontSize:11,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:active?800:600,transition:"all .15s",boxShadow:active?"0 0 18px rgba(245,158,11,0.3)":"none",...s}}>{children}</button>;
}
function YStat({label,value,color}){
  return(<div style={{background:"rgba(245,158,11,0.03)",border:"1px solid rgba(245,158,11,0.08)",borderRadius:10,padding:"8px 16px",display:"flex",flexDirection:"column",gap:2,minWidth:56}}>
    <span style={{fontSize:8,color:"#78350f",letterSpacing:1.5,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{label}</span>
    <span style={{fontSize:17,fontWeight:800,color:color||"#fef3c7",fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
  </div>);
}
function cntB(co){return{background:"rgba(0,0,0,0.3)",border:"1px solid "+co.border+"18",borderRadius:6,width:24,height:24,color:co.text,cursor:"pointer",fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"};}
const inp={background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:7,padding:"6px 10px",color:"#fef3c7",fontSize:12,fontFamily:"'Outfit',sans-serif",width:130,outline:"none"};
