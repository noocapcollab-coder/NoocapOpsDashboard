import { useState, useRef, useEffect, useCallback } from "react";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const SHORT = ["MON","TUE","WED","THU","FRI","SAT"];

const PALETTE = {
  Brad:    { bg:"rgba(59,130,246,0.10)", border:"#3b82f6", text:"#93c5fd", dot:"#3b82f6", glow:"rgba(59,130,246,0.3)", accent:"#2563eb" },
  Lindsay: { bg:"rgba(168,85,247,0.10)", border:"#a855f7", text:"#d8b4fe", dot:"#a855f7", glow:"rgba(168,85,247,0.3)", accent:"#7c3aed" },
  Duncan:  { bg:"rgba(34,197,94,0.10)",  border:"#22c55e", text:"#86efac", dot:"#22c55e", glow:"rgba(34,197,94,0.3)",  accent:"#16a34a" },
  EmTech:  { bg:"rgba(245,158,11,0.10)", border:"#f59e0b", text:"#fcd34d", dot:"#f59e0b", glow:"rgba(245,158,11,0.3)", accent:"#d97706" },
  Chris:   { bg:"rgba(6,182,212,0.10)",  border:"#06b6d4", text:"#67e8f9", dot:"#06b6d4", glow:"rgba(6,182,212,0.3)",  accent:"#0891b2" },
};
const XTRA = [
  { bg:"rgba(244,63,94,0.10)", border:"#f43f5e", text:"#fda4af", dot:"#f43f5e", glow:"rgba(244,63,94,0.3)", accent:"#e11d48" },
  { bg:"rgba(132,204,22,0.10)", border:"#84cc16", text:"#bef264", dot:"#84cc16", glow:"rgba(132,204,22,0.3)", accent:"#65a30d" },
];

// Theme colors
const Y = {
  bg: "#050505",
  card: "rgba(245,158,11,0.03)",
  cardBorder: "rgba(245,158,11,0.08)",
  cardHover: "rgba(245,158,11,0.12)",
  accent: "#f59e0b",
  accentDim: "#b45309",
  accentGlow: "rgba(245,158,11,0.25)",
  accentBright: "#fbbf24",
  gold: "#eab308",
  text: "#fef3c7",
  textDim: "#92400e",
  textMuted: "#78350f",
  surface: "rgba(245,158,11,0.04)",
  surfaceBorder: "rgba(245,158,11,0.10)",
  todayBg: "rgba(245,158,11,0.06)",
  todayBorder: "rgba(245,158,11,0.18)",
};

const getMonday = (d) => { const dt=new Date(d);const dy=dt.getDay();dt.setDate(dt.getDate()-dy+(dy===0?-6:1));dt.setHours(0,0,0,0);return dt; };
const fmt = (d) => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull = (d) => d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
const fmtW = (m) => { const s=new Date(m);s.setDate(s.getDate()+5);return fmt(m)+" — "+fmt(s)+", "+s.getFullYear(); };
const uid = () => Math.random().toString(36).slice(2,9);

// ═══ LOCALSTORAGE PERSISTENCE ═══
const SK = "noocap_ops_";
const load = (k, fb) => { try { const v = localStorage.getItem(SK+k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(SK+k, JSON.stringify(v)); } catch {} };

export default function App() {
  const [clients, setClients] = useState(() => load("clients", ["Brad","Duncan","EmTech"]));
  const [editors, setEditors] = useState(() => load("editors", ["Parvez","Ananya","Sumith"]));
  const [pipeline, setPipeline] = useState(() => load("pipeline", {Brad:0,Duncan:0,EmTech:0}));
  const [pipelineBreakdown, setPipelineBreakdown] = useState(() => load("breakdown", {}));
  const [notionVideos, setNotionVideos] = useState(() => load("notionVideos", {}));
  const [ws, setWs] = useState(() => getMonday(new Date()));
  const [assigns, setAssigns] = useState(() => load("assigns", []));
  const mounted = useRef(false);
  const [dragC, setDragC] = useState(null);
  const [dragA, setDragA] = useState(null);
  const [openCell, setOpenCell] = useState(null);
  const [pending, setPending] = useState(null);
  const [vn, setVn] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNm, setEditNm] = useState("");
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
  const [syncError, setSyncError] = useState(null);

  const cR=useRef(),eR=useRef(),rR=useRef(),vnR=useRef(),edR=useRef(),plR=useRef();

  // Auto-save
  useEffect(()=>{
    if(!mounted.current){mounted.current=true;return;}
    save("clients",clients);save("editors",editors);save("pipeline",pipeline);
    save("breakdown",pipelineBreakdown);save("notionVideos",notionVideos);
    save("assigns",assigns);if(lastSync)save("lastSync",lastSync);
  },[clients,editors,pipeline,pipelineBreakdown,notionVideos,assigns,lastSync]);

  useEffect(()=>{if(addC&&cR.current)cR.current.focus();},[addC]);
  useEffect(()=>{if(addE&&eR.current)eR.current.focus();},[addE]);
  useEffect(()=>{if(renI!==null&&rR.current)rR.current.focus();},[renI]);
  useEffect(()=>{if(pending&&vnR.current)vnR.current.focus();},[pending]);
  useEffect(()=>{if(editId&&edR.current)edR.current.focus();},[editId]);
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

  const doStart = (d,e,c) => { setPending({day:d,ed:e,cl:c});setVn("");setOpenCell(null); };
  const doConfirm = () => { if(!pending)return;const{day,ed,cl}=pending;setAssigns(p=>[...p,{id:uid(),wk,day,ed,cl,vn:vn.trim()}]);setPending(null);setVn("");showToast("Video assigned"); };
  const doCancel = () => { setPending(null);setVn(""); };
  const startEN = (a,e) => { e.stopPropagation();setEditId(a.id);setEditNm(a.vn||""); };
  const saveEN = () => { if(editId){setAssigns(p=>p.map(a=>a.id===editId?{...a,vn:editNm.trim()}:a));setEditId(null);setEditNm("");} };
  const setPL = (c,v) => setPipeline(p=>({...p,[c]:Math.max(0,v)}));
  const savePLE = () => { if(editPL){const v=parseInt(plV,10);if(!isNaN(v))setPL(editPL,v);setEditPL(null);} };
  const handleDropCell = (day, ed) => {
    if(dragA){setAssigns(p=>p.map(a=>a.id===dragA.id?{...a,day,ed,wk}:a));setDragA(null);showToast("Rescheduled");}
    else if(dragC){doStart(day,ed,dragC);setDragC(null);}
  };

  // ═══ NOTION SYNC ═══
  const syncFromNotion = async () => {
    setSyncing(true);setSyncError(null);
    try {
      const resp = await fetch("/api/sync");
      const json = await resp.json();
      if (!json.success) throw new Error(json.error || "Sync failed");
      const newPipeline = {...pipeline};
      const allBreakdowns = {};const allEditors = new Set(editors);const allVideos = {};
      for (const [client, data] of Object.entries(json.data)) {
        newPipeline[client] = data.pipelineCount;
        allBreakdowns[client] = data.statusCounts;
        allVideos[client] = data.videos;
        data.editors.forEach(e => allEditors.add(e));
        if (!clients.includes(client)) setClients(p => [...p, client]);
      }
      setPipeline(newPipeline);setPipelineBreakdown(allBreakdowns);
      setNotionVideos(allVideos);setEditors([...allEditors]);
      setLastSync(new Date().toLocaleTimeString());showToast("Synced from Notion");
    } catch (err) {
      console.error("Sync error:", err);setSyncError(err.message);showToast("Sync failed: "+err.message, true);
    } finally { setSyncing(false); }
  };

  const wkAs = assigns.filter(a=>a.wk===wk);
  const filled = wkAs.length;
  const tPL = Object.values(pipeline).reduce((s,v)=>s+v,0);
  const tRem = clients.reduce((s,c)=>s+rem(c),0);
  const todayAssigns = todayName ? wkAs.filter(a=>a.day===todayName) : [];

  const copySlack = () => {
    let text = `📋 *NOOCAP Video Schedule — ${fmtW(ws)}*\n\n`;
    editors.forEach(ed => { const edAs = wkAs.filter(a=>a.ed===ed); if(!edAs.length)return; text += `*${ed}*\n`; DAYS.forEach(day => { edAs.filter(x=>x.day===day).forEach(a => { text += `  ${SHORT[DAYS.indexOf(day)]}: ${a.cl}${a.vn?" — "+a.vn:""}\n`; }); }); text += "\n"; });
    if(!filled) text += "_No videos scheduled this week_\n";
    navigator.clipboard.writeText(text).then(()=>{setCopied(true);showToast("Copied!");setTimeout(()=>setCopied(false),2000);});
  };

  return (
    <div style={{background:Y.bg,color:"#d4d4d8",minHeight:"100vh",fontFamily:"'Outfit',system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${Y.accentDim}40;border-radius:9px}
        input:focus{outline:none;border-color:${Y.accent}50 !important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px ${Y.accentGlow}}50%{box-shadow:0 0 20px ${Y.accentGlow}}}
        .fu{animation:fadeUp .22s ease-out}.si{animation:slideIn .3s ease-out}
        .cell{transition:all .15s}.cell:hover{background:${Y.card} !important;border-color:${Y.cardBorder} !important}
        .pill{transition:all .18s;cursor:grab;user-select:none}.pill:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.5)}.pill:active{cursor:grabbing;transform:scale(1.03)}
        .chip{transition:all .18s}.chip:hover{transform:scale(1.01);box-shadow:0 4px 16px rgba(0,0,0,0.4) !important}
        .hov-bright:hover{filter:brightness(1.3)}
        .hov-show:hover .hov-target{opacity:1 !important}
        .drag-over{box-shadow:inset 0 0 0 2px ${Y.accent}60 !important;background:${Y.card} !important}
        .add-more{opacity:0;transition:opacity .15s}.cell:hover .add-more{opacity:1}
        .sync-spin{animation:spin 1s linear infinite}
        .ntag{font-size:8px;padding:1px 5px;border-radius:4px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase}
      `}</style>

      {/* Ambient yellow glow */}
      <div style={{position:"absolute",top:-300,left:"20%",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(245,158,11,0.04) 0%,transparent 60%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:400,right:"-5%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(234,179,8,0.03) 0%,transparent 60%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-200,left:"40%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(245,158,11,0.02) 0%,transparent 60%)",pointerEvents:"none"}}/>

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",zIndex:999,
          background:toast.isErr?"rgba(239,68,68,0.12)":"rgba(245,158,11,0.12)",
          border:"1px solid "+(toast.isErr?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"),backdropFilter:"blur(12px)",
          borderRadius:10,padding:"10px 24px",color:toast.isErr?"#fca5a5":"#fcd34d",fontSize:13,fontWeight:600,
          animation:"toastIn .25s ease-out",boxShadow:"0 8px 32px rgba(0,0,0,0.5)",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{toast.isErr?"✗":"✓"}</span>{toast.msg}
        </div>
      )}

      <div style={{position:"relative",zIndex:1,padding:"24px 28px",maxWidth:1480,margin:"0 auto"}}>

        {/* ═══ HEADER ═══ */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16,marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:12,background:"linear-gradient(135deg,#f59e0b 0%,#eab308 40%,#d97706 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#000",boxShadow:"0 0 28px rgba(245,158,11,0.4),0 0 56px rgba(234,179,8,0.15)",letterSpacing:"-1px",animation:"glow 3s ease-in-out infinite"}}>N</div>
            <div>
              <h1 style={{margin:0,fontSize:26,fontWeight:900,color:"#fafafa",letterSpacing:"-0.5px",lineHeight:1.1}}>
                NOOCAP <span style={{background:"linear-gradient(90deg,#f59e0b,#eab308,#fbbf24)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Media Ops</span>
              </h1>
              <p style={{margin:"3px 0 0",fontSize:10,color:Y.textDim,letterSpacing:3,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>PRODUCTION DASHBOARD</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <button onClick={syncFromNotion} disabled={syncing}
              style={{background:syncing?Y.card:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,179,8,0.08))",
                border:"1px solid "+Y.surfaceBorder,color:syncing?Y.textDim:Y.accentBright,padding:"8px 18px",borderRadius:10,fontSize:11,
                cursor:syncing?"wait":"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:700,display:"flex",alignItems:"center",gap:7,transition:"all .15s"}}>
              <span className={syncing?"sync-spin":""} style={{fontSize:14}}>⟳</span>
              {syncing?"Syncing...":"Sync Notion"}
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
            <YBtn onClick={copySlack}>{copied?"✓ Copied":"📋 Slack"}</YBtn>
          </div>
        </div>

        {/* ═══ TODAY'S FOCUS ═══ */}
        {isCW && todayName && (
          <div className="si" style={{background:"linear-gradient(135deg,"+Y.todayBg+",rgba(234,179,8,0.03))",border:"1px solid "+Y.todayBorder,borderRadius:14,padding:"16px 20px",marginBottom:20,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:200,height:"100%",background:"linear-gradient(90deg,transparent,rgba(245,158,11,0.04))",pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:todayAssigns.length>0?12:0}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:Y.accent,boxShadow:"0 0 12px "+Y.accentGlow,animation:"pulse 2s ease-in-out infinite"}}/>
              <span style={{fontSize:13,fontWeight:700,color:Y.accentBright,letterSpacing:0.5}}>TODAY'S FOCUS</span>
              <span style={{fontSize:12,color:Y.textDim}}>{fmtFull(now)}</span>
              {todayAssigns.length===0 && <span style={{fontSize:12,color:Y.textMuted,fontStyle:"italic",marginLeft:8}}>No videos scheduled</span>}
              {todayAssigns.length>0 && <span style={{fontSize:11,color:Y.textDim,fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto"}}>{todayAssigns.length} video{todayAssigns.length>1?"s":""}</span>}
            </div>
            {todayAssigns.length>0 && (
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {todayAssigns.map(a=>{const co=col(a.cl);return(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,background:co.bg,border:"1px solid "+co.border+"40",borderRadius:10,padding:"10px 16px"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:co.dot,boxShadow:"0 0 8px "+co.glow}}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:co.text}}>{a.cl}</div>
                      {a.vn && <div style={{fontSize:10,color:co.text+"99",marginTop:1}}>{a.vn}</div>}
                    </div>
                    <div style={{fontSize:10,color:"#52525b",borderLeft:"1px solid rgba(245,158,11,0.1)",paddingLeft:10}}>{a.ed}</div>
                  </div>
                );})}
              </div>
            )}
          </div>
        )}

        {/* ═══ PIPELINE ═══ */}
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10}}>
            {clients.map(c=>{
              const co=col(c);const pl=pipeline[c]||0;const asgn=totA(c);const r=rem(c);const p=pl>0?Math.round(asgn/pl*100):0;
              const bd = pipelineBreakdown[c]||{};
              const hasNotion = !!pipelineBreakdown[c] && Object.keys(pipelineBreakdown[c]).length > 0;
              return(
                <div key={c} style={{background:"rgba(0,0,0,0.4)",border:"1px solid "+co.border+"18",borderRadius:12,padding:"12px 14px",transition:"all .2s",position:"relative",overflow:"hidden"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=co.border+"45"} onMouseLeave={e=>e.currentTarget.style.borderColor=co.border+"18"}>
                  <div style={{position:"absolute",top:-10,right:-10,width:50,height:50,borderRadius:"50%",background:co.glow,filter:"blur(25px)",opacity:0.25}}/>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,position:"relative"}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:co.dot,boxShadow:"0 0 8px "+co.glow}}/>
                    <span style={{fontSize:13,fontWeight:700,color:co.text}}>{c}</span>
                    {hasNotion && <span className="ntag" style={{background:"rgba(245,158,11,0.08)",color:Y.textDim,marginLeft:"auto",border:"1px solid "+Y.surfaceBorder}}>notion</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,position:"relative"}}>
                    <button className="hov-bright" onClick={()=>setPL(c,pl-1)} style={cntB(co)}>−</button>
                    {editPL===c?(
                      <input ref={plR} value={plV} onChange={e=>setPlV(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")savePLE();if(e.key==="Escape")setEditPL(null);}} onBlur={savePLE}
                        style={{background:"rgba(0,0,0,0.4)",border:"1px solid "+co.border+"40",borderRadius:6,width:40,height:26,color:co.text,fontSize:16,fontWeight:800,textAlign:"center",fontFamily:"'JetBrains Mono',monospace",outline:"none",padding:0}}/>
                    ):(
                      <span onClick={()=>{setEditPL(c);setPlV(String(pl));}}
                        style={{fontSize:20,fontWeight:800,color:co.text,cursor:"pointer",minWidth:32,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>{pl}</span>
                    )}
                    <button className="hov-bright" onClick={()=>setPL(c,pl+1)} style={cntB(co)}>+</button>
                    <span style={{fontSize:9,color:Y.textDim,marginLeft:"auto",fontFamily:"'JetBrains Mono',monospace"}}>in pipe</span>
                  </div>
                  {Object.keys(bd).length>0 && (
                    <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:6}}>
                      {Object.entries(bd).filter(([_,v])=>v>0).map(([s,v])=>{
                        const isP = ["idea","scripting","to film","to edit","not started"].includes(s.toLowerCase());
                        return <span key={s} style={{fontSize:8,padding:"1px 5px",borderRadius:4,background:isP?co.border+"18":"rgba(255,255,255,0.03)",color:isP?co.text:"#52525b",fontWeight:600,fontFamily:"'JetBrains Mono',monospace"}}>{s} {v}</span>;
                      })}
                    </div>
                  )}
                  <div style={{background:"rgba(0,0,0,0.3)",borderRadius:5,height:5,marginBottom:6,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:5,background:`linear-gradient(90deg,${co.accent},${co.dot})`,width:Math.min(p,100)+"%",transition:"width .4s ease",boxShadow:p>0?"0 0 10px "+co.glow:"none"}}/>
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

        {/* ═══ STATS ═══ */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          <YStat label="TOTAL VIDEOS" value={filled}/><YStat label="EDITORS" value={editors.length}/>
          {clients.map(c=><YStat key={c} label={c.toUpperCase()} value={wkA2(c)} color={col(c).dot}/>)}
        </div>

        {/* ═══ CLIENT PILLS ═══ */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:18}}>
          <span style={{fontSize:10,color:Y.textMuted,letterSpacing:2.5,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",marginRight:4}}>DRAG →</span>
          {clients.map(c=>{const co=col(c);const r2=rem(c);return(
            <div key={c} className="pill" draggable onDragStart={()=>setDragC(c)} onDragEnd={()=>setDragC(null)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"7px 14px",borderRadius:9,background:co.bg,border:"1.5px solid "+co.border+"45",color:co.text,fontSize:12,fontWeight:600}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:co.dot,boxShadow:"0 0 6px "+co.glow}}/>{c}
              {r2>0&&<span style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#000",fontSize:9,fontWeight:800,borderRadius:10,padding:"1px 6px",lineHeight:"14px"}}>{r2}</span>}
              <span onClick={()=>{setClients(p=>p.filter(x=>x!==c));setAssigns(p=>p.filter(a=>a.cl!==c));const np={...pipeline};delete np[c];setPipeline(np);}}
                style={{cursor:"pointer",opacity:0.2,fontSize:14,lineHeight:1,transition:"opacity .15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.7"} onMouseLeave={e=>e.currentTarget.style.opacity="0.2"}>×</span>
            </div>
          );})}
          {addC?(
            <div className="fu" style={{display:"flex",gap:4}}>
              <input ref={cR} value={nc} onChange={e=>setNc(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&nc.trim()&&!clients.includes(nc.trim())){const n=nc.trim();setClients(p=>[...p,n]);setPipeline(p=>({...p,[n]:0}));setNc("");setAddC(false);}}}
                placeholder="Client name" style={inp}/>
              <YBtn onClick={()=>{if(nc.trim()&&!clients.includes(nc.trim())){const n=nc.trim();setClients(p=>[...p,n]);setPipeline(p=>({...p,[n]:0}));setNc("");setAddC(false);}}} active>Add</YBtn>
              <YBtn onClick={()=>{setAddC(false);setNc("");}}>×</YBtn>
            </div>
          ):<YBtn onClick={()=>setAddC(true)}>+ Client</YBtn>}
        </div>

        {/* ═══ GRID ═══ */}
        <div style={{overflowX:"auto",paddingBottom:4}}>
          <div style={{minWidth:920}}>
            <div style={{display:"grid",gridTemplateColumns:"160px repeat(6,1fr)",gap:3,marginBottom:3}}>
              <div style={{padding:10,fontSize:10,color:Y.textMuted,letterSpacing:2.5,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"flex-end",fontWeight:700}}>EDITORS</div>
              {DAYS.map((day,i)=>{const d=new Date(ws);d.setDate(d.getDate()+i);const isT=isCW&&i===tI;return(
                <div key={day} style={{padding:"10px 8px",textAlign:"center",borderRadius:"12px 12px 0 0",
                  background:isT?Y.todayBg:"rgba(255,255,255,0.01)",
                  border:isT?"1px solid "+Y.todayBorder:"1px solid rgba(255,255,255,0.03)",borderBottom:"none",position:"relative"}}>
                  <div style={{fontSize:10,letterSpacing:2.5,fontWeight:700,color:isT?Y.accentBright:Y.textMuted,fontFamily:"'JetBrains Mono',monospace"}}>{SHORT[i]}</div>
                  <div style={{fontSize:14,fontWeight:700,color:isT?Y.text:"#52525b",marginTop:2}}>{fmt(d)}</div>
                  {isT&&<div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:24,height:3,borderRadius:"3px 3px 0 0",background:"linear-gradient(90deg,#f59e0b,#eab308)",boxShadow:"0 0 12px "+Y.accentGlow}}/>}
                </div>
              );})}
            </div>
            {editors.map((ed,eI)=>{const load2=editorLoad(ed);return(
              <div key={ed} style={{display:"grid",gridTemplateColumns:"160px repeat(6,1fr)",gap:3,marginBottom:3}}>
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
                        <span onClick={()=>{setRenI(eI);setRenV(ed);}} style={{fontSize:13,fontWeight:600,color:"#a1a1aa",cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",transition:"color .15s"}}
                          onMouseEnter={e=>e.currentTarget.style.color=Y.text} onMouseLeave={e=>e.currentTarget.style.color="#a1a1aa"} title="Click to rename">{ed}</span>
                        <span className="hov-target" onClick={()=>{setEditors(p=>p.filter(x=>x!==ed));setAssigns(p=>p.filter(a=>a.ed!==ed));}}
                          style={{cursor:"pointer",color:Y.textMuted,fontSize:13,flexShrink:0,transition:"all .15s",opacity:0}}
                          onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color=Y.textMuted}>×</span>
                      </>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,background:"rgba(0,0,0,0.3)",borderRadius:4,height:4,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:4,transition:"width .4s ease",width:Math.min(load2/6*100,100)+"%",
                        background:load2>5?"linear-gradient(90deg,#ef4444,#f97316)":load2>3?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#eab308,#fbbf24)"}}/>
                    </div>
                    <span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:load2>5?"#fca5a5":load2>3?Y.accentBright:Y.textDim,fontWeight:600,minWidth:28}}>{load2} vid{load2!==1?"s":""}</span>
                  </div>
                </div>
                {DAYS.map((day,dI)=>{
                  const ci=cellAs(day,ed);const isT=isCW&&dI===tI;const cid=day+"::"+ed;const isO=openCell===cid;const isP=pending&&pending.day===day&&pending.ed===ed;const has=ci.length>0;
                  return(
                    <div key={day} className="cell" onClick={()=>{if(!isP)setOpenCell(isO?null:cid);}}
                      onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                      onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
                      onDrop={e=>{e.currentTarget.classList.remove("drag-over");handleDropCell(day,ed);}}
                      style={{padding:6,background:isT?"rgba(245,158,11,0.02)":"rgba(255,255,255,0.006)",
                        border:isT?"1px solid rgba(245,158,11,0.08)":"1px solid rgba(255,255,255,0.03)",cursor:"pointer",minHeight:72,
                        borderRadius:eI===0&&dI===5?"0 12px 0 0":eI===editors.length-1&&dI===5?"0 0 12px 0":"0"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {ci.map(a=>{const co=col(a.cl);const isEd=editId===a.id;return(
                          <div key={a.id} className="chip" draggable onDragStart={e=>{e.stopPropagation();setDragA(a);}} onDragEnd={()=>setDragA(null)} onClick={e=>e.stopPropagation()}
                            style={{background:co.bg,border:"1px solid "+co.border+"28",borderRadius:8,padding:"5px 8px",cursor:"grab"}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <span style={{width:5,height:5,borderRadius:"50%",background:co.dot,flexShrink:0}}/><span style={{fontSize:11,fontWeight:700,color:co.text}}>{a.cl}</span>
                              </div>
                              <span onClick={e=>{e.stopPropagation();setAssigns(p=>p.filter(x=>x.id!==a.id));showToast("Removed");}}
                                style={{cursor:"pointer",color:co.text,opacity:0.2,fontSize:12,lineHeight:1,transition:"opacity .15s"}}
                                onMouseEnter={e=>e.currentTarget.style.opacity="0.8"} onMouseLeave={e=>e.currentTarget.style.opacity="0.2"}>×</span>
                            </div>
                            {isEd?(<input ref={edR} value={editNm} onChange={e=>setEditNm(e.target.value)} onClick={e=>e.stopPropagation()}
                              onKeyDown={e=>{if(e.key==="Enter")saveEN();if(e.key==="Escape"){setEditId(null);setEditNm("");}}} onBlur={saveEN} placeholder="Video name"
                              style={{...inp,width:"100%",fontSize:9,padding:"2px 6px",background:"rgba(0,0,0,0.3)",borderColor:co.border+"30",color:co.text,marginTop:2}}/>
                            ):(<div onClick={e=>startEN(a,e)} style={{fontSize:9,color:co.text,opacity:a.vn?0.7:0.25,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingLeft:9,fontStyle:a.vn?"normal":"italic",marginTop:1}}>{a.vn||"+ name"}</div>)}
                          </div>
                        );})}
                        {isP&&(()=>{const co=col(pending.cl);return(
                          <div className="fu" onClick={e=>e.stopPropagation()} style={{background:co.bg,border:"1px solid "+co.border+"40",borderRadius:8,padding:"5px 8px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                              <span style={{width:5,height:5,borderRadius:"50%",background:co.dot}}/><span style={{fontSize:11,fontWeight:700,color:co.text}}>{pending.cl}</span>
                            </div>
                            <input ref={vnR} value={vn} onChange={e=>setVn(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter")doConfirm();if(e.key==="Escape")doCancel();}}
                              placeholder="Video name ↵" style={{...inp,width:"100%",fontSize:9,padding:"3px 6px",background:"rgba(0,0,0,0.3)",borderColor:co.border+"30",color:co.text,marginBottom:4}}/>
                            <div style={{display:"flex",gap:3}}>
                              <button onClick={doConfirm} style={{flex:1,background:co.border+"18",border:"1px solid "+co.border+"30",borderRadius:5,padding:"3px 0",color:co.text,fontSize:9,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Save</button>
                              <button onClick={doCancel} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:5,padding:"3px 6px",color:"#52525b",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>×</button>
                            </div>
                          </div>
                        );})}
                        {isO&&!isP&&(
                          <div className="fu" style={{display:"flex",flexDirection:"column",gap:3}}>
                            {clients.map(c=>{const co=col(c);const r2=rem(c);return(
                              <button key={c} onClick={e=>{e.stopPropagation();doStart(day,ed,c);}}
                                style={{background:co.bg,border:"1px solid "+co.border+"20",borderRadius:6,padding:"4px 8px",color:co.text,fontSize:10,fontWeight:600,cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .15s"}}
                                onMouseEnter={e=>{e.currentTarget.style.borderColor=co.border+"60";e.currentTarget.style.boxShadow="0 0 10px "+co.glow;}}
                                onMouseLeave={e=>{e.currentTarget.style.borderColor=co.border+"20";e.currentTarget.style.boxShadow="none";}}>
                                <span>{c}</span>{r2>0&&<span style={{fontSize:8,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#000",borderRadius:8,padding:"0 4px",fontWeight:800}}>{r2}</span>}
                              </button>
                            );})}
                          </div>
                        )}
                        {!has&&!isO&&!isP&&(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:52,color:Y.textMuted+"40",fontSize:22,fontWeight:300,transition:"color .2s"}} onMouseEnter={e=>e.currentTarget.style.color=Y.textDim} onMouseLeave={e=>e.currentTarget.style.color=Y.textMuted+"40"}>+</div>)}
                        {has&&!isO&&!isP&&(<div className="add-more" onClick={e=>{e.stopPropagation();setOpenCell(cid);}} style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3px 0",borderRadius:5,border:"1px dashed "+Y.surfaceBorder,color:Y.textMuted,fontSize:11,cursor:"pointer",marginTop:1}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=Y.accent+"40";e.currentTarget.style.color=Y.accent;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=Y.surfaceBorder;e.currentTarget.style.color=Y.textMuted;}}>+ add</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );})}
          </div>
        </div>

        {/* Add editor */}
        <div style={{marginTop:8}}>
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
        </div>

        {/* Footer */}
        <div style={{marginTop:24,padding:"14px 0",borderTop:"1px solid "+Y.surfaceBorder,display:"flex",gap:24,flexWrap:"wrap",fontSize:10,color:Y.textMuted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:0.5}}>
          <span>⬡ Sync Notion → auto pipeline</span>
          <span>⬡ Drag clients or chips</span>
          <span>⬡ Multiple videos per cell</span>
          <span>⬡ Slack Copy for weekly brief</span>
        </div>
      </div>
    </div>
  );
}

function YBtn({children,onClick,active,style:s}){
  return <button onClick={onClick} style={{
    background:active?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(245,158,11,0.04)",
    border:"1px solid "+(active?"#f59e0b":"rgba(245,158,11,0.12)"),
    color:active?"#000":"#92400e",padding:"7px 14px",borderRadius:9,fontSize:11,
    cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:active?800:600,transition:"all .15s",
    boxShadow:active?"0 0 18px rgba(245,158,11,0.3)":"none",...s
  }}>{children}</button>;
}
function YStat({label,value,color}){
  return(<div style={{background:"rgba(245,158,11,0.03)",border:"1px solid rgba(245,158,11,0.08)",borderRadius:10,padding:"8px 16px",display:"flex",flexDirection:"column",gap:2,minWidth:64}}>
    <span style={{fontSize:9,color:"#78350f",letterSpacing:1.5,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{label}</span>
    <span style={{fontSize:18,fontWeight:800,color:color||"#fef3c7",fontFamily:"'JetBrains Mono',monospace"}}>{value}</span>
  </div>);
}
function cntB(co){return{background:"rgba(0,0,0,0.3)",border:"1px solid "+co.border+"18",borderRadius:6,width:26,height:26,color:co.text,cursor:"pointer",fontSize:14,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"};}
const inp={background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:7,padding:"6px 10px",color:"#fef3c7",fontSize:12,fontFamily:"'Outfit',sans-serif",width:130,outline:"none",transition:"border-color .2s"};
